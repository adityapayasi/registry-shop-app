import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE = "registry-shop-sync";
const MIN_KEY_LENGTH = 16;
const MIN_LEGACY_KEY_LENGTH = 4;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const MAX_DATA_BYTES = 6 * 1024 * 1024;

// Simple in-memory rate limiter (resets on cold start, which is fine for a shop app)
const _hits = new Map();

function rateLimited(id, now) {
  const entry = _hits.get(id);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    _hits.set(id, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function json(body, status = 200, origin = "") {
  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type, x-shop-key";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function blobKey(shopKey) {
  return "shop_" + createHash("sha256").update(String(shopKey)).digest("hex");
}

export default async (req, context) => {
  const origin = req.headers.get("origin") || "";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-shop-key",
      },
    });
  }

  const shopKey = req.headers.get("x-shop-key");
  const keyLen = shopKey ? String(shopKey).trim().length : 0;

  if (keyLen < MIN_LEGACY_KEY_LENGTH) {
    return json({ _err: 400, error: "missing-or-short-key" }, 400, origin);
  }

  const key = blobKey(shopKey);

  if (rateLimited(key, Date.now())) {
    return json({ _err: 429, error: "rate-limited" }, 429, origin);
  }

  const store = getStore({ name: STORE, consistency: "strong" });

  // New short keys (< 16 chars) are rejected unless the shop already exists
  if (keyLen < MIN_KEY_LENGTH) {
    let exists = false;
    try {
      exists = (await store.get(key, { type: "json" })) != null;
    } catch (_) {
      exists = false;
    }
    if (!exists) {
      return json(
        { _err: 403, error: "weak-new-key", minLength: MIN_KEY_LENGTH },
        403,
        origin
      );
    }
  }

  /* ---------- GET: poll / read current state ---------- */
  if (req.method === "GET") {
    let current = null;
    try {
      current = await store.get(key, { type: "json" });
    } catch (_) {
      current = null;
    }
    if (!current || typeof current !== "object") {
      current = { rev: 0, data: null };
    }
    return json({ rev: current.rev || 0, data: current.data || null }, 200, origin);
  }

  /* ---------- POST: push / write ---------- */
  if (req.method === "POST") {
    let body = null;
    try {
      body = await req.json();
    } catch (_) {
      return json({ _err: 400, error: "bad-json" }, 400, origin);
    }

    if (!body || body.data == null) {
      return json({ _err: 400, error: "no-data" }, 400, origin);
    }

    const dataStr = String(body.data);
    if (dataStr.length > MAX_DATA_BYTES) {
      return json({ _err: 413, error: "data-too-large" }, 413, origin);
    }

    const incomingRev = body.rev;
    if (typeof incomingRev !== "number") {
      return json({ _err: 400, error: "bad-rev" }, 400, origin);
    }

    let current = null;
    let etag = null;
    try {
      const r = await store.getWithMetadata(key, { type: "json" });
      if (r) {
        current = r.data;
        etag = r.etag;
      }
    } catch (_) {
      current = null;
      etag = null;
    }

    if (!current || typeof current !== "object") {
      current = { rev: 0, data: null };
    }

    // Conflict: server has a different revision than what the client thinks
    if ((current.rev || 0) !== incomingRev) {
      return json(
        { conflict: true, rev: current.rev || 0, data: current.data || null },
        200,
        origin
      );
    }

    // Accept the push and bump revision
    const next = { rev: (current.rev || 0) + 1, data: body.data };
    const writeOpts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };

    let res;
    try {
      res = await store.setJSON(key, next, writeOpts);
    } catch (_) {
      res = { modified: false };
    }

    if (res && res.modified) {
      return json({ rev: next.rev }, 200, origin);
    }

    // Write failed (concurrent modification), return conflict
    return json(
      { conflict: true, rev: current.rev || 0, data: current.data || null },
      200,
      origin
    );
  }

  return json({ _err: 405, error: "method-not-allowed" }, 405, origin);
};
