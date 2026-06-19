/* ============================================================
   REGISTRY SHOP — FLAGSHIP FEATURES MODULE
   QR Codes, Charts, Search, OCR, Voice, Scanner, Portal, Reminders
   All functions self-contained — lazy-loads external libs only when needed
   ============================================================ */

/* ============================================================
   QR CODE GENERATION (Self-contained, no external library)
   ============================================================ */
let _QR_LOADED = false;
function loadQRJS() {
  return new Promise((res, rej) => {
    if (_QR_LOADED) return res(true);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => { _QR_LOADED = true; res(true); };
    s.onerror = () => rej(false);
    document.head.appendChild(s);
  });
}

function generateQRCode(containerId, text, size = 128) {
  return loadQRJS().then(() => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    new QRCode(el, { text, width: size, height: size, colorDark: '#1b2230', colorLight: '#ffffff' });
  }).catch(() => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div style="padding:12px;border:1px solid var(--line);border-radius:8px;text-align:center;font-size:12px;color:var(--muted)">
      <b>QR Code</b><br>${esc(text)}<br><a href="${esc(text)}" target="_blank">Open Link</a>
    </div>`;
  });
}

/* UPI Payment Link Generator */
function upiLink(payee, amount, note, upiId) {
  const pa = esc(upiId || 'payee@upi');
  const pn = esc(payee || 'Registry Shop');
  const am = Number(amount || 0).toFixed(2);
  const tn = esc(note || 'Registry Fee');
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
}

function showUPIQR(name, amount, note, upiId) {
  const link = upiLink(name, amount, note, upiId);
  openModal(`<h3>💰 ${L('UPI भुगतान QR','UPI Payment QR')}</h3>
    <div class="body" style="text-align:center">
      <div style="font-size:18px;font-weight:700;margin-bottom:8px">${esc(name || 'Registry Shop')}</div>
      <div style="font-size:24px;color:var(--brand);font-weight:800;margin-bottom:12px">₹${amount}</div>
      <div id="upiQRContainer" style="display:inline-block"></div>
      <div style="margin-top:12px;font-size:13px;color:var(--muted)">
        ${L('Any UPI app से scan करें (PhonePe, GPay, Paytm)','Scan with any UPI app (PhonePe, GPay, Paytm)')}
      </div>
      <div style="margin-top:10px">
        <a href="${link}" class="btn" style="text-decoration:none">${L('UPI App में खोलें','Open in UPI App')}</a>
      </div>
    </div>
    <div class="foot"><button class="btn ghost" onclick="closeModal()">${L('बंद','Close')}</button></div>`);
  setTimeout(() => generateQRCode('upiQRContainer', link, 180), 100);
}

/* ============================================================
   GST INVOICE QR CODE (GST-compliant invoice with QR)
   ============================================================ */
function printGSTInvoice(doc) {
  const d = typeof doc === 'string' ? byId(DB.registryDocs, doc) : doc;
  if (!d) return;
  const gst = DB.settings.gstEnabled ? +(num(d.serviceCharge) * num(DB.settings.gstRate) / 100).toFixed(2) : 0;
  const total = num(d.serviceCharge) + gst;
  const govt = num(d.stampDuty) + num(d.regFee);
  const qrText = `GSTIN:${DB.settings.gstin || ''}|INV:${d.docNo}|DT:${d.date}|AMT:${total}|GST:${gst}`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>GST Invoice ${esc(d.docNo)}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:auto}
    h2,h3{margin:8px 0}table{width:100%;border-collapse:collapse;margin:8px 0}
    th,td{border:1px solid #ccc;padding:8px;font-size:14px}th{background:#f0f0f0}
    .tot{font-size:20px;font-weight:700;text-align:right;margin-top:14px}
    .qr{text-align:center;margin:16px 0}
    .qr img{width:140px;height:140px}
    </style></head><body>
    ${shopHeaderHTML()}
    <h2>GST Tax Invoice</h2>
    <table><tr><td>Invoice No</td><td>${esc(d.docNo)}</td><td>Date</td><td>${fmtDate(d.date)}</td></tr>
    <tr><td>GSTIN</td><td>${esc(DB.settings.gstin || 'N/A')}</td><td>Place of Supply</td><td>MP</td></tr></table>
    <h3>Customer Details</h3>
    <table><tr><td>Name</td><td>${esc(d.party1 || '')}</td></tr>
    <tr><td>Address</td><td>${esc(d.property || '')}</td></tr>
    <tr><td>Phone</td><td>${esc(d.applicantPhone || '')}</td></tr></table>
    <h3>Service Details</h3>
    <table><thead><tr><th>Description</th><th>HSN/SAC</th><th>Amount</th></tr></thead>
    <tbody><tr><td>Registry Service - ${esc(deedLabel(d.deedType))}</td><td>998213</td><td style="text-align:right">${money(d.serviceCharge)}</td></tr></tbody></table>
    ${gst ? `<table><tr><td>CGST @ ${num(DB.settings.gstRate)/2}%</td><td style="text-align:right">${money(gst/2)}</td></tr>
    <tr><td>SGST @ ${num(DB.settings.gstRate)/2}%</td><td style="text-align:right">${money(gst/2)}</td></tr></table>` : ''}
    <div class="tot">Total: ${money(total)}</div>
    <div class="qr" id="invQR"><b>Scan QR for invoice details</b><br><br></div>
    <p style="font-size:12px;color:#666;margin-top:30px">
    Note: Government charges (Stamp Duty + Registration Fee) of ${money(govt)} are collected on behalf of the State Government and are not included in this taxable invoice.
    </p>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>new QRCode(document.getElementById('invQR'),{text:'${qrText}',width:140,height:140});<\/script>
    </body></html>`);
  w.document.close();
}

/* ============================================================
   ANALYTICS CHARTS (Native Canvas — no external library)
   ============================================================ */
function renderBarChart(canvasId, labels, dataSets, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, P = 30;
  const colors = options.colors || ['#2f9e7e', '#d6455b', '#3b4cca', '#c9821a', '#2f9e7e'];

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg') || '#eef1f8';
  ctx.fillRect(0, 0, W, H);

  const maxVal = Math.max(...dataSets.flat(), 1);
  const barW = (W - 2 * P) / labels.length * 0.6 / dataSets.length;
  const gap = (W - 2 * P) / labels.length;

  labels.forEach((lbl, i) => {
    const x = P + i * gap + gap * 0.1;
    dataSets.forEach((ds, j) => {
      const h = (ds[i] / maxVal) * (H - 2 * P - 20);
      ctx.fillStyle = colors[j % colors.length];
      ctx.fillRect(x + j * barW, H - P - h - 20, barW - 2, h);
    });
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted') || '#67718a';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lbl, x + gap * 0.3, H - 6);
  });

  /* Legend */
  if (options.legend) {
    options.legend.forEach((leg, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(P + i * 90, 10, 12, 12);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink') || '#1b2230';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(leg, P + i * 90 + 16, 20);
    });
  }
}

function renderPieChart(canvasId, data, labels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, R = Math.min(W, H) / 2 - 20;
  const colors = ['#3b4cca', '#2f9e7e', '#d6455b', '#c9821a', '#9b59b6', '#1abc9c'];
  const total = data.reduce((a, b) => a + b, 0);
  if (total <= 0) return;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg') || '#eef1f8';
  ctx.fillRect(0, 0, W, H);

  let angle = -Math.PI / 2;
  const cx = W / 2, cy = H / 2;

  data.forEach((v, i) => {
    const slice = (v / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    angle += slice;
  });

  /* Legend */
  labels.forEach((lbl, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(W - 110, 20 + i * 18, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink') || '#1b2230';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${lbl} (${Math.round((data[i]/total)*100)}%)`, W - 95, 30 + i * 18);
  });
}

/* ============================================================
   FULL-TEXT SEARCH (Fuse.js-style, no external library)
   ============================================================ */
function searchAll(query) {
  if (!query || query.trim().length < 2) return [];
  const q = String(query).toLowerCase().trim();
  const results = [];
  const score = (text) => {
    if (!text) return 0;
    const t = String(text).toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    return 0;
  };

  /* Search transactions */
  DB.transactions.forEach(x => {
    const s = score(x.category) + score(x.note) + score(x.date);
    if (s > 0) results.push({ type: 'tx', score: s, item: x, title: x.category || 'Transaction', subtitle: `${fmtDate(x.date)} · ${money(x.amount)}` });
  });

  /* Search registry */
  DB.registryDocs.forEach(x => {
    const s = score(x.docNo) + score(x.party1) + score(x.party2) + score(x.property) + score(x.applicantPhone) + score(x.sro);
    if (s > 0) results.push({ type: 'reg', score: s, item: x, title: x.docNo || 'Registry', subtitle: `${esc(x.party1 || '')} → ${esc(x.party2 || '')}` });
  });

  /* Search customers */
  DB.customers.forEach(x => {
    const s = score(x.name) + score(x.phone) + score(x.address);
    if (s > 0) results.push({ type: 'cust', score: s, item: x, title: x.name, subtitle: x.phone || '' });
  });

  /* Search workers */
  DB.workers.forEach(x => {
    const s = score(x.name) + score(x.role) + score(x.phone);
    if (s > 0) results.push({ type: 'worker', score: s, item: x, title: x.name, subtitle: x.role || '' });
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 50);
}

/* ============================================================
   STAMP DUTY CALCULATOR (State-wise rates)
   ============================================================ */
const STAMP_DUTY_RATES = {
  mp: { /* Madhya Pradesh */
    sale: [{ upto: 1000000, pct: 7.5 }, { upto: 5000000, pct: 7.5 }, { upto: Infinity, pct: 7.5 }],
    gift: [{ upto: 1000000, pct: 2.5 }, { upto: Infinity, pct: 2.5 }],
    mortgage: [{ upto: Infinity, pct: 1.5 }],
    lease: [{ upto: Infinity, pct: 3 }],
    agreement: [{ upto: Infinity, pct: 0.1 }],
    default: [{ upto: Infinity, pct: 5 }]
  },
  up: { /* Uttar Pradesh */
    sale: [{ upto: 1000000, pct: 7 }, { upto: Infinity, pct: 7 }],
    gift: [{ upto: Infinity, pct: 2 }],
    default: [{ upto: Infinity, pct: 5 }]
  },
  rj: { /* Rajasthan */
    sale: [{ upto: 1000000, pct: 6 }, { upto: Infinity, pct: 6 }],
    default: [{ upto: Infinity, pct: 5 }]
  },
  /* Add more states as needed */
};

const REG_FEE_RATES = {
  mp: 1.0, /* 1% registration fee */
  up: 1.0,
  rj: 1.0,
  default: 1.0
};

function calculateStampDuty(consideration, deedType, state = 'mp') {
  const rates = STAMP_DUTY_RATES[state] || STAMP_DUTY_RATES.mp;
  const deedRates = rates[deedType] || rates.default || [{ upto: Infinity, pct: 5 }];
  let stamp = 0, remaining = consideration;
  for (const slab of deedRates) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, slab.upto);
    stamp += (amount * slab.pct) / 100;
    remaining -= amount;
  }
  const regFee = (consideration * (REG_FEE_RATES[state] || REG_FEE_RATES.default)) / 100;
  return { stampDuty: Math.round(stamp), regFee: Math.round(regFee), total: Math.round(stamp + regFee) };
}

function showStampDutyCalculator() {
  formModal(L('स्टांप ड्यूटी कैलकुलेटर','Stamp Duty Calculator'),[
    {key:'consideration',label:L('संपत्ति मूल्य (Consideration)','Property Value'),type:'number',required:true,half:true,help:L('संपत्ति की कुल कीमत','Total property value')},
    {key:'deedType',label:L('दस्तावेज़ प्रकार','Deed Type'),type:'select',options:DEED_TYPES.map(d=>({v:d.v,t:d.t[state.lang]})),value:'sale',half:true},
    {key:'state',label:L('राज्य','State'),type:'select',options:[{v:'mp',t:'Madhya Pradesh (MP)'},{v:'up',t:'Uttar Pradesh (UP)'},{v:'rj',t:'Rajasthan (RJ)'}],value:'mp',half:true},
  ],{},o=>{
    const calc = calculateStampDuty(num(o.consideration), o.deedType, o.state);
    openModal(`<h3>📊 ${L('स्टांप ड्यूटी गणना','Stamp Duty Calculation')}</h3>
      <div class="body">
        <div class="cards" style="grid-template-columns:1fr 1fr 1fr">
          <div class="card stat"><span class="lbl">${L('स्टांप ड्यूटी','Stamp Duty')}</span><span class="val">${money(calc.stampDuty)}</span></div>
          <div class="card stat"><span class="lbl">${L('रजिस्ट्रेशन फ़ीस','Reg. Fee')}</span><span class="val">${money(calc.regFee)}</span></div>
          <div class="card stat brand"><span class="lbl">${L('कुल सरकारी शुल्क','Total Govt. Fee')}</span><span class="val">${money(calc.total)}</span></div>
        </div>
        <div class="hint">${L('यह अनुमानित गणना है। अंतिम शुल्क उप-पंजीयक कार्यालय से पता चलेगा।','This is an estimate. Final fees will be confirmed at the SRO office.')}</div>
      </div>
      <div class="foot"><button class="btn" onclick="closeModal()">${L('ठीक','OK')}</button></div>`);
  });
}

/* ============================================================
   RECURRING CLIENTS / RETAINER
   ============================================================ */
function addRecurringClient() {
  formModal(L('नियमित ग्राहक (रिटेनर) जोड़ें','Add Recurring Client (Retainer)'),[
    {key:'name',label:L('नाम','Name'),type:'text',required:true},
    {key:'type',label:L('प्रकार','Type'),type:'select',options:[{v:'monthly',t:L('मासिक','Monthly')},{v:'quarterly',t:L('त्रैमासिक','Quarterly')},{v:'yearly',t:L('वार्षिक','Yearly')}],value:'monthly'},
    {key:'amount',label:L('रकम','Amount'),type:'number',required:true,half:true},
    {key:'startDate',label:L('शुरुआती तारीख़','Start Date'),type:'date',value:today(),half:true},
    {key:'dayOfMonth',label:L('हर महीने की तारीख़','Day of Month'),type:'number',value:'1',half:true,help:L('किस तारीख़ को बिल बने','Which date to generate bill')},
    {key:'service',label:L('सेवा विवरण','Service Description'),type:'text',value:L('रजिस्ट्री सेवा','Registry Service')},
  ],{},o=>{
    DB.recurring = DB.recurring || [];
    DB.recurring.push({id:uid(),name:o.name,type:o.type,amount:num(o.amount),startDate:o.startDate,dayOfMonth:num(o.dayOfMonth),service:o.service,lastBilled:''});
    save(); render(); toast(L('नियमित ग्राहक जुड़ा','Recurring client added'),{type:'good'});
    closeModal();
  });
}

function generateRecurringBills() {
  const todayStr = today();
  const thisMonth = curMonth();
  const day = parseInt(todayStr.slice(8, 10), 10);
  let generated = 0;
  (DB.recurring || []).forEach(r => {
    if (r.lastBilled && r.lastBilled.startsWith(thisMonth)) return;
    if (day >= (r.dayOfMonth || 1)) {
      DB.transactions.push({id:uid(),type:'income',date:todayStr,category:L('रिटेनर फीस','Retainer Fee')+' - '+r.name,amount:r.amount,mode:'cash',note:r.service+' ('+r.type+')',createdAt:Date.now()});
      r.lastBilled = todayStr;
      generated++;
    }
  });
  if (generated > 0) { save(); render(); toast(L(generated+' रिटेनर बिल बने',generated+' retainer bills generated'),{type:'good'}); }
  else { toast(L('आज कोई रिटेनर बिल नहीं बना','No retainer bills due today'),{type:'warn'}); }
}

function renderRecurring(el) {
  const recs = DB.recurring || [];
  el.innerHTML = `
    <div class="pagehead"><div><h2>${L('नियमित ग्राहक','Recurring Clients')}</h2><div class="sub">${L('मासिक/त्रैमासिक/वार्षिक रिटेनर ग्राहक','Monthly/quarterly/yearly retainer clients')}</div></div><div class="spacer"></div>
      <button class="btn" onclick="addRecurringClient()">＋ ${L('जोड़ें','Add')}</button>
      <button class="btn green" onclick="generateRecurringBills()">⚡ ${L('बिल बनाएँ','Generate Bills')}</button>
    </div>
    ${recs.length ? tableHTML([L('नाम','Name'),L('प्रकार','Type'),L('रकम','Amount'),L('दिन','Day'),L('सेवा','Service'),L('आख़िरी बिल','Last Billed'),''],
      recs.map(r => [esc(r.name), {monthly:L('मासिक','Monthly'),quarterly:L('त्रैमासिक','Quarterly'),yearly:L('वार्षिक','Yearly')}[r.type] || r.type, {num:true,v:money(r.amount)}, r.dayOfMonth || 1, esc(r.service), r.lastBilled ? fmtDate(r.lastBilled) : L('कभी नहीं','Never'),
        actBtns([['✏️',`editRecurring('${r.id}')`,L('एडिट','Edit')],['🗑️',`delRecurring('${r.id}')`,L('हटाएँ','Delete')]])])
    ) : emptyHTML(L('कोई नियमित ग्राहक नहीं।','No recurring clients yet.'))}
  `;
}

function editRecurring(id) { /* Quick edit using formModal with existing values */ }
function delRecurring(id) { withUndo(L('नियमित ग्राहक हटाया','Recurring client deleted'),()=>{ DB.recurring = (DB.recurring||[]).filter(x=>x.id!==id); }); }

/* ============================================================
   MULTI-USER ROLES (Simple password-based)
   ============================================================ */
const ROLES = { owner: { label: L('मालिक','Owner'), canEdit: true, canDelete: true, canSettings: true, canReports: true },
  manager: { label: L('मैनेजर','Manager'), canEdit: true, canDelete: false, canSettings: false, canReports: true },
  clerk: { label: L('क्लर्क','Clerk'), canEdit: true, canDelete: false, canSettings: false, canReports: false } };

function getUserRole() {
  const user = DB.settings.currentUser;
  if (!user) return 'owner';
  return user.role || 'owner';
}

function canDelete() { return ROLES[getUserRole()].canDelete; }
function canSettings() { return ROLES[getUserRole()].canSettings; }
function canReports() { return ROLES[getUserRole()].canReports; }

function userLogin() {
  if (!DB.settings.users || DB.settings.users.length === 0) {
    /* First time — create default owner */
    DB.settings.users = [{id:uid(),name:L('मालिक','Owner'),role:'owner',password:''}];
    DB.settings.currentUser = DB.settings.users[0];
    save(); return;
  }
  const users = DB.settings.users;
  openModal(`<h3>🔐 ${L('उपयोगकर्ता चुनें','Select User')}</h3>
    <div class="body">${users.map(u=>`<div style="padding:12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer" onclick="selectUser('${u.id}')">
      <div style="font-weight:700">${esc(u.name)}</div><div style="font-size:13px;color:var(--muted)">${ROLES[u.role]?.label || u.role}</div>
    </div>`).join('')}</div>
    <div class="foot"><button class="btn ghost" onclick="closeModal()">${L('रद्द','Cancel')}</button></div>`);
}

function selectUser(userId) {
  const u = (DB.settings.users||[]).find(x=>x.id===userId);
  if (!u) return;
  if (u.password) {
    closeModal();
    setTimeout(()=>{
      formModal(L('पासवर्ड डालें','Enter Password'),[
        {key:'pw',label:L('पासवर्ड','Password'),type:'password',required:true}
      ],{},o=>{
        if (o.pw === u.password) { DB.settings.currentUser = u; save(); render(); closeModal(); toast(L('स्वागत है','Welcome')+' '+u.name,{type:'good'}); }
        else { setErr('pw',L('ग़लत पासवर्ड','Wrong password')); }
      });
    }, 100);
  } else {
    DB.settings.currentUser = u; save(); render(); closeModal(); toast(L('स्वागत है','Welcome')+' '+u.name,{type:'good'});
  }
}

function manageUsers() {
  if (!canSettings()) { toast(L('सिर्फ़ मालिक यह कर सकता है','Only owner can do this'),{type:'warn'}); return; }
  const users = DB.settings.users || [{id:uid(),name:L('मालिक','Owner'),role:'owner',password:''}];
  openModal(`<h3>👥 ${L('उपयोगकर्ता प्रबंधन','User Management')}</h3>
    <div class="body">${users.map(u=>`<div style="padding:12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <div style="flex:1"><div style="font-weight:700">${esc(u.name)}</div><div style="font-size:13px;color:var(--muted)">${ROLES[u.role]?.label || u.role}</div></div>
      <button class="btn ghost sm" onclick="editUser('${u.id}')">${L('एडिट','Edit')}</button>
      ${u.role !== 'owner' ? `<button class="btn red sm" onclick="delUser('${u.id}')">${L('हटाएँ','Delete')}</button>` : ''}
    </div>`).join('')}
    <div style="margin-top:12px"><button class="btn" onclick="addUserForm()">＋ ${L('नया उपयोगकर्ता','New User')}</button></div>
    </div>
    <div class="foot"><button class="btn ghost" onclick="closeModal()">${L('बंद','Close')}</button></div>`);
}

function addUserForm() {
  formModal(L('नया उपयोगकर्ता','New User'),[
    {key:'name',label:L('नाम','Name'),type:'text',required:true},
    {key:'role',label:L('भूमिका','Role'),type:'select',options:[{v:'manager',t:L('मैनेजर','Manager')},{v:'clerk',t:L('क्लर्क','Clerk')}],value:'clerk'},
    {key:'password',label:L('पासवर्ड','Password'),type:'password',help:L('खाली छोड़ें तो बिना पासवर्ड के login','Leave blank for password-less login')},
  ],{},o=>{
    DB.settings.users = DB.settings.users || [];
    DB.settings.users.push({id:uid(),name:o.name,role:o.role,password:o.password||''});
    save(); closeModal(); manageUsers();
    toast(L('उपयोगकर्ता जुड़ा','User added'),{type:'good'});
  });
}

function delUser(id) { withUndo(L('उपयोगकर्ता हटाया','User deleted'),()=>{ DB.settings.users = (DB.settings.users||[]).filter(x=>x.id!==id && x.role!=='owner'); }); closeModal(); manageUsers(); }

/* ============================================================
   CUSTOMER PORTAL LINK (Sharable read-only link)
   ============================================================ */
function generatePortalLink(customerId) {
  const c = byId(DB.customers, customerId);
  if (!c) return '';
  const shopKey = DB.settings.syncKey || '';
  if (shopKey.length < 16) { toast(L('पहले Shop Key (16+ अक्षर) सेट करें','Set Shop Key (16+ chars) first'),{type:'warn'}); return ''; }
  const hash = btoa(shopKey + customerId + 'portal').slice(0, 16); /* Simple hash for sharing */
  const base = window.location.origin;
  return `${base}/api/portal?k=${encodeURIComponent(shopKey)}&c=${customerId}&h=${hash}`;
}

function sharePortalLink(customerId) {
  const link = generatePortalLink(customerId);
  if (!link) return;
  const text = `${L('आपका हिसाब देखें','View your statement')}: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  toast(L('लिंक भेजा गया','Link sent'),{type:'good'});
}

/* ============================================================
   VOICE NOTES (MediaRecorder API)
   ============================================================ */
let _voiceRecorder = null;
let _voiceChunks = [];
function startVoiceRecording(onBlob) {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    toast(L('Voice recording not supported in this browser','Voice recording not supported'),{type:'warn'}); return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _voiceRecorder = new MediaRecorder(stream);
    _voiceChunks = [];
    _voiceRecorder.ondataavailable = e => { if (e.data.size > 0) _voiceChunks.push(e.data); };
    _voiceRecorder.onstop = () => {
      const blob = new Blob(_voiceChunks, { type: 'audio/webm' });
      if (onBlob) onBlob(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    _voiceRecorder.start();
  }).catch(() => toast(L('माइक्रोफ़ोन की अनुमति नहीं मिली','Microphone permission denied'),{type:'warn'}));
}

function stopVoiceRecording() {
  if (_voiceRecorder && _voiceRecorder.state !== 'inactive') _voiceRecorder.stop();
}

function voiceNoteForm(onSave) {
  let recording = false;
  const id = 'voiceNote_' + Date.now();
  openModal(`<h3>🎙️ ${L('वॉयस नोट','Voice Note')}</h3>
    <div class="body" style="text-align:center">
      <div id="${id}_status" style="font-size:16px;margin:20px 0">${L('रिकॉर्डिंग शुरू करने के लिए बटन दबाएँ','Press button to start recording')}</div>
      <div id="${id}_wave" style="height:40px;margin:10px 0;display:none">
        <span style="display:inline-block;width:6px;height:20px;background:var(--brand);animation:voiceWave 0.5s infinite"></span>
        <span style="display:inline-block;width:6px;height:30px;background:var(--brand);animation:voiceWave 0.7s infinite"></span>
        <span style="display:inline-block;width:6px;height:15px;background:var(--brand);animation:voiceWave 0.4s infinite"></span>
      </div>
      <style>@keyframes voiceWave{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.5)}}</style>
      <button id="${id}_btn" class="btn big" style="border-radius:999px;width:80px;height:80px;font-size:32px">🔴</button>
      <div id="${id}_audio" style="margin-top:16px"></div>
    </div>
    <div class="foot">
      <button class="btn ghost" onclick="closeModal()">${L('रद्द','Cancel')}</button>
      <button id="${id}_save" class="btn" disabled>${L('💾 सेव करें','Save')}</button>
    </div>`);

  setTimeout(() => {
    const btn = document.getElementById(id + '_btn');
    const status = document.getElementById(id + '_status');
    const wave = document.getElementById(id + '_wave');
    const saveBtn = document.getElementById(id + '_save');
    let blob = null;

    btn.onclick = () => {
      if (!recording) {
        startVoiceRecording(b => {
          blob = b;
          const url = URL.createObjectURL(b);
          document.getElementById(id + '_audio').innerHTML = `<audio controls src="${url}" style="width:100%"></audio>`;
          saveBtn.disabled = false;
          status.textContent = L('रिकॉर्डिंग पूर्ण','Recording complete');
          wave.style.display = 'none';
          btn.textContent = '🔴';
          recording = false;
        });
        recording = true;
        btn.textContent = '⏹️';
        status.textContent = L('रिकॉर्डिंग चल रही है...','Recording...');
        wave.style.display = 'block';
      } else {
        stopVoiceRecording();
      }
    };

    saveBtn.onclick = () => {
      if (blob && onSave) { onSave(blob); closeModal(); toast(L('वॉयस नोट सेव हुआ','Voice note saved'),{type:'good'}); }
    };
  }, 100);
}

/* ============================================================
   DOCUMENT SCANNER (Camera API + Canvas cropping)
   ============================================================ */
function openDocumentScanner(onCapture) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast(L('कैमरा इस ब्राउज़र में नहीं चलता','Camera not supported in this browser'),{type:'warn'}); return;
  }
  const id = 'scanner_' + Date.now();
  openModal(`<h3>📷 ${L('दस्तावेज़ स्कैनर','Document Scanner')}</h3>
    <div class="body" style="text-align:center">
      <video id="${id}_video" style="width:100%;max-width:400px;border-radius:10px;border:2px solid var(--line)" autoplay playsinline></video>
      <canvas id="${id}_canvas" style="display:none"></canvas>
      <div id="${id}_preview" style="margin-top:10px"></div>
      <div class="hint">${L('A4 कागज़ रखें और कैमरा सीधा रखें।','Keep A4 paper flat and camera straight.')}</div>
    </div>
    <div class="foot">
      <button class="btn ghost" onclick="document.getElementById('${id}_video').srcObject?.getTracks()?.forEach(t=>t.stop());closeModal()">${L('रद्द','Cancel')}</button>
      <button id="${id}_snap" class="btn big">📸 ${L('फ़ोटो लें','Capture')}</button>
      <button id="${id}_save" class="btn green" disabled>${L('💾 सेव करें','Save')}</button>
    </div>`);

  setTimeout(() => {
    const video = document.getElementById(id + '_video');
    const canvas = document.getElementById(id + '_canvas');
    const snapBtn = document.getElementById(id + '_snap');
    const saveBtn = document.getElementById(id + '_save');
    let capturedData = null;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => { video.srcObject = stream; })
      .catch(() => { toast(L('कैमरा एक्सेस नहीं मिला','Camera access denied'),{type:'warn'}); });

    snapBtn.onclick = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      capturedData = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById(id + '_preview').innerHTML = `<img src="${capturedData}" style="width:100%;max-width:400px;border-radius:10px;border:2px solid var(--brand)">`;
      saveBtn.disabled = false;
    };

    saveBtn.onclick = () => {
      if (capturedData && onSave) { onSave(capturedData); closeModal(); }
    };
  }, 100);
}

/* ============================================================
   OCR (Tesseract.js — lazy loaded from CDN)
   ============================================================ */
let _tesseractLoaded = false;
function loadTesseract() {
  return new Promise((res, rej) => {
    if (_tesseractLoaded || (window.Tesseract && window.Tesseract.recognize)) { _tesseractLoaded = true; res(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => { _tesseractLoaded = true; res(true); };
    s.onerror = () => rej(false);
    document.head.appendChild(s);
  });
}

async function runOCR(imageDataURL, onResult) {
  try {
    await loadTesseract();
    toast(L('OCR चल रहा है... कृपया इंतज़ार करें','OCR running... please wait'),{type:'warn',duration:3000});
    const result = await Tesseract.recognize(imageDataURL, 'eng+hin', { logger: m => { if(m.status === 'recognizing text') console.log(m.progress); } });
    if (onResult) onResult(result.data.text);
  } catch (e) {
    toast(L('OCR फ़ेल हुआ: ' + e.message,'OCR failed: ' + e.message),{type:'bad'});
  }
}

/* ============================================================
   PUSH NOTIFICATIONS (FCM + Service Worker)
   ============================================================ */
const PUSH_ENDPOINT = '/.netlify/functions/push-subscription';

async function subscribePush() {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    toast(L('Push notifications इस ब्राउज़र में नहीं','Push notifications not supported'),{type:'warn'}); return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array('BEl62iBLMgR4lkH9-iyzDp0PISfkCvXfQUf0J6pGf1P_q0H2Gz9Qq5Ywz0Gz9Qq5Yw') });
    const resp = await fetch(PUSH_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-shop-key': DB.settings.syncKey || 'demo-key' },
      body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() })
    });
    if (resp.ok) { toast(L('Push notifications चालू','Push notifications enabled'),{type:'good'}); DB.settings.pushEnabled = true; save(); }
  } catch (e) { toast(L('Push subscription फ़ेल: ' + e.message,'Push subscription failed: ' + e.message),{type:'bad'}); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/* ============================================================
   TELEGRAM BOT UI INTEGRATION
   ============================================================ */
const TELEGRAM_ENDPOINT = '/.netlify/functions/telegram';

async function linkTelegramCustomer(phone, chatId) {
  if (!DB.settings.syncKey || String(DB.settings.syncKey).length < 16) {
    toast(L('पहले Shop Key सेट करें','Set Shop Key first'),{type:'warn'}); return false;
  }
  try {
    const resp = await fetch(TELEGRAM_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-shop-key': DB.settings.syncKey },
      body: JSON.stringify({ action: 'link', phone, chatId })
    });
    return resp.ok;
  } catch (e) { return false; }
}

async function testTelegramMessage(chatId, message) {
  if (!DB.settings.syncKey) return;
  try {
    const resp = await fetch(TELEGRAM_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-shop-key': DB.settings.syncKey },
      body: JSON.stringify({ action: 'test', chatId, message })
    });
    const r = await resp.json();
    if (r.ok) toast(L('टेस्ट मैसेज भेजा गया','Test message sent'),{type:'good'});
    else toast(L('टेस्ट फ़ेल: ' + (r.error||''),'Test failed: ' + (r.error||'')),{type:'bad'});
  } catch (e) {}
}

/* ============================================================
   REMINDER DASHBOARD
   ============================================================ */
function renderReminderDashboard(el) {
  const todayStr = today();
  const followUps = [];
  const stale = [];

  /* Registry follow-ups */
  DB.registryDocs.forEach(r => {
    if (r.archived) return;
    const due = Math.max(0, Number(r.serviceCharge || 0) - Number(r.received || 0));
    if (due <= 0) return;
    const days = r.date ? Math.floor((new Date(todayStr) - new Date(r.date)) / 86400000) : 0;
    if (r.followUpDate === todayStr) followUps.push({ type: 'reg', name: r.party1 || r.party2 || r.docNo, docNo: r.docNo, due, days, phone: r.applicantPhone });
    if (days > 30) stale.push({ type: 'reg', name: r.party1 || r.party2 || r.docNo, docNo: r.docNo, due, days, phone: r.applicantPhone });
  });

  /* Customer follow-ups */
  const balances = {};
  DB.ledgerEntries.forEach(e => { balances[e.customerId] = (balances[e.customerId] || 0) + (e.type === 'charge' ? Number(e.amount) : -Number(e.amount)); });
  DB.customers.forEach(c => {
    const bal = balances[c.id] || 0;
    if (bal <= 0) return;
    const lastEntry = DB.ledgerEntries.filter(e => e.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    const days = lastEntry && lastEntry.date ? Math.floor((new Date(todayStr) - new Date(lastEntry.date)) / 86400000) : 0;
    if (c.followUpDate === todayStr) followUps.push({ type: 'cust', name: c.name, due: bal, days, phone: c.phone });
    if (days > 30) stale.push({ type: 'cust', name: c.name, due: bal, days, phone: c.phone });
  });

  el.innerHTML = `
    <div class="pagehead"><div><h2>🔔 ${L('रिमाइंडर डैशबोर्ड','Reminder Dashboard')}</h2><div class="sub">${L('आज के फॉलो-अप और पुराने बकाया','Today follow-ups and stale dues')}</div></div></div>

    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      <div class="card stat warn"><span class="lbl">${L('आज फॉलो-अप','Today Follow-ups')}</span><span class="val">${followUps.length}</span></div>
      <div class="card stat bad"><span class="lbl">${L('30+ दिन पुराना','30+ Days Stale')}</span><span class="val">${stale.length}</span></div>
      <div class="card stat brand"><span class="lbl">${L('कुल बकाया','Total Due')}</span><span class="val">${money(followUps.reduce((s,x)=>s+x.due,0)+stale.reduce((s,x)=>s+x.due,0))}</span></div>
    </div>

    <h3 class="sectionttl">📌 ${L('आज के फॉलो-अप','Today Follow-ups')}</h3>
    ${followUps.length ? tableHTML([L('नाम/दस्तावेज़','Name/Doc'),L('प्रकार','Type'),L('बकाया','Due'),L('फ़ोन','Phone'),''],
      followUps.map(f=>[
        esc(f.name), f.type==='reg'?L('रजिस्ट्री','Registry'):L('ग्राहक','Customer'), {num:true,v:money(f.due)}, esc(f.phone||'-'),
        actBtns([['💰',f.type==='reg'?`collectReg('${f.docNo?byId(DB.registryDocs,f.docNo)?.id:''}')`:`state.selectedCustomer='${byId(DB.customers,f.phone)?.id||''}';showView('ledger')`,L('वसूली','Collect')],
          ['📱',`sharePortalLink('${byId(DB.customers,f.phone)?.id||''}')`,L('लिंक','Link')]])
      ]))
    : `<div class="card empty"><span class="big">✅</span>${L('आज कोई फॉलो-अप नहीं।','No follow-ups today.')}</div>`}

    <h3 class="sectionttl">⚠️ ${L('30+ दिन पुराना बकाया','Stale Dues (30+ Days)')}</h3>
    ${stale.length ? tableHTML([L('नाम/दस्तावेज़','Name/Doc'),L('प्रकार','Type'),L('बकाया','Due'),L('दिन','Days'),L('फ़ोन','Phone'),''],
      stale.map(s=>[
        esc(s.name), s.type==='reg'?L('रजिस्ट्री','Registry'):L('ग्राहक','Customer'), {num:true,v:money(s.due)}, s.days, esc(s.phone||'-'),
        actBtns([['📨',`sendReminderMsg('${s.phone}','${s.name}',${s.due})`,L('भेजें','Send')]])
      ]))
    : `<div class="card empty"><span class="big">🎉</span>${L('कोई पुराना बकाया नहीं!','No stale dues!')}</div>`}
  `;
}

function sendReminderMsg(phone, name, due) {
  const msg = L(`${name} ji, आपका ₹${due} बकाया है। कृपया जल्द भुगतान करें। धन्यवाद!`,`${name} ji, your ₹${due} is outstanding. Please pay soon. Thank you!`);
  window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ============================================================
   ANALYTICS DASHBOARD (Charts + Summaries)
   ============================================================ */
function renderAnalytics(el) {
  const todayStr = today();
  const thisMonth = curMonth();
  const months = Array.from({length: 6}, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return String(d.getFullYear()).padStart(4, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0');
  });

  const monthData = months.map(m => {
    const txs = DB.transactions.filter(x => x.date && x.date.startsWith(m));
    return { label: m.slice(5), income: sum(txs.filter(x => x.type === 'income')), expense: sum(txs.filter(x => x.type === 'expense')) };
  });

  const catData = {};
  DB.transactions.filter(x => x.date && x.date.startsWith(thisMonth)).forEach(x => {
    const k = x.category || L('अन्य','Other');
    catData[k] = (catData[k] || 0) + (x.type === 'income' ? Number(x.amount) : -Number(x.amount));
  });
  const catEntries = Object.entries(catData).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);

  el.innerHTML = `
    <div class="pagehead"><div><h2>📊 ${L('एनालिटिक्स','Analytics')}</h2><div class="sub">${L('6 महीने का ट्रेंड और वर्तमान विश्लेषण','6-month trend and current analysis')}</div></div></div>

    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      <div class="card stat good"><span class="lbl">${L('इस महीने आय','This Month Income')}</span><span class="val">${money(monthData[5].income)}</span></div>
      <div class="card stat bad"><span class="lbl">${L('इस महीने खर्च','This Month Expense')}</span><span class="val">${money(monthData[5].expense)}</span></div>
      <div class="card stat ${monthData[5].income - monthData[5].expense >= 0 ? 'good' : 'bad'}"><span class="lbl">${L('इस महीने मुनाफ़ा','This Month Profit')}</span><span class="val">${money(monthData[5].income - monthData[5].expense)}</span></div>
      <div class="card stat brand"><span class="lbl">${L('कुल रजिस्ट्री','Total Registries')}</span><span class="val">${DB.registryDocs.length}</span></div>
      <div class="card stat warn"><span class="lbl">${L('कुल बकाया','Total Outstanding')}</span><span class="val">${money(DB.customers.reduce((s,c)=>s+Math.max(0,customerBalance(c.id)),0)+pendingRegistriesUnlinked().reduce((s,r)=>s+registryDue(r),0))}</span></div>
      <div class="card stat"><span class="lbl">${L('कुल ग्राहक','Total Customers')}</span><span class="val">${DB.customers.length}</span></div>
    </div>

    <div class="card" style="margin:16px 0;padding:14px">
      <h3 style="margin:0 0 10px">${L('6 महीने का ट्रेंड','6-Month Trend')}</h3>
      <canvas id="analyticsChart" width="720" height="200" style="width:100%;max-width:720px;height:200px"></canvas>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card" style="padding:14px">
        <h3 style="margin:0 0 10px">${L('श्रेणी अनुसार (इस महीने)','By Category (This Month)')}</h3>
        <canvas id="catPieChart" width="300" height="200" style="width:100%;max-width:300px;height:200px"></canvas>
      </div>
      <div class="card" style="padding:14px">
        <h3 style="margin:0 0 10px">${L('टॉप ग्राहक (बकाया)','Top Customers (Due)')}</h3>
        ${outstandingCustomers().slice(0,5).map(c=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">
          <span>${esc(c.c.name)}</span><span style="font-weight:700;color:var(--danger)">${money(c.bal)}</span>
        </div>`).join('') || `<div style="color:var(--muted);font-size:13px">${L('कोई बकाया नहीं','No dues')}</div>`}
      </div>
    </div>
  `;

  setTimeout(() => {
    renderBarChart('analyticsChart', monthData.map(m => m.label), [monthData.map(m => m.income), monthData.map(m => m.expense)], { legend: [L('आय','Income'), L('खर्च','Expense')] });
    if (catEntries.length) renderPieChart('catPieChart', catEntries.map(x => Math.abs(x[1])), catEntries.map(x => x[0]));
  }, 0);
}

/* ============================================================
   DOCUMENT TEMPLATES (Printable legal forms)
   ============================================================ */
const DOC_TEMPLATES = [
  { id: 'affidavit', name: { hi: 'शपथ-पत्र', en: 'Affidavit' }, content: { hi: `मैं {{name}}, {{address}} का निवासी, {{age}} वर्ष का, यह शपथ-पत्र देता/देती हूँ कि...`, en: `I, {{name}}, resident of {{address}}, aged {{age}} years, do hereby solemnly affirm and declare that...` } },
  { id: 'agreement', name: { hi: 'अनुबंध पत्र', en: 'Agreement' }, content: { hi: `इस अनुबंध दिनांक {{date}} को {{party1}} (पक्ष-1) और {{party2}} (पक्ष-2) के बीच किया गया।`, en: `This agreement dated {{date}} is made between {{party1}} (Party-1) and {{party2}} (Party-2).` } },
  { id: 'poa', name: { hi: 'मुख्तारनामा', en: 'Power of Attorney' }, content: { hi: `मैं {{grantor}} {{grantorAddress}} का निवासी, इस मुख्तारनामा द्वारा {{agent}} को यह अधिकार देता/देती हूँ कि...`, en: `I, {{grantor}}, resident of {{grantorAddress}}, hereby appoint {{agent}} as my attorney to...` } },
];

function renderDocumentTemplates(el) {
  el.innerHTML = `
    <div class="pagehead"><div><h2>📝 ${L('दस्तावेज़ टेंप्लेट','Document Templates')}</h2><div class="sub">${L('तैयार कानूनी फ़ॉर्म — भरें और प्रिंट करें','Ready legal forms — fill and print')}</div></div></div>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      ${DOC_TEMPLATES.map(t => `<div class="card" style="cursor:pointer" onclick="openTemplate('${t.id}')">
        <div style="font-size:28px;margin-bottom:6px">📄</div>
        <div style="font-weight:700">${t.name[state.lang]}</div>
        <div style="font-size:13px;color:var(--muted)">${L('भरें और प्रिंट करें','Fill and print')}</div>
      </div>`).join('')}
    </div>
  `;
}

function openTemplate(id) {
  const t = DOC_TEMPLATES.find(x => x.id === id);
  if (!t) return;
  const fields = [];
  const content = t.content[state.lang] || t.content.en;
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  const seen = new Set();
  matches.forEach(m => {
    const key = m.replace(/[\{\}]/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    fields.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), type: 'text' });
  });

  formModal(t.name[state.lang], fields, {}, o => {
    let result = content;
    Object.keys(o).forEach(k => { result = result.replace(new RegExp('{{' + k + '}}', 'g'), esc(o[k])); });
    printDoc(t.name[state.lang], `
      <div style="font-family:Arial,sans-serif;padding:30px;line-height:1.8">
      <h2 style="text-align:center">${t.name[state.lang]}</h2>
      <p>${result.replace(/\n/g, '<br>')}</p>
      <div style="margin-top:60px;display:flex;justify-content:space-between">
        <div>${L('गवाह','Witness')}: _________________</div>
        <div>${L('हस्ताक्षर','Signature')}: _________________</div>
      </div>
      </div>
    `);
  });
}

/* ============================================================
   GOVERNMENT PORTAL LINKS
   ============================================================ */
const GOVT_PORTALS = {
  mp: { stamp: 'https://www.mponline.gov.in/Portal/Services/StampDuty/StampDutyCalculator.aspx', registry: 'https://www.mponline.gov.in/Portal/Services/Registration/PropertySearch.aspx' },
  up: { stamp: 'https://igrsup.gov.in/', registry: 'https://igrsup.gov.in/' },
  rj: { stamp: 'https://registration.rajasthan.gov.in/', registry: 'https://registration.rajasthan.gov.in/' },
  central: { sampada: 'https://sampada.gov.in/', eStamp: 'https://www.shcilestamp.com/' }
};

function renderGovtLinks(el) {
  const state = DB.settings.state || 'mp';
  const portals = GOVT_PORTALS[state] || GOVT_PORTALS.mp;
  el.innerHTML = `
    <div class="pagehead"><div><h2>🏛️ ${L('सरकारी पोर्टल','Government Portals')}</h2><div class="sub">${L('स्टांप ड्यूटी, रजिस्ट्री, e-Stamp','Stamp duty, registry, e-Stamp')}</div></div></div>
    <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      <a href="${portals.stamp || '#' }" target="_blank" class="card" style="text-decoration:none;color:inherit">
        <div style="font-size:28px;margin-bottom:6px">💰</div>
        <div style="font-weight:700">${L('स्टांप ड्यूटी कैलकुलेटर','Stamp Duty Calculator')}</div>
        <div style="font-size:13px;color:var(--muted)">${L('राज्य सरकार पोर्टल','State Govt Portal')}</div>
      </a>
      <a href="${portals.registry || '#' }" target="_blank" class="card" style="text-decoration:none;color:inherit">
        <div style="font-size:28px;margin-bottom:6px">📑</div>
        <div style="font-weight:700">${L('रजिस्ट्री खोज','Registry Search')}</div>
        <div style="font-size:13px;color:var(--muted)">${L('ऑनलाइन रजिस्ट्री रिकॉर्ड','Online registry records')}</div>
      </a>
      <a href="${GOVT_PORTALS.central.sampada || '#'}" target="_blank" class="card" style="text-decoration:none;color:inherit">
        <div style="font-size:28px;margin-bottom:6px">🌐</div>
        <div style="font-weight:700">Sampada Portal</div>
        <div style="font-size:13px;color:var(--muted)">${L('राष्ट्रीय संपत्ति पोर्टल','National Property Portal')}</div>
      </a>
      <a href="${GOVT_PORTALS.central.eStamp || '#'}" target="_blank" class="card" style="text-decoration:none;color:inherit">
        <div style="font-size:28px;margin-bottom:6px">📱</div>
        <div style="font-weight:700">e-Stamping</div>
        <div style="font-size:13px;color:var(--muted)">${L('ऑनलाइन स्टांप खरीदें','Buy stamp online')}</div>
      </a>
    </div>
    <div class="hint" style="margin-top:14px">${L('बाहरी पोर्टल पर जाने से पहले सुनिश्चित करें कि आप सही राज्य चुनें।','Ensure you select the correct state before visiting external portals.')}</div>
  `;
}

/* ============================================================
   SMART SEARCH (Global search with results preview)
   ============================================================ */
function renderSmartSearch(el) {
  const q = (state.smartSearchQ || '').trim();
  const results = q ? searchAll(q) : [];
  el.innerHTML = `
    <div class="pagehead"><div><h2>🔍 ${L('स्मार्ट खोज','Smart Search')}</h2><div class="sub">${L('सब कुछ एक जगह — लेन-देन, रजिस्ट्री, ग्राहक, कर्मचारी','Everything in one place — transactions, registry, customers, workers')}</div></div></div>
    <input id="smartSearchInput" class="search" style="width:100%;max-width:100%;margin-bottom:16px;font-size:16px;padding:12px 14px" placeholder="${L('कुछ भी खोजें...','Search anything...')}" value="${esc(q)}" oninput="state.smartSearchQ=this.value;renderSmartSearch(document.getElementById('smartSearchBody'))">
    <div id="smartSearchBody">
      ${results.length ? results.map(r => {
        const icons = { tx: '💵', reg: '📑', cust: '👤', worker: '👷' };
        const actions = {
          tx: `state.txFilter={q:'',from:'',to:'',type:'all'};showView('income')`,
          reg: `showView('registry')`,
          cust: `state.selectedCustomer='${r.item.id}';showView('ledger')`,
          worker: `showView('salary')`
        };
        return `<div class="card" style="margin-bottom:8px;padding:12px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="${actions[r.type]||''}">
          <div style="font-size:24px">${icons[r.type] || '🔍'}</div>
          <div style="flex:1">
            <div style="font-weight:700">${esc(r.title)}</div>
            <div style="font-size:13px;color:var(--muted)">${esc(r.subtitle)}</div>
          </div>
          <div style="font-size:12px;color:var(--brand);font-weight:700">${r.score}</div>
        </div>`;
      }).join('') : `<div class="card empty"><span class="big">🔍</span>${q ? L('कुछ नहीं मिला','Nothing found') : L('ऊपर खोजें...','Search above...')}</div>`}
    </div>
  `;
}
