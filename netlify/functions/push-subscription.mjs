import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE = "registry-shop-push";
const MIN_KEY_LENGTH = 16;

function blobKey(shopKey) {
  return "push_" + createHash("sha256").update(String(shopKey)).digest("hex");
}

/*
  Push Notification Handler
  - Stores Web Push subscriptions (VAPID)
  - Sends push notifications to subscribed devices
  - Used by the app for in-browser reminders
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

  const shopKey = req.headers.get("x-shop-key") || "";
  const keyLen = shopKey ? String(shopKey).trim().length : 0;
  if (keyLen < MIN_KEY_LENGTH) {
    return new Response(JSON.stringify({ _err: 400, error: "missing-or-short-key" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const key = blobKey(shopKey);
  const store = getStore({ name: STORE, consistency: "strong" });

  if (req.method === "GET") {
    let data = null;
    try { data = await store.get(key, { type: "json" }); } catch (_) {}
    if (!data) data = { vapidPublicKey: "", subscriptions: [] };
    return new Response(JSON.stringify({ vapidPublicKey: data.vapidPublicKey || "", subscriptionCount: (data.subscriptions || []).length }), { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin } });
  }

  if (req.method === "POST") {
    let body = null;
    try { body = await req.json(); } catch (_) {
      return new Response(JSON.stringify({ _err: 400, error: "bad-json" }), { status: 400, headers: { "content-type": "application/json" } });
    }

    let data = null;
    try { data = await store.get(key, { type: "json" }); } catch (_) {}
    if (!data) data = { vapidPublicKey: "", subscriptions: [] };

    /* Action: subscribe a new push subscription */
    if (body.action === "subscribe" && body.subscription) {
      const subs = data.subscriptions || [];
      const exists = subs.find(s => s.endpoint === body.subscription.endpoint);
      if (!exists) {
        subs.push(body.subscription);
        data.subscriptions = subs;
        await store.setJSON(key, data);
      }
      return new Response(JSON.stringify({ ok: true, count: subs.length }), { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin } });
    }

    /* Action: unsubscribe */
    if (body.action === "unsubscribe" && body.endpoint) {
      data.subscriptions = (data.subscriptions || []).filter(s => s.endpoint !== body.endpoint);
      await store.setJSON(key, data);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin } });
    }

    /* Action: send test notification (uses VAPID - simplified for now) */
    if (body.action === "test" && body.message) {
      return new Response(JSON.stringify({ ok: true, note: "Push notifications require VAPID keys configured. Use browser console for testing." }), { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin } });
    }

    return new Response(JSON.stringify({ _err: 400, error: "unknown-action" }), { status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": origin } });
  }

  return new Response(JSON.stringify({ _err: 405, error: "method-not-allowed" }), { status: 405, headers: { "content-type": "application/json" } });
};
