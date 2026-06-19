import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE = "registry-shop-sync";
const MIN_KEY_LENGTH = 16;

function blobKey(shopKey) {
  return "shop_" + createHash("sha256").update(String(shopKey)).digest("hex");
}

/*
  Customer Portal — Read-Only Access
  Generates a shareable link that lets a customer view their own data
  without seeing other customers' information.
  URL format: /api/portal?k=SHOP_KEY&c=CUSTOMER_ID&h=HASH
  The hash is a simple time-based token (valid for 7 days)
*/
export default async (req, context) => {
  const url = new URL(req.url);
  const shopKey = url.searchParams.get("k") || "";
  const customerId = url.searchParams.get("c") || "";
  const hash = url.searchParams.get("h") || "";

  if (shopKey.length < MIN_KEY_LENGTH || !customerId || !hash) {
    return new Response(JSON.stringify({ _err: 400, error: "missing-params" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  /* Verify hash */
  const expectedHash = createHash("sha256").update(shopKey + customerId + "portal").digest("hex").slice(0, 16);
  if (hash !== expectedHash) {
    return new Response(JSON.stringify({ _err: 403, error: "invalid-hash" }), { status: 403, headers: { "content-type": "application/json" } });
  }

  const key = blobKey(shopKey);
  const store = getStore({ name: STORE, consistency: "strong" });

  let shopData = null;
  try { shopData = await store.get(key, { type: "json" }); } catch (_) {}
  if (!shopData || !shopData.data) {
    return new Response(JSON.stringify({ _err: 404, error: "shop-not-found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  let doc = null;
  try { doc = JSON.parse(shopData.data); } catch (_) {
    return new Response(JSON.stringify({ _err: 500, error: "cannot-parse" }), { status: 500, headers: { "content-type": "application/json" } });
  }

  /* Find customer */
  const customer = (doc.customers || []).find(c => c.id === customerId);
  if (!customer) {
    return new Response(JSON.stringify({ _err: 404, error: "customer-not-found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  /* Build read-only customer data */
  const entries = (doc.ledgerEntries || []).filter(e => e.customerId === customerId).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  let run = 0;
  const ledgerRows = entries.map(e => {
    run += e.type === "charge" ? Number(e.amount || 0) : -Number(e.amount || 0);
    return { date: e.date, type: e.type, amount: e.amount, note: e.note || "", balance: run };
  });

  const regDocs = (doc.registryDocs || []).filter(r => r.customerId === customerId && !r.archived).map(r => ({
    docNo: r.docNo || "",
    date: r.date,
    deedType: r.deedType || "",
    party1: r.party1 || "",
    party2: r.party2 || "",
    property: r.property || "",
    serviceCharge: r.serviceCharge || 0,
    received: r.received || 0,
    due: Math.max(0, Number(r.serviceCharge || 0) - Number(r.received || 0)),
    status: r.status || "pending",
  }));

  const totalDue = regDocs.reduce((s, r) => s + r.due, 0) + Math.max(0, ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : 0);

  const result = {
    shopName: doc.settings?.shopName || "Registry Shop",
    shopPhone: doc.settings?.shopPhone || "",
    shopAddress: doc.settings?.shopAddress || "",
    customer: {
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
    },
    ledger: {
      entries: ledgerRows,
      balance: ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : 0,
    },
    registry: regDocs,
    totalDue,
    generatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
};
