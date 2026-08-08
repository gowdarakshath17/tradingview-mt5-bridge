import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Signal, BridgeConfig } from '../types';
import { getTradingStats } from '../utils/tradingStats';
import { 
  DollarSign, 
  Activity, 
  Cpu, 
  CheckCircle2, 
  Gauge, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  Copy,
  Zap
} from 'lucide-react';

interface BentoGridProps {
  signals: Signal[];
  config: BridgeConfig;
  systemStatus: {
    status: string;
    pending: number;
    executed: number;
    failed: number;
  };
  avgSlippage: string;
}

export default function BentoGrid({ signals, config, systemStatus, avgSlippage }: BentoGridProps) {
  const stats = useMemo(() => getTradingStats(signals), [signals]);
  const [copied, setCopied] = React.useState(false);

  const copyWebhook = () => {
    navigator.clipboard.writeText("https://api.goldbridge.com/v1/webhook");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe color codes
  const dailyPnLColor = stats.dailyPnL >= 0 ? "text-emerald-500" : "text-rose-500";
  const dailyBgColor = stats.dailyPnL >= 0 ? "bg-emerald-50" : "bg-rose-50";
  const cumulativePnLColor = stats.cumulativePnL >= 0 ? "text-emerald-600" : "text-rose-600";

  // Simple sparkline visualizer using SVG path
  const sparklinePath = useMemo(() => {
    if (stats.pnlHistory.length < 2) return "";
    const width = 120;
    const height = 40;
    const padding = 4;
    const pts = stats.pnlHistory.map(h => h.cumulative);
    const min = Math.min(...pts, 0);
    const max = Math.max(...pts, 100);
    const range = max - min || 1;

    return pts.map((p, idx) => {
      const x = padding + (idx / (pts.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p - min) / range) * (height - padding * 2);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [stats.pnlHistory]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 font-sans animate-fade-in">
      
      {/* CARD 1: PnL Performance (Spans 2 columns on lg/xl) */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all flex flex-col justify-between min-h-[180px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display block">
              Daily & Cumulative Profit
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <h2 className={`text-2xl font-bold font-mono tracking-tight ${dailyPnLColor}`}>
                {stats.dailyPnL >= 0 ? `+$${stats.dailyPnL.toLocaleString()}` : `-$${Math.abs(stats.dailyPnL).toLocaleString()}`}
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">TODAY</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
              <span className="text-slate-400">Net:</span>
              <span className={`font-semibold font-mono ${cumulativePnLColor}`}>
                {stats.cumulativePnL >= 0 ? `+$${stats.cumulativePnL.toLocaleString()}` : `-$${Math.abs(stats.cumulativePnL).toLocaleString()}`}
              </span>
            </div>
          </div>
          
          {/* Sparkline Graphic representing historical signal outcomes */}
          {stats.pnlHistory.length >= 2 ? (
            <div className="flex flex-col items-end gap-1">
              <svg width="120" height="40" className="overflow-visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={stats.cumulativePnL >= 0 ? "#10b981" : "#f43f5e"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                Signal Performance Curve
              </span>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Daily Profit Goal Progress Bar */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-sans font-medium text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-500 animate-pulse shrink-0" />
              Daily Profit Goal Progress
            </span>
            <span className="font-mono font-bold text-slate-600">
              {Math.min(100, Math.max(0, (stats.dailyPnL / (config?.dailyProfitGoal || 500)) * 100)).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/10">
            <motion.div 
              className={`h-full rounded-full bg-gradient-to-r ${stats.dailyPnL >= (config?.dailyProfitGoal || 500) ? 'from-emerald-500 to-teal-500' : 'from-blue-500 to-emerald-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, (stats.dailyPnL / (config?.dailyProfitGoal || 500)) * 100))}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${stats.dailyPnL >= (config?.dailyProfitGoal || 500) ? 'bg-emerald-500' : stats.dailyPnL >= 0 ? 'bg-blue-500' : 'bg-rose-500'}`} />
            <span>Target: ${(config?.dailyProfitGoal || 500).toLocaleString()}</span>
          </div>
          <span className="text-slate-500">
            {stats.dailyPnL >= (config?.dailyProfitGoal || 500) ? 'Goal Achieved! 🎉' : `${stats.pnlHistory.length} trades`}
          </span>
        </div>
      </motion.div>

      {/* CARD 2: Active Webhook Rules & Copy Endpoint */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all flex flex-col justify-between min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display block">
              Webhook Bridge
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-lg font-bold font-display text-slate-900 uppercase">
                {systemStatus.status === "active" ? "ONLINE" : "OFFLINE"}
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Ready for high-speed automated TradingView alerts
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 text-emerald-500 rounded-xl border border-slate-100 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-2">
          <button 
            onClick={copyWebhook}
            className="w-full flex items-center justify-between gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-lg text-[10px] font-mono text-slate-600 transition-colors cursor-pointer group"
          >
            <span className="truncate">api.goldbridge.com/v1/...</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
            )}
          </button>
        </div>
      </motion.div>

      {/* CARD 3: Win Rate & Profit Factor */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all flex flex-col justify-between min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display block">
              Win Statistics
            </span>
            <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {stats.winRate}%
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              Wins: {stats.winCount} | Loss: {stats.lossCount}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 text-blue-600 rounded-xl border border-slate-100 shadow-sm">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        {/* Mini progress bar representational of win percentage */}
        <div className="space-y-1.5 mt-2">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${stats.winRate}%` }} 
              className="bg-emerald-500 h-full transition-all duration-500"
            />
            <div 
              style={{ width: `${100 - stats.winRate}%` }} 
              className="bg-rose-400 h-full transition-all duration-500"
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono font-semibold text-slate-400">
            <span className="text-emerald-500">WIN RATE</span>
            <span className="text-rose-500">LOSS RATE</span>
          </div>
        </div>
      </motion.div>

      {/* CARD 4: Queue backlog */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all flex flex-col justify-between min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display block">
              Terminal Queue
            </span>
            <h3 className="text-2xl font-bold font-mono text-blue-600 mt-1">
              {systemStatus.pending}
            </h3>
            <p className="text-[10px] text-slate-400">
              Awaiting MT5 Terminal
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 text-blue-600 rounded-xl border border-slate-100 shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-50">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Exec: {systemStatus.executed}
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            • Fail: {systemStatus.failed}
          </span>
        </div>
      </motion.div>

      {/* CARD 5: Average Slippage & Health */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all flex flex-col justify-between min-h-[160px]"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display block">
              Execution Quality
            </span>
            <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {avgSlippage}
            </h3>
            <p className="text-[10px] text-slate-400">
              Avg signal-to-execution latency
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 shadow-sm">
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[9px] font-mono font-bold text-emerald-600">
            A-GRADE HEALTH
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            {stats.totalLots.toFixed(1)} Lot Vol
          </span>
        </div>
      </motion.div>

    </div>
  );
}
