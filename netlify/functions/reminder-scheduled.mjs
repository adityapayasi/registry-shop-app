import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE = "registry-shop-sync";
const REMINDER_STORE = "registry-shop-reminders";
const MIN_KEY_LENGTH = 16;

function blobKey(shopKey) {
  return "shop_" + createHash("sha256").update(String(shopKey)).digest("hex");
}
function remKey(shopKey) {
  return "rem_" + createHash("sha256").update(String(shopKey)).digest("hex");
}

/*
  Scheduled Function: Daily Reminder Check
  Runs every day at configured time (default 9:00 AM IST)
  Finds all customers with:
  - followUpDate == today
  - stale dues (30+ days)
  - And sends Telegram reminders
*/
export default async (req, context) => {
  /* Netlify scheduled functions are triggered by cron, not user requests */
  /* But we also allow manual trigger via POST for testing */
  const isScheduled = req.headers.get("x-netlify-event") === "schedule";

  if (!isScheduled && req.method !== "POST") {
    return new Response(JSON.stringify({ _err: 405, error: "schedule-only" }), { status: 405, headers: { "content-type": "application/json" } });
  }

  /* We need to iterate all shop keys. In practice, scheduled functions
     run per-site. For a multi-tenant store, we'd scan all keys. */
  const results = [];

  /* For now, manual trigger requires a shop key */
  let shopKey = "";
  try {
    if (!isScheduled) {
      const body = await req.json();
      shopKey = body.shopKey || "";
    }
  } catch (_) {}

  const syncStore = getStore({ name: STORE, consistency: "strong" });
  const remStore = getStore({ name: REMINDER_STORE, consistency: "strong" });

  /* Get all shops to check */
  let shopKeys = [];
  if (shopKey) {
    shopKeys = [shopKey];
  } else {
    /* Scan for all reminder configs to find active shops */
    try {
      const list = await remStore.list();
      for (const item of list) {
        if (item.key && item.key.startsWith("rem_")) {
          /* Extract is not possible from hash; we need another approach */
          /* In production, maintain a separate index of active shop keys */
        }
      }
    } catch (_) {}
  }

  if (shopKey) {
    const key = blobKey(shopKey);
    const remKeyHash = remKey(shopKey);

    let shopData = null, remData = null;
    try { shopData = await syncStore.get(key, { type: "json" }); } catch (_) {}
    try { remData = await remStore.get(remKeyHash, { type: "json" }); } catch (_) {}

    if (!shopData || !shopData.data) {
      return new Response(JSON.stringify({ _err: 404, error: "shop-not-found" }), { status: 404, headers: { "content-type": "application/json" } });
    }

    if (!remData || !remData.enabled || !remData.botToken) {
      return new Response(JSON.stringify({ status: "skipped", reason: "reminders-not-configured" }), { status: 200, headers: { "content-type": "application/json" } });
    }

    /* Decrypt shop data */
    let doc = null;
    try {
      doc = JSON.parse(shopData.data);
    } catch (_) {
      return new Response(JSON.stringify({ _err: 500, error: "cannot-parse-data" }), { status: 500, headers: { "content-type": "application/json" } });
    }

    /* Build reminders list */
    const today = new Date().toISOString().slice(0, 10);
    const reminders = [];

    /* Check registry docs for follow-ups and stale dues */
    if (doc.registryDocs) {
      for (const r of doc.registryDocs) {
        if (!r || r.archived) continue;
        const due = Math.max(0, Number(r.serviceCharge || 0) - Number(r.received || 0));
        if (due <= 0) continue;
        const daysOld = r.date ? Math.floor((new Date(today) - new Date(r.date)) / 86400000) : 0;
        const isFollowUp = r.followUpDate === today;
        const isStale = daysOld > 30;
        if (isFollowUp || isStale) {
          reminders.push({
            name: r.party1 || r.party2 || "Customer",
            phone: r.applicantPhone || "",
            docNo: r.docNo || "",
            due,
            followUpDate: r.followUpDate || "",
            daysOld,
            shopName: doc.settings?.shopName || "Registry Shop",
          });
        }
      }
    }

    /* Check ledger customers for stale dues */
    if (doc.customers && doc.ledgerEntries) {
      const balances = {};
      for (const e of doc.ledgerEntries) {
        if (!e || !e.customerId) continue;
        balances[e.customerId] = (balances[e.customerId] || 0) + (e.type === "charge" ? Number(e.amount || 0) : -Number(e.amount || 0));
      }
      for (const c of doc.customers) {
        if (!c) continue;
        const bal = balances[c.id] || 0;
        if (bal <= 0) continue;
        const lastEntry = doc.ledgerEntries
          .filter(e => e.customerId === c.id)
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
        const daysOld = lastEntry && lastEntry.date ? Math.floor((new Date(today) - new Date(lastEntry.date)) / 86400000) : 0;
        const isFollowUp = c.followUpDate === today;
        const isStale = daysOld > 30;
        if (isFollowUp || isStale) {
          /* Don't duplicate if already in reminders */
          const exists = reminders.find(x => x.phone === c.phone);
          if (!exists) {
            reminders.push({
              name: c.name || "Customer",
              phone: c.phone || "",
              docNo: "",
              due: bal,
              followUpDate: c.followUpDate || "",
              daysOld,
              shopName: doc.settings?.shopName || "Registry Shop",
            });
          }
        }
      }
    }

    /* Send reminders via Telegram */
    const sent = [];
    for (const r of reminders) {
      const chatId = remData.chatMap && remData.chatMap[r.phone.replace(/\D/g, "")];
      if (!chatId) continue;
      const msg = buildReminderMsg(r);
      const res = await sendTelegramMsg(remData.botToken, chatId, msg);
      sent.push({ phone: r.phone, ok: res.ok, error: res.error });
    }

    results.push({ shopKey: shopKey.slice(0, 4) + "...", remindersFound: reminders.length, sent: sent.length, details: sent });
  }

  return new Response(JSON.stringify({ status: "ok", isScheduled, results }), { status: 200, headers: { "content-type": "application/json" } });
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
  return `🔔 <b>Reminder from ${r.shopName}</b>

👤 ${r.name}
📋 ${r.docNo || "Due payment"}
💰 <b>₹${r.due}</b> outstanding
📅 ${r.followUpDate ? "Follow-up: " + r.followUpDate : "Due since " + r.daysOld + " days"}

Please make payment at your earliest convenience. 🙏`;
}
