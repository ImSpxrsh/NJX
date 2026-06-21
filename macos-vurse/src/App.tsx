import {
  Activity,
  Airplay,
  AlertTriangle,
  ArrowRight,
  AtSign,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  Fingerprint,
  Home,
  KeyRound,
  Laptop,
  Link2,
  Lock,
  LockKeyhole,
  Mail,
  MessageCircle,
  MonitorCheck,
  MoreHorizontal,
  Network,
  PanelLeft,
  Phone,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  UsersRound,
  Vault,
  WalletCards,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";

type Page =
  | "overview"
  | "verify"
  | "protection"
  | "identity"
  | "privacy"
  | "recovery"
  | "family"
  | "activity"
  | "enterprise"
  | "settings";

type AppName = "verus" | "safari" | "messages" | null;
type VerificationState =
  | "RECEIVED"
  | "PAUSED"
  | "PENDING"
  | "VERIFIED"
  | "DENIED"
  | "EXPIRED";

type Notice = {
  id: number;
  title: string;
  body: string;
  level: "safe" | "attention" | "danger";
  page?: Page;
};

type Breach = {
  Name: string;
  Title?: string;
  Domain?: string;
  BreachDate?: string;
  DataClasses?: string[];
};

const navItems: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "verify", label: "Verify", icon: BadgeCheck },
  { id: "protection", label: "Protection", icon: Shield },
  { id: "identity", label: "Identity", icon: Fingerprint },
  { id: "privacy", label: "Privacy", icon: EyeOff },
  { id: "recovery", label: "Recovery", icon: RotateCcw },
  { id: "family", label: "Family Circle", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "enterprise", label: "Enterprise", icon: Building2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const activityData = [
  { time: "8 AM", activity: 18, event: "Normal activity", risk: "Low" },
  { time: "10 AM", activity: 11, event: "Tracker blocked", risk: "Low" },
  { time: "12 PM", activity: 22, event: "New login challenge", risk: "Medium" },
  { time: "2 PM", activity: 34, event: "Family verification", risk: "Low" },
  { time: "4 PM", activity: 46, event: "Suspicious link blocked", risk: "High" },
  { time: "6 PM", activity: 28, event: "Context shift", risk: "Medium" },
  { time: "8 PM", activity: 39, event: "Network trusted", risk: "Low" },
  { time: "10 PM", activity: 42, event: "Protected session", risk: "Low" },
];

const demoBreaches: Breach[] = [
  {
    Name: "Adobe",
    Title: "Adobe",
    Domain: "adobe.com",
    BreachDate: "2013-10-04",
    DataClasses: ["Email addresses", "Password hints", "Passwords", "Usernames"],
  },
  {
    Name: "Dropbox",
    Title: "Dropbox",
    Domain: "dropbox.com",
    BreachDate: "2012-07-01",
    DataClasses: ["Email addresses", "Passwords"],
  },
];

const scenarios = [
  ["Grandchild emergency", "Changed number · bail money", "DENIED"],
  ["Executive impersonation", "Urgent wire transfer", "BLOCKED"],
  ["Gift-card request", "Family baseline mismatch", "DENIED"],
  ["Bank fraud call", "One-time code request", "BLOCKED"],
  ["Remote tech support", "Screen-control request", "BLOCKED"],
  ["Changed crypto address", "Clipboard mismatch", "PAUSED"],
  ["Password breach", "Old credential exposure", "RECOVERY"],
  ["Suspicious parking QR", "Lookalike destination", "BLOCKED"],
  ["New email login", "Unrecognized browser", "REVOKED"],
  ["Public airport Wi-Fi", "Untrusted network", "PROTECTED"],
  ["Data broker exposure", "Old address published", "REMOVAL"],
  ["Recovery takeover", "Recovery email changed", "LOCKDOWN"],
  ["Legitimate emergency", "Contact confirms request", "VERIFIED"],
  ["Request expires", "No independent response", "EXPIRED"],
  ["Disconnect this Mac", "Network isolation test", "ISOLATED"],
];

const protectionModules = [
  { title: "Network Shield", copy: "DNS protection and suspicious connections", icon: Network, value: "14 blocked" },
  { title: "Link & QR Scanner", copy: "Inspect redirects before you open them", icon: QrCode, value: "Ready" },
  { title: "File Check", copy: "Signature and behavior inspection", icon: FileCheck2, value: "No threats" },
  { title: "Clipboard Guard", copy: "Payment destinations stay unchanged", icon: Copy, value: "Watching" },
  { title: "Remote Access Guard", copy: "Screen-control requests require verification", icon: Airplay, value: "Protected" },
  { title: "Login Guard", copy: "Review new devices and recovery changes", icon: KeyRound, value: "1 reviewed" },
];

/* ─── Family Circle (single source of truth) ───────────────
   Same enrolled contacts rendered on the Family Circle screen.
   Used both there and by the claimed-sender name matcher. */
type FamilyContact = {
  id: number;
  name: string;
  relation: string;
  phone: string;
  email: string;
  baseline: string;
  safePhrase: boolean;
};

const initialFamilyContacts: FamilyContact[] = [
  { id: 1, name: "Maya Roy", relation: "Daughter", phone: "(609) 555-0148", email: "maya.roy@example.com", baseline: "Never requests gift cards", safePhrase: true },
  { id: 2, name: "Daniel Roy", relation: "Grandson", phone: "(609) 555-0162", email: "daniel.roy@example.com", baseline: "May call from school", safePhrase: false },
  { id: 3, name: "Priya Shah", relation: "Family friend", phone: "(609) 555-0181", email: "priya.shah@example.com", baseline: "No money requests", safePhrase: false },
];

const NO_CONTACT_MATCH = "Unknown — no name matching your trusted circle was found";

type ClaimMatch = { display: string; firstName: string; count: number };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Match a pasted/typed message against the enrolled contacts (the live
   Family Circle list), case-insensitive, on first name or full name with
   word boundaries. One match → that name; several distinct matches → list
   them all; none → explicit Unknown. */
function matchClaimedSender(text: string, contacts: FamilyContact[]): ClaimMatch {
  const matched: string[] = [];
  for (const { name } of contacts) {
    const first = name.split(" ")[0];
    const firstRe = new RegExp(`\\b${escapeRegex(first)}\\b`, "i");
    const fullRe = new RegExp(`\\b${escapeRegex(name).replace(/\s+/g, "\\s+")}\\b`, "i");
    if (fullRe.test(text) || firstRe.test(text)) matched.push(name);
  }
  if (matched.length === 0) return { display: NO_CONTACT_MATCH, firstName: "the caller", count: 0 };
  if (matched.length === 1) return { display: matched[0], firstName: matched[0].split(" ")[0], count: 1 };
  return { display: matched.join(", "), firstName: "the caller", count: matched.length };
}

/* ─── Clock ─────────────────────────────────────────────── */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── Main App ───────────────────────────────────────────── */
function App() {
  const [activeApp, setActiveApp] = useState<AppName>(null);
  const [page, setPage] = useState<Page>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationCenter, setNotificationCenter] = useState(false);
  const [networkConnected, setNetworkConnected] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [publicWifi, setPublicWifi] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [verification, setVerification] = useState<VerificationState>("RECEIVED");
  const [interruption, setInterruption] = useState(false);
  const [receiptReady, setReceiptReady] = useState(false);
  const [trustedReply, setTrustedReply] = useState(false);
  const [contacts, setContacts] = useState<FamilyContact[]>(initialFamilyContacts);
  const [claimedMatch, setClaimedMatch] = useState<ClaimMatch>(() => matchClaimedSender("", initialFamilyContacts));
  const [emailOpened, setEmailOpened] = useState(false);
  const [email, setEmail] = useState("sparsh.roy@example.com");
  const [breaches, setBreaches] = useState<Breach[] | null>(null);
  const [breachSource, setBreachSource] = useState<"demo" | "hibp">("demo");
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [recoveryPlan, setRecoveryPlan] = useState(false);
  const [lockdown, setLockdown] = useState(false);
  const [toast, setToast] = useState("");
  const [notifications, setNotifications] = useState<Notice[]>([
    { id: 1, title: "Protected", body: "Identity monitoring and Network Shield are active.", level: "safe", page: "overview" },
  ]);
  const timerScheduled = useRef(false);
  const time = useClock();


  const pushNotice = (title: string, body: string, level: Notice["level"] = "attention", targetPage: Page = "overview") => {
    const notice = { id: Date.now(), title, body, level, page: targetPage };
    setNotifications((c) => [notice, ...c].slice(0, 8));
    setToast(title);
    window.setTimeout(() => setToast(""), 3400);
  };

  useEffect(() => {
    if (timerScheduled.current) return;
    timerScheduled.current = true;
    const t = window.setTimeout(() => {
      pushNotice("Verus is quietly watching", "Open Secure Mail in Safari to try the phishing interruption demo.", "safe", "verify");
    }, 4200);
    return () => window.clearTimeout(t);
  }, []);

  const openVerus = (target: Page = "overview") => {
    setActiveApp("verus"); setPage(target); setMenuOpen(false); setNotificationCenter(false);
  };

  const isolateNetwork = () => {
    setNetworkConnected(false); setMenuOpen(false);
    pushNotice("Network isolated", "This simulated Mac is no longer connected to the internet.", "attention", "protection");
  };

  const restoreNetwork = () => {
    setNetworkConnected(true); setLockdown(false);
    pushNotice("Connectivity restored", "Network Shield is active and the connection is trusted.", "safe", "overview");
  };

  const launchScenario = (name = "Grandchild emergency scam", outcome = "DENIED", message?: string) => {
    const messageForMatch = message ?? scenarioMessages[name] ?? scenarioMessages[name.replace(/ scam$/i, "")] ?? "";
    setClaimedMatch(matchClaimedSender(messageForMatch, contacts));
    if (name.includes("Password")) { openVerus("identity"); void checkIdentity(); return; }
    if (name.includes("Public")) { setPublicWifi(true); openVerus("protection"); pushNotice("Public Wi-Fi Mode active", "Untrusted-network protections were enabled automatically.", "attention", "protection"); return; }
    if (name.includes("Data broker")) { openVerus("privacy"); pushNotice("Exposure found", "An old address and phone number were found on a people-search site.", "attention", "privacy"); return; }
    if (name.includes("Disconnect")) { isolateNetwork(); return; }
    if (name.includes("Recovery takeover")) { openVerus("recovery"); startLockdown(); return; }
    if (name.includes("Legitimate")) {
      setVerification("PAUSED"); setTrustedReply(false); setReceiptReady(false); setInterruption(true);
      pushNotice("Action paused", "A family request is waiting for independent confirmation.", "attention", "verify"); return;
    }
    setVerification(outcome === "EXPIRED" ? "EXPIRED" : "PAUSED");
    setTrustedReply(false); setReceiptReady(false); setInterruption(true);
    pushNotice("Action paused", `${name} is waiting for independent confirmation.`, "danger", "verify");
  };

  const openScamEmail = () => {
    setEmailOpened(true);
    window.setTimeout(() => {
      setVerification("PAUSED"); setInterruption(true);
      pushNotice("Phishing email detected", "This message uses a lookalike sign-in page and account pressure.", "danger", "verify");
    }, 2000);
  };

  const addContact = (contact: Omit<FamilyContact, "id">) => {
    setContacts((current) => [...current, { ...contact, id: Date.now() }]);
  };
  const removeContact = (id: number) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  };

  const startVerification = () => { setVerification("PENDING"); window.setTimeout(() => setTrustedReply(true), 900); };

  const resolveVerification = (approved: boolean) => {
    setVerification(approved ? "VERIFIED" : "DENIED"); setTrustedReply(false); setReceiptReady(true);
    pushNotice(approved ? "Verification complete" : "Request denied", approved ? `${claimedMatch.firstName} confirmed that this request is legitimate.` : `${claimedMatch.firstName} reported that they did not send this request.`, approved ? "safe" : "danger", "activity");
  };

  const closeInterruption = () => {
    if (!["DENIED", "VERIFIED", "EXPIRED"].includes(verification)) {
      pushNotice("Request remains paused", "The risky action cannot continue before independent confirmation.", "attention", "verify"); return;
    }
    setInterruption(false); openVerus(receiptReady ? "activity" : "verify");
  };

  const checkIdentity = async () => {
    setCheckingIdentity(true); setRecoveryPlan(false);
    try {
      const r = await fetch(`/api/breaches?email=${encodeURIComponent(email)}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setBreaches(d.breaches ?? []); setBreachSource(d.source === "hibp" ? "hibp" : "demo");
    } catch {
      setBreaches(demoBreaches); setBreachSource("demo");
    } finally {
      setCheckingIdentity(false);
      pushNotice("Credential exposure found", "Older breach records were found. Credential reuse is blocked until reviewed.", "attention", "identity");
    }
  };

  const startLockdown = () => {
    setLockdown(true); setNetworkConnected(false);
    pushNotice("Emergency Lockdown active", "Network, outgoing payments, sessions, and the recovery vault are paused.", "danger", "recovery");
  };

  const bodyClass = ["desktop-shell", highContrast ? "high-contrast" : "", largeText ? "large-text" : ""].filter(Boolean).join(" ");

  return (
    <main className={bodyClass}>
      <div className="wallpaper-orb wallpaper-orb-one" />
      <div className="wallpaper-orb wallpaper-orb-two" />

      <MacMenuBar
        time={time}
        connected={networkConnected}
        activeApp={activeApp}
        onNotifications={() => { setNotificationCenter((v) => !v); setMenuOpen(false); }}
        notificationCount={notifications.length}
      />

      <AnimatePresence>
        {menuOpen && (
          <VerusPopover
            connected={networkConnected}
            privacyMode={privacyMode}
            onOpen={openVerus}
            onScenario={() => launchScenario()}
            onPrivacy={() => { setPrivacyMode((v) => !v); pushNotice(privacyMode ? "Privacy Mode off" : "Privacy Mode active", privacyMode ? "Standard connection settings restored." : "Trackers and nonessential background connections are paused.", "safe", "privacy"); }}
            onDisconnect={networkConnected ? isolateNetwork : restoreNetwork}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notificationCenter && (
          <NotificationCenter
            notices={notifications}
            onOpen={(n) => openVerus(n.page ?? "overview")}
            onClear={() => setNotifications([])}
          />
        )}
      </AnimatePresence>

      <section className="desktop-icons" aria-label="Desktop shortcuts">
        <DesktopShortcut label="Safety Receipts" icon={<FileCheck2 />} onClick={() => openVerus("activity")} />
        <DesktopShortcut label="Recovery Vault" icon={<Vault />} onClick={() => openVerus("recovery")} />
      </section>

      <AnimatePresence>
        {activeApp && (
          <AppWindow app={activeApp} maximized={maximized} onClose={() => setActiveApp(null)} onMinimize={() => setActiveApp(null)} onMaximize={() => setMaximized((v) => !v)}>
            {activeApp === "verus" && (
              <VerusApp
                page={page} onPage={setPage} connected={networkConnected} privacyMode={privacyMode}
                publicWifi={publicWifi} verification={verification} receiptReady={receiptReady} claimedSender={claimedMatch.display}
                email={email} setEmail={setEmail} breaches={breaches} breachSource={breachSource}
                checkingIdentity={checkingIdentity} recoveryPlan={recoveryPlan} lockdown={lockdown}
                contacts={contacts} onAddContact={addContact} onRemoveContact={removeContact}
                highContrast={highContrast} largeText={largeText} onScenario={launchScenario}
                onCheckIdentity={checkIdentity}
                onRecoveryPlan={() => { setRecoveryPlan(true); pushNotice("Recovery plan created", "Start with the primary email account, then update dependent accounts.", "safe", "recovery"); }}
                onPrivacyMode={() => { setPrivacyMode((v) => !v); pushNotice(privacyMode ? "Disappear Mode off" : "Disappear Mode active", privacyMode ? "Standard privacy controls restored." : "Nonessential exposure has been reduced.", "safe", "privacy"); }}
                onDisconnect={networkConnected ? isolateNetwork : restoreNetwork}
                onLockdown={lockdown ? restoreNetwork : startLockdown}
                onHighContrast={setHighContrast} onLargeText={setLargeText}
                onToast={(msg) => pushNotice(msg, "Demo action completed.", "safe", page)}
              />
            )}
            {activeApp === "safari" && <SafariApp emailOpened={emailOpened} onOpenEmail={openScamEmail} />}
            {activeApp === "messages" && <MessagesApp onVerify={() => launchScenario("Gift-card request")} />}
          </AppWindow>
        )}
      </AnimatePresence>

      <MacDock
        activeApp={activeApp}
        onOpen={(app) => { setActiveApp(app); if (app === "verus") setPage("overview"); }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.96 }}>
            <img src="/verus-logo.png" alt="" />
            <div><strong>{toast}</strong><span>Click the Verus icon for details.</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {interruption && (
          <InterruptionOverlay
            state={verification} trustedReply={trustedReply} receiptReady={receiptReady}
            claimedSender={claimedMatch.display} claimedFirstName={claimedMatch.firstName}
            onStart={startVerification} onResolve={resolveVerification} onClose={closeInterruption}
            onEnd={() => { setVerification("DENIED"); setReceiptReady(true); pushNotice("Interaction ended safely", "No money or credentials were sent.", "safe", "activity"); }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ─── macOS Big Sur Menu Bar ─────────────────────────────── */
function MacMenuBar({ time, connected, activeApp, onNotifications, notificationCount }: {
  time: string; connected: boolean; activeApp: AppName;
  onNotifications: () => void; notificationCount: number;
}) {
  const appMenus: Record<string, string[]> = {
    verus: ["Verus", "File", "View", "Protection", "Window", "Help"],
    safari: ["Safari", "File", "Edit", "View", "History", "Window", "Help"],
    messages: ["Messages", "File", "Edit", "View", "Conversations", "Window", "Help"],
  };
  const menus = activeApp ? (appMenus[activeApp] ?? appMenus.verus) : ["Finder", "File", "Edit", "View", "Go", "Window", "Help"];

  return (
    <header className="menu-bar">
      <div className="menu-left">
        <span className="apple-logo">
          <svg viewBox="0 0 814 1000" width="14" height="14" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.5-57.9-155.5-127.4C46 405.8 15.5 268.1 15.5 233.3c0-5.2.1-10.3.3-15.5C24.2 109.4 116 46.3 208.9 46.3c77.9 0 141.9 52.5 190.5 52.5 46.3 0 120.5-55.5 209.2-55.5 33.6 0 133.3 3.6 200.8 129.6zM505.7 28.4c-11.7 52.5-41.9 101.4-82.1 134.1-40.8 33.3-90.5 53.5-140.3 53.5a197.9 197.9 0 01-3-24c0-51.4 25.8-105.5 67.1-139.5C387.1 18.7 445 0 497.9 0c1.7 0 3.3.1 5 .2A199.5 199.5 0 01505.7 28.4z" />
          </svg>
        </span>
        {menus.map((item, i) => (
          <span key={item} className={i === 0 ? "menu-app-name" : "menu-item"}>{item}</span>
        ))}
      </div>
      <div className="menu-right">
        <button onClick={onNotifications} className="menu-icon-btn" aria-label="Notifications">
          <Bell size={14} />
          {notificationCount > 0 && <span className="notice-count">{notificationCount}</span>}
        </button>
        <Search size={14} className="menu-icon" />
        {connected ? <Wifi size={14} className="menu-icon" /> : <WifiOff size={14} className="menu-icon danger-icon" />}
        <SlidersHorizontal size={14} className="menu-icon" />
        <span className="menu-time">{time}</span>
      </div>
    </header>
  );
}

/* ─── macOS Big Sur Dock with magnification ──────────────── */
function MacDock({ activeApp, onOpen }: {
  activeApp: AppName;
  onOpen: (app: Exclude<AppName, null>) => void;
}) {
  const [pointer, setPointer] = useState<{ x: number; width: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - rect.left, width: rect.width });
  };

  type DockItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    cls: string;
    action?: () => void;
    sep?: never;
  } | { sep: true; id: string; label?: never; icon?: never; cls?: never; action?: never };

  const items: DockItem[] = [
    { id: "finder", label: "Finder", icon: <PanelLeft />, cls: "finder" },
    { id: "launchpad", label: "Launchpad", icon: <img src="/macos/launchpad.png" alt="" />, cls: "launchpad" },
    { id: "safari", label: "Safari", icon: <img src="/macos/safari.png" alt="" />, cls: "safari", action: () => onOpen("safari") },
    { id: "messages", label: "Messages", icon: <img src="/macos/messages.png" alt="" />, cls: "messages", action: () => onOpen("messages") },
    { id: "mail", label: "Mail", icon: <img src="/macos/mail.png" alt="" />, cls: "mail" },
    { id: "maps", label: "Maps", icon: <img src="/macos/maps.png" alt="" />, cls: "maps" },
    { id: "photos", label: "Photos", icon: <img src="/macos/photos.png" alt="" />, cls: "photos" },
    { id: "music", label: "Music", icon: <img src="/macos/music.png" alt="" />, cls: "music" },
    { id: "tv", label: "TV", icon: <img src="/macos/tv.png" alt="" />, cls: "tv" },
    { id: "news", label: "News", icon: <img src="/macos/news.png" alt="" />, cls: "news" },
    { id: "calendar", label: "Calendar", icon: <img src="/macos/calendar.png" alt="" />, cls: "calendar" },
    { sep: true, id: "s1" },
    { id: "verus", label: "Verus", icon: <img src="/verus-logo.png" alt="" />, cls: "verus", action: () => onOpen("verus") },
    { sep: true, id: "s2" },
    { id: "settings", label: "System Settings", icon: <img src="/macos/systempreferences.png" alt="" />, cls: "settings" },
    { id: "trash", label: "Trash", icon: <Trash2 />, cls: "trash" },
  ];

  const nonSepItems = items.filter((i) => !i.sep);
  const getScale = (nonSepIndex: number) => {
    if (pointer === null) return 1;
    const iconW = pointer.width / nonSepItems.length;
    const center = (nonSepIndex + 0.5) * iconW;
    const dist = Math.abs(pointer.x - center);
    const maxDist = iconW * 2.8;
    if (dist > maxDist) return 1;
    return 1 + (1 - dist / maxDist) * 0.75;
  };

  return (
    <nav
      className="dock"
      aria-label="Application dock"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPointer(null)}
    >
      {items.map((item) => {
        if (item.sep) return <span key={item.id} className="dock-separator" />;
        const idx = nonSepItems.findIndex((candidate) => candidate.id === item.id);
        const scale = getScale(idx);
        const ty = -(scale - 1) * 28;
        const isActive = activeApp === item.id;
        return (
          <button
            key={item.id}
            className={`dock-icon ${item.cls}`}
            style={{
              transform: `translateY(${ty}px) scale(${scale})`,
              transformOrigin: "bottom center",
              transition: pointer === null ? "transform 0.28s ease" : "transform 0.08s ease",
            }}
            onClick={item.action}
            aria-label={item.label}
          >
            {item.icon}
            <span className="dock-label">{item.label}</span>
            {isActive && <i className="dock-dot" />}
          </button>
        );
      })}
    </nav>
  );
}

/* ─── Verus menubar popover ──────────────────────────────── */
function VerusPopover({ connected, privacyMode, onOpen, onScenario, onPrivacy, onDisconnect }: {
  connected: boolean; privacyMode: boolean;
  onOpen: (page?: Page) => void; onScenario: () => void; onPrivacy: () => void; onDisconnect: () => void;
}) {
  return (
    <motion.aside className="verus-popover glass" initial={{ opacity: 0, y: -12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}>
      <div className="popover-heading">
        <img src="/verus-logo.png" alt="Verus" />
        <div><strong>VERUS</strong><span><CheckCircle2 size={14} /> Protected</span></div>
      </div>
      <div className="device-summary">
        <StatusLine icon={ShieldCheck} text="Device protected" />
        <StatusLine icon={connected ? Wifi : WifiOff} text={connected ? "Network trusted" : "Network isolated"} />
        <StatusLine icon={BadgeCheck} text="No unresolved requests" />
        <StatusLine icon={Fingerprint} text="Identity monitoring active" />
      </div>
      <div className="popover-section">
        <small>QUICK ACTIONS</small>
        <div className="quick-grid">
          <button onClick={onScenario}><MessageCircle /> Check a message</button>
          <button onClick={() => onOpen("protection")}><Link2 /> Scan a link</button>
          <button onClick={() => onOpen("identity")}><KeyRound /> Check exposure</button>
          <button onClick={onPrivacy}><EyeOff /> {privacyMode ? "End Privacy Mode" : "Start Privacy Mode"}</button>
        </div>
      </div>
      <div className="popover-section">
        <small>RECENT ACTIVITY</small>
        <ul className="recent-list">
          <li><span className="event-dot amber" /> Unknown login blocked<time>8m</time></li>
          <li><span className="event-dot green" /> Trusted contact confirmed<time>1h</time></li>
          <li><span className="event-dot purple" /> 3 tracking requests blocked<time>2h</time></li>
        </ul>
      </div>
      <button className="disconnect-button" onClick={onDisconnect}>
        <Power />
        <span>
          <strong>{connected ? "Disconnect This Mac" : "Restore Connection"}</strong>
          <small>{connected ? "Simulate a network kill switch" : "Return to trusted network"}</small>
        </span>
      </button>
      <button className="primary-button full" onClick={() => onOpen("overview")}>Open Verus <ArrowRight /></button>
      <p className="privacy-note"><Lock size={12} /> Everything is processed privately whenever possible.</p>
    </motion.aside>
  );
}

/* ─── Notification center ────────────────────────────────── */
function NotificationCenter({ notices, onOpen, onClear }: { notices: Notice[]; onOpen: (n: Notice) => void; onClear: () => void }) {
  return (
    <motion.aside className="notification-center glass" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
      <div className="notification-heading">
        <div><small>NOTIFICATION CENTER</small><h2>Today</h2></div>
        <button onClick={onClear}>Clear</button>
      </div>
      {notices.length === 0 ? (
        <div className="empty-state"><Bell /><p>No new notifications</p></div>
      ) : (
        notices.map((n) => (
          <button key={n.id} className={`notification-card ${n.level}`} onClick={() => onOpen(n)}>
            <img src="/verus-logo.png" alt="" />
            <span><small>VERUS · now</small><strong>{n.title}</strong><p>{n.body}</p></span>
          </button>
        ))
      )}
    </motion.aside>
  );
}

function StatusLine({ icon: Icon, text }: { icon: typeof Shield; text: string }) {
  return <div><Icon size={16} /><span>{text}</span><Check size={15} /></div>;
}

function DesktopShortcut({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onDoubleClick={onClick} onClick={onClick}><span>{icon}</span>{label}</button>;
}

/* ─── App Window ─────────────────────────────────────────── */
function AppWindow({ app, maximized, onClose, onMinimize, onMaximize, children }: {
  app: Exclude<AppName, null>; maximized: boolean;
  onClose: () => void; onMinimize: () => void; onMaximize: () => void; children: React.ReactNode;
}) {
  return (
    <motion.section
      className={`app-window ${app}-window ${maximized ? "maximized" : ""}`}
      initial={{ opacity: 0, y: 35, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
    >
      <div className="window-controls">
        <button className="control close" onClick={onClose} aria-label="Close" />
        <button className="control minimize" onClick={onMinimize} aria-label="Minimize" />
        <button className="control maximize" onClick={onMaximize} aria-label="Maximize" />
      </div>
      {children}
    </motion.section>
  );
}

/* ─── Verus App ──────────────────────────────────────────── */
type VerusAppProps = {
  page: Page; onPage: (p: Page) => void; connected: boolean; privacyMode: boolean;
  publicWifi: boolean; verification: VerificationState; receiptReady: boolean; claimedSender: string;
  email: string; setEmail: (e: string) => void; breaches: Breach[] | null; breachSource: "demo" | "hibp";
  checkingIdentity: boolean; recoveryPlan: boolean; lockdown: boolean; highContrast: boolean; largeText: boolean;
  contacts: FamilyContact[]; onAddContact: (contact: Omit<FamilyContact, "id">) => void; onRemoveContact: (id: number) => void;
  onScenario: (name?: string, outcome?: string, message?: string) => void; onCheckIdentity: () => void; onRecoveryPlan: () => void;
  onPrivacyMode: () => void; onDisconnect: () => void; onLockdown: () => void;
  onHighContrast: (v: boolean) => void; onLargeText: (v: boolean) => void; onToast: (msg: string) => void;
};

function VerusApp(props: VerusAppProps) {
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pageScrollRef.current?.scrollTo({ top: 0 });
  }, [props.page]);

  return (
    <div className="verus-layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/verus-logo.png" alt="Verus" />
          <div><strong>VERUS</strong><small>Independent verification</small></div>
        </div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={props.page === id ? "active" : ""} onClick={() => props.onPage(id)}>
              <Icon /> <span>{label}</span>
              {id === "verify" && props.verification === "PAUSED" && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-profile">
          <div className="avatar">SR</div>
          <div><strong>Sparsh Roy</strong><span>Enterprise admin</span></div>
          <ChevronRight />
        </div>
      </aside>
      <section className="content">
        <div className="content-topbar">
          <div className="breadcrumb">
            <span>Verus</span><ChevronRight />
            <strong>{navItems.find((i) => i.id === props.page)?.label}</strong>
          </div>
          <div className="top-statuses">
            <span className={props.connected ? "safe-pill" : "danger-pill"}>
              {props.connected ? <Wifi /> : <WifiOff />}
              {props.connected ? "Trusted network" : "Network isolated"}
            </span>
            <button aria-label="Search"><Search /></button>
            <div className="mini-avatar">SR</div>
          </div>
        </div>
        <div className="page-scroll" ref={pageScrollRef}>
          <AnimatePresence mode="wait">
            <motion.div key={props.page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {props.page === "overview" && <OverviewPage {...props} />}
              {props.page === "verify" && <VerifyPage {...props} />}
              {props.page === "protection" && <ProtectionPage {...props} />}
              {props.page === "identity" && <IdentityPage {...props} />}
              {props.page === "privacy" && <PrivacyPage {...props} />}
              {props.page === "recovery" && <RecoveryPage {...props} />}
              {props.page === "family" && <FamilyPage {...props} />}
              {props.page === "activity" && <ActivityPage {...props} />}
              {props.page === "enterprise" && <EnterprisePage {...props} />}
              {props.page === "settings" && <SettingsPage {...props} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

function PageHeading({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children?: React.ReactNode }) {
  return (
    <header className="page-heading">
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>
      {children}
    </header>
  );
}

function OverviewPage(props: VerusAppProps) {
  const cards = [
    { label: "Device Protection", value: "Protected", detail: "14 risky connections blocked", meta: "Last scan 8 minutes ago", icon: Laptop },
    { label: "Identity Exposure", value: "Monitoring", detail: "2 old breaches found", meta: "No active abuse detected", icon: Fingerprint },
    { label: "Verification Requests", value: props.verification === "PAUSED" ? "Action needed" : "Ready", detail: "1 request verified today", meta: "0 unresolved", icon: BadgeCheck },
    { label: "Privacy", value: props.privacyMode ? "Disappear Mode" : "Protected", detail: "23 trackers blocked today", meta: "4 removals active", icon: EyeOff },
  ];
  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-icon"><ShieldCheck /></span>
          <small>ALL SYSTEMS CALM</small>
          <h1>Your digital life is protected.</h1>
          <p>Verus is independently checking risky requests before anything irreversible happens.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => props.onPage("verify")}>Verify something <ArrowRight /></button>
            <button className="secondary-button" onClick={() => props.onToast("Safety check complete")}><ScanLine /> Run safety check</button>
          </div>
        </div>
        <div className="protection-orbit">
          <div className="orbit-core"><img src="/verus-logo.png" alt="" /></div>
          <span className="orbit-item one"><Laptop /> Device</span>
          <span className="orbit-item two"><Wifi /> Network</span>
          <span className="orbit-item three"><Fingerprint /> Identity</span>
          <span className="orbit-item four"><Users /> Family</span>
        </div>
      </section>
      <div className="status-grid">
        {cards.map(({ label, value, detail, meta, icon: Icon }) => (
          <article className="status-card" key={label}>
            <div className="status-card-top"><span><Icon /></span><small>{value}</small></div>
            <h3>{label}</h3><strong>{detail}</strong><p>{meta}</p>
          </article>
        ))}
      </div>
      <section className="chart-card">
        <div className="section-title">
          <div><small>TODAY</small><h2>Protection activity</h2><p>Quiet events, important interruptions, and what Verus did.</p></div>
          <span className="safe-pill"><Signal /> Live</span>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activityData} margin={{ top: 12, right: 18, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: "#858aa0", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 60]} />
              <Tooltip content={<ActivityTooltip />} />
              <Line type="monotone" dataKey="activity" stroke="#d1456d" strokeWidth={3}
                dot={{ r: 5, fill: "#d1456d", stroke: "#171827", strokeWidth: 3 }}
                activeDot={{ r: 7, fill: "#fff", stroke: "#d1456d", strokeWidth: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}

function ActivityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipContentProps<number, string>["payload"];
}) {
  if (!active || !payload?.[0]) return null;
  const item = payload[0].payload as (typeof activityData)[number];
  return (
    <div className="chart-tooltip">
      <small>{item.time}</small><strong>{item.event}</strong>
      <p>Risk: {item.risk}</p><span>Verus checked the event. No user action required.</span>
    </div>
  );
}

/* ─── Verify analysis (rule-based) ──────────────────────────
   Content-driven, narrow patterns. Each category only fires on
   specific evidence, so a normal message does not accidentally
   match several categories at once. */
type RiskTier = "fact" | "signal";
type RiskFinding = { category: string; tier: RiskTier; evidence: string };

const RISK_RULES: { category: string; tier: RiskTier; patterns: RegExp[] }[] = [
  {
    category: "Payment demand",
    tier: "fact",
    patterns: [
      /\bgift\s?cards?\b/i,
      /\bwire\s+(?:transfer|the\s+money|funds|\$?\d)/i,
      /\b(?:crypto(?:currency)?|bitcoin|btc|ethereum|eth|usdt|stablecoins?)\b/i,
      /\b(?:zelle|venmo|cash\s?app|paypal|money\s?order|western\s?union|moneygram)\b/i,
      /\b(?:send|transfer|pay|wire|deposit)\b[^.?!\n]{0,40}\$\s?\d[\d,]*(?:\.\d{2})?/i,
      /\$\s?\d[\d,]*(?:\.\d+)?[^.?!\n]{0,30}\b(?:now|today|immediately|asap|right\s+away|tonight)\b/i,
    ],
  },
  {
    category: "Credential or code request",
    tier: "fact",
    patterns: [
      /\b(?:one[-\s]?time|verification|security|authentication|access|login|confirmation)\s+code\b/i,
      /\b(?:otp|2fa|two[-\s]?factor|passcode)\b/i,
      /\b(?:password|social\s+security(?:\s+number)?|ssn|account\s+number|routing\s+number|card\s+number|cvv)\b/i,
      /\bread\s+(?:me\s+|us\s+|back\s+)?(?:the\s+)?code\b/i,
    ],
  },
  {
    category: "Changed contact method",
    tier: "signal",
    patterns: [
      /\b(?:new|different|temporary|second)\s+(?:phone\s+)?number\b/i,
      /\bthis\s+is\s+my\s+new\b/i,
      /\b(?:lost|broke|broken|damaged|cracked)\s+(?:my\s+)?phone\b/i,
      /\b(?:text|reach|contact|call|message)\s+me\s+(?:back\s+)?(?:at|on)\s+this\b/i,
      /\buse\s+this\s+(?:new\s+)?number\b/i,
    ],
  },
  {
    category: "Urgency",
    tier: "signal",
    patterns: [
      /\b(?:urgent(?:ly)?|immediately|right\s+(?:now|away)|asap|time[-\s]?sensitive)\b/i,
      /\b(?:act|respond|reply|do\s+this|do\s+it)\s+now\b/i,
      /\bbefore\s+it'?s\s+too\s+late\b/i,
      /\bbefore\s+(?:the\s+)?(?:end\s+of\s+(?:the\s+)?day|close\s+of\s+business|deadline)\b/i,
      /\bwithin\s+(?:the\s+next\s+)?\d+\s+(?:minutes|hours)\b/i,
    ],
  },
  {
    category: "Secrecy",
    tier: "signal",
    patterns: [
      /\b(?:do\s?n['o]?t|never)\s+tell\b/i,
      /\bkeep\s+(?:this|it)\s+(?:between\s+us|secret|quiet|private|confidential|to\s+yourself)\b/i,
      /\b(?:between\s+you\s+and\s+me|our\s+(?:little\s+)?secret)\b/i,
      /\bdo\s?n['o]?t\s+(?:let\s+anyone|mention\s+this|say\s+anything|tell\s+(?:mom|dad|anyone|your))\b/i,
    ],
  },
  {
    category: "Emotional pressure",
    tier: "signal",
    patterns: [
      /\b(?:bail|bailed|arrested|in\s+jail|jailed|detained|deported)\b/i,
      /\b(?:car\s+accident|in\s+the\s+hospital|emergency\s+room|badly\s+hurt)\b/i,
      /\b(?:kidnapp?ed|held\s+hostage|in\s+danger)\b/i,
      /\b(?:i'?m\s+in\s+(?:big\s+)?trouble|please\s+help\s+me|i\s+don'?t\s+know\s+what\s+to\s+do)\b/i,
      /\b(?:lawyer|attorney|lawsuit|warrant\s+for)\b/i,
    ],
  },
];

function analyzeMessage(text: string): RiskFinding[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const findings: RiskFinding[] = [];
  for (const rule of RISK_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(trimmed);
      if (match) {
        findings.push({ category: rule.category, tier: rule.tier, evidence: match[0].trim() });
        break; // one finding per category, anchored to the first concrete match
      }
    }
  }
  return findings;
}

const scenarioMessages: Record<string, string> = {
  "Grandchild emergency": "This is Daniel. I lost my phone. Please send $1,200 for bail and do not tell Mom.",
  "Bank fraud call": "This is the fraud department at your bank. We detected suspicious activity. To stop the transfer, read us the one-time verification code we just texted you and confirm your account number right now.",
  "Executive impersonation": "Hi, it's the CEO. I need you to process an urgent wire transfer of $48,000 to a new vendor before the end of the day. Keep this confidential until the deal is announced.",
  "Legitimate emergency": "Hi Mom, it's Daniel calling from my own phone. Running late after practice so I'll miss dinner — no need to do anything, see you tonight.",
};

function VerifyPage(props: VerusAppProps) {
  const [input, setInput] = useState("This is Daniel. I lost my phone. Please send $1,200 for bail and do not tell Mom.");
  const [tab, setTab] = useState<"message" | "link" | "phone" | "screenshot">("message");
  const analysis = useMemo(() => analyzeMessage(input), [input]);
  const facts = analysis.filter((f) => f.tier === "fact");
  const signals = analysis.filter((f) => f.tier === "signal");
  return (
    <>
      <PageHeading eyebrow="INDEPENDENT VERIFICATION" title="Do not guess. Verify." copy="Check the person, request, destination, or account before you act.">
        <span className={`state-pill ${props.verification.toLowerCase()}`}>{props.verification}</span>
      </PageHeading>
      <div className="verify-layout">
        <section className="panel verify-input-panel">
          <div className="input-tabs">
            <button className={tab === "message" ? "active" : ""} onClick={() => setTab("message")}><MessageCircle /> Message</button>
            <button className={tab === "link" ? "active" : ""} onClick={() => setTab("link")}><Link2 /> Link</button>
            <button className={tab === "phone" ? "active" : ""} onClick={() => setTab("phone")}><Phone /> Phone</button>
            <button className={tab === "screenshot" ? "active" : ""} onClick={() => setTab("screenshot")}><Upload /> Screenshot</button>
          </div>
          {tab === "phone" && (
            <p className="explain-note">We don&rsquo;t try to detect cloned voices &mdash; even trained listeners get this wrong most of the time. We verify through something a clone can&rsquo;t know instead.</p>
          )}
          <label htmlFor="verify-input">Paste the suspicious message</label>
          <textarea id="verify-input" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="privacy-strip"><Lock /> Processed temporarily · Message content is not saved</div>
          <button
            className="primary-button full"
            onClick={() => {
              if (analysis.length === 0) {
                props.onToast("No known scam patterns matched. Verify directly if anything feels off.");
                return;
              }
              props.onScenario("Grandchild emergency scam", undefined, input);
            }}
          >Check this message <ScanLine /></button>
        </section>
        <section className="panel signal-panel">
          <small>RISK ANALYSIS</small>
          <h2>Explainable evidence</h2>
          {analysis.length === 0 ? (
            <p className="explain-note">No known scam patterns matched this message. That isn&rsquo;t a guarantee it is genuine &mdash; if anything feels off, verify directly with the person using a number you already trust.</p>
          ) : (
            <>
              <p className="analysis-summary">{analysis.length} risk signal{analysis.length === 1 ? "" : "s"} found in this message.</p>
              {facts.length > 0 && (
                <div className="evidence-group">
                  <div className="evidence-heading"><Fingerprint /> Deterministic facts</div>
                  {facts.map((f) => <SignalTag key={f.category} strong text={`${f.category}: “${f.evidence}”`} />)}
                </div>
              )}
              {signals.length > 0 && (
                <div className="evidence-group">
                  <div className="evidence-heading"><Sparkles /> Model-assisted signals</div>
                  <div className="tag-cloud">
                    {signals.map((s) => <SignalTag key={s.category} text={s.category} title={`Matched: “${s.evidence}”`} />)}
                  </div>
                </div>
              )}
              <p className="explain-note">Language signals explain why Verus paused the action. They are not presented as confirmed facts.</p>
            </>
          )}
        </section>
      </div>
      <section className="panel scenario-row">
        <div><small>PRELOADED DEMOS</small><h2>Try a complete verification flow</h2></div>
        <div className="scenario-buttons">
          {["Grandchild emergency", "Bank fraud call", "Executive impersonation", "Legitimate emergency"].map((name) => (
            <button key={name} onClick={() => { const msg = scenarioMessages[name]; if (msg) setInput(msg); props.onScenario(name, undefined, msg); }}><ShieldAlert /> {name}</button>
          ))}
        </div>
      </section>
    </>
  );
}

function SignalTag({ text, strong = false, title }: { text: string; strong?: boolean; title?: string }) {
  return <span className={`signal-tag ${strong ? "fact" : ""}`} title={title}>{strong ? <CheckCircle2 /> : <AlertTriangle />} {text}</span>;
}

function ProtectionPage(props: VerusAppProps) {
  const [scanResult, setScanResult] = useState("");
  return (
    <>
      <PageHeading eyebrow="DEVICE & NETWORK" title="Protection Center" copy="Calm, layered protection for links, files, sessions, and connections.">
        <button className="secondary-button" onClick={props.onDisconnect}>
          {props.connected ? <WifiOff /> : <Wifi />}
          {props.connected ? "Disconnect this Mac" : "Restore connection"}
        </button>
      </PageHeading>
      {!props.connected && (
        <div className="isolation-banner">
          <WifiOff />
          <div><strong>Mac isolated from the internet</strong><p>Simulated network access is paused. Local Verus controls remain available.</p></div>
          <button onClick={props.onDisconnect}>Restore</button>
        </div>
      )}
      {props.publicWifi && (
        <div className="attention-banner">
          <ShieldAlert />
          <div><strong>Public Wi-Fi Mode is active</strong><p>Browser isolation, encrypted DNS, and tracker blocking are enabled.</p></div>
        </div>
      )}
      <div className="module-grid">
        {protectionModules.map(({ title, copy, value, icon: Icon }) => (
          <article className="module-card" key={title}>
            <span className="module-icon"><Icon /></span>
            <div><h3>{title}</h3><p>{copy}</p></div>
            <strong>{value}</strong>
            <button onClick={() => props.onToast(`${title} checked`)}>Review <ChevronRight /></button>
          </article>
        ))}
      </div>
      <section className="panel link-scanner">
        <div><small>LINK & QR SCANNER</small><h2>Check a destination before opening it</h2></div>
        <div className="scanner-input">
          <Link2 />
          <input defaultValue="https://secure-appleid-review.example/login" />
          <button onClick={() => setScanResult("Blocked: newly created lookalike domain redirects to an unrelated sign-in page.")}>Scan</button>
        </div>
        {scanResult && (
          <div className="scan-result"><TriangleAlert /><div><strong>Destination blocked</strong><p>{scanResult}</p></div></div>
        )}
      </section>
    </>
  );
}

function IdentityPage(props: VerusAppProps) {
  return (
    <>
      <PageHeading eyebrow="IDENTITY MONITORING" title="Know where you were exposed." copy="Check older breach records, then secure the accounts that can reset everything else.">
        <span className="safe-pill"><Fingerprint /> Monitoring active</span>
      </PageHeading>
      <section className="identity-hero panel">
        <div className="identity-check">
          <span className="module-icon"><AtSign /></span>
          <small>PASSWORD EXPOSURE CHECK</small>
          <h2>Check an email address</h2>
          <p>Live HIBP checks run only when a server-side API key is configured. Demo mode never presents generated results as live findings.</p>
          <label htmlFor="identity-email">Email address</label>
          <div className="identity-input">
            <Mail />
            <input id="identity-email" type="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} />
            <button onClick={props.onCheckIdentity} disabled={props.checkingIdentity}>
              {props.checkingIdentity ? <RefreshCw className="spin" /> : <Search />}
              {props.checkingIdentity ? "Checking" : "Check exposure"}
            </button>
          </div>
          <span className="not-saved"><Lock /> Email is used for this check and is not stored by this prototype.</span>
        </div>
        <div className="account-map">
          <small>ACCOUNT MAP</small>
          <h3>Your Gmail can reset 7 other accounts</h3>
          <div className="account-map-visual">
            <span className="account-node core"><Mail /> Gmail</span>
            <span className="account-node n1"><Banknote /> Bank</span>
            <span className="account-node n2"><Cloud /> Cloud</span>
            <span className="account-node n3"><WalletCards /> Shopping</span>
            <span className="account-node n4"><MessageCircle /> Social</span>
          </div>
        </div>
      </section>
      {props.breaches && (
        <section className="breach-results">
          <div className="section-title">
            <div>
              <small>{props.breachSource === "hibp" ? "LIVE HIBP RESULT" : "LABELED DEMO DATA"}</small>
              <h2>{props.breaches.length ? `${props.breaches.length} older exposures found` : "No exposure found in the returned data"}</h2>
              <p>Credential reuse is blocked in this demo until the recovery steps are reviewed.</p>
            </div>
            {props.breaches.length > 0 && (
              <button className="primary-button" onClick={props.onRecoveryPlan}>Create recovery plan <ArrowRight /></button>
            )}
          </div>
          {props.breaches.map((breach) => (
            <article className="breach-card" key={breach.Name}>
              <div className="breach-logo">{breach.Name.slice(0, 1)}</div>
              <div>
                <h3>{breach.Title ?? breach.Name}</h3>
                <p>Approximate breach date: {breach.BreachDate ? new Date(`${breach.BreachDate}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "Not provided"}</p>
                <div className="data-tags">{(breach.DataClasses ?? ["Email addresses", "Passwords"]).slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div>
              </div>
              <div className="breach-actions">
                <span><Check /> Password reset planned</span>
                <span><Shield /> 2FA review needed</span>
              </div>
            </article>
          ))}
          {props.recoveryPlan && (
            <div className="recovery-plan"><CheckCircle2 /><div><strong>Recovery plan ready</strong><p>1. Secure Gmail · 2. Revoke old sessions · 3. Change unique passwords · 4. Review recovery methods</p></div></div>
          )}
        </section>
      )}
    </>
  );
}

function PrivacyPage(props: VerusAppProps) {
  const [removal, setRemoval] = useState(false);
  return (
    <>
      <PageHeading eyebrow="EXPOSURE REDUCTION" title="Disappear Mode" copy="Reduce unnecessary exposure without disappearing from the services you need.">
        <button className={`mode-switch ${props.privacyMode ? "on" : ""}`} onClick={props.onPrivacyMode} aria-pressed={props.privacyMode}>
          <span />{props.privacyMode ? "Active" : "Off"}
        </button>
      </PageHeading>
      <div className="privacy-grid">
        <section className="panel privacy-controls">
          <div className="privacy-illustration"><EyeOff /><span>{props.privacyMode ? "Exposure reduced" : "Ready when you are"}</span></div>
          {["Block known trackers", "Hide simulated IP details", "Pause advertising identifiers", "Prevent clipboard monitoring", "Limit camera and microphone access", "Isolate the simulated browser session"].map((item) => (
            <div className="control-row" key={item}><CheckCircle2 /><span>{item}</span><strong>{props.privacyMode ? "On" : "Ready"}</strong></div>
          ))}
        </section>
        <section className="panel exposure-map">
          <small>EXPOSURE MAP</small>
          <h2>Where your information appears</h2>
          <div className="exposure-rings">
            <span className="exposure-core">You</span>
            <span className="exposure-node e1">Data brokers · 6</span>
            <span className="exposure-node e2">Old accounts · 3</span>
            <span className="exposure-node e3">Public records · 2</span>
            <span className="exposure-node e4">Social profiles · 1</span>
          </div>
        </section>
      </div>
      <section className="panel removal-panel">
        <div><small>REMOVE ME FROM THE INTERNET</small><h2>Reduce data-broker and people-search exposure</h2><p>This is exposure reduction, not a promise to erase the entire internet.</p></div>
        <div className="removal-stats">
          <span><strong>12</strong> sources found</span>
          <span><strong>{removal ? 5 : 4}</strong> requests submitted</span>
          <span><strong>3</strong> removals confirmed</span>
        </div>
        <button className="primary-button" onClick={() => { setRemoval(true); props.onToast("Removal request started"); }}>
          {removal ? <Check /> : <Trash2 />}{removal ? "Request submitted" : "Start next removal"}
        </button>
      </section>
    </>
  );
}

function RecoveryPage(props: VerusAppProps) {
  const playbooks = ["My email was hacked", "I sent money to a scammer", "I entered my password on a fake site", "My device may be compromised", "I think I was fooled by a cloned voice or fake caller", "I installed remote-access software"];
  return (
    <>
      <PageHeading eyebrow="GUIDED RECOVERY" title="Get safe, one step at a time." copy="Contain the damage first. Then secure the accounts that matter most.">
        <button className={`lockdown-button ${props.lockdown ? "active" : ""}`} onClick={props.onLockdown}>
          <Power /> {props.lockdown ? "Undo Emergency Lockdown" : "Start Emergency Lockdown"}
        </button>
      </PageHeading>
      {props.lockdown && (
        <section className="lockdown-status">
          <ShieldAlert />
          <div><small>EMERGENCY LOCKDOWN ACTIVE</small><h2>Risky activity is contained.</h2><p>Network disconnected · payments paused · sessions revoked · vault locked · trusted contacts notified</p></div>
          <span>No rush. Review each step when ready.</span>
        </section>
      )}
      <div className="playbook-grid">
        {playbooks.map((title, i) => (
          <button className="playbook" key={title} onClick={() => props.onToast(`${title} playbook opened`)}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div><strong>{title}</strong><p>Contain · Secure · Revoke · Recover</p></div>
            <ChevronRight />
          </button>
        ))}
      </div>
      <section className="panel vault-panel">
        <div className="vault-heading">
          <span className="module-icon"><Vault /></span>
          <div><small>RECOVERY VAULT</small><h2>Sensitive details stay hidden</h2><p>Fictional demo values · automatic re-hiding enabled</p></div>
        </div>
        <VaultRow label="Primary email backup code" value="•••• •••• ••••" />
        <VaultRow label="Bank fraud phone number" value="••• ••• •0147" />
        <VaultRow label="Emergency contact" value="Maya · ••• ••• •0184" />
        <p className="explain-note">These details stay on this device and are never sent to our servers or to the AI model. (Demo build: the values above are fictional placeholders, not yet backed by real on-device encryption.)</p>
      </section>
    </>
  );
}

function VaultRow({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="vault-row">
      <LockKeyhole /><span>{label}</span>
      <code>{revealed ? value.replaceAll("•", "7") : value}</code>
      <button onClick={() => setRevealed((c) => !c)}>{revealed ? <EyeOff /> : <Eye />} {revealed ? "Hide" : "Reveal"}</button>
    </div>
  );
}

function FamilyPage(props: VerusAppProps) {
  const [rehearsal, setRehearsal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relation: "", phone: "", email: "", baseline: "", safePhrase: false });
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const resetForm = () => { setForm({ name: "", relation: "", phone: "", email: "", baseline: "", safePhrase: false }); setError(""); };

  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { setError("Enter a name for this contact."); return; }
    if (!form.phone.trim() && !form.email.trim()) { setError("Add at least one contact method — a phone number or email."); return; }
    props.onAddContact({
      name: form.name.trim(),
      relation: form.relation.trim() || "Trusted contact",
      phone: form.phone.trim(),
      email: form.email.trim(),
      baseline: form.baseline.trim(),
      safePhrase: form.safePhrase,
    });
    props.onToast(`${form.name.trim()} added to Family Circle`);
    resetForm();
    setFormOpen(false);
  };

  return (
    <>
      <PageHeading eyebrow="TRUSTED CONTACT NETWORK" title="Family Circle" copy="Independent confirmation comes from people and contact methods you enrolled in advance.">
        <button className="primary-button" onClick={() => { setFormOpen((open) => !open); setError(""); }}><Users /> Add trusted contact</button>
      </PageHeading>
      {formOpen && (
        <form className="contact-form panel" onSubmit={submitContact}>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" aria-label="Full name" />
          <input value={form.relation} onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))} placeholder="Relationship (e.g. Son)" aria-label="Relationship" />
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" aria-label="Phone number" />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" aria-label="Email" />
          <input className="span-2" value={form.baseline} onChange={(e) => setForm((f) => ({ ...f, baseline: e.target.value }))} placeholder="Baseline note (optional, e.g. Never requests gift cards)" aria-label="Baseline note" />
          <label className="contact-form-check span-2"><input type="checkbox" checked={form.safePhrase} onChange={(e) => setForm((f) => ({ ...f, safePhrase: e.target.checked }))} /> Safe phrase enrolled for this contact</label>
          {error && <p className="contact-form-error span-2">{error}</p>}
          <div className="contact-form-actions span-2">
            <button type="submit">Add contact</button>
            <button type="button" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</button>
          </div>
        </form>
      )}
      <div className="contact-grid">
        {props.contacts.map((contact) => (
          <article className="contact-card" key={contact.id}>
            <div className="contact-avatar">{contact.name.split(" ").map((n) => n[0]).join("")}</div>
            <div className="contact-title"><h3>{contact.name}</h3><span>{contact.relation}</span></div>
            <button className="contact-remove" aria-label={`Remove ${contact.name}`} onClick={() => setConfirmId(contact.id)}><Trash2 /></button>
            <span className="verified-label"><BadgeCheck /> Independently verified</span>
            {contact.phone && <div className="contact-detail"><Phone /> {contact.phone}</div>}
            {contact.email && <div className="contact-detail"><Mail /> {contact.email}</div>}
            {contact.baseline && <p className="baseline">{contact.baseline}</p>}
            <button onClick={() => props.onToast(`${contact.name} verification request sent`)}>Send test request <ArrowRight /></button>
            {contact.safePhrase && <span className="safe-phrase">Safe phrase enrolled</span>}
            {contact.safePhrase && <small className="safe-phrase-note">Not on social media. Not something a clone could learn from a voice sample.</small>}
            {confirmId === contact.id && (
              <div className="contact-remove-confirm">
                <span>Remove {contact.name}?</span>
                <div>
                  <button className="danger" onClick={() => { props.onRemoveContact(contact.id); props.onToast(`${contact.name} removed from Family Circle`); setConfirmId(null); }}>Remove</button>
                  <button onClick={() => setConfirmId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      <section className="panel rehearsal-panel">
        <div><small>SAFETY REHEARSAL</small><h2>Practice before a real urgent moment.</h2><p>A message claims Maya lost her phone and urgently needs $600 in gift cards.</p></div>
        <div className="rehearsal-steps">
          {["Notice the changed number", "Pause the request", "Contact Maya using the saved number", "Ask the safe-phrase question", "Deny the false request"].map((step, i) => (
            <button key={step} className={i <= rehearsal ? "done" : ""} onClick={() => setRehearsal(Math.min(i + 1, 4))}>
              {i < rehearsal ? <Check /> : <span>{i + 1}</span>}{step}
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => { setRehearsal(4); props.onToast("Safety rehearsal complete"); }}>Complete rehearsal <BookOpenCheck /></button>
      </section>
    </>
  );
}

function ActivityPage(props: VerusAppProps) {
  const [deleted, setDeleted] = useState(false);
  return (
    <>
      <PageHeading eyebrow="LOCAL ACTIVITY" title="What Verus did, in plain language." copy="Behavioral data is device-local, minimally retained, and deletable.">
        <button className="secondary-button" onClick={() => setDeleted(true)}><Trash2 /> Delete behavior data</button>
      </PageHeading>
      {deleted ? (
        <section className="empty-state panel"><Trash2 /><h2>Behavior data deleted</h2><p>Safety Receipts remain until you delete them separately.</p><button onClick={() => setDeleted(false)}>Restore demo data</button></section>
      ) : (
        <div className="activity-layout">
          <section className="panel behavior-panel">
            <div className="behavior-tabs">
              <button className="active">Signals</button><button>Patterns</button><button>Sessions</button><button>Privacy</button>
            </div>
            <div className="baseline-grid">
              <div><small>EXPLICIT BASELINE</small><h3>What your family told Verus</h3><p>Gift cards are never requested.</p><p>Daniel uses one saved mobile number.</p><p>Bank staff never ask for one-time codes.</p></div>
              <div><small>CURRENT RULES</small><h3>When Verus will pause</h3><p>Payment destination changes.</p><p>A known person uses a new contact method.</p><p>Remote-access software requests control.</p></div>
            </div>
          </section>
          <section className="panel timeline-panel">
            <small>RECENT EVENTS</small>
            {[["9:42 AM", "Unknown login blocked", "No action required", "safe"], ["11:18 AM", "Tracker request blocked", "Stored on this device", "safe"], ["2:08 PM", "Changed contact paused", "Verification required", "attention"], ["2:10 PM", "Maya denied request", "No money transferred", "danger"]].map(([time, event, note, state]) => (
              <div className="timeline-row" key={event}>
                <span className={`event-dot ${state}`} /><time>{time}</time>
                <div><strong>{event}</strong><p>{note}</p></div>
                <ChevronRight />
              </div>
            ))}
          </section>
        </div>
      )}
      {props.receiptReady && (
        <section className="receipt panel">
          <div className="receipt-head">
            <span><FileCheck2 /></span>
            <div><small>SAFETY RECEIPT · VR-260621-1048</small><h2>Grandchild emergency request</h2><p>The original message was analyzed temporarily and was not stored.</p></div>
            <span className={`state-pill ${props.verification.toLowerCase()}`}>{props.verification}</span>
          </div>
          <div className="receipt-grid">
            <span><small>CLAIMED SENDER</small>{props.claimedSender}</span>
            <span><small>CONTACT METHOD</small>Unknown mobile number</span>
            <span><small>SIGNALS</small>Urgency · secrecy · payment</span>
            <span><small>DETERMINISTIC MISMATCH</small>Number not saved</span>
            <span><small>VERIFICATION METHOD</small>Saved contact channel</span>
            <span><small>ACTION</small>Payment blocked</span>
          </div>
          <div className="receipt-actions">
            <button onClick={() => props.onToast("PDF export prepared")}>Export PDF</button>
            <button onClick={() => props.onToast("Receipt shared with family")}>Share with family</button>
            <button onClick={() => props.onToast("Fraud report prepared")}>Report as fraud</button>
          </div>
        </section>
      )}
    </>
  );
}

type EnterpriseRole = "Owner" | "Admin" | "Analyst" | "Member";
type EnterpriseMember = {
  id: number;
  name: string;
  email: string;
  role: EnterpriseRole;
  team: string;
  status: "Active" | "Invited" | "Suspended";
  initials: string;
};

const initialEnterpriseMembers: EnterpriseMember[] = [
  { id: 1, name: "Sparsh Roy", email: "sparsh@northstar.example", role: "Owner", team: "Security", status: "Active", initials: "SR" },
  { id: 2, name: "Maya Chen", email: "maya@northstar.example", role: "Admin", team: "Finance", status: "Active", initials: "MC" },
  { id: 3, name: "Noah Williams", email: "noah@northstar.example", role: "Analyst", team: "Security", status: "Active", initials: "NW" },
  { id: 4, name: "Aria Patel", email: "aria@northstar.example", role: "Member", team: "Operations", status: "Active", initials: "AP" },
  { id: 5, name: "Liam Park", email: "liam@northstar.example", role: "Member", team: "Executives", status: "Active", initials: "LP" },
  { id: 6, name: "Elena Garcia", email: "elena@northstar.example", role: "Member", team: "Operations", status: "Invited", initials: "EG" },
];

function EnterprisePage(props: VerusAppProps) {
  const [view, setView] = useState<"people" | "policies" | "audit">("people");
  const [members, setMembers] = useState(initialEnterpriseMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [policies, setPolicies] = useState({
    sso: true,
    mfa: true,
    paymentVerification: true,
    unmanagedDevices: false,
  });

  const activeMembers = members.filter((member) => member.status === "Active").length;
  const policyCoverage = Math.round((Object.values(policies).filter(Boolean).length / Object.keys(policies).length) * 100);

  const inviteMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    const name = inviteName.trim() || inviteEmail.split("@")[0].replace(/[._-]/g, " ");
    const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "NM";
    setMembers((current) => [
      ...current,
      { id: Date.now(), name, email: inviteEmail.trim(), role: "Member", team: "Unassigned", status: "Invited", initials },
    ]);
    setInviteName("");
    setInviteEmail("");
    setInviteOpen(false);
    props.onToast(`Invitation sent to ${inviteEmail.trim()}`);
  };

  const updateMember = (id: number, updates: Partial<EnterpriseMember>) => {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...updates } : member));
  };

  const togglePolicy = (policy: keyof typeof policies) => {
    setPolicies((current) => ({ ...current, [policy]: !current[policy] }));
    props.onToast("Organization policy updated");
  };

  const policyCards: Array<{
    id: keyof typeof policies;
    title: string;
    copy: string;
    icon: typeof Shield;
  }> = [
    { id: "sso", title: "Single sign-on", copy: "Require the organization identity provider for access.", icon: KeyRound },
    { id: "mfa", title: "Phishing-resistant MFA", copy: "Require a security key or platform passkey for admins.", icon: Fingerprint },
    { id: "paymentVerification", title: "High-risk payment verification", copy: "Pause changed destinations and require a second approver.", icon: Banknote },
    { id: "unmanagedDevices", title: "Block unmanaged devices", copy: "Limit organization data to enrolled and compliant devices.", icon: MonitorCheck },
  ];

  return (
    <>
      <PageHeading eyebrow="VERUS ENTERPRISE" title="Organization security" copy="Manage people, policies, devices, and high-risk verification across your organization.">
        <button className="primary-button" onClick={() => setInviteOpen((open) => !open)}><UserPlus /> Invite member</button>
      </PageHeading>

      <section className="enterprise-org-card">
        <div className="enterprise-org-mark">N</div>
        <div>
          <span className="enterprise-kicker">CURRENT ORGANIZATION</span>
          <h2>Northstar Labs</h2>
          <p>northstar.example · Enterprise plan</p>
        </div>
        <span className="verified-org"><BadgeCheck /> Domain verified</span>
        <button className="secondary-button" onClick={() => props.onToast("Organization settings opened")}><Building2 /> Organization settings</button>
      </section>

      <div className="enterprise-metrics">
        <article><span><UsersRound /></span><div><small>PROTECTED PEOPLE</small><strong>{activeMembers}</strong><p>{members.length - activeMembers} awaiting action</p></div></article>
        <article><span><MonitorCheck /></span><div><small>ENROLLED DEVICES</small><strong>7</strong><p>1 needs an update</p></div></article>
        <article><span><ShieldAlert /></span><div><small>HIGH-RISK EVENTS</small><strong>3</strong><p>All contained this week</p></div></article>
        <article><span><ShieldHalf /></span><div><small>POLICY COVERAGE</small><strong>{policyCoverage}%</strong><p>{Object.values(policies).filter(Boolean).length} of 4 enforced</p></div></article>
      </div>

      <div className="enterprise-workspace">
        <section className="panel enterprise-main">
          <div className="enterprise-tabs">
            <button className={view === "people" ? "active" : ""} onClick={() => setView("people")}>People</button>
            <button className={view === "policies" ? "active" : ""} onClick={() => setView("policies")}>Policies</button>
            <button className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}>Audit log</button>
          </div>

          {view === "people" && (
            <>
              <div className="enterprise-section-head">
                <div><small>DIRECTORY</small><h2>Members and access</h2><p>Assign roles, review enrollment, and suspend access immediately.</p></div>
                <span>{members.length} members</span>
              </div>
              {inviteOpen && (
                <form className="enterprise-invite-form" onSubmit={inviteMember}>
                  <input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Full name" aria-label="Full name" />
                  <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" type="email" required aria-label="Work email" />
                  <button type="submit">Send invite</button>
                  <button type="button" onClick={() => setInviteOpen(false)}>Cancel</button>
                </form>
              )}
              <div className="member-table" role="table" aria-label="Organization members">
                <div className="member-row member-header" role="row">
                  <span>Member</span><span>Team</span><span>Role</span><span>Status</span><span />
                </div>
                {members.map((member) => (
                  <div className="member-row" role="row" key={member.id}>
                    <div className="member-person"><span>{member.initials}</span><div><strong>{member.name}</strong><small>{member.email}</small></div></div>
                    <span>{member.team}</span>
                    <select
                      value={member.role}
                      onChange={(event) => {
                        updateMember(member.id, { role: event.target.value as EnterpriseRole });
                        props.onToast(`${member.name}'s role updated`);
                      }}
                      aria-label={`${member.name} role`}
                    >
                      {(["Owner", "Admin", "Analyst", "Member"] as EnterpriseRole[]).map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <span className={`member-status ${member.status.toLowerCase()}`}>{member.status}</span>
                    <button
                      className="member-action"
                      aria-label={`${member.status === "Suspended" ? "Restore" : "Suspend"} ${member.name}`}
                      onClick={() => {
                        updateMember(member.id, { status: member.status === "Suspended" ? "Active" : "Suspended" });
                        props.onToast(member.status === "Suspended" ? `${member.name} restored` : `${member.name} suspended`);
                      }}
                    ><MoreHorizontal /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === "policies" && (
            <>
              <div className="enterprise-section-head">
                <div><small>ORGANIZATION CONTROLS</small><h2>Security policies</h2><p>Changes apply to all assigned people and devices.</p></div>
                <span>{policyCoverage}% covered</span>
              </div>
              <div className="enterprise-policy-grid">
                {policyCards.map(({ id, title, copy, icon: Icon }) => (
                  <article key={id}>
                    <span><Icon /></span>
                    <div><h3>{title}</h3><p>{copy}</p></div>
                    <button className={`toggle ${policies[id] ? "on" : ""}`} onClick={() => togglePolicy(id)} aria-pressed={policies[id]}><span /></button>
                  </article>
                ))}
              </div>
            </>
          )}

          {view === "audit" && (
            <>
              <div className="enterprise-section-head">
                <div><small>ADMIN ACTIVITY</small><h2>Audit log</h2><p>Review access, policy, and verification changes.</p></div>
                <button onClick={() => props.onToast("Audit CSV export prepared")}><Download /> Export CSV</button>
              </div>
              <div className="enterprise-audit-list">
                {[
                  ["Policy updated", "Phishing-resistant MFA enabled for Administrators", "Sparsh Roy", "2 min ago"],
                  ["Risky action contained", "Changed vendor bank details paused pending approval", "Verus", "18 min ago"],
                  ["Member invited", "Elena Garcia invited to Operations", "Maya Chen", "1 hr ago"],
                  ["Device enrolled", "MacBook Pro · compliant", "Noah Williams", "Yesterday"],
                ].map(([title, detail, actor, time]) => (
                  <div key={`${title}-${time}`}><span className="audit-icon"><CheckCircle2 /></span><div><strong>{title}</strong><p>{detail}</p></div><span>{actor}</span><time>{time}</time></div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="enterprise-side">
          <section className="panel enterprise-posture">
            <div className="posture-score"><ShieldCheck /><strong>92</strong><span>/ 100</span></div>
            <small>ORGANIZATION POSTURE</small>
            <h3>Strong protection</h3>
            <p>Enable unmanaged-device blocking to close the remaining control gap.</p>
            <button onClick={() => { setView("policies"); setPolicies((current) => ({ ...current, unmanagedDevices: true })); props.onToast("Unmanaged-device blocking enabled"); }}>Fix recommendation <ArrowRight /></button>
          </section>
          <section className="panel enterprise-teams">
            <div><small>TEAMS</small><button aria-label="Add team" onClick={() => props.onToast("Team creation opened")}>+</button></div>
            {[
              ["Security", "2 people", Shield],
              ["Finance", "1 person", Banknote],
              ["Operations", "2 people", BriefcaseBusiness],
              ["Executives", "1 person", BadgeCheck],
            ].map(([name, count, Icon]) => {
              const TeamIcon = Icon as typeof Shield;
              return <button key={name as string} onClick={() => props.onToast(`${name} team opened`)}><span><TeamIcon /></span><div><strong>{name as string}</strong><small>{count as string}</small></div><ChevronRight /></button>;
            })}
          </section>
        </aside>
      </div>
    </>
  );
}

function SettingsPage(props: VerusAppProps) {
  return (
    <>
      <PageHeading eyebrow="DEMO & ACCESSIBILITY" title="Settings" copy="Control readability, privacy defaults, and complete product scenarios." />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <h2>Accessibility</h2>
          <SettingToggle title="Larger text" copy="Increase essential interface text." enabled={props.largeText} onChange={props.onLargeText} />
          <SettingToggle title="High contrast" copy="Increase panel and text separation." enabled={props.highContrast} onChange={props.onHighContrast} />
          <SettingToggle title="Reduce motion" copy="Also follows the device setting." enabled={false} onChange={() => props.onToast("Reduced motion preference saved")} />
          <h2>Privacy</h2>
          <SettingToggle title="Local behavior view" copy="Explicit baseline signals stay on this device." enabled onChange={() => props.onToast("Local behavior setting updated")} />
          <button className="danger-text-button" onClick={() => props.onToast("Demo data deleted")}><Trash2 /> Delete all demo and behavior data</button>
        </section>
        <section className="panel scenario-lab">
          <div className="scenario-lab-title">
            <div><small>SCENARIO LAB</small><h2>15 complete demo flows</h2></div>
            <span>DEMO MODE</span>
          </div>
          <div className="scenario-list">
            {scenarios.map(([name, detail, outcome]) => (
              <button key={name} onClick={() => props.onScenario(name, outcome)}>
                <span className="scenario-play"><Zap /></span>
                <div><strong>{name}</strong><p>{detail}</p></div>
                <span className="scenario-outcome">{outcome}</span>
                <ChevronRight />
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function SettingToggle({ title, copy, enabled, onChange }: { title: string; copy: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <div><strong>{title}</strong><p>{copy}</p></div>
      <button className={`toggle ${enabled ? "on" : ""}`} onClick={() => onChange(!enabled)} aria-pressed={enabled}><span /></button>
    </div>
  );
}

function SafariApp({ emailOpened, onOpenEmail }: { emailOpened: boolean; onOpenEmail: () => void }) {
  return (
    <div className="safari-app">
      <div className="browser-toolbar">
        <button>‹</button><button>›</button>
        <div className="address-bar"><Lock size={13} /> mail.verus-demo.local</div>
        <RefreshCw size={15} />
      </div>
      <div className="mail-app">
        <aside className="mail-sidebar">
          <div className="mail-brand"><Mail /> Secure Mail</div>
          <button className="active">Inbox <span>3</span></button>
          <button>Flagged</button><button>Sent</button><button>Archive</button>
        </aside>
        <div className="mail-list">
          <div className="mail-list-title"><h2>Inbox</h2><Search /></div>
          <button className={emailOpened ? "selected unread" : "unread"} onClick={onOpenEmail}>
            <span className="sender">Account Security</span>
            <strong>Action required: your account will be locked</strong>
            <p>We noticed an unusual sign-in. Verify your password today...</p>
            <time>Now</time>
          </button>
          <button>
            <span className="sender">Maya Roy</span><strong>Dinner on Sunday</strong>
            <p>I made a reservation for 6:30. Does that work?</p><time>9:14 AM</time>
          </button>
          <button>
            <span className="sender">Verus</span><strong>Your weekly privacy summary</strong>
            <p>89 trackers blocked and one old account found.</p><time>Yesterday</time>
          </button>
        </div>
        <article className="mail-reader">
          {!emailOpened ? (
            <div className="mail-empty"><Mail /><p>Select a message to read it.</p></div>
          ) : (
            <div className="phishing-email">
              <div className="email-head">
                <div className="fake-brand">A</div>
                <div><h1>Action required: verify your account</h1><p>Account Security &lt;security@appleid-review.example&gt;</p></div>
              </div>
              <p>Hello Sparsh,</p>
              <p>Your account will be permanently locked today because of an unusual sign-in. Confirm your password immediately to prevent loss of access.</p>
              <button className="fake-email-button">Review account now</button>
              <small>Do not reply to this automated message.</small>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function MessagesApp({ onVerify }: { onVerify: () => void }) {
  return (
    <div className="messages-app">
      <aside>
        <div className="messages-search"><Search /> Search</div>
        <button className="selected">
          <div className="contact-avatar">DR</div>
          <div><strong>Unknown Number</strong><p>This is Daniel. New phone...</p></div>
        </button>
        <button>
          <div className="contact-avatar">MR</div>
          <div><strong>Maya Roy</strong><p>Dinner sounds good!</p></div>
        </button>
      </aside>
      <section>
        <header><strong>Unknown Number</strong><small>Claims to be Daniel Roy</small></header>
        <div className="conversation">
          <span className="message incoming">Hi Grandpa, this is Daniel. I lost my phone and I am in trouble.</span>
          <span className="message incoming">Please buy $600 in gift cards right now. Do not call Mom.</span>
          <div className="message-warning">
            <img src="/verus-logo.png" alt="" />
            <div><strong>Contact method does not match</strong><p>This number is not saved for Daniel.</p></div>
            <button onClick={onVerify}>Verify</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function InterruptionOverlay({ state, trustedReply, receiptReady, claimedSender, claimedFirstName, onStart, onResolve, onClose, onEnd }: {
  state: VerificationState; trustedReply: boolean; receiptReady: boolean;
  claimedSender: string; claimedFirstName: string;
  onStart: () => void; onResolve: (approved: boolean) => void; onClose: () => void; onEnd: () => void;
}) {
  const claimedInitials = claimedFirstName === "the caller"
    ? "?"
    : claimedSender.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.div className="interruption-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="interruption-card" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }}>
        <div className="interruption-brand">
          <img src="/verus-logo.png" alt="Verus" />
          <span><strong>VERUS INTERRUPTION</strong><small>Independent verification required</small></span>
          <span className={`state-pill ${state.toLowerCase()}`}>{state}</span>
        </div>
        {state === "PAUSED" && (
          <>
            <span className="pause-icon"><ShieldAlert /></span>
            <small className="eyebrow">POTENTIAL SCAM DETECTED</small>
            <h1>Pause. Do not send money or passwords yet.</h1>
            <p className="interruption-lead">This request will remain paused until it is independently confirmed. There is no rush.</p>
            <div className="interruption-details">
              <div><small>CLAIMS TO BE</small><strong>{claimedSender}</strong><p>Incoming contact: (917) 555-0382</p></div>
              <div><small>DETERMINISTIC FACT</small><strong>This number is not saved for {claimedFirstName}.</strong><p>Saved contact: (609) 555-0162</p></div>
            </div>
            <div className="interruption-signals">
              <SignalTag text="Urgency" /><SignalTag text="Secrecy" /><SignalTag text="Financial demand" /><SignalTag text="Changed contact" strong />
            </div>
            <div className="safe-phrase-guidance">
              <KeyRound />
              <div><strong>Use your family safe-phrase question</strong><p>Ask them for the phrase. Verus will never display it on screen.</p></div>
            </div>
            <div className="interruption-actions">
              <button className="primary-button" onClick={onStart}><UserRoundCheck /> Ask {claimedFirstName} to confirm</button>
              <button className="secondary-button" onClick={onEnd}><X /> End this interaction</button>
            </div>
          </>
        )}
        {state === "PENDING" && (
          <div className="pending-view">
            <span className="pending-visual"><UserRoundCheck /></span>
            <small className="eyebrow">INDEPENDENT CHECK IN PROGRESS</small>
            <h1>{claimedFirstName === "the caller" ? "The saved contact is being contacted using the saved number." : `${claimedFirstName} is being contacted using the saved number.`}</h1>
            <p>The original request remains paused. You do not need to stay on this screen or respond to the sender.</p>
            <div className="state-progress">
              <span className="done"><Check /> Received</span>
              <span className="done"><Check /> Paused</span>
              <span className="current"><Clock3 /> Pending</span>
              <span>Resolved</span>
            </div>
            {trustedReply && (
              <motion.div className="trusted-response" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="trusted-response-head">
                  <div className="contact-avatar">{claimedInitials}</div>
                  <div><small>TRUSTED CONTACT VIEW</small><strong>Is this request really from you?</strong></div>
                </div>
                <p>A request claiming to be from {claimedFirstName} asks Sparsh for money from a new phone number.</p>
                <div>
                  <button onClick={() => onResolve(true)}><Check /> Yes, approve</button>
                  <button className="deny" onClick={() => onResolve(false)}><X /> No, deny</button>
                </div>
              </motion.div>
            )}
          </div>
        )}
        {["DENIED", "VERIFIED", "EXPIRED"].includes(state) && (
          <div className={`resolved-view ${state.toLowerCase()}`}>
            <span className="resolved-icon">{state === "VERIFIED" ? <BadgeCheck /> : <ShieldCheck />}</span>
            <small className="eyebrow">VERIFICATION COMPLETE</small>
            <h1>{state === "VERIFIED" ? `${claimedFirstName} confirmed the request.` : state === "EXPIRED" ? "No response received. The action remains blocked." : `${claimedFirstName} did not send this request.`}</h1>
            <p>{state === "VERIFIED" ? "The request may continue using the independently confirmed details." : "No money, password, or account access was shared."}</p>
            <div className="resolution-summary">
              <span><Check /> Risky action {state === "VERIFIED" ? "cleared" : "blocked"}</span>
              <span><Check /> Original message not stored</span>
              <span><Check /> Safety Receipt {receiptReady ? "created" : "available"}</span>
            </div>
            <button className="primary-button" onClick={onClose}>View Safety Receipt <ArrowRight /></button>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

export default App;
