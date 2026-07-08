# 💸 CashPilot

> A smart, student-focused expense manager — built as a Progressive Web App with real-time Firebase sync, AI-powered spending advice, and a clean dark UI.

<br />

## ✨ Features

### 📊 Dashboard
- Live **monthly balance** with animated area chart
- **Safe daily spend** calculator — recalculates remaining days vs. money left
- AI-powered **spending forecast** using Google Gemini
- Category breakdown with progress bars
- Recent expense list & savings goal preview

### 📝 Expense Logging
- Add expenses with name, amount (custom calculator input), category, date, and notes
- AI auto-suggests category and title based on what you type
- 5 categories: Food, Transport, Books, Hangout, Other

### 🗂️ Daily Records
- Full searchable expense history
- Delete individual records
- Clean card layout with category icons

### 📅 Expense Calendar
- Monthly heatmap calendar — darker purple = heavier spending
- Tap any day to see what you spent
- Weekly trend bar chart
- Category split visualization

### 💰 Budget Management
- Set monthly allowance and savings goal
- "Add money to budget" — logs income and updates allowance
- Savings progress meter
- Safe daily runway display

### 🔔 Inbox / Notifications
- In-app notification system for budget alerts
- Mark as read / clear all
- Bill split tracker (add & settle shared expenses)

### ⚙️ Settings
- Edit name, email, monthly budget, and savings goal
- Light / Dark mode toggle
- Export data as **JSON** (full backup) or **CSV** (expenses only)
- Sign out

### 📲 PWA (Progressive Web App)
- Installable on Android, iOS, and Desktop
- Custom home screen icon
- Standalone display (no browser chrome)
- Offline-capable layout

<br />

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 (no build-time JSX transform — Vite handles it) |
| Build Tool | Vite |
| Styling | Vanilla CSS with CSS custom properties (design tokens) |
| Font | Inter (Google Fonts) |
| Icons | Lucide React |
| Backend / DB | Firebase Firestore (real-time, per-user data) |
| Auth | Firebase Authentication (Email/Password + Google OAuth) |
| AI | Google Gemini API (`geminiIntegration.js`) |
| PWA | Web App Manifest + apple-touch-icon |

<br />

## 📁 Project Structure

```
CashPilot/
├── public/
│   ├── cashpilot-logo.png     # PWA install icon
│   └── manifest.json          # PWA manifest
├── src/
│   ├── context/
│   │   ├── AuthContext.jsx    # Firebase auth state
│   │   └── DataContext.jsx    # Firestore data provider
│   ├── firebase/
│   │   ├── config.js          # Firebase app init
│   │   ├── auth.js            # Sign in / sign up / Google OAuth
│   │   ├── errors.js          # Firebase error messages
│   │   └── services/
│   │       ├── accounts.js
│   │       ├── goals.js
│   │       ├── profile.js
│   │       ├── recurring.js
│   │       ├── splits.js
│   │       ├── summary.js
│   │       └── transactions.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useData.js
│   │   ├── useAccounts.js
│   │   ├── useAlerts.js
│   │   ├── useBudgetMetrics.js
│   │   ├── useCategoryTrends.js
│   │   ├── useGoals.js
│   │   ├── useNotifications.js
│   │   ├── useRecurringExpenses.js
│   │   ├── useSummary.js
│   │   └── useTransactions.js
│   ├── utils/
│   │   ├── alerts.js
│   │   ├── budgetCalculations.js
│   │   ├── calendarHeatmap.js
│   │   ├── categoryAnalytics.js
│   │   ├── dataExport.js
│   │   ├── dataManagement.js
│   │   ├── expenseRecurrence.js
│   │   ├── geminiIntegration.js
│   │   ├── notifications.js
│   │   └── splitTracking.js
│   ├── main.jsx               # All screens and components
│   └── styles.css             # All styles (design system + components)
├── index.html
├── vite.config.js
├── firestore.rules
├── .env.example
└── package.json
```

<br />

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Grignardz/CashPilot.git
cd CashPilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project
2. Enable **Firestore Database** and **Authentication** (Email/Password + Google)
3. Copy your project config

### 4. Set up environment variables

```bash
cp .env.example .env
```

Fill in your Firebase values in `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 5. (Optional) Set up Gemini AI

To enable AI spending advice and auto-category suggestions, add your Gemini API key to `.env`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Get one free at [Google AI Studio](https://aistudio.google.com/).

### 6. Deploy Firestore security rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

<br />

## 🔐 Firestore Security Rules

All user data is strictly isolated — users can only read and write their own documents:

```
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;

  match /{document=**} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

<br />

## 📦 Build for Production

```bash
npm run build
```

Output goes to `dist/`. You can deploy to Firebase Hosting, Vercel, or any static host.

<br />

## 🎨 Design System

The entire app uses CSS custom properties defined in `:root` in `styles.css`:

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0a0a0a` | Page background |
| `--surface` | `#141416` | Cards, panels |
| `--surface-raised` | `#1c1c1f` | Elevated elements |
| `--accent` | `#7c5cbf` | Purple — primary actions |
| `--accent-light` | `#d4c8f5` | Light purple — highlights |
| `--green` | `#c8f0c0` | Success, AI card |
| `--pink` | `#f5c8d8` | Error, delete |
| `--text` | `#f5f5f7` | Primary text |
| `--text-secondary` | `#a1a1a6` | Muted text |

Font: **Inter** (Google Fonts, weights 400–900)

<br />

## 📱 Installing as a PWA

### Android (Chrome)
- Open the app in Chrome
- Tap the **⋮ menu → Add to Home screen**

### iOS (Safari)
- Open the app in Safari
- Tap the **Share button → Add to Home Screen**

### Desktop (Chrome/Edge)
- Look for the **install icon** in the address bar

<br />

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

<br />

## 📄 License

MIT — free to use, modify, and distribute.

<br />

---

Made with 💜 by [Labhansh](https://github.com/Grignardz)
