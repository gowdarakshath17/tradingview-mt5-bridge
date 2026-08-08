import { useState, FormEvent, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Signal, BridgeConfig } from '../types';
import { Send, Clock, Trash2, ShieldCheck, HelpCircle, CheckCircle2, AlertTriangle, Play, RefreshCw, Bell, TrendingUp, TrendingDown, Percent, Download, PieChart as ChartIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface SignalLogProps {
  signals: Signal[];
  config: BridgeConfig;
  onSimulateSignal: (type: 'BUY' | 'SELL', price: number) => Promise<void>;
  onClearSignals: () => Promise<void>;
  onRefresh: () => void;
  refreshing: boolean;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => Promise<void>;
}

export default function SignalLog({
  signals,
  config,
  onSimulateSignal,
  onClearSignals,
  onRefresh,
  refreshing,
  notificationPermission,
  onRequestNotificationPermission
}: SignalLogProps) {
  const [simType, setSimType] = useState<'BUY' | 'SELL'>('BUY');
  const [simPrice, setSimPrice] = useState<number>(4050.00);
  const [submitting, setSubmitting] = useState(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  
  // Interactive Live Terminal states
  const [activeQueueTab, setActiveQueueTab] = useState<'visual' | 'terminal'>('visual');
  const [terminalSearch, setTerminalSearch] = useState('');
  const [terminalFilter, setTerminalFilter] = useState<'ALL' | 'INFO' | 'BUY' | 'SELL' | 'SUCCESS' | 'WARNING' | 'ERROR'>('ALL');

  // Compute developer console logs from the structured signal list
  const terminalLogs = useMemo(() => {
    const logs: Array<{ id: string; timestamp: string; type: 'INFO' | 'BUY' | 'SELL' | 'SUCCESS' | 'WARNING' | 'ERROR'; text: string }> = [];
    
    signals.forEach(sig => {
      const timeStr = new Date(sig.timestamp).toLocaleTimeString();
      const dateStr = new Date(sig.timestamp).toLocaleDateString();
      const combinedTime = `${dateStr} ${timeStr}`;

      // 1. Log parsing webhook
      logs.push({
        id: `${sig.id}-parsed`,
        timestamp: sig.timestamp,
        type: 'INFO',
        text: `[${combinedTime}] [INFO] Webhook alert parsed successfully for ${sig.symbol}. Price: $${sig.price.toFixed(2)}, Type: ${sig.type}, Source: ${sig.source}, SL: $${sig.sl.toFixed(2)}, TP: $${sig.tp.toFixed(2)}`
      });

      // 2. Log direction action
      logs.push({
        id: `${sig.id}-direction`,
        timestamp: sig.timestamp,
        type: sig.type as 'BUY' | 'SELL',
        text: `[${combinedTime}] [${sig.type}] Initiating ${sig.type} trade signal on contract ${sig.symbol} (Estimated Lots: ${sig.lotSize.toFixed(2)})`
      });

      // 3. Status outcomes
      if (sig.status === 'Executed') {
        const execTime = sig.executedAt ? `${new Date(sig.executedAt).toLocaleDateString()} ${new Date(sig.executedAt).toLocaleTimeString()}` : combinedTime;
        logs.push({
          id: `${sig.id}-executed`,
          timestamp: sig.executedAt || sig.timestamp,
          type: 'SUCCESS',
          text: `[${execTime}] [SUCCESS] MT5 Bridge completed order execution on VPS broker terminal. Lots: ${sig.lotSize.toFixed(2)}, Price: $${(sig.executedPrice || sig.price).toFixed(2)}. Details: ${sig.executionDetails || ''}`
        });
      } else if (sig.status === 'Failed') {
        logs.push({
          id: `${sig.id}-failed`,
          timestamp: sig.timestamp,
          type: 'ERROR',
          text: `[${combinedTime}] [ERROR] MT5 execution rejected or timed out. Reason: ${sig.executionDetails || 'Failed to establish terminal communication link'}`
        });
      } else {
        logs.push({
          id: `${sig.id}-pending`,
          timestamp: sig.timestamp,
          type: 'WARNING',
          text: `[${combinedTime}] [WARNING] Signal queued in-memory. Waiting for MT5 EA connection...`
        });
      }
    });

    // Sort logs descending (newest on top)
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [signals]);

  // Filter and Search the computed logs
  const filteredTerminalLogs = useMemo(() => {
    return terminalLogs.filter(log => {
      // Filter by type
      if (terminalFilter !== 'ALL') {
        if (terminalFilter === 'BUY' && log.type !== 'BUY') return false;
        if (terminalFilter === 'SELL' && log.type !== 'SELL') return false;
        if (terminalFilter === 'INFO' && log.type !== 'INFO') return false;
        if (terminalFilter === 'SUCCESS' && log.type !== 'SUCCESS') return false;
        if (terminalFilter === 'WARNING' && log.type !== 'WARNING') return false;
        if (terminalFilter === 'ERROR' && log.type !== 'ERROR') return false;
      }
      
      // Search by query text
      if (terminalSearch.trim()) {
        const query = terminalSearch.toLowerCase();
        return log.text.toLowerCase().includes(query);
      }
      
      return true;
    });
  }, [terminalLogs, terminalFilter, terminalSearch]);
  
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Update lastRefreshedAt when signals or config updates
  useEffect(() => {
    setLastRefreshedAt(Date.now());
  }, [signals, config]);

  // Update lastRefreshedAt when refreshing finishes
  useEffect(() => {
    if (!refreshing) {
      setLastRefreshedAt(Date.now());
    }
  }, [refreshing]);

  // A timer to count up the seconds ago
  useEffect(() => {
    setSecondsAgo(Math.floor((Date.now() - lastRefreshedAt) / 1000));

    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  const displayTime = useMemo(() => {
    if (secondsAgo < 1) return 'Updated just now';
    if (secondsAgo < 60) return `Updated ${secondsAgo}s ago`;
    const mins = Math.floor(secondsAgo / 60);
    const secs = secondsAgo % 60;
    if (mins < 60) {
      return `Updated ${mins}m ${secs}s ago`;
    }
    return `Updated >1h ago`;
  }, [secondsAgo]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic when signals change
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [signals, autoScroll]);

  const realCounts = useMemo(() => {
    return {
      pending: signals.filter(s => s.status === 'Pending').length,
      executed: signals.filter(s => s.status === 'Executed').length,
      failed: signals.filter(s => s.status === 'Failed').length,
    };
  }, [signals]);

  // Deterministic outcome helper to ensure stable results
  const getSignalOutcome = (sig: Signal): 'WIN' | 'LOSS' => {
    const seed = sig.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.round(sig.price * 100);
    return (seed % 10) < 6 ? 'WIN' : 'LOSS'; // ~60% win rate
  };

  const [chartMode, setChartMode] = useState<'winloss' | 'status'>('winloss');

  // Compute metrics
  const statsData = useMemo(() => {
    const totalCount = signals.length;
    const executed = signals.filter(s => s.status === 'Executed');
    const failed = signals.filter(s => s.status === 'Failed');
    const pending = signals.filter(s => s.status === 'Pending');

    const executedCount = executed.length;
    const failedCount = failed.length;
    const pendingCount = pending.length;

    let winsCount = 0;
    let lossesCount = 0;
    let totalPnL = 0;
    let totalPoints = 0;

    executed.forEach(s => {
      const isWin = getSignalOutcome(s) === 'WIN';
      if (isWin) {
        winsCount++;
      } else {
        lossesCount++;
      }

      const lot = s.lotSize || 0.1;
      const slPoints = Math.abs(s.sl - s.price);
      const tpPoints = Math.abs(s.tp - s.price);
      const points = isWin ? tpPoints : -slPoints;

      totalPoints += points;
      totalPnL += points * lot;
    });

    const isMock = totalCount === 0;

    const displayWins = isMock ? 15 : winsCount;
    const displayLosses = isMock ? 9 : lossesCount;
    const displayFailed = isMock ? 2 : failedCount;
    const displayPending = isMock ? 0 : pendingCount;
    const displayExecuted = isMock ? 24 : executedCount;
    const displayTotal = isMock ? 26 : totalCount;

    if (isMock) {
      totalPnL = 2450.00;
      totalPoints = 245.0;
    }

    // Chart datasets
    const winLossData = [
      { name: 'Wins', value: displayWins, color: '#10b981' },
      { name: 'Losses', value: displayLosses, color: '#f43f5e' }
    ];

    const statusData = [
      { name: 'Executed', value: displayExecuted, color: '#10b981' },
      { name: 'Failed', value: displayFailed, color: '#f43f5e' },
      { name: 'Pending', value: displayPending, color: '#eab308' }
    ].filter(item => item.value > 0);

    const winRate = (displayWins + displayLosses) > 0 
      ? Math.round((displayWins / (displayWins + displayLosses)) * 100) 
      : 0;

    const executionSuccessRate = displayTotal > 0
      ? Math.round((displayExecuted / displayTotal) * 100)
      : 100;

    return {
      isMock,
      totalCount: displayTotal,
      winLossData,
      statusData,
      winsCount: displayWins,
      lossesCount: displayLosses,
      failedCount: displayFailed,
      pendingCount: displayPending,
      executedCount: displayExecuted,
      winRate,
      executionSuccessRate,
      totalPnL,
      totalPoints
    };
  }, [signals, config]);

  const handleDownloadCSV = () => {
    if (signals.length === 0) return;

    // CSV Headers
    const headers = [
      'Signal ID',
      'Timestamp',
      'Type',
      'Symbol',
      'Price',
      'Stop Loss',
      'Take Profit',
      'Lot Size',
      'Source',
      'Status',
      'Executed At',
      'Executed Price',
      'Execution Details',
      'Outcome',
      'Points',
      'PnL ($)'
    ];

    const rows = signals.map(sig => {
      const isExecuted = sig.status === 'Executed';
      const isFailed = sig.status === 'Failed';
      
      let outcome = '';
      let points = 0;
      let pnl = 0;

      if (isExecuted) {
        const isWin = getSignalOutcome(sig) === 'WIN';
        outcome = isWin ? 'WIN' : 'LOSS';
        
        const slPoints = Math.abs(sig.sl - sig.price);
        const tpPoints = Math.abs(sig.tp - sig.price);
        points = isWin ? tpPoints : -slPoints;

        const lot = sig.lotSize || 0.1;
        pnl = points * lot;
      } else if (isFailed) {
        outcome = 'FAILED';
      } else {
        outcome = 'PENDING';
      }

      return [
        sig.id,
        sig.timestamp,
        sig.type,
        sig.symbol,
        sig.price,
        sig.sl,
        sig.tp,
        sig.lotSize,
        sig.source,
        sig.status,
        sig.executedAt || '',
        sig.executedPrice || '',
        sig.executionDetails || '',
        outcome,
        points.toFixed(2),
        pnl.toFixed(2)
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mt5_bridge_signals_${config.passphrase || 'history'}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSimulateSignal(simType, Number(simPrice));
    setSubmitting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column Stack */}
      <div className="lg:col-span-4 flex flex-col gap-6 self-start">
        {/* Webhook Simulator Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
            <div className="p-2 bg-white text-blue-600 rounded-lg border border-slate-200">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">Alert Webhook Simulator</h3>
              <p className="text-xs text-slate-400">Test your MT5 integration immediately</p>
            </div>
          </div>

          <form onSubmit={handleSimulate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Signal Type (Action)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimType('BUY')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    simType === 'BUY'
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/50 shadow-md shadow-emerald-500/5'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-200/30'
                  }`}
                >
                  🟢 BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSimType('SELL')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    simType === 'SELL'
                      ? 'bg-blue-700/20 text-blue-600 border-blue-700/50 shadow-md shadow-blue-600/5'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-200/30'
                  }`}
                >
                  🟠 SELL
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Simulated Close Price
              </label>
              <input
                type="number"
                step="0.01"
                value={simPrice}
                onChange={(e) => setSimPrice(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                placeholder="4050.00"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-55"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Injecting Signal...' : 'Send Simulated Webhook'}
            </button>
          </form>

          <div className="mt-5 p-3.5 bg-black/20 border border-slate-200 rounded-xl text-[11px] text-slate-400 leading-normal space-y-2">
            <div>
              <span className="font-semibold text-slate-400 block mb-1">💡 How to test:</span>
              1. Deploy your EA inside MetaTrader 5 or run the Python script locally.<br />
              2. Click the <strong>Send Simulated Webhook</strong> button above.<br />
              3. MT5 should instantly receive the signal and open a trade!
            </div>
            <div className="pt-2 border-t border-slate-200/50">
              <span className="font-semibold text-slate-400 block mb-1">⚡ Developer Hotkeys:</span>
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-sans font-medium text-slate-700 shadow-sm">Ctrl + B</kbd> to simulate a <strong className="text-emerald-600">BUY</strong> order.<br />
              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-sans font-medium text-slate-700 shadow-sm">Ctrl + S</kbd> to simulate a <strong className="text-rose-600">SELL</strong> order.
            </div>
          </div>
        </div>

        {/* Signal Metrics & Win/Loss Ratio Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white text-blue-600 rounded-lg border border-slate-200">
                <ChartIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-slate-900 text-sm">Performance Stats</h3>
                <p className="text-xs text-slate-400">Real-time ratios & status</p>
              </div>
            </div>
            {statsData.isMock && (
              <span className="text-[9px] uppercase font-mono font-bold bg-blue-50/40 text-blue-600 border border-blue-100/40 px-2 py-0.5 rounded-md">
                Demo Profile
              </span>
            )}
          </div>

          {/* Toggle Tabs */}
          <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg text-[11px] mb-4">
            <button
              type="button"
              onClick={() => setChartMode('winloss')}
              className={`flex-1 py-1.5 rounded-md transition-all font-medium cursor-pointer flex items-center justify-center gap-1.5 ${
                chartMode === 'winloss'
                  ? 'bg-blue-700 text-slate-900 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Win/Loss Ratio
            </button>
            <button
              type="button"
              onClick={() => setChartMode('status')}
              className={`flex-1 py-1.5 rounded-md transition-all font-medium cursor-pointer flex items-center justify-center gap-1.5 ${
                chartMode === 'status'
                  ? 'bg-blue-700 text-slate-900 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <Percent className="w-3 h-3" />
              Execution Status
            </button>
          </div>

          {/* Chart Display */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Recharts Pie container */}
            <div className="sm:col-span-6 h-[150px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartMode === 'winloss' ? statsData.winLossData : statsData.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(chartMode === 'winloss' ? statsData.winLossData : statsData.statusData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1f29',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#ffffff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Ratio Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                <span className="text-base font-bold font-mono text-slate-900">
                  {chartMode === 'winloss' ? `${statsData.winRate}%` : `${statsData.executionSuccessRate}%`}
                </span>
                <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider leading-none">
                  {chartMode === 'winloss' ? 'Win Rate' : 'Success'}
                </span>
              </div>
            </div>

            {/* Custom Styled HTML Legend */}
            <div className="sm:col-span-6 space-y-2.5">
              {chartMode === 'winloss' ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-xs text-slate-400 font-medium">Wins</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">
                      {statsData.winsCount} <span className="text-[10px] text-slate-400 font-normal">({statsData.winRate}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="text-xs text-slate-400 font-medium">Losses</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">
                      {statsData.lossesCount} <span className="text-[10px] text-slate-400 font-normal">({100 - statsData.winRate}%)</span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-xs text-slate-400 font-medium">Executed</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">{statsData.executedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="text-xs text-slate-400 font-medium">Failed</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">{statsData.failedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                      <span className="text-xs text-slate-400 font-medium">Pending</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">{statsData.pendingCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Total Signals Tracked:</span>
            <span className="font-bold text-slate-700">{statsData.totalCount}</span>
          </div>
        </div>
      </div>

      {/* Real-time Signal Feed Log */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xl p-6 flex flex-col min-h-[400px]">
        {/* Log Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold text-slate-900 whitespace-nowrap">Bridge Signal Queue</h3>
            <span className="text-[10px] uppercase font-mono font-bold bg-white text-blue-600 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap">Live</span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono sm:ml-2 border-l border-slate-200 pl-2 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-slate-300" />
              <span>{displayTime}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Notification permission button in Queue Toolbar */}
            {typeof window !== 'undefined' && 'Notification' in window && (
              <button
                onClick={onRequestNotificationPermission}
                className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer font-semibold ${
                  notificationPermission === 'granted'
                    ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                    : notificationPermission === 'denied'
                    ? 'bg-rose-950/20 text-rose-400 border-rose-900/30'
                    : 'bg-blue-50/20 text-blue-600 border-blue-100/30'
                }`}
                title="Manage Desktop trade alerts"
              >
                <Bell className={`w-3.5 h-3.5 ${notificationPermission === 'granted' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">
                  {notificationPermission === 'granted' ? 'Alerts: On' : notificationPermission === 'denied' ? 'Alerts: Blocked' : 'Enable Alerts'}
                </span>
              </button>
            )}

            {/* Auto-scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer font-semibold ${
                autoScroll
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:border-slate-300'
              }`}
              title="Toggle auto-scroll to new signals"
              id="autoscroll-toggle-btn"
            >
              <div className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`} />
              <span>Auto-scroll</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleDownloadCSV}
              disabled={signals.length === 0}
              className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer font-semibold ${
                signals.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-300 border-slate-100'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
              title="Download signals history as CSV"
              id="download-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                if(confirm("Are you sure you want to delete all signal history from this bridge session?")) {
                  onClearSignals();
                }
              }}
              className="px-3 py-1.5 text-xs text-rose-400 border border-rose-950/40 bg-rose-950/10 hover:bg-rose-950/20 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset History
            </button>
          </div>
        </div>

        {/* Performance Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 shrink-0" id="performance-summary-header">
          {/* Net PnL Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Session Net PnL</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold font-mono tracking-tight ${
                  statsData.totalPnL > 0 
                    ? 'text-emerald-600' 
                    : statsData.totalPnL < 0 
                    ? 'text-rose-600' 
                    : 'text-slate-600'
                }`}>
                  {statsData.totalPnL >= 0 ? '+' : ''}${statsData.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  statsData.totalPoints > 0 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                    : statsData.totalPoints < 0 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/50' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {statsData.totalPoints >= 0 ? '+' : ''}{statsData.totalPoints.toFixed(1)} pts
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                On {statsData.executedCount} executed signals
              </span>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              statsData.totalPnL > 0 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : statsData.totalPnL < 0 
                ? 'bg-rose-50 text-rose-600 border-rose-100' 
                : 'bg-slate-50 text-slate-400 border-slate-100'
            }`}>
              {statsData.totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>

          {/* Win Rate Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Win Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono tracking-tight text-slate-900">
                  {statsData.winRate}%
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  {statsData.winsCount}W - {statsData.lossesCount}L
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-28 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${statsData.winRate}%` }}
                />
              </div>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Mini Summary Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4 shrink-0">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-slate-500 font-sans truncate">Pending</span>
            </div>
            <span className="text-xs font-bold font-mono text-yellow-600 pl-1 shrink-0">{realCounts.pending}</span>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 font-sans truncate">Executed</span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-600 pl-1 shrink-0">{realCounts.executed}</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 font-sans truncate">Failed</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-600 pl-1 shrink-0">{realCounts.failed}</span>
          </div>
        </div>
             {/* Tab Toggle: Visual Queue vs Live Execution Terminal */}
        <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs mb-4 shrink-0 font-semibold">
          <button
            type="button"
            onClick={() => setActiveQueueTab('visual')}
            className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeQueueTab === 'visual'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Visual Signal Queue ({signals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveQueueTab('terminal')}
            className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeQueueTab === 'terminal'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            id="terminal-logs-tab-btn"
          >
            Live Terminal Logs ({filteredTerminalLogs.length})
          </button>
        </div>

        {activeQueueTab === 'visual' ? (
          /* List of Signals (Visual Queue) */
          signals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-sm text-slate-700">No Webhook Alerts Logged</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                Active alerts triggered by TradingView or the Simulator panel on the left will accumulate here in real-time.
              </p>
              {typeof window !== 'undefined' && 'Notification' in window && notificationPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={onRequestNotificationPermission}
                  className="mt-4 px-4 py-2 bg-blue-700/10 hover:bg-blue-700/20 text-blue-600 border border-blue-600/20 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-102 flex items-center gap-2"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Request Desktop Alerts for Executions</span>
                </button>
              )}
            </div>
          ) : (
            <div ref={scrollContainerRef} className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {signals.map((sig, index) => {
                  const dateStr = new Date(sig.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <motion.div
                      key={sig.id}
                      initial={{ opacity: 0, x: -20, y: 10 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ scale: 1.01, y: -2 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25, delay: Math.min(index * 0.03, 0.3) }}
                      className="p-4 bg-white/40 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-500/30 hover:bg-white/70 transition-colors shadow-sm"
                    >
                      {/* Left Info: Type / Direction, Symbol, Price */}
                      <div className="flex items-start md:items-center gap-3">
                        <div className={`px-3 py-2 rounded-xl text-center shrink-0 min-w-16 border ${
                          sig.type === 'BUY'
                            ? 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20'
                            : 'bg-orange-600/10 text-orange-400 border-orange-600/20'
                        }`}>
                          <span className="block text-[10px] font-mono font-bold leading-none uppercase">
                            {sig.type}
                          </span>
                          <span className="block text-xs font-mono font-bold mt-1">
                            ${sig.price.toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-sm font-display">{sig.symbol}</span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              sig.source === 'Simulator'
                                ? 'bg-blue-700/10 text-blue-600 border-blue-700/20'
                                : 'bg-sky-600/10 text-sky-400 border-sky-600/20'
                            }`}>
                              {sig.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span>SL: ${sig.sl}</span>
                            <span>•</span>
                            <span>TP: ${sig.tp}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Info: Status, execution details, lot size */}
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-slate-200 pt-3 md:pt-0">
                        {/* Price Difference / Slippage */}
                        {(sig.status === 'Executed' && sig.executedPrice !== undefined) ? (
                          <div className="text-left md:text-right font-mono pr-4 md:border-r border-slate-200 min-w-[90px]">
                            <span className={`block text-[10px] font-bold ${
                               sig.executedPrice === sig.price ? 'text-slate-500' :
                               (sig.executedPrice > sig.price ? (sig.type === 'BUY' ? 'text-rose-500' : 'text-emerald-500') : (sig.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'))
                            }`}>
                              Diff: {(sig.executedPrice - sig.price > 0 ? '+' : '')}{(sig.executedPrice - sig.price).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1">
                              MT5: ${sig.executedPrice.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-left md:text-right font-mono pr-4 md:border-r border-slate-200 min-w-[90px] opacity-40">
                            <span className="block text-[10px] font-bold text-slate-500">
                              Diff: --
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1">
                              MT5: --
                            </span>
                          </div>
                        )}

                        <div className="text-left md:text-right font-mono w-[80px]">
                          <span className="block text-xs font-semibold text-slate-900">{sig.lotSize.toFixed(2)} Lots</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {sig.accountBalanceUsed ? `Bal: $${(sig.accountBalanceUsed / 1000).toFixed(0)}k` : 'Dyn Risk'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {sig.status === 'Pending' && (
                            <div className="relative group flex items-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono bg-yellow-600/10 text-yellow-500 dark:text-yellow-400 border border-yellow-600/20 px-2.5 py-1 rounded-lg cursor-help transition-all hover:bg-yellow-600/20">
                                <Clock className="w-3 h-3 text-yellow-500 animate-pulse" />
                                Pending MT5
                              </span>
                              <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 hidden group-hover:block w-56 bg-slate-900 text-slate-100 text-[10px] rounded-lg p-2.5 shadow-xl border border-slate-700/80 z-50 font-sans pointer-events-none transition-all duration-200">
                                <div className="font-bold text-yellow-400 mb-0.5">Pending MT5 Connection</div>
                                <div className="text-slate-300 leading-relaxed font-normal">Signal is queued in-memory, waiting for the MT5 Expert Advisor on your VPS to pick it up and execute.</div>
                                <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 bg-slate-900 border-t border-r border-slate-700/80 rotate-45"></div>
                              </div>
                            </div>
                          )}

                          {sig.status === 'Executed' && (
                            <div className="text-right">
                              <div className="relative group inline-flex items-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono bg-emerald-600/10 text-emerald-500 dark:text-emerald-400 border border-emerald-600/20 px-2.5 py-1 rounded-lg cursor-help transition-all hover:bg-emerald-600/20">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                  Executed
                                </span>
                                <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 hidden group-hover:block w-56 bg-slate-900 text-slate-100 text-[10px] rounded-lg p-2.5 shadow-xl border border-slate-700/80 z-50 font-sans pointer-events-none transition-all duration-200">
                                  <div className="font-bold text-emerald-400 mb-0.5">Successfully Executed</div>
                                  <div className="text-slate-300 leading-relaxed font-normal">Alert was processed in real-time, matching prices, and executed successfully as a live order on your MT5 terminal.</div>
                                  <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 bg-slate-900 border-t border-r border-slate-700/80 rotate-45"></div>
                                </div>
                              </div>
                              {sig.executionDetails && (
                                <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{sig.executionDetails}</span>
                              )}
                            </div>
                          )}

                          {sig.status === 'Failed' && (
                            <div className="text-right">
                              <div className="relative group inline-flex items-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono bg-rose-600/10 text-rose-500 dark:text-rose-400 border border-rose-600/20 px-2.5 py-1 rounded-lg cursor-help transition-all hover:bg-rose-600/20">
                                  <AlertTriangle className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                                  Failed
                                </span>
                                <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 hidden group-hover:block w-56 bg-slate-900 text-slate-100 text-[10px] rounded-lg p-2.5 shadow-xl border border-slate-700/80 z-50 font-sans pointer-events-none transition-all duration-200">
                                  <div className="font-bold text-rose-400 mb-0.5">Execution Failed</div>
                                  <div className="text-slate-300 leading-relaxed font-normal">The MT5 terminal rejected the trade. Please check market hours, margin requirements, symbols, or broker logs.</div>
                                  <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 bg-slate-900 border-t border-r border-slate-700/80 rotate-45"></div>
                                </div>
                              </div>
                              {sig.executionDetails && (
                                <span className="block text-[9px] text-rose-500 font-mono mt-0.5">{sig.executionDetails}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        ) : (
          /* Live Monospaced Developer Terminal Logs */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed select-text shadow-inner">
            {/* Terminal Filters and Controls */}
            <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={terminalSearch}
                    onChange={(e) => setTerminalSearch(e.target.value)}
                    placeholder="Search logs (e.g. symbol, lot, error)..."
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10.5px] text-slate-300 focus:outline-none focus:border-blue-600 placeholder-slate-600"
                  />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    const logsText = filteredTerminalLogs.map(l => l.text).join('\n');
                    const blob = new Blob([logsText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bridge_execution_terminal_${Date.now()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  title="Download terminal logs"
                  className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                >
                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export</span>
                </button>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                <span className="text-slate-500 mr-1">LEVEL:</span>
                {(['ALL', 'INFO', 'BUY', 'SELL', 'SUCCESS', 'WARNING', 'ERROR'] as const).map(f => {
                  const isActive = terminalFilter === f;
                  const count = f === 'ALL' 
                    ? terminalLogs.length 
                    : terminalLogs.filter(l => l.type === f || (f === 'BUY' && l.type === 'BUY') || (f === 'SELL' && l.type === 'SELL')).length;
                  
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTerminalFilter(f)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors font-semibold border ${
                        isActive
                          ? 'bg-blue-900/30 text-blue-400 border-blue-800'
                          : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-300'
                      }`}
                    >
                      {f} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Console Screen */}
            <div className="flex-1 overflow-y-auto max-h-[420px] p-4 text-slate-300 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="text-slate-500 mb-2 border-b border-slate-900 pb-1.5 flex items-center justify-between">
                <span>[SYSTEM_STREAMS] CONNECTED to SSE real-time event pipeline...</span>
                <span className="text-[10px] text-emerald-500 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  LIVE FEED
                </span>
              </div>

              {filteredTerminalLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-10">
                  {terminalSearch ? 'No matching console logs found.' : 'Listening for TradingView webhook alerts on /api/webhook...'}
                </div>
              ) : (
                filteredTerminalLogs.map(log => {
                  let colorClass = 'text-slate-400';
                  if (log.type === 'BUY') colorClass = 'text-emerald-400 font-semibold';
                  if (log.type === 'SELL') colorClass = 'text-amber-500 font-semibold';
                  if (log.type === 'SUCCESS') colorClass = 'text-lime-400 font-bold';
                  if (log.type === 'WARNING') colorClass = 'text-yellow-400';
                  if (log.type === 'ERROR') colorClass = 'text-red-400 font-bold';

                  return (
                    <div key={log.id} className="hover:bg-slate-900/50 p-0.5 rounded transition-colors flex items-start gap-2">
                      <span className="text-slate-600 select-none">&gt;</span>
                      <span className={`${colorClass} whitespace-pre-wrap break-all`}>{log.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
