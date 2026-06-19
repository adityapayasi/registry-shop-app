# रजिस्ट्री दुकान — हिसाब-किताब (Registry Shop Bookkeeping App)

A clean, fully offline-first, bilingual (Hindi/English) bookkeeping app for a property-registry service shop. No install, no login — works in any modern browser. Data stays on your device by default.

## Features

| Feature | Description |
|---------|-------------|
| 🏠 Dashboard | Daily income/expense, net profit, cash in hand, month profit, total pending, bank balance |
| 💵 Income/Expense | Daily transactions with search, date/type filters, running totals |
| 📑 Registry | Document tracking — doc number, parties, mobile, SRO, govt vs service fees, payment status, one-click receipts |
| ⏳ Pending Dues | Combined view of udhaar + registry service fee dues |
| 📒 Udhaar Ledger | Customer credit tracking with running balance, printable statements |
| 👷 Salary | Worker list + salary payments (auto-adds to expenses) |
| 🏦 Bank | Account management, manual transactions + CSV/Excel import |
| 📊 Reports | Day/month/custom period reports with category & payment-mode breakdown, CSV + Excel export |
| ⚙️ Backup/Settings | Shop info, language toggle, backup download/restore, auto-save snapshots, multi-device sync |

## Deploy to Netlify (Recommended)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Build

```bash
npm run build
```

This copies `index.html` and all `public/` assets into the `dist/` folder.

### Step 3: Deploy

**Option A — Netlify CLI (Quickest)**

```bash
npx netlify login
npx netlify deploy --prod --dir=dist --functions=netlify/functions
```

**Option B — GitHub + Auto-Deploy**

1. Push this repo to GitHub
2. Go to [https://app.netlify.com](https://app.netlify.com) → "Add new site" → "Import from GitHub"
3. Select this repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Click "Deploy site"

### Step 4: Enable Multi-Device Sync

After deployment:

1. Open your live site URL
2. Go to **⚙️ Backup/Settings** → **📱 Multi-device sync**
3. Turn on sync and enter a **Shop Key** (16+ characters for new shops)
4. Use the **same key** on your phone/PC — data syncs automatically

## Local Development

Open `index.html` directly in a browser, or run:

```bash
npm run build
npm run dev
```

Then visit `http://localhost:3000`.

## Data & Privacy

- All data is stored in your browser's **localStorage** + **IndexedDB** (not on any server)
- **Sync** sends only **encrypted** data to Netlify's serverless store — the server never sees plaintext
- **Backup** downloads a JSON file — keep it safe on a pen drive or cloud storage
- Auto-snapshots keep the last 3 states locally as a safety net

## Project Structure

```
registry-shop-app/
├── index.html              # Main app (single-file, self-contained)
├── netlify.toml            # Netlify deployment config
├── netlify/functions/
│   └── sync.mjs            # Serverless sync function
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (offline cache)
│   ├── _headers            # Security headers
│   ├── icon-192.png        # PWA icon
│   └── icon-512.png        # PWA icon
├── build.js                # Build script (copies to dist/)
├── package.json            # Dependencies & scripts
└── README.md               # This file
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Sync shows "⚠️ sync paused" | Check internet, verify Shop Key is 16+ chars, or see Netlify function logs |
| Backup not downloading | Check browser pop-up blocker, use Chrome/Edge |
| App not loading offline | Make sure service worker registered (visit site once with internet) |
| Old data missing | Use **Backup/Settings → Restore from Backup** to load your `.json` backup |

## License

MIT
