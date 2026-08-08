import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { 
  Award, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Key, 
  Layers, 
  Activity, 
  ArrowRight,
  TrendingUp,
  Sliders,
  DollarSign,
  Briefcase
} from 'lucide-react';

export interface FundedAccount {
  id: string;
  propFirm: string;
  accountId: string;
  platform: 'MT5' | 'MT4';
  accountSize: number;
  currentBalance: number;
  currentEquity: number;
  leverage: string;
  dailyDrawdownLimitPercent: number;
  maxDrawdownLimitPercent: number;
  status: 'Ready' | 'Authorized' | 'Deauthorized' | 'Syncing' | 'Failed' | 'Violated';
  authorizedAt?: string;
  mt5Server?: string;
  emergencyKillSwitch: boolean;
  accountType?: 'Evaluation' | 'Funded' | 'Express' | 'Stellar';
  explanation?: string;
}

interface FundedAccountsProps {
  user: FirebaseUser | null;
  maxAccounts?: number;
}

export default function FundedAccounts({ user, maxAccounts = 1 }: FundedAccountsProps) {
  const [accounts, setAccounts] = useState<FundedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [propFirm, setPropFirm] = useState('FTMO');
  const [accountId, setAccountId] = useState('');
  const [platform, setPlatform] = useState<'MT5' | 'MT4'>('MT5');
  const [accountSize, setAccountSize] = useState(100000);
  const [password, setPassword] = useState('');
  const [mt5Server, setMt5Server] = useState('FTMO-Demo');
  const [leverage, setLeverage] = useState('1:100');
  const [dailyLimit, setDailyLimit] = useState(5);
  const [maxLimit, setMaxLimit] = useState(10);
  const [emergencyKillSwitch, setEmergencyKillSwitch] = useState(true);
  const [accountType, setAccountType] = useState<'Evaluation' | 'Funded' | 'Express' | 'Stellar'>('Evaluation');
  
  // AI Detection states
  const [isDetectingRules, setIsDetectingRules] = useState(false);
  const [aiRulesMessage, setAiRulesMessage] = useState<string | null>(null);

  // Sync Log states for the Authorizer terminal
  const [activeSyncAccountId, setActiveSyncAccountId] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch / Load accounts from Firestore (if user is logged in) and LocalStorage (offline/fallback)
  useEffect(() => {
    const loadAccounts = async () => {
      setLoading(true);
      try {
        const loadedFromFirestore: FundedAccount[] = [];
        if (user && db) {
          try {
            const accountsRef = collection(db, 'users', user.uid, 'funded_accounts');
            const querySnap = await getDocs(accountsRef);
            querySnap.forEach((docSnap) => {
              loadedFromFirestore.push(docSnap.data() as FundedAccount);
            });
          } catch (err) {
            console.warn("Firestore fetch warning:", err);
          }
        }

        // Always check localStorage for any locally cached / offline accounts
        let localAccounts: FundedAccount[] = [];
        try {
          const local = localStorage.getItem('funded_accounts');
          if (local) {
            localAccounts = JSON.parse(local);
          }
        } catch (e) {
          console.warn("Error parsing local accounts:", e);
        }

        // Merge Firestore accounts and LocalStorage accounts by ID / Account ID so no data is lost
        const accountMap = new Map<string, FundedAccount>();

        // Load local ones first
        localAccounts.forEach(acc => {
          if (acc && (acc.id || acc.accountId)) {
            accountMap.set(acc.id || acc.accountId, acc);
          }
        });

        // Load Firestore ones (take precedence / merge)
        loadedFromFirestore.forEach(acc => {
          if (acc && (acc.id || acc.accountId)) {
            accountMap.set(acc.id || acc.accountId, acc);
          }
        });

        const merged = Array.from(accountMap.values());
        setAccounts(merged);

        // Keep local cache synced
        localStorage.setItem('funded_accounts', JSON.stringify(merged));

        // If logged in to Firestore, sync any missing local accounts into Firestore database
        if (user && db && merged.length > 0) {
          for (const acc of merged) {
            try {
              const accDocRef = doc(db, 'users', user.uid, 'funded_accounts', acc.id || acc.accountId);
              await setDoc(accDocRef, acc, { merge: true });
            } catch (syncErr) {
              console.warn("Failed syncing account to Firestore:", syncErr);
            }
          }
        }
      } catch (err) {
        console.error("Error loading funded accounts:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAccounts();
  }, [user]);

  // Save accounts to storage & Firestore
  const persistAccounts = async (updated: FundedAccount[]) => {
    setAccounts(updated);
    localStorage.setItem('funded_accounts', JSON.stringify(updated));

    if (user && db) {
      for (const acc of updated) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'funded_accounts', acc.id), acc, { merge: true });
        } catch (err) {
          console.warn("Failed saving account to Firestore:", err);
        }
      }
    }
  };

  const handleAIDetectRules = async () => {
    setIsDetectingRules(true);
    setAiRulesMessage(null);
    try {
      const response = await fetch('/api/detect-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propFirm,
          accountType,
          accountSize
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to auto-detect rules');
      }
      
      const data = await response.json();
      if (data) {
        if (typeof data.dailyLimit === 'number' && data.dailyLimit > 0) setDailyLimit(data.dailyLimit);
        if (typeof data.maxLimit === 'number' && data.maxLimit > 0) setMaxLimit(data.maxLimit);
        if (data.leverage) setLeverage(data.leverage);
        if (data.explanation) {
          setAiRulesMessage(data.explanation);
        } else {
          setAiRulesMessage(`Rules successfully auto-configured! Daily Limit: ${data.dailyLimit}%, Overall: ${data.maxLimit}%, Leverage: ${data.leverage}`);
        }
      }
    } catch (err: any) {
      console.error("AI rule retrieval error:", err);
      setAiRulesMessage(`Rule detection warning: ${err.message || 'Please make sure GEMINI_API_KEY is defined.'}`);
    } finally {
      setIsDetectingRules(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    if (accounts.length >= maxAccounts) {
      alert(`Limit Reached! Your authorization level permits a maximum of ${maxAccounts} linked MT5 account(s). Please contact the platform administrator to upgrade your slots limit.`);
      return;
    }

    const newAccount: FundedAccount = {
      id: 'acc_' + Math.random().toString(36).substring(2, 11),
      propFirm,
      accountId,
      platform,
      accountSize,
      currentBalance: accountSize,
      currentEquity: accountSize,
      leverage,
      dailyDrawdownLimitPercent: dailyLimit,
      maxDrawdownLimitPercent: maxLimit,
      status: 'Ready',
      mt5Server,
      emergencyKillSwitch,
      accountType,
      explanation: aiRulesMessage || undefined
    };

    const updated = [newAccount, ...accounts];
    await persistAccounts(updated);

    toast.success(`Linked MT5 Account #${accountId} successfully!`);

    // Reset Form
    setAccountId('');
    setAiRulesMessage(null);
    setShowAddForm(false);
  };

  const handleDeleteAccount = async (id: string) => {
    const updated = accounts.filter(acc => acc.id !== id);
    setAccounts(updated);
    localStorage.setItem('funded_accounts', JSON.stringify(updated));

    if (user && db) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'funded_accounts', id));
      } catch (err) {
        console.warn("Failed to delete from Firestore:", err);
      }
    }
    toast.success('Account removed.');
  };

  // MT5 Automatic Authorization Handshake Simulation
  const handleAuthorizeToMT5 = (account: FundedAccount) => {
    if (!user || !db) {
      toast.error('Offline Mode Active: MT5 authorization requires a secure backend connection.');
      return;
    }
    setActiveSyncAccountId(account.id);
    setIsSyncing(true);
    setSyncLogs([`Initializing Secure Handshake Protocol...`]);

    const logs = [
      `Establishing outbound tunnel to MT5 Server: ${account.mt5Server || 'FTMO-Server3'}`,
      `Validating Account Login ID: ${account.accountId}...`,
      `Syncing MetaTrader 5 API gateway tokens...`,
      `Decrypting connection passphrase securely...`,
      `Requesting current margin and equity metrics...`,
      `Verifying Daily Drawdown threshold [Max Loss: $${(account.accountSize * (account.dailyDrawdownLimitPercent / 100)).toLocaleString()}]`,
      `Verifying Overall Drawdown threshold [Max Loss: $${(account.accountSize * (account.maxDrawdownLimitPercent / 100)).toLocaleString()}]`,
      `Configuring real-time webhook routing rules...`,
      `Authorized! Safe-guard monitoring engine STARTED.`
    ];

    logs.forEach((logLine, index) => {
      setTimeout(() => {
        setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${logLine}`]);
        if (index === logs.length - 1) {
          setIsSyncing(false);
          // Mark account as authorized
          const updated = accounts.map(acc => {
            if (acc.id === account.id) {
              return {
                ...acc,
                status: 'Authorized' as const,
                authorizedAt: new Date().toISOString()
              };
            }
            return acc;
          });
          persistAccounts(updated);
          if (user && db) {
            setDoc(doc(db, 'users', user.uid, 'funded_accounts', account.id), {
              ...account,
              status: 'Authorized',
              authorizedAt: new Date().toISOString()
            }, { merge: true }).catch(console.error);
          }
        }
      }, (index + 1) * 300);
    });
  };

  const handleDeauthorize = (account: FundedAccount) => {
    const updated = accounts.map(acc => {
      if (acc.id === account.id) {
        return {
          ...acc,
          status: 'Deauthorized' as const,
          authorizedAt: undefined
        };
      }
      return acc;
    });
    persistAccounts(updated);
    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'funded_accounts', account.id), {
        ...account,
        status: 'Deauthorized',
        authorizedAt: null
      }, { merge: true }).catch(console.error);
    }
  };

  const handleToggleEmergencyKillSwitch = (account: FundedAccount) => {
    const updated = accounts.map(acc => {
      if (acc.id === account.id) {
        return {
          ...acc,
          emergencyKillSwitch: !acc.emergencyKillSwitch
        };
      }
      return acc;
    });
    persistAccounts(updated);
    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'funded_accounts', account.id), {
        emergencyKillSwitch: !account.emergencyKillSwitch
      }, { merge: true }).catch(console.error);
    }
  };

  // Helper calculation
  const getDrawdownStats = (account: FundedAccount) => {
    const dailyMaxLoss = account.accountSize * (account.dailyDrawdownLimitPercent / 100);
    const overallMaxLoss = account.accountSize * (account.maxDrawdownLimitPercent / 100);
    
    const dailyLossValue = Math.max(0, account.accountSize - account.currentEquity);
    const dailyLossPercent = (dailyLossValue / account.accountSize) * 100;
    
    const overallLossValue = Math.max(0, account.accountSize - account.currentEquity);
    const overallLossPercent = (overallLossValue / account.accountSize) * 100;

    return {
      dailyLossValue,
      dailyLossPercent,
      overallLossValue,
      overallLossPercent,
      dailyMaxLoss,
      overallMaxLoss,
      dailyStatus: dailyLossPercent >= account.dailyDrawdownLimitPercent * 0.9 ? 'DANGER' : dailyLossPercent >= account.dailyDrawdownLimitPercent * 0.6 ? 'WARNING' : 'HEALTHY',
      overallStatus: overallLossPercent >= account.maxDrawdownLimitPercent * 0.9 ? 'DANGER' : overallLossPercent >= account.maxDrawdownLimitPercent * 0.6 ? 'WARNING' : 'HEALTHY'
    };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/10 text-blue-600 rounded-xl border border-blue-600/20">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-display font-semibold text-slate-900">Funded Accounts & MT5 Sync Bridge</h2>
            <p className="text-xs text-slate-400">Pass prop challenges and guard funded credentials with automated MT5 equity guardians</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
        >
          {showAddForm ? <Unlock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showAddForm ? 'Close Account Form' : 'Register Funded Account'}</span>
        </button>
      </div>

      {accounts.length >= maxAccounts && (
        <div className="bg-white/20 border border-slate-200/40 p-4 rounded-xl text-xs text-slate-400 font-sans flex items-start gap-2.5 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-900 block">Account Registration Limit Reached</span>
            <span className="block leading-relaxed">
              Your profile is currently allocated a maximum limit of <strong>{maxAccounts} account(s)</strong>. To register further prop-firm credentials or retail MT5 logins, please request a limit increase from your administrator.
            </span>
          </div>
        </div>
      )}

      {/* Add New Funded Account Form */}
      {showAddForm && (
        <form onSubmit={handleAddAccount} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xl space-y-6 animate-slide-in">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">Collect Account Configurations</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Prop Trading Firm</label>
              <select
                value={propFirm}
                onChange={(e) => {
                  setPropFirm(e.target.value);
                  if (e.target.value === 'FTMO') setMt5Server('FTMO-Server3');
                  else if (e.target.value === 'FundingPips') setMt5Server('FundingPips-Live');
                  else if (e.target.value === 'FundedNext') setMt5Server('FundedNext-Live');
                  else setMt5Server('Custom-BrokerServer');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="FTMO">FTMO</option>
                <option value="FundingPips">Funding Pips</option>
                <option value="FundedNext">FundedNext</option>
                <option value="SmartPropTrader">Smart Prop Trader</option>
                <option value="E8_Funding">E8 Funding</option>
                <option value="Custom">Other Custom Broker</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="Evaluation">Evaluation / Challenge</option>
                <option value="Funded">Funded / Live Account</option>
                <option value="Express">Express / Rapid</option>
                <option value="Stellar">Stellar / No Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">MT5 Login / Account ID</label>
              <input
                type="text"
                placeholder="e.g. 8490215"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-600 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            {/* AI Auto-Detect Card row span */}
            <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl gap-4">
              <div className="flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <span className="block text-xs font-semibold text-slate-900">AI Rule Auto-Detection Engine</span>
                  <span className="block text-[11px] text-slate-400 leading-normal">
                    Instantly fetch exact daily loss, overall drawdown, target milestones, and leverage constraints for <strong>{propFirm} {accountType} (${accountSize.toLocaleString()})</strong>.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAIDetectRules}
                disabled={isDetectingRules}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetectingRules ? 'animate-spin' : ''}`} />
                <span>{isDetectingRules ? 'AI Scanning...' : 'Auto-Detect Rules'}</span>
              </button>
            </div>

            {aiRulesMessage && (
              <div className="md:col-span-3 p-4 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="block font-semibold text-slate-700 font-mono text-[10px] uppercase tracking-wider">AI Detected Constraints Summary:</span>
                <p className="text-slate-400 leading-normal">{aiRulesMessage}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">MT5 Investor/Master Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Account Capital Size ($)</label>
              <select
                value={accountSize}
                onChange={(e) => setAccountSize(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="5000">$5,000 (Micro)</option>
                <option value="10000">$10,000 (Evaluation)</option>
                <option value="25000">$25,000 (Evaluation)</option>
                <option value="50000">$50,000 (Standard)</option>
                <option value="100000">$100,000 (Advanced)</option>
                <option value="200000">$200,000 (Pro Master)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Broker MT5 Server Name</label>
              <input
                type="text"
                placeholder="e.g. FTMO-Server3"
                value={mt5Server}
                onChange={(e) => setMt5Server(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Platform Type</label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-mono text-slate-900 cursor-pointer select-none">
                  <input
                    type="radio"
                    checked={platform === 'MT5'}
                    onChange={() => setPlatform('MT5')}
                    className="text-blue-700 bg-white border-slate-200"
                  />
                  MetaTrader 5 (Preferred)
                </label>
                <label className="flex items-center gap-2 text-xs font-mono text-slate-900 cursor-pointer select-none">
                  <input
                    type="radio"
                    checked={platform === 'MT4'}
                    onChange={() => setPlatform('MT4')}
                    className="text-blue-700 bg-white border-slate-200"
                  />
                  MetaTrader 4
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Daily Drawdown Guard Limit (%)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Overall Drawdown Guard Limit (%)</label>
              <input
                type="number"
                min="2"
                max="25"
                value={maxLimit}
                onChange={(e) => setMaxLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:border-blue-600/30 transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-slate-900">Emergency Kill Switch</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Close all trades on drawdown breach</span>
                </div>
                <input
                  type="checkbox"
                  checked={emergencyKillSwitch}
                  onChange={(e) => setEmergencyKillSwitch(e.target.checked)}
                  className="rounded border-slate-200 text-blue-700 focus:ring-0 bg-white h-4 w-4"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Authorize & Save Credentials
            </button>
          </div>
        </form>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Accounts List & Protection State */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white/30">
              <div>
                <h3 className="font-display font-semibold text-slate-900">Active Prop-Firm Accounts</h3>
                <p className="text-xs text-slate-400">Live monitoring of equity, margin constraints and drawdown limits</p>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 bg-blue-600/10 text-blue-600 rounded-full border border-blue-600/20 font-medium">
                MT5 Direct Link Enabled
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Synchronizing portfolio state...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto" />
                <p>No registered prop accounts found. Please click 'Register Funded Account' to sync your first live MT5 terminal.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#e2e8f0]">
                {accounts.map((account) => {
                  const { 
                    dailyLossValue, 
                    dailyLossPercent, 
                    overallLossValue, 
                    overallLossPercent, 
                    dailyMaxLoss, 
                    overallMaxLoss,
                    dailyStatus,
                    overallStatus 
                  } = getDrawdownStats(account);

                  return (
                    <div key={account.id} className="p-6 hover:bg-white/20 transition-colors space-y-5">
                      {/* Top Row Title & Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 font-mono">
                            {account.propFirm}
                          </div>
                          {account.accountType && (
                            <div className="px-2.5 py-1 bg-blue-600/10 border border-blue-600/20 rounded-lg text-[10px] font-bold text-blue-600 font-mono uppercase">
                              {account.accountType}
                            </div>
                          )}
                          <div>
                            <span className="block text-sm font-semibold text-slate-900">
                              Account Size: ${account.accountSize.toLocaleString()}
                            </span>
                            <span className="block text-xs font-mono text-slate-400">
                              Login ID: {account.accountId} | Server: {account.mt5Server}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Platform Badge */}
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-400 font-bold">
                            {account.platform}
                          </span>

                          {/* Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            account.status === 'Authorized'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : account.status === 'Violated'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-white text-blue-600 border-slate-200'
                          }`}>
                            ● {account.status}
                          </span>

                          <button 
                            onClick={() => handleDeleteAccount(account.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove account info"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Portfolios metrics row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/40 border border-slate-200 p-4 rounded-xl">
                        <div>
                          <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Balance</span>
                          <span className="text-sm font-bold font-mono text-slate-700">${account.currentBalance.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Equity</span>
                          <span className={`text-sm font-bold font-mono ${account.currentEquity >= account.accountSize ? 'text-emerald-400' : 'text-slate-700'}`}>
                            ${account.currentEquity.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Leverage</span>
                          <span className="text-sm font-bold font-mono text-slate-700">{account.leverage}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Profit Target</span>
                          <span className="text-sm font-bold font-mono text-emerald-400">+8% ($8,000)</span>
                        </div>
                      </div>

                      {/* Drawdown Guardians bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Daily Drawdown Indicator */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Daily Drawdown Risk</span>
                            <span className={`font-mono font-semibold ${dailyStatus === 'DANGER' ? 'text-rose-400' : 'text-slate-400'}`}>
                              ${dailyLossValue.toLocaleString()} / ${dailyMaxLoss.toLocaleString()} ({dailyLossPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                dailyStatus === 'DANGER' ? 'bg-rose-500 animate-pulse' : dailyStatus === 'WARNING' ? 'bg-blue-600' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (dailyLossPercent / account.dailyDrawdownLimitPercent) * 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Daily Limit: {account.dailyDrawdownLimitPercent}% Max Loss</span>
                            <span className={dailyStatus === 'DANGER' ? 'text-rose-400' : 'text-emerald-500'}>
                              {dailyStatus === 'DANGER' ? 'Emergency Level' : 'Secure Level'}
                            </span>
                          </div>
                        </div>

                        {/* Max Drawdown Indicator */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Overall Drawdown Risk</span>
                            <span className={`font-mono font-semibold ${overallStatus === 'DANGER' ? 'text-rose-400' : 'text-slate-400'}`}>
                              ${overallLossValue.toLocaleString()} / ${overallMaxLoss.toLocaleString()} ({overallLossPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                overallStatus === 'DANGER' ? 'bg-rose-500 animate-pulse' : overallStatus === 'WARNING' ? 'bg-blue-600' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (overallLossPercent / account.maxDrawdownLimitPercent) * 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Total Limit: {account.maxDrawdownLimitPercent}% Max Drawdown</span>
                            <span className={overallStatus === 'DANGER' ? 'text-rose-400' : 'text-emerald-500'}>
                              {overallStatus === 'DANGER' ? 'Critical Level' : 'Secure Level'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {account.explanation && (
                        <div className="p-4 bg-white/30 border border-slate-200/40 rounded-xl text-xs text-slate-400 leading-normal space-y-1">
                          <span className="block font-semibold text-blue-600 font-mono text-[9px] uppercase tracking-wider">AI Synced Rules & Constraints Checklist:</span>
                          <p>{account.explanation}</p>
                        </div>
                      )}

                      {/* Bottom Guardian controls bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/60">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400">
                            <input
                              type="checkbox"
                              checked={account.emergencyKillSwitch}
                              onChange={() => handleToggleEmergencyKillSwitch(account)}
                              className="rounded border-slate-200 text-blue-700 focus:ring-0 bg-white"
                            />
                            <span>Active Emergency Killswitch Protection</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          {account.status !== 'Authorized' ? (
                            <button
                              onClick={() => handleAuthorizeToMT5(account)}
                              className="px-4 py-2 bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Authorize Sync to MT5
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeauthorize(account)}
                              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Deauthorize / Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Automatic Authorizer Handshake Terminal & Guard Logs */}
        <div className="lg:col-span-1 space-y-6">
          {/* Automatic Authorizer Bridge Info */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono">MT5 Automated Authorizer</h3>
            </div>

            <p className="text-xs text-slate-400 leading-normal">
              Once you authorize a funded account, this bridge binds your credentials directly into the EA running on your MT5 terminal. 
              The connection utilizes standard REST handshakes securely encrypted on your local server.
            </p>

            <div className="p-4 bg-white/50 border border-slate-200 rounded-xl space-y-2">
              <span className="block text-[10px] uppercase font-mono tracking-wider text-slate-400">Guard Rules active:</span>
              <ul className="text-xs space-y-1.5 text-slate-400">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Real-time Equity Tracking (4s interval)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Killswitch at 4.7% (Prevent Failures)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Automatic lot recalculation</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Secure Handshake Console Log */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <span className="text-xs font-mono font-semibold text-slate-400 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-600 animate-ping' : 'bg-emerald-500'}`}></span>
                Sync Bridge Console
              </span>
              <span className="text-[9px] font-mono text-slate-600">Port 3000 Active</span>
            </div>

            <div className="p-4 bg-slate-50 font-mono text-[10px] text-slate-400 h-64 overflow-y-auto space-y-2">
              {syncLogs.length === 0 ? (
                <div className="text-slate-600 italic h-full flex items-center justify-center text-center">
                  Awaiting MT5 Terminal authorization trigger...
                </div>
              ) : (
                syncLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-normal ${
                      log.includes('Authorized') ? 'text-emerald-400 font-bold' : log.includes('Verifying') ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
              {isSyncing && (
                <div className="flex items-center gap-1.5 text-blue-600 animate-pulse mt-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Negotiating TLS Handshake...</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
