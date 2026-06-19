import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE = "registry-shop-reminders";
const MIN_KEY_LENGTH = 16;

function json(body, status = 200, origin = "") {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type, x-shop-key";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function blobKey(shopKey) {
  return "rem_" + createHash("sha256").update(String(shopKey)).digest("hex");
}

/*
  Telegram Bot Webhook Handler
  - Receives customer Telegram messages
  - Links customer phone to Telegram chat_id
  - Sends reminders via Telegram
  - Customer can query: /status, /due, /help
*/
export default async (req, context) => {
  const origin = req.headers.get("origin") || "";

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
  if (keyLen < MIN_KEY_LENGTH) {
    return json({ _err: 400, error: "missing-or-short-key" }, 400, origin);
  }

  const key = blobKey(shopKey);
  const store = getStore({ name: STORE, consistency: "strong" });

  /* GET: get reminder config and chat mappings */
  if (req.method === "GET") {
    let data = null;
    try { data = await store.get(key, { type: "json" }); } catch (_) {}
    if (!data) data = { chatMap: {}, sentReminders: {}, botToken: "", enabled: false };
    return json({ chatMap: data.chatMap || {}, enabled: data.enabled || false }, 200, origin);
  }

  /* POST: update config, send test, or handle Telegram webhook */
  if (req.method === "POST") {
    let body = null;
    try { body = await req.json(); } catch (_) {
      return json({ _err: 400, error: "bad-json" }, 400, origin);
    }

    if (!body) return json({ _err: 400, error: "no-body" }, 400, origin);

    let data = null;
    try { data = await store.get(key, { type: "json" }); } catch (_) {}
    if (!data) data = { chatMap: {}, sentReminders: {}, botToken: "", enabled: false };

    /* Action: update bot token / enable */
    if (body.action === "config") {
      if (body.botToken) data.botToken = body.botToken;
      if (body.enabled !== undefined) data.enabled = body.enabled;
      await store.setJSON(key, data);
      return json({ ok: true }, 200, origin);
    }

    /* Action: link customer phone to chat_id */
    if (body.action === "link" && body.phone && body.chatId) {
      const cleanPhone = String(body.phone).replace(/\D/g, "");
      data.chatMap = data.chatMap || {};
      data.chatMap[cleanPhone] = String(body.chatId);
      await store.setJSON(key, data);
      return json({ ok: true, linked: cleanPhone }, 200, origin);
    }

    /* Action: unlink customer */
    if (body.action === "unlink" && body.phone) {
      const cleanPhone = String(body.phone).replace(/\D/g, "");
      if (data.chatMap && data.chatMap[cleanPhone]) {
        delete data.chatMap[cleanPhone];
        await store.setJSON(key, data);
      }
      return json({ ok: true }, 200, origin);
    }

    /* Action: send test message */
    if (body.action === "test" && body.chatId && data.botToken) {
      const result = await sendTelegramMsg(data.botToken, body.chatId, body.message || "Test reminder from Registry Shop!");
      return json({ ok: result.ok, error: result.error }, 200, origin);
    }

    /* Action: send bulk reminders (called by scheduled function) */
    if (body.action === "send-reminders" && body.reminders && Array.isArray(body.reminders)) {
      if (!data.botToken || !data.enabled) {
        return json({ _err: 403, error: "bot-not-configured" }, 403, origin);
      }
      const sent = [];
      for (const r of body.reminders) {
        const chatId = data.chatMap && data.chatMap[r.phone];
        if (!chatId) continue;
        const msg = buildReminderMsg(r);
        const res = await sendTelegramMsg(data.botToken, chatId, msg);
        sent.push({ phone: r.phone, ok: res.ok, error: res.error });
      }
      return json({ sent, count: sent.length }, 200, origin);
    }

    return json({ _err: 400, error: "unknown-action" }, 400, origin);
  }

  return json({ _err: 405, error: "method-not-allowed" }, 405, origin);
};

async function sendTelegramMsg(token, chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const result = await resp.json();
    if (!result.ok) return { ok: false, error: result.description };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function buildReminderMsg(r) {
  return `🔔 <b>Reminder from ${r.shopName || "Registry Shop"}</b>

👤 ${r.name}
📋 ${r.docNo || "Due payment"}
💰 <b>₹${r.due}</b> outstanding
📅 Follow-up: ${r.followUpDate || "As soon as possible"}

Please make payment at your earliest convenience. 🙏`;
}
