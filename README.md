# FinAuzi

> **Notre trésorerie pour l'Australie**

A private, mobile-first web platform for managing shared cashflow for our year in Australia.

Built with **React + Vite + Tailwind CSS + Firebase** and designed for **Vercel** deployment.

---

## Features

- 🔐 **Private access** — Only two authorized Firebase Auth users can access the app
- 💰 **Cashflow forecasting** — 12-month projection with safety buffer and health indicators
- 📊 **Transaction management** — Recurring and one-off transactions with full CRUD
- 👫 **Person attribution** — Each transaction is attributed to either **Clément** or **Lise**
- 📱 **Mobile-first** — Premium touch-optimized interface with bottom sheet, tab navigation
- 🖥️ **Desktop layout** — Full-featured dashboard with sidebar navigation
- 🔄 **Real-time sync** — Firestore `onSnapshot` listeners — both users see changes instantly
- 💱 **EUR/AUD toggle** — Display-level currency conversion (internal calculations in EUR)
- 📥 **Data migration** — Automatic detection and import of legacy localStorage data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build | Vite 6 |
| Styling | Tailwind CSS 3 |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | Vercel |
| Icons | Lucide React |
| Charts | Recharts |

---

## Project Structure

```
src/
├── lib/firebase.js           # Firebase init
├── config/people.js          # Person mapping + helpers
├── context/
│   ├── AuthContext.jsx        # Firebase auth provider
│   └── CurrencyContext.jsx    # EUR/AUD toggle
├── services/
│   ├── transactionService.js  # Firestore CRUD + real-time
│   ├── settingsService.js     # Shared settings
│   └── migrationService.js    # localStorage → Firestore
├── hooks/
│   └── useAustraliaData.js    # Central data hook (Firestore-backed)
├── utils/
│   └── cashflow.js            # Pure forecast engine + person helpers
├── views/
│   ├── AustraliaView.jsx      # Main dashboard view
│   ├── LoginView.jsx          # Firebase login screen
│   └── SettingsView.jsx       # App settings + account
├── components/
│   ├── auth/                  # Loading, AccessDenied screens
│   ├── australia/             # Desktop dashboard components
│   ├── mobile/                # Mobile-first components
│   ├── migration/             # Import banner
│   ├── layout/                # Sidebar + Header
│   └── ui/                    # Reusable UI pieces
└── main.jsx                   # Entry point (AuthProvider wrapper)
```

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd finauzi
npm install
```

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**
4. **Create two users manually:**
   - User 1 — confirm UID matches: `J8xOqDWZv5gEss5CBbQ7kQOsTwV2`
   - User 2 — confirm UID matches: `o8wLosYoh7b989P9gQyZCk8tt3l1`
5. **Enable Firestore Database:**
   - Go to Firestore → Create database
   - Start in **production mode**
6. **Publish security rules:**
   - Copy the contents of `firestore.rules` from this project
   - Paste into Firestore → Rules tab
   - Click **Publish**

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase config:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Run Locally

```bash
npm run dev
```

---

## Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Add all `VITE_FIREBASE_*` environment variables in Vercel project settings
4. Deploy

### Post-Deploy Checklist

- [ ] Login with User 1 — verify access
- [ ] Login with User 2 — verify access
- [ ] Try with an unauthorized account — verify Access Denied
- [ ] Test localStorage import banner appears
- [ ] Add a transaction as User 1 — confirm User 2 sees it in real time
- [ ] Edit safety buffer as User 2 — confirm User 1 sees the update
- [ ] Verify EUR/AUD toggle works
- [ ] Verify mobile layout on a phone

---

## Firestore Data Structure

```
couples/
  main/
    settings/
      main                    # { initialCapitalEUR, safetyBufferEUR, selectedCurrency, updatedAt, updatedBy }
    transactions/
      {transactionId}         # { title, amountEUR, type, recurrence, category, date, endDate, notes, isActive, personUid, createdAt, createdBy, updatedAt, updatedBy }
    migrations/
      localStorageImport      # { importedAt, importedBy, sourceKeys, transactionCount }
    shoppingItems/
      {itemId}                # { name, quantityLabel, aisle, checked, checkedBy, checkedAt, note, createdAt, createdBy, updatedAt, updatedBy }
    shoppingCatalog/
      {slug}                  # { name, nameLower, aisle, favorite, useCount, lastUsedAt, createdAt, createdBy, updatedAt, updatedBy }
```

---

## Authorized Users

| UID | Label | Color |
|-----|-------|-------|
| `J8xOqDWZv5gEss5CBbQ7kQOsTwV2` | Lise | Blue |
| `o8wLosYoh7b989P9gQyZCk8tt3l1` | Clément | Emerald |

---

## Security

- Only the two authorized UIDs can read/write data
- Firestore rules enforce `personUid` validation
- Firestore rules enforce `updatedBy == request.auth.uid`
- No public registration — users are created manually in Firebase Console
- Firebase config values are loaded from environment variables

---

## License

Private project — not open source.
