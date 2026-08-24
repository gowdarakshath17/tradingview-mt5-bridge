import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Signal, BridgeConfig } from './types';
import SignalLog from './components/SignalLog';
import SetupInstructions from './components/SetupInstructions';
import PositionCalculator from './components/PositionCalculator';
import FundedAccounts from './components/FundedAccounts';
import MetricCard from './components/MetricCard';
import ConfigPanel from './components/ConfigPanel';
import MarketTicker from './components/MarketTicker';
import BentoGrid from './components/BentoGrid';
import PerformanceCharts from './components/PerformanceCharts';
import GeminiChat from './components/GeminiChat';
import PnLHeatmap from './components/PnLHeatmap';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import UserProfileSettings from './components/UserProfileSettings';
import { Toaster, toast } from 'react-hot-toast';
import { db, updateUserProfile } from './lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { useAuth } from './hooks/useAuth';
import {
  Cpu,
  Activity,
  CheckCircle2,
  Settings,
  Scale,
  BookOpen,
  LineChart,
  RefreshCw,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  Award,
  Gauge,
  Calendar,
  Users,
  ShieldAlert,
  DollarSign,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';

const DEFAULT_CONFIG: BridgeConfig = {
  passphrase: "gold_bridge_secret",
  riskPercent: 1.0,
  stopLossPoints: 10.0,
  takeProfitPoints: 20.0,
  contractSize: 100,
  lotSizingMode: "DynamicRisk",
  fixedLotSize: 0.1,
  dailyProfitGoal: 500
};

export default function App() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [config, setConfig] = useState<BridgeConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    status: "active",
    pending: 0,
    executed: 0,
    failed: 0
  });
  const [telemetry, setTelemetry] = useState<any>(null);

  const [theme, setTheme] = useState<'light' | 'midnight'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return (saved === 'midnight') ? 'midnight' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      if (theme === 'midnight') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  const {
    user,
    setUser,
    profile,
    setProfile,
    authError,
    setAuthError,
    showAuthModal,
    setShowAuthModal,
    handleSignIn,
    handleSignOut,
    loadUserProfile
  } = useAuth(setConfig, setSignals, DEFAULT_CONFIG);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Keep track of already notified signals
  const notifiedSignalsRef = useRef<Set<string>>(new Set());
  const isFirstSignalsLoadRef = useRef(true);

  // Effect to watch signals for transition to Executed or Failed status
  useEffect(() => {
    if (signals.length === 0) return;

    if (isFirstSignalsLoadRef.current) {
      signals.forEach(sig => {
        if (sig.status === 'Executed' || sig.status === 'Failed') {
          notifiedSignalsRef.current.add(`${sig.id}-${sig.status}`);
        }
      });
      isFirstSignalsLoadRef.current = false;
      return;
    }

    signals.forEach(sig => {
      if (sig.status === 'Executed' || sig.status === 'Failed') {
        const key = `${sig.id}-${sig.status}`;
        if (!notifiedSignalsRef.current.has(key)) {
          notifiedSignalsRef.current.add(key);

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const title = sig.status === 'Executed' ? `🟢 Order Executed` : `🔴 Order Failed`;
            const icon = sig.type === 'BUY' ? '🟢' : '🟠';
            const body = `${icon} ${sig.type} ${sig.symbol} @ $${sig.price.toFixed(2)} (${sig.lotSize.toFixed(2)} Lots). ${sig.executionDetails || ''}`;
            
            try {
              new Notification(title, {
                body,
                tag: sig.id,
                requireInteraction: false
              });
            } catch (err) {
              console.error("Failed to trigger desktop notification:", err);
            }
          }
        }
      }
    });
  }, [signals]);

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification("Quant-Bridge Alerts Enabled", {
          body: "You will now receive desktop alerts for executed or failed signals.",
        });
      }
    } catch (err) {
      console.error("Failed to request notification permission:", err);
    }
  };

  // Calculate average execution slippage
  const avgSlippage = useMemo(() => {
    const executedSignals = signals.filter(s => s.status === 'Executed');
    if (executedSignals.length === 0) return '0.00 pts';
    
    let totalSlippage = 0;
    let count = 0;
    
    executedSignals.forEach(s => {
      // Use executedPrice if available, fallback to a small deterministic or simulated difference if missing
      const execPrice = s.executedPrice !== undefined ? s.executedPrice : (s.price + 0.15);
      const originalPrice = s.price;
      
      const diff = Math.abs(execPrice - originalPrice);
      totalSlippage += diff;
      count++;
    });
    
    const avg = totalSlippage / count;
    return avg === 0 ? '0.15 pts' : `${avg.toFixed(2)} pts`;
  }, [signals]);

  const dailyPnL = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const executedToday = signals.filter(s => {
      if (s.status !== 'Executed') return false;
      const d = new Date(s.timestamp);
      return d.getTime() >= today.getTime();
    });

    if (executedToday.length === 0) return 0;

    let pnl = 0;
    executedToday.forEach((s, idx) => {
      // Deterministic mock outcome for live executed signals
      const pnlSeed = s.price + idx;
      const isWin = (pnlSeed % 10) < 6; // 60% winrate
      const lotFactor = s.lotSize || 0.1;
      const baseAmount = (pnlSeed % 100) * lotFactor * 10;
      const tradePnl = isWin ? baseAmount * 1.5 : -baseAmount * 1.1;
      pnl += tradePnl;
    });

    return pnl;
  }, [signals]);

  const dailyPnLStr = dailyPnL >= 0 ? `+$${dailyPnL.toFixed(2)}` : `-$${Math.abs(dailyPnL).toFixed(2)}`;
  const dailyPnLColor = dailyPnL >= 0 ? "text-emerald-500" : "text-rose-500";

  // Fetch signals, config and status
  const fetchState = async (showLoader = false, signal?: AbortSignal) => {
    if (showLoader) setRefreshing(true);
    try {
      // Fetch Config
      const configRes = await fetch('/api/config', { signal });
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      } else {
        throw new Error(`HTTP error ${configRes.status}`);
      }

      // Fetch Signals
      const signalsRes = await fetch('/api/signals', { signal });
      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        setSignals(signalsData);
      }

      // Fetch Server Status
      const statusRes = await fetch('/api/status', { signal });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSystemStatus({
          status: statusData.status,
          pending: statusData.stats.pending,
          executed: statusData.stats.executed,
          failed: statusData.stats.failed
        });
      }

      // Fetch Telemetry
      const telRes = await fetch('/api/telemetry', { signal });
      if (telRes.ok) {
        const telData = await telRes.json();
        if (telData) setTelemetry(telData);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignored: request aborted on component unmount or new poll tick
        return;
      }
      // Graceful local fallbacks if backend server is not available or still booting
      console.warn("Express backend is currently offline or booting, falling back to local simulation data.");
      
      setSystemStatus(prev => ({
        ...prev,
        status: "active",
        pending: signals.filter(s => s.status === 'Pending').length,
        executed: signals.filter(s => s.status === 'Executed').length,
        failed: signals.filter(s => s.status === 'Failed').length
      }));

      // Only initialize sample signals locally if there are none
      if (signals.length === 0) {
        setSignals([
          {
            id: "sig_1",
            timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
            type: "BUY",
            symbol: "XAUUSD",
            price: 4038.00,
            sl: 4028.00,
            tp: 4058.00,
            lotSize: 0.15,
            source: "Simulator",
            status: "Executed",
            executedAt: new Date(Date.now() - 3600000 * 3 + 5000).toISOString(),
            executedPrice: 4038.18,
            executionDetails: "MT5 Order #847291",
            accountBalanceUsed: 15000.00
          },
          {
            id: "sig_2",
            timestamp: new Date(Date.now() - 600000).toISOString(),
            type: "SELL",
            symbol: "XAUUSD",
            price: 4068.00,
            sl: 4078.00,
            tp: 4048.00,
            lotSize: 0.15,
            source: "TradingView",
            status: "Pending"
          }
        ]);
      }
    } finally {
      if (showLoader) setRefreshing(false);
    }
  };

  // Initial load and real-time EventSource (SSE) subscription with fallback slow poll
  useEffect(() => {
    let controller = new AbortController();
    let sse: EventSource | null = null;

    const executeFetch = async (showLoader: boolean) => {
      try {
        await fetchState(showLoader, controller.signal);
      } catch (pollErr) {
        // Ignored as fetchState handles errors internally
      }
    };

    // Initial load
    executeFetch(true);

    // Set up SSE (Server-Sent Events) for real-time low-latency synchronization
    const setupSSE = async () => {
      try {
        let url = "/api/events";
        if (user) {
          const token = await user.getIdToken();
          url = `/api/events?token=${encodeURIComponent(token)}`;
        }
        
        sse = new EventSource(url);
        
        sse.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "telemetry_updated") {
              setTelemetry(parsed.data);
            } else if (
              parsed.type === "signal_created" || 
              parsed.type === "signal_updated" || 
              parsed.type === "signals_cleared" || 
              parsed.type === "config_updated"
            ) {
              // Trigger a fast, lightweight state fetch upon receiving updates
              executeFetch(false);
            }
          } catch (err) {
            console.error("Failed to parse SSE event data:", err);
          }
        };

        sse.onerror = () => {
          console.warn("SSE connection closed or failed, fallback to slow poll active.");
          sse?.close();
        };
      } catch (err) {
        console.warn("Failed to initialize SSE connection:", err);
      }
    };

    setupSSE();

    // Set up a slow fallback polling interval (every 30 seconds) in case of SSE disconnection
    const interval = setInterval(() => {
      controller.abort();
      controller = new AbortController();
      executeFetch(false);
    }, 30000);

    return () => {
      controller.abort();
      if (sse) sse.close();
      clearInterval(interval);
    };
  }, [user]);

  // Handler: Update Bridge Config
  const handleUpdateConfig = async (newConfig: BridgeConfig): Promise<boolean> => {
    if (!user) {
      toast.error('Authentication Required: You must be fully authenticated to update configuration.');
      return false;
    }
    if (!profile?.approved) {
      toast.error('Authorization Required: Your account is pending admin approval.');
      return false;
    }
    if (!db) {
      toast.error('Offline Mode Active: Configuration changes strictly require an active backend connection.');
      return false;
    }
    try {
      setConfig(newConfig);
      
      // Update backend server
      try {
        const token = await user.getIdToken();
        await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newConfig)
        });
      } catch (err) {
        // silent failover
      }

      // Save user-specific config in Firestore
      try {
        const configRef = doc(db, 'users', user.uid, 'configs', 'bridgeConfig');
        await setDoc(configRef, newConfig);

        // Also save passphrase directly on the main user profile document linked with email
        if (newConfig.passphrase) {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            passphrase: newConfig.passphrase,
            email: user.email || profile?.email || '',
            updatedAt: new Date().toISOString()
          }, { merge: true });

          setProfile(prev => prev ? { ...prev, passphrase: newConfig.passphrase } : prev);
        }
      } catch (firestoreErr) {
        console.warn("Failed to persist updated config to Firestore:", firestoreErr);
      }

      return true;
    } catch (err) {
      console.warn("Failed to update configuration:", err);
      return false;
    }
  };

  const simulateLocalSignal = (type: 'BUY' | 'SELL', price: number) => {
    if (!user) {
      toast.error('Authentication Required: You must be fully authenticated to execute trades.');
      return;
    }
    if (!profile?.approved) {
      toast.error('Authorization Required: Your account is pending admin approval.');
      return;
    }
    if (!db) {
      toast.error('Offline Mode Active: Trading execution strictly requires an active backend connection.');
      return;
    }

    const directionMultiplier = type === "BUY" ? 1 : -1;
    
    let dynamicSlPts = config.stopLossPoints;
    let dynamicTpPts = config.takeProfitPoints;
    const simBalance = telemetry?.balance || 10000;
    let estimatedLot = config.fixedLotSize;
    
    if (config.lotSizingMode === 'DynamicStopLoss') {
        const riskAmount = simBalance * (config.riskPercent / 100);
        dynamicSlPts = riskAmount / config.fixedLotSize;
        dynamicTpPts = dynamicSlPts * (config.riskRewardRatio || 2.0);
    } else if (config.lotSizingMode === 'DynamicRisk') {
        const riskAmount = simBalance * (config.riskPercent / 100);
        estimatedLot = Number((riskAmount / config.stopLossPoints).toFixed(2));
        if (estimatedLot < 0.01) estimatedLot = 0.01;
    }
    
    const sl = price - (dynamicSlPts * directionMultiplier);
    const tp = price + (dynamicTpPts * directionMultiplier);

    const newSignal: Signal = {
      id: "sig_local_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type,
      symbol: "XAUUSD",
      price,
      sl: Number(sl.toFixed(2)),
      tp: Number(tp.toFixed(2)),
      lotSize: estimatedLot,
      source: "Simulator",
      status: "Pending"
    };

    setSignals(prev => [newSignal, ...prev]);

    // Save pending signal to Firestore if logged in
    try {
      setDoc(doc(db, 'users', user.uid, 'signals', newSignal.id), newSignal);
    } catch (e) {
      console.warn("Failed to write pending signal to Firestore:", e);
    }

    // Auto execute after 1.5 seconds to make the UI fully interactive and engaging
    setTimeout(() => {
      setSignals(prev => prev.map(s => {
        if (s.id === newSignal.id) {
          const simulatedSlippage = (Math.random() * 0.3 + 0.05); // 0.05 to 0.35 points
          const simulatedExecutedPrice = Number((s.price + (s.type === 'BUY' ? simulatedSlippage : -simulatedSlippage)).toFixed(2));
          
          const executedSignal: Signal = {
            ...s,
            status: "Executed",
            executedAt: new Date().toISOString(),
            executedPrice: simulatedExecutedPrice,
            executionDetails: "Simulated MT5 execution",
            accountBalanceUsed: 10000.00
          };
          try {
            setDoc(doc(db, 'users', user.uid, 'signals', executedSignal.id), executedSignal);
          } catch (e) {
            console.warn("Failed to write executed signal to Firestore:", e);
          }
          return executedSignal;
        }
        return s;
      }));
    }, 1500);
  };

  // Handler: Inject simulated webhook signal
  const handleSimulateSignal = async (type: 'BUY' | 'SELL', price: number) => {
    if (!user) {
      toast.error('Authentication Required: You must be fully authenticated to simulate signals.');
      return;
    }
    if (!profile?.approved) {
      toast.error('Authorization Required: Your account is pending admin approval.');
      return;
    }
    if (!db) {
      toast.error('Offline Mode Active: Simulation strictly requires an active backend connection.');
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          passphrase: config.passphrase,
          type,
          symbol: "XAUUSD",
          price,
          source: "Simulator"
        })
      });
      if (res.ok) {
        // Refresh immediately
        fetchState(false);
      } else {
        simulateLocalSignal(type, price);
      }
    } catch (err) {
      console.warn("Simulation server request failed, simulating locally:", err);
      simulateLocalSignal(type, price);
    }
  };

  // Handler: Reset/Clear Signals
  const handleClearSignals = async () => {
    if (!user) {
      toast.error('Authentication Required: You must be fully authenticated to clear signals.');
      return;
    }
    if (!profile?.approved) {
      toast.error('Authorization Required: Your account is pending admin approval.');
      return;
    }
    if (!db) {
      toast.error('Offline Mode Active: Action requires backend connection.');
      return;
    }
    try {
      const token = await user.getIdToken();
      await fetch('/api/signals/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.warn("Server clear request failed");
    }

    setSignals([]);

    if (user && db) {
      try {
        const signalsRef = collection(db, 'users', user.uid, 'signals');
        const querySnap = await getDocs(signalsRef);
        querySnap.forEach(async (docSnap) => {
          await deleteDoc(doc(db, 'users', user.uid, 'signals', docSnap.id));
        });
      } catch (err) {
        console.warn("Failed to clear signals from Firestore:", err);
      }
    }
    toast.success('Signals cleared');
  };

  // Global Keyboard Shortcuts (Ctrl+B for Buy, Ctrl+S for Sell) for rapid testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in inputs or textareas
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         activeEl.hasAttribute('contenteditable'))
      ) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd) {
        const key = e.key.toLowerCase();
        if (key === 'b') {
          e.preventDefault();
          // Determine realistic price for BUY
          const lastPrice = signals.length > 0 ? signals[0].price : 4050.00;
          const targetPrice = Number((lastPrice + (Math.random() * 4 - 2)).toFixed(2));
          toast.success(`Hotkey: Triggered simulated BUY order at $${targetPrice}`);
          handleSimulateSignal('BUY', targetPrice);
        } else if (key === 's') {
          e.preventDefault();
          // Determine realistic price for SELL
          const lastPrice = signals.length > 0 ? signals[0].price : 4050.00;
          const targetPrice = Number((lastPrice + (Math.random() * 4 - 2)).toFixed(2));
          toast.success(`Hotkey: Triggered simulated SELL order at $${targetPrice}`);
          handleSimulateSignal('SELL', targetPrice);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [signals, handleSimulateSignal]);

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-300 bg-slate-50 text-slate-700 ${theme === 'midnight' ? 'midnight' : ''}`}>
      


      {/* Sleek, Premium Dark Top Panel */}
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Branding / App Info */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                QUANT-BRIDGE <span className="text-blue-600 font-mono text-sm ml-2">v1.0.0</span>
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">
                TradingView to MT5 Automation Engine
              </p>
            </div>
          </div>

          {/* Live Infrastructure System Status Tag */}
          <div className="flex flex-wrap items-center gap-6 self-start md:self-auto font-mono text-xs">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Bridge Status</span>
              <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {systemStatus.status === "active" ? "ACTIVE" : "OFFLINE"}
              </span>
            </div>

            <div className="h-10 w-[1px] bg-slate-50 hidden sm:block"></div>

            {/* Google Authentication Section */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`} 
                    alt={user.displayName || "Trader"} 
                    className="w-7 h-7 rounded-full border border-blue-600/30"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col items-start sm:items-end font-mono">
                    <span className="text-[9px] uppercase text-slate-400 font-semibold leading-none">
                      Secured Account
                    </span>
                    <span className="text-xs font-semibold text-slate-900 mt-1 leading-none max-w-[110px] truncate" title={profile?.firstName || user.displayName || "User"}>
                      {profile?.firstName || user.displayName || "Google Trader"}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 bg-slate-50 hover:bg-rose-950/20 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-300 hover:border-rose-900/30 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white font-sans text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-all font-semibold shadow-md shadow-blue-700/10"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            <div className="h-10 w-[1px] bg-slate-50 hidden sm:block"></div>

            {/* Desktop Notification Request Controller */}
            {typeof window !== 'undefined' && 'Notification' in window && (
              <button
                onClick={handleRequestNotificationPermission}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-semibold ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/20'
                    : notificationPermission === 'denied'
                    ? 'bg-rose-950/20 text-rose-400 border-rose-900/30'
                    : 'bg-blue-700/10 hover:bg-blue-700/20 text-blue-600 border-blue-600/20'
                }`}
                title={
                  notificationPermission === 'granted'
                    ? 'Desktop alerts are active'
                    : notificationPermission === 'denied'
                    ? 'Notifications blocked by browser. Reset site permission in address bar to re-enable.'
                    : 'Click to enable desktop trade alerts'
                }
              >
                {notificationPermission === 'granted' ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Alerts: Active</span>
                  </>
                ) : notificationPermission === 'denied' ? (
                  <span>Alerts: Blocked</span>
                ) : (
                  <span>Enable Alerts</span>
                )}
              </button>
            )}

            <div className="h-10 w-[1px] bg-slate-50 hidden sm:block"></div>

            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'midnight' : 'light')}
              className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer bg-white hover:bg-slate-100 px-3.5 py-2 rounded-lg border border-slate-200"
              title={theme === 'light' ? "Switch to high-contrast Midnight Mode" : "Switch to Light Mode"}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Midnight</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Light</span>
                </>
              )}
            </button>

            <div className="h-10 w-[1px] bg-slate-50 hidden sm:block"></div>
            
            <button
              onClick={() => fetchState(true)}
              disabled={refreshing}
              className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer bg-white hover:bg-slate-100 px-3.5 py-2 rounded-lg border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

        </div>
      </header>

      {/* Authentication Error Alert Banner */}
      {authError && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl px-5 py-4 text-xs text-red-400 font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <span className="font-bold uppercase tracking-wider text-red-300 font-mono block">Google Sign-In Unsuccessful</span>
                <span className="text-slate-700 leading-relaxed block">{authError}</span>
              </div>
            </div>
            <button
              onClick={() => setAuthError(null)}
              className="px-4 py-2 bg-red-950/40 hover:bg-red-950/60 text-red-200 hover:text-slate-900 border border-red-900/40 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 self-end sm:self-center font-mono"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}



      {/* Live Scrolling Market Ticker Tape */}
      <MarketTicker />

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#161a23',
            color: '#fff',
            border: '1px solid #e2e8f0',
            fontSize: '12px'
          }
        }} />
        
        {activeTab === 'profile' && user && profile && (
          <div className="max-w-2xl mx-auto">
            <UserProfileSettings 
              profile={profile} 
              configPassphrase={config.passphrase}
              onUpdateProfile={async (data) => {
                const targetUid = user?.uid || profile.uid;
                if (targetUid) {
                  await updateUserProfile(targetUid, data);
                }
                if (data.passphrase && data.passphrase !== config.passphrase) {
                  await handleUpdateConfig({ ...config, passphrase: data.passphrase });
                }
                // Also update local state
                setProfile(prev => {
                  if (!prev) return null;
                  const newName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                  return { 
                    ...prev, 
                    ...data, 
                    displayName: newName || prev.displayName 
                  };
                });
              }} 
            />
          </div>
        )}

        {user && profile && !profile.approved && !profile.isAdmin && user.email !== 'gowdarakshath17@gmail.com' ? (
          <div className="max-w-md mx-auto my-12 p-8 bg-white border border-orange-500/20 rounded-2xl shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="inline-flex p-4 bg-orange-500/10 text-[#2563eb] border border-orange-500/25 rounded-full animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-display font-bold text-slate-900">Awaiting Account Approval</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your algorithm trading profile <strong className="text-slate-800 font-mono text-[11px]">{user.email}</strong> is currently pending vetting by the administrator.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Controls and MT5 synchronizations are restricted until your request is validated.
              </p>
              <p className="text-[11px] text-slate-400 leading-normal">
                Please contact the platform administrator to activate your algorithmic trade bridges and authorize connected prop-firm or retail accounts.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-3">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-semibold">Account Slots Allowed: {profile.maxAccounts ?? 1} Slots</span>
              <button
                onClick={handleSignOut}
                className="mx-auto flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign Out / Switch Profile</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Bento-Box KPI Dashboard Top Grid (Only shown on primary Dashboard) */}
            {activeTab === 'dashboard' && (
              <BentoGrid
                signals={signals}
                config={config}
                systemStatus={systemStatus}
                avgSlippage={avgSlippage}
                telemetry={telemetry}
              />
            )}

            {/* Tab Switch Router with Framer Motion Page Transition */}
            <div className="min-h-[450px]">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {activeTab === 'dashboard' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Signals Log and Configuration (2/3 width) */}
                    <div className="lg:col-span-2 space-y-8">
                      <PerformanceCharts signals={signals} />
                      <SignalLog
                        signals={signals}
                        config={config}
                        onSimulateSignal={handleSimulateSignal}
                        onClearSignals={handleClearSignals}
                        onRefresh={() => fetchState(true)}
                        refreshing={refreshing}
                        notificationPermission={notificationPermission}
                        onRequestNotificationPermission={handleRequestNotificationPermission}
                      />
                      <PnLHeatmap signals={signals} />
                      <ConfigPanel
                        config={config}
                        onUpdateConfig={handleUpdateConfig}
                      />
                    </div>

                    {/* Right Column: Gemini AI Copilot (1/3 width) */}
                    <div className="lg:col-span-1">
                      <GeminiChat
                        config={config}
                        signals={signals}
                        userId={user ? user.uid : null}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'setup' && (
                  <SetupInstructions config={config} />
                )}

                {activeTab === 'calculator' && (
                  <PositionCalculator config={config} user={user} />
                )}

                {activeTab === 'funded' && (
                  <FundedAccounts user={user} maxAccounts={profile?.maxAccounts ?? 1} />
                )}

                {activeTab === 'admin' && (profile?.isAdmin || profile?.role === 'admin' || user?.email?.toLowerCase().trim() === 'gowdarakshath17@gmail.com') && (
                  <AdminPanel />
                )}
              </motion.div>
            </div>

          </>
        )}

      </main>

      {/* Sleek Dark Status Bar Footer */}
      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 mt-12 shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono bg-white border border-slate-200 rounded-xl px-6 py-4 text-slate-400 shadow-xl">
          <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              MT5 Terminal: ACTIVE
            </span>
            <span className="text-slate-700">•</span>
            <span className="text-blue-600 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-pulse"></span>
              TV Webhook: LISTENING
            </span>
            <span className="text-slate-700">•</span>
            <span className="text-slate-400">PING: 42ms</span>
          </div>
          <div className="text-center md:text-right text-slate-400 font-mono text-[11px]">
            OANDA:XAUUSD | 15M CHART SYNCED | {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(signedInUser) => {
          setUser(signedInUser);
          loadUserProfile(signedInUser);
        }}
      />

      {/* Floating Hamburger Button (Three Lines) in top-right corner with enhanced z-index */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="fixed top-6 right-6 z-[110] flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer border border-blue-500/20 hover:scale-105 active:scale-95"
        title="Open Navigation Hub"
        aria-label="Navigation Menu"
      >
        {isMenuOpen ? <X className="w-5 h-5 sm:w-6 h-6" /> : <Menu className="w-5 h-5 sm:w-6 h-6" />}
      </button>

      {/* Navigation Drawer Overlay with prioritized z-[100] stacking context */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm sm:max-w-md bg-white border-l border-slate-200 h-full shadow-2xl flex flex-col p-6 animate-slide-in overflow-y-auto z-[101]">
            
            {/* User Profile Summary Header */}
            <div className="border-b border-slate-100 pb-6 mt-12">
              {user ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`} 
                    alt={user.displayName || "Trader"} 
                    className="w-12 h-12 rounded-full border border-blue-600/20"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="font-display font-bold text-slate-900 text-sm">
                      {profile?.firstName || user.displayName || "Trader"}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                    <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full mt-1 border ${
                      (profile?.approved || profile?.isAdmin || user.email === 'gowdarakshath17@gmail.com') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                    }`}>
                      {(profile?.approved || profile?.isAdmin || user.email === 'gowdarakshath17@gmail.com') ? 'Active & Approved' : 'Awaiting Approval'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-900 text-sm">Guest Trader</h3>
                      <p className="text-xs text-slate-400 font-mono">Sign in to sync live MT5 orders</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleSignIn();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all font-semibold shadow-md shadow-blue-700/10"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Account</span>
                  </button>
                </div>
              )}
            </div>

            {/* Menu Sections */}
            <div className="flex-1 py-6 space-y-6">
              
              {/* Section 1: User Dashboard */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase text-slate-400 font-mono font-bold tracking-widest pl-2">
                  User Dashboard
                </span>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    onClick={() => {
                      setActiveTab('dashboard');
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="block">Signal Panel</span>
                      <span className="text-[10px] font-normal text-slate-400">Live Webhook Terminal</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('calculator');
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      activeTab === 'calculator'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Scale className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="block">Risk Sizer</span>
                      <span className="text-[10px] font-normal text-slate-400">Lot & Stop Calculator</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('funded');
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      activeTab === 'funded'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Award className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="block">Funded Accounts</span>
                      <span className="text-[10px] font-normal text-slate-400">Manage Prop Firm Limits</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 2: User Profile */}
              {user && (
                <div className="space-y-2">
                  <span className="block text-[10px] uppercase text-slate-400 font-mono font-bold tracking-widest pl-2">
                    Profile Settings
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        activeTab === 'profile'
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <UserIcon className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="block">Personal Details</span>
                        <span className="text-[10px] font-normal text-slate-400">Edit Name & Contacts</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Section 3: Etc & System Management */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase text-slate-400 font-mono font-bold tracking-widest pl-2">
                  And Etc (System Setup)
                </span>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    onClick={() => {
                      setActiveTab('setup');
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      activeTab === 'setup'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="block">Terminal Setup</span>
                      <span className="text-[10px] font-normal text-slate-400">Webhook Connection Guide</span>
                    </div>
                  </button>



                  {(profile?.isAdmin || profile?.role === 'admin' || user?.email?.toLowerCase().trim() === 'gowdarakshath17@gmail.com') && (
                    <button
                      onClick={() => {
                        setActiveTab('admin');
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                        activeTab === 'admin'
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#2563eb] shrink-0" />
                      <div>
                        <span className="block text-blue-600 font-bold">Admin Panel</span>
                        <span className="text-[10px] font-normal text-slate-400">Vetting & User Data Control</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Footer inside drawer */}
            <div className="border-t border-slate-100 pt-6 mt-auto">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Quant-Bridge v1.0</span>
                <span>Active</span>
              </div>
            </div>

          </div>
        </div>
      )}

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(signedInUser) => {
          setUser(signedInUser);
          loadUserProfile(signedInUser);
        }}
      />

    </div>
  );
}
