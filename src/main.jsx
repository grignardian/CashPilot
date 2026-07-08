import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  Bell,
  Bus,
  CalendarDays,
  ChevronRight,
  Coffee,
  Eye,
  EyeOff,
  Home,
  IndianRupee,
  LogOut,
  Mail,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Target,
  Utensils,
  User,
  Wallet,
  Trash2,
  X,
  ShoppingCart,
  ShoppingBag,
  Tv,
  GraduationCap,
  HeartPulse,
  Gift
} from "lucide-react";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { useAuth } from "./hooks/useAuth";
import { useAlerts } from "./hooks/useAlerts";
import { useBudgetMetrics } from "./hooks/useBudgetMetrics";
import { useNotifications } from "./hooks/useNotifications";
import { useRecurringExpenses } from "./hooks/useRecurringExpenses";
import { useData } from "./hooks/useData";
import { getTierForAmount } from "./utils/calendarHeatmap";
import { suggestCategoryAndName, getSpendingAdvice, isGeminiConfigured } from "./utils/geminiIntegration";
import { exportDataAsJSON, exportAsCSV, downloadFile } from "./utils/dataExport";
import { generateMonthlyRecap, saveMonthlyRecap } from "./utils/dataManagement";
import "./styles.css";

const categories = [
  { name: "Food", icon: Utensils, color: "#c8f0c0" },
  { name: "Transport", icon: Bus, color: "#d4c8f5" },
  { name: "Groceries", icon: ShoppingCart, color: "#e8f5e9" },
  { name: "Shopping", icon: ShoppingBag, color: "#ffe5ec" },
  { name: "Bills & Rent", icon: Home, color: "#ffedd5" },
  { name: "Subscriptions", icon: Tv, color: "#ffd6ff" },
  { name: "Academics", icon: GraduationCap, color: "#e0f2fe" },
  { name: "Health", icon: HeartPulse, color: "#fee2e2" },
  { name: "Gifts", icon: Gift, color: "#fef9c3" },
  { name: "Hangout", icon: Coffee, color: "#bfe8ff" },
  { name: "Other", icon: ReceiptText, color: "#f5c8d8" }
];

const currency = (value) =>
  `₹ ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;

// Use local date (not UTC) — critical for IST and other UTC+ timezones
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <CashPilotApp />
      </DataProvider>
    </AuthProvider>
  );
}

function CashPilotApp() {
  const { user, loading, error: authError, signIn, signUp, signInGoogle, logOut } = useAuth();
  const {
    transactions,
    summary,
    profile,
    accounts,
    goals,
    recurring: firebaseRecurring,
    splits,
    loadingData,
    error: dataError,
    addTransaction,
    deleteTransaction,
    updateProfile,
    updateSettings,
    addRecurring: addRecurringToFirebase,
    deleteRecurring: deleteRecurringFromFirebase,
    addSplit,
    settleSplit: settleSplitAction,
    unsettleSplit: unsettleSplitAction,
    deleteSplit,
    clearAllUserData
  } = useData();
  const [screen, setScreen] = useState("home");
  const [aiOpen, setAiOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [splitContext, setSplitContext] = useState(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("cashpilot-theme") || "dark");
  const settings = profile.settings;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cashpilot-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => t === "dark" ? "light" : "dark");

  // Utility hooks integration
  const budgetMetrics = useBudgetMetrics(transactions, settings);
  const { alerts, alertCount, hasCritical, dismiss: dismissAlert, refresh: refreshAlerts } = useAlerts(transactions, settings);
  const { unreadCount, notifications, add: addNotification, read: readNotification, readAll: readAllNotifications, remove: removeNotification, refresh: refreshNotifications } = useNotifications();
  const { recurring, dueItems, suggestions: recurringSuggestions, add: addRecurring, remove: removeRecurring, markLogged, refresh: refreshRecurring } = useRecurringExpenses(transactions);

  // Generate monthly recap when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      const result = generateMonthlyRecap(month, year, transactions, settings.allowance, settings.savingsGoal);
      saveMonthlyRecap(result);
    }
  }, [transactions.length]);

  // Notify about due recurring expenses
  useEffect(() => {
    if (dueItems.length > 0) {
      dueItems.forEach((item) => {
        addNotification("reminder", `${item.name} is due`, `₹${item.amount} · ${item.frequency}`, "info");
      });
    }
  }, [dueItems.length]);

  const expenses = useMemo(() => transactions.map(transactionToExpense), [transactions]);

  const totals = useMemo(() => {
    const now = new Date();
    const todayKey = today();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Only count expense-type transactions from the current month
    const monthExpenses = expenses.filter(
      (item) => item.type === "expense" && item.date.startsWith(monthKey)
    );

    const spent = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allowance = settings.allowance;
    const left = allowance - spent;

    const todaySpent = monthExpenses
      .filter((item) => item.date === todayKey)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const byCategory = categories.map((cat) => ({
      ...cat,
      total: monthExpenses
        .filter((item) => item.category === cat.name)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    }));

    const byDate = monthExpenses.reduce((map, item) => {
      map[item.date] = (map[item.date] || 0) + Number(item.amount || 0);
      return map;
    }, {});

    return {
      spent,
      left,
      todaySpent,
      byCategory,
      byDate,
      dailyLimit: budgetMetrics.safeDaily,
      savingsProgress: settings.savingsGoal > 0
        ? Math.min(100, Math.max(0, ((left > 0 ? left : 0) / settings.savingsGoal) * 100))
        : (left > 0 ? 100 : 0)
    };
  }, [expenses, settings, budgetMetrics.safeDaily]);

  const addExpense = async (expense) => {
    const ref = await addTransaction({
      amount: expense.amount,
      type: "expense",
      category: expense.category,
      accountId: accounts[0]?.id || "",
      note: [expense.title, expense.note].filter(Boolean).join(" · "),
      dateKey: expense.date
    });
    refreshAlerts();
    refreshRecurring();
    setScreen("records");
    return ref;
  };

  const deleteExpense = async (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx && tx.type === "income") {
      const newAllowance = Math.max(0, settings.allowance - Number(tx.amount || 0));
      await updateSettings({ ...settings, allowance: newAllowance });
    }
    await deleteTransaction(id);
    refreshAlerts();
  };

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <AuthScreen
        authError={authError}
        onSignIn={signIn}
        onSignUp={signUp}
        onGoogle={signInGoogle}
      />
    );
  }

  // New user: data loaded but budget never configured
  if (!loadingData && settings.allowance === 0) {
    return (
      <OnboardingScreen
        profile={profile}
        updateSettings={updateSettings}
      />
    );
  }

  return (
    <main className="stage">
      <section className="app-shell" aria-label="CashPilot budget planner">
        <StatusBar />
        <Sidebar active={screen} setScreen={setScreen} totals={totals} />
        <div className="screen">
          <DesktopHeader screen={screen} setScreen={setScreen} onLogout={logOut} unreadCount={unreadCount} />
          {(dataError || loadingData) && (
            <div className={`app-notice ${dataError ? "error" : ""}`}>
              {dataError || "Syncing your budget..."}
            </div>
          )}
          {!dataError && !loadingData && alertCount > 0 && (
            <div className={`app-notice ${hasCritical ? "error" : ""}`}>
              {alerts[0].type === "daily"
                ? `You've spent ₹${Math.round(budgetMetrics.todaySpent)} today. Safe limit: ₹${Math.round(budgetMetrics.safeDaily)}.`
                : `Monthly spending at ₹${Math.round(budgetMetrics.monthSpent)} of ₹${Math.round(settings.allowance - settings.savingsGoal)} available.`
              }
            </div>
          )}
          {screen === "home" && (
            <HomeScreen
              expenses={expenses}
              totals={totals}
              settings={settings}
              goals={goals}
              aiOpen={aiOpen}
              onDismissAi={() => setAiOpen(false)}
              onAdd={() => setScreen("add")}
              onRecords={() => setScreen("records")}
              splits={splits}
              settleSplit={settleSplitAction}
              unsettleSplit={unsettleSplitAction}
            />
          )}
          {screen === "add" && (
            <AddExpenseScreen 
              onAdd={addExpense} 
              onOpenModal={(formValues) => {
                setSplitContext(formValues);
                setModalOpen(true);
              }} 
            />
          )}
          {screen === "records" && (
            <RecordsScreen
              query={query}
              setQuery={setQuery}
              expenses={expenses}
              onDelete={deleteExpense}
              onAdd={() => setScreen("add")}
              splits={splits}
              settleSplit={settleSplitAction}
              unsettleSplit={unsettleSplitAction}
            />
          )}
          {screen === "budget" && <BudgetScreen settings={settings} updateSettings={updateSettings} totals={totals} addTransaction={addTransaction} accounts={accounts} />}
          {screen === "calendar" && <CalendarScreen expenses={expenses} totals={totals} onAdd={() => setScreen("add")} splits={splits} settleSplit={settleSplitAction} unsettleSplit={unsettleSplitAction} />}
          {screen === "inbox" && <InboxScreen totals={totals} settings={settings} expenses={expenses} onBudget={() => setScreen("budget")} notifications={notifications} onReadNotification={readNotification} splits={splits} settleSplit={settleSplitAction} unsettleSplit={unsettleSplitAction} />}
          {screen === "settings" && (
            <SettingsScreen
              profile={profile}
              settings={settings}
              updateProfile={updateProfile}
              updateSettings={updateSettings}
              onLogout={logOut}
              transactions={transactions}
              accounts={accounts}
              goals={goals}
              theme={theme}
              toggleTheme={toggleTheme}
              onClearData={clearAllUserData}
            />
          )}
        </div>
        <BottomTabs active={screen} setScreen={setScreen} />
      </section>
      {modalOpen && (
        <StudentModal 
          onClose={() => { setModalOpen(false); setSplitContext(null); }} 
          expenseId={null} 
          addSplit={addSplit} 
          splitContext={splitContext}
          onAdd={addExpense}
        />
      )}
      <InstallPrompt />
    </main>
  );
}

function transactionToExpense(tx) {
  const [title, note] = String(tx.note || tx.category || "Expense").split(" · ");
  return {
    id: tx.id,
    title: title || tx.category || "Expense",
    amount: Number(tx.amount || 0),
    category: tx.category || "Other",
    date: tx.dateKey || today(),
    note: note || "",
    type: tx.type
  };
}

const navItems = [
  { id: "home", icon: Home, label: "Dashboard" },
  { id: "records", icon: Search, label: "Records" },
  { id: "add", icon: Plus, label: "Add" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "budget", icon: ArrowRightLeft, label: "Budget" }
];

function Sidebar({ active, setScreen, totals }) {
  return (
    <aside className="sidebar">
      <div className="brand-mark">
        <Sparkles size={18} />
        <span>CashPilot</span>
      </div>
      <nav className="side-nav" aria-label="CashPilot sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`side-nav-item pressable ${active === item.id ? "active" : ""}`}
              onClick={() => setScreen(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-card">
        <p>Left this month</p>
        <strong>{currency(totals.left)}</strong>
        <span>{currency(totals.dailyLimit)} daily runway</span>
      </div>
    </aside>
  );
}

function DesktopHeader({ screen, setScreen, onLogout, unreadCount }) {
  return (
    <header className="desktop-header">
      <div>
        <p>Expenses manager</p>
        <h1>CashPilot</h1>
      </div>
      <div className="desktop-actions">
        <button className="invite pressable" onClick={() => setScreen("calendar")}>
          <CalendarDays size={15} />
          {new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
        </button>
        <button className="icon-ring pressable" aria-label="Notifications" onClick={() => setScreen("inbox")}>
          <Bell size={19} />
          {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        </button>
        <button className="icon-ring pressable" aria-label="Settings" onClick={() => setScreen("settings")}>
          <SettingsIcon size={18} />
        </button>
        <button className="icon-ring pressable" aria-label="Sign out" onClick={onLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function StatusBar() {
  return (
    <div className="status-bar">
      <span>11:31</span>
      <div className="dynamic-island" />
      <div className="status-icons">
        <span className="signal" />
        <span className="wifi" />
        <span className="battery" />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="stage auth-stage">
      <section className="auth-card" style={{ textAlign: "center", padding: "48px 28px" }}>
        <div className="brand-mark" style={{ justifyContent: "center" }}>
          <Sparkles size={22} />
          <span>CashPilot</span>
        </div>
        <p className="auth-subtitle" style={{ marginTop: "16px" }}>Loading your budget...</p>
        <div style={{ marginTop: "24px", height: "4px", borderRadius: "99px", overflow: "hidden", background: "var(--border)" }}>
          <div style={{ height: "100%", width: "60%", borderRadius: "99px", background: "var(--accent-light)", animation: "shimmer 1.5s ease infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg, var(--accent) 25%, var(--accent-light) 50%, var(--accent) 75%)" }} />
        </div>
      </section>
    </main>
  );
}

function OnboardingScreen({ profile, updateSettings }) {
  const [form, setForm] = useState({ allowance: "", savingsGoal: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const allowanceVal = Number(form.allowance.replace(/[^0-9]/g, "")) || 0;
    const savingsVal = Number(form.savingsGoal.replace(/[^0-9]/g, "")) || 0;

    if (allowanceVal <= 0) {
      setError("Please set a monthly allowance greater than 0.");
      setBusy(false);
      return;
    }
    if (savingsVal > allowanceVal) {
      setError("Savings goal cannot be higher than your monthly allowance.");
      setBusy(false);
      return;
    }

    try {
      await updateSettings({
        allowance: allowanceVal,
        savingsGoal: savingsVal,
      });
    } catch (err) {
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = profile.name || "Student";

  return (
    <main className="stage auth-stage">
      <section className="auth-card" style={{ maxWidth: "420px" }}>
        <div className="brand-mark">
          <Sparkles size={18} />
          <span>CashPilot</span>
        </div>
        <h1 style={{ fontSize: "24px", marginTop: "12px" }}>Welcome, {name}!</h1>
        <p className="auth-subtitle" style={{ marginBottom: "20px" }}>
          Let's set up your monthly budget to unlock your smart daily spending limits.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Monthly Budget (Allowance)</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.allowance}
              onChange={(e) => setForm({ ...form, allowance: e.target.value.replace(/[^0-9]/g, "") })}
              required
            />
          </label>
          <label>
            <span>Savings Target Goal</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.savingsGoal}
              onChange={(e) => setForm({ ...form, savingsGoal: e.target.value.replace(/[^0-9]/g, "") })}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-button pressable" disabled={busy} type="submit" style={{ marginTop: "12px" }}>
            {busy ? "Setting up..." : "Start managing budget"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AuthScreen({ authError, onSignIn, onSignUp, onGoogle }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      if (mode === "signup") {
        await onSignUp(form.email, form.password, form.name);
      } else {
        await onSignIn(form.email, form.password);
      }
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setLocalError("");
    try {
      await onGoogle();
    } catch (error) {
      setLocalError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="stage auth-stage">
      <section className="auth-card">
        <div className="brand-mark">
          <Sparkles size={18} />
          <span>CashPilot</span>
        </div>
        <h1>{mode === "signup" ? "Create your own wallet" : "Welcome back"}</h1>
        <p className="auth-subtitle">Sign in to sync expenses, calendar marks, and budget records across devices.</p>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              <span>Name</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@college.edu" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" />
          </label>
          {(localError || authError) && <p className="form-error">{localError || authError}</p>}
          <button className="primary-button pressable" disabled={busy} type="submit">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button className="google-button pressable" disabled={busy} onClick={google}>
          Continue with Google
        </button>
        <button className="auth-switch pressable" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </section>
    </main>
  );
}

function HomeScreen({ expenses, totals, settings, goals, aiOpen, onDismissAi, onAdd, onRecords, splits, settleSplit, unsettleSplit }) {
  const [aiAdvice, setAiAdvice] = useState("");
  const [balanceHidden, setBalanceHidden] = useState(true);

  useEffect(() => {
    const topCats = totals.byCategory
      .filter((c) => c.total > 0)
      .slice(0, 3)
      .map((c) => `${c.name} ${Math.round((c.total / Math.max(totals.spent, 1)) * 100)}%`)
      .join(", ");

    getSpendingAdvice({
      budget: settings.allowance,
      savingsGoal: settings.savingsGoal,
      spent: totals.spent,
      daysRemaining: Math.max(1, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()),
      topCategories: topCats || "none yet"
    }).then((result) => {
      if (result?.advice) setAiAdvice(result.advice);
    }).catch(() => {});
  }, [totals.spent, settings.allowance, settings.savingsGoal]);

  return (
    <div className="page home-page">
      <div className="home-actions">
        <button className="invite pressable">
          <CalendarDays size={15} />
          {new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
        </button>
        <div className="home-action-right">
          <button className="icon-ring pressable" aria-label="Notifications">
            <Bell size={19} />
          </button>
          <button className="avatar pressable" aria-label="Profile" />
        </div>
      </div>

      <section className="balance-block">
        <div className="balance-header">
          <p className="eyebrow">Monthly money left</p>
          <button className="eye-toggle pressable" onClick={() => setBalanceHidden(!balanceHidden)} aria-label={balanceHidden ? "Show balance" : "Hide balance"}>
            {balanceHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <h1>{balanceHidden ? `₹ ${totals.left < 0 ? "-" : ""}${"•".repeat(Math.max(1, Math.round(Math.abs(totals.left)).toString().length))}` : currency(totals.left)}</h1>
        <AreaChart totals={totals} allowance={settings.allowance} />
      </section>

      <div className="stat-row">
        <MiniStat title="Spent today" percent="live" value={currency(totals.todaySpent)} />
        <MiniStat title="Safe daily spend" percent={`${totals.left > 0 ? "on track" : "over"}`} value={currency(totals.dailyLimit)} />
      </div>

      {aiOpen && (
        <section className="ai-card pressable">
          <button className="close-button" aria-label="Dismiss forecast" onClick={onDismissAi}>
            <X size={15} />
          </button>
          <div className="ai-label">
            <Sparkles size={16} />
            <span>CashPilot forecast</span>
          </div>
          <div className="ai-content">
            <h2>{aiAdvice || (totals.left >= settings.savingsGoal ? "You can hit this month's savings goal." : "Cut snacks by ₹80/day to stay on track.")}</h2>
            <button className="dark-pill pressable" onClick={onAdd}>
              Log spend
            </button>
          </div>
        </section>
      )}

      <button className="goals-header pressable" onClick={onRecords}>
        <span>Records</span>
        <b>{expenses.length}</b>
      </button>

      <div className="desktop-home-grid">
        <BudgetCard icon={<Wallet size={20} />} title="Monthly allowance" value={currency(settings.allowance)} caption="Pocket money, UPI, cash" />
        <BudgetCard icon={<Target size={20} />} title="Savings target" value={currency(settings.savingsGoal)} caption={`${Math.round(totals.savingsProgress)}% reachable right now`} />
        <BudgetCard icon={<ReceiptText size={20} />} title="Daily runway" value={currency(totals.dailyLimit)} caption="Suggested spend per day" />
      </div>

      <CategoryBreakdown totals={totals} />
      <RecentExpenses expenses={expenses.slice(0, 4)} splits={splits} settleSplit={settleSplit} unsettleSplit={unsettleSplit} />
      <GoalPreview goals={goals} />
    </div>
  );
}

function AreaChart({ totals, allowance }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const width = 340;
  const height = 165;
  const topPadding = 14;
  const bottomPadding = 26;
  const chartHeight = height - topPadding - bottomPadding;

  const maxVal = Number(allowance || 0);

  // If no budget and no spending, show a flat line at the top
  if (maxVal === 0 && totals.spent === 0) {
    const flatY = topPadding + 4;
    return (
      <svg className="area-chart" viewBox="0 0 340 165" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a98df5" stopOpacity="0.58" />
            <stop offset="78%" stopColor="#7c5cbf" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="chart-baseline" x1="0" x2={width} y1={height / 2} y2={height / 2} />
        <path className="chart-line" d={`M0 ${flatY} L${width} ${flatY}`} />
      </svg>
    );
  }

  // Pre-calculate daily cumulative expenses up to today
  const dailyCumulativeExpenses = [];
  let cumulative = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (d <= todayDate) {
      cumulative += Number(totals.byDate[dateKey] || 0);
    }
    dailyCumulativeExpenses.push(cumulative);
  }

  // Find minVal across all days to handle over-budget scenarios gracefully
  let minVal = maxVal;
  for (let d = 1; d <= todayDate; d++) {
    const remaining = maxVal - dailyCumulativeExpenses[d - 1];
    if (remaining < minVal) {
      minVal = remaining;
    }
  }
  // Ensure minVal is at most 0 to show zero axis properly if over budget
  minVal = Math.min(0, minVal);

  const valSpan = Math.max(maxVal - minVal, 1);

  // Generate points: index 0 is start of month (day 0), 1..daysInMonth are end of days
  const points = Array.from({ length: daysInMonth + 1 }, (_, index) => {
    const day = index;
    const x = (index / daysInMonth) * width;
    
    let remaining;
    if (day === 0) {
      remaining = maxVal;
    } else if (day <= todayDate) {
      remaining = maxVal - dailyCumulativeExpenses[day - 1];
    } else {
      remaining = totals.left;
    }

    const y = topPadding + (1 - (remaining - minVal) / valSpan) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;
  
  // zeroY represents the y coordinate for 0 remaining budget
  const zeroY = topPadding + (1 - (0 - minVal) / valSpan) * chartHeight;

  return (
    <svg className="area-chart" viewBox="0 0 340 165" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a98df5" stopOpacity="0.58" />
          <stop offset="78%" stopColor="#7c5cbf" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartFill)" />
      <line className="chart-baseline" x1="0" x2={width} y1={zeroY} y2={zeroY} />
      <path className="chart-line" d={linePath} />
    </svg>
  );
}

function MiniStat({ title, percent, value }) {
  return (
    <section className="mini-stat pressable">
      <p>{title}</p>
      <span>{percent}</span>
      <strong>{value}</strong>
    </section>
  );
}

function BudgetCard({ icon, title, value, caption }) {
  return (
    <section className="budget-card pressable">
      <span>{icon}</span>
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{caption}</small>
    </section>
  );
}

function CategoryBreakdown({ totals }) {
  const max = Math.max(...totals.byCategory.map((item) => item.total), 1);

  return (
    <section className="student-panel category-panel">
      <div className="panel-heading">
        <h2>Category spend</h2>
        <span>This month</span>
      </div>
      {totals.byCategory.map((item) => {
        const Icon = item.icon;
        return (
          <div className="category-row" key={item.name}>
            <span className="category-icon" style={{ background: item.color }}>
              <Icon size={17} />
            </span>
            <div>
              <strong>{item.name}</strong>
              <div className="progress">
                <span style={{ width: `${(item.total / max) * 100}%` }} />
              </div>
            </div>
            <b>{currency(item.total)}</b>
          </div>
        );
      })}
    </section>
  );
}

function RecentExpenses({ expenses, splits, settleSplit, unsettleSplit }) {
  return (
    <section className="student-panel recent-panel">
      <div className="panel-heading">
        <h2>Recent expenses</h2>
        <span>Latest logs</span>
      </div>
      <div className="expense-list">
        {expenses.map((item) => (
          <ExpenseRow key={item.id} expense={item} splits={splits} settleSplit={settleSplit} unsettleSplit={unsettleSplit} />
        ))}
      </div>
    </section>
  );
}

function GoalPreview({ goals }) {
  if (!goals.length) return null;

  return (
    <section className="student-panel goal-preview">
      <div className="panel-heading">
        <h2>Goals</h2>
        <span>{goals.length} active</span>
      </div>
      {goals.slice(0, 3).map((goal) => {
        const progress = goal.targetAmount ? Math.min(100, (Number(goal.savedAmount || 0) / Number(goal.targetAmount)) * 100) : 0;
        return (
          <div className="category-row" key={goal.id}>
            <span className="category-icon" style={{ background: "#d4c8f5" }}>
              <Target size={17} />
            </span>
            <div>
              <strong>{goal.title}</strong>
              <div className="progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <b>{currency(goal.savedAmount)} / {currency(goal.targetAmount)}</b>
          </div>
        );
      })}
    </section>
  );
}

function AmountInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState(String(value || ""));

  const handleKey = (key) => {
    if (key === "backspace") {
      setDisplay((prev) => prev.slice(0, -1));
    } else if (key === "clear") {
      setDisplay("");
    } else if (key === "done") {
      onChange(display);
      setOpen(false);
    } else if (key === ".") {
      if (!display.includes(".")) setDisplay((prev) => prev + ".");
    } else {
      setDisplay((prev) => prev + key);
    }
  };

  const openCalc = () => {
    setDisplay(String(value || ""));
    setOpen(true);
  };

  return (
    <>
      <button type="button" className="custom-dropdown-trigger" onClick={openCalc}>
        <span className="custom-dropdown-value">
          {value ? `₹ ${Number(value).toLocaleString("en-IN")}` : ""}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="16" y2="18"/></svg>
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onMouseDown={() => { onChange(display); setOpen(false); }}>
          <div className="calc-popup" onMouseDown={(e) => e.stopPropagation()}>
            <div className="calc-display">
              <span className="calc-currency">₹</span>
              <span className="calc-amount">{display || "0"}</span>
            </div>
            <div className="calc-grid">
              {["7","8","9","4","5","6","1","2","3",".","0","backspace"].map((key) => (
                <button type="button" key={key} className={`calc-key pressable ${key === "backspace" ? "calc-key-action" : ""}`} onClick={() => handleKey(key)}>
                  {key === "backspace" ? "⌫" : key}
                </button>
              ))}
            </div>
            <div className="calc-actions">
              <button type="button" className="calc-clear pressable" onClick={() => handleKey("clear")}>Clear</button>
              <button type="button" className="calc-done pressable" onClick={() => handleKey("done")}>Done</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function DateInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value || new Date().toISOString().slice(0, 10));

  const parsed = new Date(selectedDate + "T00:00:00");
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthLabel = parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ];

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const pickDay = (day) => {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(dateKey);
    onChange(dateKey);
    setOpen(false);
  };

  const openPicker = () => {
    setSelectedDate(value || new Date().toISOString().slice(0, 10));
    setOpen(true);
  };

  const displayValue = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <>
      <button type="button" className="custom-dropdown-trigger" onClick={openPicker}>
        <span className="custom-dropdown-value">{displayValue}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
      {open && createPortal(
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="datepicker-popup" onMouseDown={(e) => e.stopPropagation()}>
            <div className="datepicker-header">
              <button type="button" className="datepicker-nav pressable" onClick={prevMonth}>‹</button>
              <span className="datepicker-month">{monthLabel}</span>
              <button type="button" className="datepicker-nav pressable" onClick={nextMonth}>›</button>
            </div>
            <div className="datepicker-weekdays">
              {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="datepicker-grid">
              {cells.map((day, index) => {
                if (!day) return <span key={`e-${index}`} />;
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = dateKey === value;
                const isToday = dateKey === new Date().toISOString().slice(0, 10);
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={`datepicker-day pressable ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => pickDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CustomDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);

  // Support both string[] and object[] (with .name, .icon, .color)
  const isStringOptions = options.length === 0 || typeof options[0] === "string";
  const normalize = (opt) =>
    isStringOptions ? { name: opt, color: null, icon: null } : opt;

  const selected = isStringOptions
    ? (options.includes(value) ? normalize(value) : null)
    : options.find((opt) => opt.name === value);

  return (
    <div className="custom-dropdown">
      <button
        type="button"
        className="custom-dropdown-trigger"
        onClick={() => setOpen(!open)}
      >
        {selected && (
          <>
            {selected.color && selected.icon && (
              <span className="custom-dropdown-icon" style={{ background: selected.color }}>
                <selected.icon size={14} />
              </span>
            )}
            <span className="custom-dropdown-value">{selected.name}</span>
          </>
        )}
        {!selected && <span className="custom-dropdown-value"></span>}
        <svg className={`custom-dropdown-chevron ${open ? "open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && createPortal(
        <div className="custom-dropdown-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="custom-dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
            {options.map((opt) => {
              const norm = normalize(opt);
              const OptIcon = norm.icon;
              return (
                <button
                  type="button"
                  key={norm.name}
                  className={`custom-dropdown-item ${norm.name === value ? "active" : ""}`}
                  onClick={() => { onChange(norm.name); setOpen(false); }}
                >
                  {OptIcon && norm.color && (
                    <span className="custom-dropdown-icon" style={{ background: norm.color }}>
                      <OptIcon size={14} />
                    </span>
                  )}
                  <span>{norm.name}</span>
                  {norm.name === value && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


function AddExpenseScreen({ onAdd, onOpenModal }) {
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "",
    date: "",
    note: ""
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiHint, setAiHint] = useState("");

  const handleTitleBlur = async () => {
    if (form.title.trim().length < 3) return;
    try {
      const suggestion = await suggestCategoryAndName(form.title.trim());
      if (suggestion && suggestion.confidence >= 0.7) {
        setForm((prev) => ({ ...prev, category: suggestion.suggestedCategory }));
        setAiHint(`AI suggested: ${suggestion.suggestedCategory}`);
        setTimeout(() => setAiHint(""), 3000);
      }
    } catch { /* ignore AI errors */ }
  };

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !amount) {
      setError("Add a name and amount before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({
        ...form,
        amount,
        category: form.category || "Other",
        date: form.date || today()
      });
    } catch {
      setError("Could not save this expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page form-page">
      <section className="hero-copy utility-hero">
        <h1>Log today's<br /><span>expense</span></h1>
        <p>Add canteen meals, travel, books, subscriptions, hangouts, or any tiny UPI spend before it disappears from memory.</p>
      </section>

      <form className="expense-form" onSubmit={submit}>
        <label>
          <span>Expense name</span>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onBlur={handleTitleBlur} placeholder="" />
          {aiHint && <small style={{ color: "#c8f0c0", fontSize: "11px", marginTop: "4px" }}>{aiHint}</small>}
        </label>
        <label>
          <span>Amount in rupees</span>
          <AmountInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} />
        </label>
        <label>
          <span>Category</span>
          <CustomDropdown
            value={form.category}
            options={categories}
            onChange={(val) => setForm({ ...form, category: val })}
          />
        </label>
        <label>
          <span>Date</span>
          <DateInput value={form.date} onChange={(val) => setForm({ ...form, date: val })} />
        </label>
        <label className="wide-field">
          <span>Note</span>
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="" />
        </label>
        <div className="form-actions">
          <button className="primary-button pressable" type="submit" disabled={saving}>{saving ? "Saving..." : "Save expense"}</button>
          <button className="primary-button pressable" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }} type="button" onClick={() => onOpenModal(form)}>Split with friend</button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

function RecordsScreen({ query, setQuery, expenses, onDelete, onAdd, splits, settleSplit, unsettleSplit }) {
  const [splitsSpaceOpen, setSplitsSpaceOpen] = useState(false);

  const filtered = expenses.filter((item) =>
    `${item.title} ${item.category} ${item.note}`.toLowerCase().includes(query.toLowerCase())
  );

  const pendingSplitsAmount = (splits || [])
    .filter(s => s.status === "pending")
    .reduce((sum, s) => sum + (s.friendShare || 0), 0);

  const settledSplitsAmount = (splits || [])
    .filter(s => s.status === "settled")
    .reduce((sum, s) => sum + (s.friendShare || 0), 0);

  return (
    <div className="page utility-page">
      <section className="hero-copy utility-hero">
        <h1>Daily <span>records</span></h1>
        <p>Search, review, and clean up every rupee you logged this month.</p>
      </section>
      <label className="search-field">
        <Search size={18} />
        <input placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="record-toolbar">
        <span>{filtered.length} records</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="dark-pill pressable" style={{ background: "rgba(169, 141, 245, 0.08)", border: "1px solid rgba(169, 141, 245, 0.2)", color: "var(--accent-light)" }} onClick={() => setSplitsSpaceOpen(true)}>Split records</button>
          <button className="dark-pill pressable" onClick={onAdd}>Add new</button>
        </div>
      </div>
      <div className="expense-list full">
        {filtered.map((item) => (
          <ExpenseRow key={item.id} expense={item} onDelete={onDelete} splits={splits} settleSplit={settleSplit} unsettleSplit={unsettleSplit} />
        ))}
      </div>
      {filtered.length === 0 && <p className="empty-state">No matching expense records yet.</p>}

      {splitsSpaceOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={() => setSplitsSpaceOpen(false)}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(100%, 450px)", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: "24px" }}>
            <button className="close-button" aria-label="Close" onClick={() => setSplitsSpaceOpen(false)}>
              <X size={16} />
            </button>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700" }}>Split records space</h2>
            
            {/* Split Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255, 200, 100, 0.04)", border: "1px solid rgba(255, 200, 100, 0.12)", borderRadius: "12px", padding: "12px 14px" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px", display: "block" }}>Friends owe you</span>
                <strong style={{ display: "block", fontSize: "18px", color: "var(--warning)", marginTop: "4px" }}>
                  {currency(pendingSplitsAmount)}
                </strong>
              </div>
              <div style={{ background: "rgba(200, 240, 192, 0.04)", border: "1px solid rgba(200, 240, 192, 0.12)", borderRadius: "12px", padding: "12px 14px" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "11px", display: "block" }}>Total settled</span>
                <strong style={{ display: "block", fontSize: "18px", color: "var(--accent-light)", marginTop: "4px" }}>
                  {currency(settledSplitsAmount)}
                </strong>
              </div>
            </div>

            {/* Scrollable Splits List */}
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
              {splits && splits.length > 0 ? (
                splits.map((split) => {
                  const isPending = split.status === "pending";
                  return (
                    <div 
                      key={split.id} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        borderRadius: "10px", 
                        padding: "10px 12px", 
                        marginBottom: "8px", 
                        background: "var(--surface-raised)", 
                        border: "1px solid var(--border)" 
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: "10px" }}>
                        <strong style={{ display: "block", fontSize: "13px", color: "var(--text)" }}>
                          Split with {split.friendName}
                        </strong>
                        <small style={{ color: "var(--text-secondary)", fontSize: "11px", display: "block", marginTop: "2px" }}>
                          Total: {currency(split.originalAmount)} · Share: {currency(split.yourShare)} · Owed: {currency(split.friendShare)}
                        </small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <button 
                          className="primary-button pressable" 
                          style={{ 
                            width: "auto", 
                            margin: 0, 
                            padding: "4px 8px", 
                            fontSize: "11px", 
                            height: "fit-content", 
                            background: isPending ? "rgba(169, 141, 245, 0.15)" : "rgba(200, 240, 192, 0.08)", 
                            border: isPending ? "1px solid rgba(169, 141, 245, 0.3)" : "1px solid rgba(200, 240, 192, 0.2)", 
                            color: isPending ? "var(--accent-light)" : "var(--accent-light)" 
                          }} 
                          onClick={() => isPending ? settleSplit(split.id) : unsettleSplit(split.id)}
                        >
                          {isPending ? "Settle" : "Settled"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", textAlign: "center", margin: "32px 0" }}>
                  No split records found.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ExpenseRow({ expense, onDelete, splits = [], settleSplit, unsettleSplit }) {
  const category = categories.find((item) => item.name === expense.category) || categories.at(-1);
  const Icon = category.icon;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDeleteClick = () => setConfirmOpen(true);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onDelete(expense.id);
  };

  const associatedSplit = (splits || []).find((s) => s.expenseId === expense.id);

  return (
    <>
      <article className="expense-row">
        <span className="category-icon" style={{ background: category.color }}>
          <Icon size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{expense.title}</strong>
          <small style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{expense.category} · {expense.date}{expense.note ? ` · ${expense.note}` : ""}</small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <b>{currency(expense.amount)}</b>
          {associatedSplit && settleSplit && unsettleSplit && (
            associatedSplit.status === "pending" ? (
              <button 
                className="primary-button pressable" 
                style={{ 
                  margin: 0, 
                  padding: "4px 8px", 
                  fontSize: "11px", 
                  width: "auto", 
                  background: "rgba(169, 141, 245, 0.15)", 
                  border: "1px solid rgba(169, 141, 245, 0.3)", 
                  color: "var(--accent-light)", 
                  height: "fit-content" 
                }} 
                onClick={(e) => {
                  e.stopPropagation();
                  settleSplit(associatedSplit.id);
                }}
              >
                Settle
              </button>
            ) : (
              <button 
                className="primary-button pressable" 
                style={{ 
                  margin: 0, 
                  padding: "4px 8px", 
                  fontSize: "11px", 
                  width: "auto", 
                  background: "rgba(200, 240, 192, 0.08)", 
                  border: "1px solid rgba(200, 240, 192, 0.2)", 
                  color: "var(--accent-light)", 
                  height: "fit-content" 
                }} 
                onClick={(e) => {
                  e.stopPropagation();
                  unsettleSplit(associatedSplit.id);
                }}
              >
                Settled
              </button>
            )
          )}
        </div>
        {onDelete && (
          <button className="delete-expense pressable" aria-label={`Delete ${expense.title}`} onClick={handleDeleteClick}>
            <X size={14} />
          </button>
        )}
      </article>

      {confirmOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={() => setConfirmOpen(false)}>
          <div className="modal-card delete-confirm-card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ background: "rgba(245, 200, 216, 0.15)", color: "var(--pink)" }}>
              <X size={20} />
            </div>
            <h2>Delete expense?</h2>
            <p>
              <strong style={{ color: "var(--text)" }}>{expense.title}</strong> · {currency(expense.amount)}
              <br />This action cannot be undone.
            </p>
            <button className="primary-button pressable" style={{ background: "#c0392b", marginTop: "20px" }} onClick={handleConfirm}>
              Delete
            </button>
            <button className="primary-button pressable" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", marginTop: "10px" }} onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function BudgetScreen({ settings, updateSettings, totals, addTransaction, accounts }) {
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  const update = (key, value) => {
    updateSettings({ ...settings, [key]: Number(String(value).replace(/[^0-9]/g, "")) || 0 });
  };

  const handleAddMoney = async () => {
    const amount = Number(addAmount);
    if (!amount) return;
    setAdding(true);
    setAddMsg("");
    try {
      await addTransaction({
        amount,
        type: "income",
        category: "Other",
        accountId: accounts?.[0]?.id || "",
        note: addNote || "Extra income",
        dateKey: new Date().toISOString().slice(0, 10)
      });
      // Also increase the allowance for this month
      updateSettings({ ...settings, allowance: settings.allowance + amount });
      setAddMsg(`Added ₹${amount.toLocaleString("en-IN")} to your budget.`);
      setAddAmount("");
      setAddNote("");
      setTimeout(() => { setAddMoneyOpen(false); setAddMsg(""); }, 1500);
    } catch {
      setAddMsg("Could not add money. Try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="page budget-page">
      <section className="hero-copy utility-hero">
        <h1>Your<br /><span>monthly budget</span></h1>
        <p>Tune your allowance and savings goal. CashPilot recalculates what you can spend each day.</p>
      </section>

      <button
        className="primary-button pressable"
        style={{ marginTop: "16px", background: "var(--green)", color: "#111", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        onClick={() => setAddMoneyOpen(true)}
      >
        <Plus size={18} /> Add money to budget
      </button>

      <div className="detail-grid">
        <section className="detail-card tint">
          <p>Monthly allowance</p>
          <AmountInput value={String(settings.allowance || "")} onChange={(val) => update("allowance", val)} />
        </section>
        <section className="detail-card">
          <p>Savings goal</p>
          <AmountInput value={String(settings.savingsGoal || "")} onChange={(val) => update("savingsGoal", val)} />
        </section>
        <section className="detail-card">
          <p>Spent so far</p>
          <strong>{currency(totals.spent)}</strong>
          <small>Across all logged records.</small>
        </section>
        <section className="detail-card">
          <p>Safe daily spend</p>
          <strong>{currency(totals.dailyLimit)}</strong>
          <small>Based on the money left this month.</small>
        </section>
      </div>
      <section className="milestone-card pressable">
        <div className="milestone-title">
          <Sparkles size={16} />
          <h2>{Math.round(totals.savingsProgress)}% of savings target covered</h2>
        </div>
        <p>Keep your remaining balance above {currency(settings.savingsGoal)} to finish the month with your planned savings.</p>
        <div className="progress big-progress">
          <span style={{ width: `${totals.savingsProgress}%` }} />
        </div>
      </section>



      {addMoneyOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={() => setAddMoneyOpen(false)}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close-button" aria-label="Close" onClick={() => setAddMoneyOpen(false)}>
              <X size={16} />
            </button>
            <div className="modal-icon" style={{ background: "rgba(200, 240, 192, 0.15)", color: "var(--green)" }}>
              <Plus size={20} />
            </div>
            <h2>Add money</h2>
            <p style={{ marginBottom: "16px" }}>Got extra pocket money, freelance pay, or a refund? Add it to this month's budget.</p>
            <div className="expense-form" style={{ marginTop: "0", gap: "10px" }}>
              <label>
                <span>Amount</span>
                <AmountInput value={addAmount} onChange={(val) => setAddAmount(val)} />
              </label>
              <label>
                <span>Note (optional)</span>
                <input value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="" style={{ height: "44px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", padding: "0 14px", outline: "none", width: "100%" }} />
              </label>
            </div>
            {addMsg && <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--green)" }}>{addMsg}</p>}
            <button className="primary-button pressable" disabled={adding || !addAmount} onClick={handleAddMoney} style={{ marginTop: "16px" }}>
              {adding ? "Adding..." : "Add to budget"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SettingsScreen({ profile, settings, updateProfile, updateSettings, onLogout, transactions, accounts, goals, theme, toggleTheme, onClearData }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    allowance: String(settings.allowance || 0),
    savingsGoal: String(settings.savingsGoal || 0)
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm({
      name: profile.name || "",
      allowance: String(settings.allowance || 0),
      savingsGoal: String(settings.savingsGoal || 0)
    });
  }, [profile.name, settings.allowance, settings.savingsGoal]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateProfile({ name: form.name.trim() || "CashPilot Student", currency: profile.currency || "INR" });
      await updateSettings({
        allowance: Number(form.allowance.replace(/[^0-9]/g, "")) || 0,
        savingsGoal: Number(form.savingsGoal.replace(/[^0-9]/g, "")) || 0
      });
      setMessage("Settings saved to your account.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteData = async () => {
    if (confirmNameInput.trim() !== (profile.name || "CashPilot Student").trim()) return;
    setDeleting(true);
    try {
      await onClearData();
      setDeleteModalOpen(false);
      setConfirmNameInput("");
      setMessage("All account data has been successfully deleted.");
    } catch (error) {
      setMessage(`Failed to delete data: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportJSON = () => {
    const json = exportDataAsJSON({ profile, transactions: transactions || [], accounts: accounts || [], goals: goals || [] });
    downloadFile(json, `cashpilot-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setMessage("Backup exported as JSON.");
  };

  const handleExportCSV = () => {
    const csv = exportAsCSV(transactions || []);
    downloadFile(csv, `cashpilot-expenses-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
    setMessage("Expenses exported as CSV.");
  };

  return (
    <div className="page settings-page">
      <section className="hero-copy utility-hero">
        <h1>User details<br /><span>and settings</span></h1>
        <p>Your monthly budget, savings target, and profile details are saved with this account.</p>
      </section>

      <form className="expense-form settings-form" onSubmit={save}>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
        </label>
        <label>
          <span>Email</span>
          <input value={profile.email || ""} readOnly />
        </label>
        <label>
          <span>Monthly budget</span>
          <input inputMode="numeric" value={form.allowance} onChange={(event) => setForm({ ...form, allowance: event.target.value })} />
        </label>
        <label>
          <span>Savings goal</span>
          <input inputMode="numeric" value={form.savingsGoal} onChange={(event) => setForm({ ...form, savingsGoal: event.target.value })} />
        </label>
        <section className="detail-card settings-summary">
          <p>Current month</p>
          <strong>{currency(settings.allowance)}</strong>
          <small>{currency(settings.savingsGoal)} savings target</small>
        </section>
        <section className="detail-card">
          <p>Signed in as</p>
          <div className="user-chip">
            <User size={18} />
            <span>{profile.name || "CashPilot Student"}</span>
          </div>
          <small>{profile.email}</small>
        </section>
        <div className="form-actions">
          <button className="primary-button pressable" type="submit" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button>
          <button className="primary-button pressable" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text)", marginTop: "0" }} type="button" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span style={{ marginLeft: "8px" }}>{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</span>
          </button>
          <button className="primary-button pressable" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text)", marginTop: "0" }} type="button" onClick={onLogout}>Sign out</button>
        </div>
        <div className="form-actions">
          <button className="outline-pill pressable" type="button" onClick={handleExportJSON}>Export backup (JSON)</button>
          <button className="outline-pill pressable" type="button" onClick={handleExportCSV}>Export expenses (CSV)</button>
        </div>
        <div className="form-actions" style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
          <button 
            className="primary-button pressable" 
            style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--danger)", marginTop: "0" }} 
            type="button" 
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 size={16} style={{ marginRight: "8px" }} />
            Delete all account data
          </button>
        </div>
        {message && <p className="form-error success-message">{message}</p>}
      </form>

      {deleteModalOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={() => { setDeleteModalOpen(false); setConfirmNameInput(""); }}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(100%, 450px)", padding: "20px 24px" }}>
            <div className="modal-header" style={{ marginBottom: "12px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "18px", color: "var(--text)" }}>
                <Trash2 size={20} /> Delete Data
              </h3>
            </div>
            
            <div className="modal-body" style={{ margin: "16px 0 20px" }}>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "16px" }}>
                This action is permanent and cannot be undone. All your transactions, budgets, accounts, goals, and splits will be permanently deleted.
              </p>
              
              <label style={{ display: "block", marginBottom: "8px" }}>
                <span style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                  To confirm, type your account name: <strong style={{ color: "var(--text)", background: "var(--surface)", padding: "2px 6px", borderRadius: "4px", fontSize: "13px", border: "1px solid var(--border)" }}>{profile.name || "CashPilot Student"}</strong>
                </span>
                <input 
                  type="text" 
                  value={confirmNameInput} 
                  onChange={(e) => setConfirmNameInput(e.target.value)} 
                  placeholder="Enter account name exactly" 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "14px", boxSizing: "border-box" }}
                />
              </label>
            </div>
            
            <div className="modal-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button 
                className="outline-pill pressable" 
                style={{ margin: 0, padding: "10px 16px", borderRadius: "8px", background: "var(--surface-raised)" }} 
                onClick={() => {
                  setDeleteModalOpen(false);
                  setConfirmNameInput("");
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="primary-button pressable" 
                style={{ 
                  margin: 0, 
                  padding: "10px 16px", 
                  borderRadius: "8px", 
                  background: confirmNameInput.trim() === (profile.name || "CashPilot Student").trim() ? "var(--danger)" : "rgba(239, 68, 68, 0.4)", 
                  borderColor: confirmNameInput.trim() === (profile.name || "CashPilot Student").trim() ? "var(--danger)" : "transparent",
                  color: "#fff",
                  cursor: confirmNameInput.trim() === (profile.name || "CashPilot Student").trim() ? "pointer" : "not-allowed" 
                }} 
                onClick={handleDeleteData}
                disabled={confirmNameInput.trim() !== (profile.name || "CashPilot Student").trim() || deleting}
              >
                {deleting ? "Deleting..." : "Delete all data"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <p className="credit-line settings-credit">Made with 💜 by Labhansh</p>
    </div>
  );
}

function CalendarGraphs({ totals, expenses }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Daily spending bar chart data
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return totals.byDate[dateKey] || 0;
  });
  const maxDaily = Math.max(...dailyData, 1);

  // Category donut data
  const catData = totals.byCategory.filter((c) => c.total > 0);
  const catTotal = catData.reduce((sum, c) => sum + c.total, 0);

  // Weekly trend (last 4 weeks)
  const weeklyData = [];
  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    let weekTotal = 0;
    expenses.forEach((exp) => {
      if (exp.type === "expense" && exp.date >= weekStart.toISOString().slice(0, 10) && exp.date <= weekEnd.toISOString().slice(0, 10)) {
        weekTotal += Number(exp.amount || 0);
      }
    });
    weeklyData.push({ label: `W${4 - i}`, total: weekTotal });
  }
  const maxWeekly = Math.max(...weeklyData.map((w) => w.total), 1);

  return (
    <>
      <section className="student-panel" style={{ marginTop: "20px" }}>
        <div className="panel-heading">
          <h2>Daily spending</h2>
          <span>This month</span>
        </div>
        <div className="bar-chart">
          {dailyData.map((val, i) => (
            <div key={i} className="bar-chart-col">
              <div className="bar-chart-bar" style={{ height: `${(val / maxDaily) * 100}%` }} />
              {(i + 1) % 5 === 0 && <span className="bar-chart-label">{i + 1}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="student-panel" style={{ marginTop: "14px" }}>
        <div className="panel-heading">
          <h2>Weekly trend</h2>
          <span>Last 4 weeks</span>
        </div>
        <div className="weekly-chart">
          {weeklyData.map((week, i) => (
            <div key={i} className="weekly-chart-item">
              <div className="weekly-chart-bar-wrap">
                <div className="weekly-chart-bar" style={{ height: `${(week.total / maxWeekly) * 100}%` }} />
              </div>
              <span className="weekly-chart-label">{week.label}</span>
              <span className="weekly-chart-value">{currency(week.total)}</span>
            </div>
          ))}
        </div>
      </section>

      {catData.length > 0 && (
        <section className="student-panel" style={{ marginTop: "14px" }}>
          <div className="panel-heading">
            <h2>Category split</h2>
            <span>{currency(catTotal)} total</span>
          </div>
          <div className="category-bar-chart">
            {catData.map((cat) => {
              const pct = catTotal > 0 ? (cat.total / catTotal) * 100 : 0;
              return (
                <div key={cat.name} className="category-bar-row">
                  <span className="category-bar-name">{cat.name}</span>
                  <div className="category-bar-track">
                    <div className="category-bar-fill" style={{ width: `${pct}%`, background: cat.color }} />
                  </div>
                  <span className="category-bar-pct">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function CalendarScreen({ expenses, totals, onAdd, splits, settleSplit, unsettleSplit }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [closing, setClosing] = useState(false);

  const monthDate = new Date(`${viewMonth}-01T00:00:00`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const closePopup = () => {
    setClosing(true);
    setTimeout(() => {
      setSelectedDate(null);
      setClosing(false);
    }, 280);
  };

  const selectedExpenses = selectedDate ? expenses.filter((item) => item.date === selectedDate) : [];
  const selectedTotal = selectedDate ? (totals.byDate[selectedDate] || 0) : 0;
  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="page calendar-page">
      <section className="hero-copy utility-hero">
        <h1>Expense<br /><span>calendar</span></h1>
        <p>Each marked day shows how much you spent. Darker purple means heavier spending.</p>
      </section>

      <section className="calendar-shell">
        <div className="calendar-head" style={{ flexDirection: "row", alignItems: "center" }}>
          <button type="button" className="datepicker-nav pressable" onClick={prevMonth}>‹</button>
          <h2 style={{ flex: 1, textAlign: "center", fontSize: "17px" }}>{monthName}</h2>
          <button type="button" className="datepicker-nav pressable" onClick={nextMonth}>›</button>
        </div>

        <div className="weekday-row">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-cell empty" key={`empty-${index}`} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const amount = totals.byDate[dateKey] || 0;
            const tier = getTierForAmount(amount);
            const intensity = tier.alpha;
            return (
              <button
                key={dateKey}
                className={`calendar-cell pressable ${dateKey === selectedDate ? "selected" : ""} ${amount ? "has-spend" : ""}`}
                onClick={() => setSelectedDate(dateKey)}
                style={{ "--spend-alpha": intensity }}
              >
                <span>{day}</span>
                {amount > 0 && <b>{currency(amount)}</b>}
              </button>
            );
          })}
        </div>
      </section>

      <CalendarGraphs totals={totals} expenses={expenses} />

      {selectedDate && createPortal(
        <div className={`modal-backdrop ${closing ? "calendar-closing" : ""}`} onMouseDown={closePopup}>
          <div className="calendar-detail-popup" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close-button" aria-label="Close" onClick={closePopup}>
              <X size={16} />
            </button>
            <div className="calendar-detail-date">{new Date(selectedDate + "T00:00:00").getDate()}</div>
            <p className="calendar-detail-label">{selectedLabel}</p>
            <div className="calendar-detail-total">{currency(selectedTotal)}</div>
            {selectedExpenses.length > 0 ? (
              <div className="expense-list" style={{ marginTop: "16px" }}>
                {selectedExpenses.map((item) => <ExpenseRow key={item.id} expense={item} splits={splits} settleSplit={settleSplit} unsettleSplit={unsettleSplit} />)}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "16px", textAlign: "center" }}>No expenses on this day</p>
            )}
            <button className="primary-button pressable" style={{ marginTop: "16px" }} onClick={() => { closePopup(); setTimeout(onAdd, 300); }}>
              Add expense
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function InboxScreen({ totals, settings, expenses, onBudget, notifications, onReadNotification, splits, settleSplit, unsettleSplit }) {
  const pendingSplits = (splits || []).filter(s => s.status === "pending");
  const settledSplits = (splits || []).filter(s => s.status === "settled");

  const nudges = useMemo(() => {
    const list = [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - now.getDate());

    // 1. Savings Goal Nudge
    const goalVal = Number(settings?.savingsGoal || 0);
    if (goalVal > 0) {
      if (totals.left >= goalVal) {
        const margin = totals.left - goalVal;
        list.push({
          title: "Savings goal safe",
          body: `You are on track to save ${currency(goalVal)}. You have a safety margin of ${currency(margin)} remaining.`,
          type: "success"
        });
      } else if (totals.left > 0) {
        const deficit = goalVal - totals.left;
        list.push({
          title: "Savings target warning",
          body: `You are short of your ${currency(goalVal)} savings goal by ${currency(deficit)}. Try to reduce non-essential spend!`,
          type: "warning"
        });
      } else {
        list.push({
          title: "Savings goal deficit",
          body: `You have completely exhausted your budget. Any extra spend directly cuts into your core savings of ${currency(goalVal)}!`,
          type: "danger"
        });
      }
    }

    // 2. Safe daily limit / Runway
    if (totals.left > 0) {
      list.push({
        title: "Safe daily limit",
        body: `You can safely spend ${currency(totals.dailyLimit)} per day for the remaining ${daysRemaining} days.`,
        type: "success"
      });
    } else {
      list.push({
        title: "Out of runway",
        body: `Remaining budget: ₹0. Limit daily spends completely to protect your savings.`,
        type: "danger"
      });
    }

    // 3. Category distribution
    const sortedCategories = [...(totals.byCategory || [])]
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    if (sortedCategories.length > 0) {
      const topCat = sortedCategories[0];
      const percentage = Math.round((topCat.total / Math.max(totals.spent, 1)) * 100);
      if (percentage > 30) {
        if (topCat.name === "Food") {
          list.push({
            title: "High food expenses",
            body: `Food accounts for ${percentage}% of your budget (total ${currency(topCat.total)}). Consider cooking or budget meals.`,
            type: "warning"
          });
        } else if (topCat.name === "Entertainment") {
          list.push({
            title: "Entertainment watch",
            body: `You spent ${percentage}% of your expenses on entertainment. Keep tabs on leisure spends!`,
            type: "warning"
          });
        } else {
          list.push({
            title: `Top category: ${topCat.name}`,
            body: `${topCat.name} accounts for ${percentage}% of your total spends (${currency(topCat.total)}) this month.`,
            type: "info"
          });
        }
      }
    }

    // 4. Weekend impulse spend warning
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      list.push({
        title: "Weekend spending mode",
        body: "Weekends are peak spend times. Stick to your daily budget limit and avoid impulsive orders.",
        type: "warning"
      });
    }

    // 5. No spend days
    const activeDaysThisMonth = Object.keys(totals.byDate || {}).length;
    const daysPassed = now.getDate();
    const noSpendDays = daysPassed - activeDaysThisMonth;
    if (noSpendDays > 0) {
      list.push({
        title: "Budget discipline check",
        body: `Excellent work! You had ${noSpendDays} 'No Spend' days so far this month.`,
        type: "success"
      });
    } else {
      list.push({
        title: "Continuous spend alert",
        body: "You've logged spends every day this month. Challenge yourself to a 'No Spend' day tomorrow!",
        type: "info"
      });
    }

    // 6. Fast spend burn rate
    const averageSpentPerDay = totals.spent / Math.max(daysPassed, 1);
    const idealAveragePerDay = Number(settings?.allowance || 0) / daysInMonth;
    if (averageSpentPerDay > idealAveragePerDay * 1.2 && totals.left > 0) {
      list.push({
        title: "High burn rate",
        body: `You are burning budget at ${currency(averageSpentPerDay)}/day compared to ideal ${currency(idealAveragePerDay)}/day.`,
        type: "warning"
      });
    }

    return list;
  }, [totals, settings, expenses]);

  return (
    <div className="page utility-page">
      <section className="hero-copy utility-hero">
        <h1>Smart nudges</h1>
        <p>Alerts, reminders, and insights to help you stay on top of your budget.</p>
      </section>

      {pendingSplits.length > 0 && (
        <section className="student-panel" style={{ marginBottom: "16px" }}>
          <div className="panel-heading">
            <h2>Pending splits</h2>
            <span>{pendingSplits.length} pending</span>
          </div>
          {pendingSplits.map((split) => (
            <div key={split.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "8px", padding: "12px 14px", marginBottom: "6px", background: "rgba(255, 200, 100, 0.06)", border: "1px solid rgba(255, 200, 100, 0.12)" }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                <strong style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>You split {currency(split.originalAmount)} with {split.friendName}</strong>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0", lineHeight: "1.4" }}>
                  Your share: {currency(split.yourShare)} · Friend owes: {currency(split.friendShare)}
                </p>
              </div>
              <button className="primary-button pressable" style={{ width: "auto", margin: 0, padding: "8px 16px", fontSize: "12px", height: "fit-content", flexShrink: 0 }} onClick={() => settleSplit(split.id)}>
                Settle
              </button>
            </div>
          ))}
        </section>
      )}

      {settledSplits.length > 0 && (
        <section className="student-panel" style={{ marginBottom: "16px" }}>
          <div className="panel-heading">
            <h2>Settled splits</h2>
          </div>
          {settledSplits.slice(0, 5).map((split) => (
            <div key={split.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "8px", padding: "10px 14px", marginBottom: "6px", background: "var(--surface)", border: "1px solid var(--border)", opacity: 0.7 }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                <strong style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "var(--text-secondary)", textDecoration: "line-through" }}>{currency(split.originalAmount)} with {split.friendName}</strong>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>
                  Settled{split.settledDate ? ` on ${split.settledDate}` : ""}
                </p>
              </div>
              <button className="primary-button pressable" style={{ width: "auto", margin: 0, padding: "6px 12px", fontSize: "11px", height: "fit-content", flexShrink: 0, background: "rgba(200, 240, 192, 0.08)", border: "1px solid rgba(200, 240, 192, 0.2)", color: "var(--accent-light)" }} onClick={() => unsettleSplit(split.id)}>
                Settled
              </button>
            </div>
          ))}
        </section>
      )}

      {notifications && notifications.length > 0 && (
        <section className="student-panel" style={{ marginBottom: "16px" }}>
          <div className="panel-heading">
            <h2>Recent alerts</h2>
            <span>{notifications.length} unread</span>
          </div>
          {notifications.slice(0, 5).map((notif) => (
            <button className="message-card pressable" key={notif.id} onClick={() => onReadNotification(notif.id)} style={{ marginBottom: "8px", width: "100%" }}>
              <span><Bell size={18} /></span>
              <div>
                <strong>{notif.title}</strong>
                <p>{notif.message}</p>
              </div>
              <X size={14} />
            </button>
          ))}
        </section>
      )}

      <div className="message-list">
        {nudges.map((nudge) => {
          let NudgeIcon = Mail;
          let iconColor = "var(--muted)";
          let iconBg = "rgba(169, 141, 245, 0.15)";
          if (nudge.type === "success") {
            NudgeIcon = Sparkles;
            iconColor = "#c8f0c0";
            iconBg = "rgba(200, 240, 192, 0.15)";
          } else if (nudge.type === "warning") {
            NudgeIcon = Bell;
            iconColor = "#f5d08d";
            iconBg = "rgba(245, 208, 141, 0.15)";
          } else if (nudge.type === "danger") {
            NudgeIcon = Target;
            iconColor = "#f59f8d";
            iconBg = "rgba(245, 159, 141, 0.15)";
          } else if (nudge.type === "info") {
            NudgeIcon = Mail;
            iconColor = "#a98df5";
            iconBg = "rgba(169, 141, 245, 0.15)";
          }
          return (
            <div className="message-card" key={nudge.title} style={{ cursor: "default", display: "grid", gridTemplateColumns: "36px 1fr", gap: "14px" }}>
              <span style={{ background: iconBg, color: iconColor }}><NudgeIcon size={18} /></span>
              <div>
                <strong>{nudge.title}</strong>
                <p>{nudge.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomTabs({ active, setScreen }) {
  return (
    <nav className="bottom-tabs" aria-label="Main navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isAction = item.id === "add";
        return (
          <button
            key={item.id}
            className={`tab-button pressable ${active === item.id ? "active" : ""} ${isAction ? "action-tab" : ""}`}
            aria-label={item.label}
            onClick={() => setScreen(item.id)}
          >
            <Icon size={isAction ? 25 : 21} />
          </button>
        );
      })}
    </nav>
  );
}

function StudentModal({ onClose, expenseId, addSplit, splitContext, onAdd }) {
  const [form, setForm] = useState({ 
    friendName: "", 
    amount: splitContext?.amount || "", 
    yourShare: "" 
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const originalAmount = Number(form.amount);
    const yourShare = Number(form.yourShare);
    if (!form.friendName.trim() || !originalAmount || !yourShare) {
      setError("Please fill in all fields.");
      return;
    }
    if (yourShare > originalAmount) {
      setError("Your share can't exceed the total amount.");
      return;
    }
    setError("");
    try {
      let linkedExpenseId = expenseId || "";

      // 1. Automatically log the user's share as a regular transaction
      if (onAdd) {
        const title = splitContext?.title 
          ? `${splitContext.title} (Split with ${form.friendName.trim()})`
          : `Split with ${form.friendName.trim()}`;
        const ref = await onAdd({
          title,
          amount: yourShare,
          category: splitContext?.category || "Other",
          date: splitContext?.date || today(),
          note: splitContext?.note || ""
        });
        if (ref && ref.id) {
          linkedExpenseId = ref.id;
        }
      }

      // 2. Create the split record in Firebase splits collection
      await addSplit({ 
        expenseId: linkedExpenseId, 
        originalAmount, 
        yourShare, 
        friendName: form.friendName.trim() 
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError("Could not create split. Try again.");
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Split expense">
      <section className="modal-card">
        <button className="close-button" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
        <div className="modal-icon">
          <IndianRupee size={22} />
        </div>
        <h2>Split with friend</h2>
        {success ? (
          <p>Split created successfully!</p>
        ) : (
          <form className="expense-form" onSubmit={submit}>
            <label>
              <span>Friend's name</span>
              <input value={form.friendName} onChange={(event) => setForm({ ...form, friendName: event.target.value })} placeholder="" />
            </label>
            <label>
              <span>Total amount</span>
              <AmountInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} />
            </label>
            <label>
              <span>Your share</span>
              <AmountInput value={form.yourShare} onChange={(val) => setForm({ ...form, yourShare: val })} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button pressable" type="submit">Split expense</button>
          </form>
        )}
      </section>
    </div>
  );
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("cashpilot-install-dismissed") === "true";
  });

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a 3 second delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("cashpilot-install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return createPortal(
    <div className="install-prompt">
      <div className="install-prompt-content">
        <button className="close-button" onClick={handleDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
        <div className="install-prompt-icon">
          <Sparkles size={20} />
        </div>
        <div className="install-prompt-text">
          <strong>Install CashPilot</strong>
          <p>Add to home screen for a better experience</p>
        </div>
        <button className="install-prompt-btn pressable" onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>,
    document.body
  );
}

createRoot(document.getElementById("root")).render(<App />);
