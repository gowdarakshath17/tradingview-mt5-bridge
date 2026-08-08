import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Signal } from '../types';
import { getTradingStats } from '../utils/tradingStats';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  Legend,
  PieChart,
  Pie
} from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieIcon, Info, Layers } from 'lucide-react';

interface PerformanceChartsProps {
  signals: Signal[];
}

export default function PerformanceCharts({ signals }: PerformanceChartsProps) {
  const [activeChartTab, setActiveChartTab] = useState<'cumulative' | 'symbols' | 'wins'>('cumulative');
  const stats = useMemo(() => getTradingStats(signals), [signals]);

  // Transform symbol distribution for bar chart
  const symbolChartData = useMemo(() => {
    return (Object.entries(stats.symbolDistribution) as [string, { volume: number; count: number }][]).map(([symbol, data]) => ({
      name: symbol,
      Volume: Number(data.volume.toFixed(2)),
      Count: data.count
    }));
  }, [stats.symbolDistribution]);

  // Win/Loss data for PieChart
  const winLossData = useMemo(() => {
    return [
      { name: 'Wins', value: stats.winCount, color: '#10b981' },
      { name: 'Losses', value: stats.lossCount, color: '#f43f5e' }
    ];
  }, [stats.winCount, stats.lossCount]);

  // If there are no executed signals yet, show an elegant empty state with placeholders
  const hasData = stats.pnlHistory.length > 0;

  // Mock data for empty state preview
  const previewData = [
    { time: '09:00', cumulative: 0 },
    { time: '10:15', cumulative: 120 },
    { time: '11:30', cumulative: -40 },
    { time: '13:00', cumulative: 340 },
    { time: '14:45', cumulative: 220 },
    { time: '16:00', cumulative: 560 }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
      
      {/* Chart Headers and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Performance Analytics
          </h3>
          <p className="text-xs text-slate-400">
            Real-time interactive analytics calculated from simulated bridge signals
          </p>
        </div>

        {/* Chart Selector Tabs */}
        <div className="flex p-1 bg-slate-50 border border-slate-100 rounded-xl max-w-fit self-start sm:self-center">
          <button
            onClick={() => setActiveChartTab('cumulative')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeChartTab === 'cumulative' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            PnL Curve
          </button>
          <button
            onClick={() => setActiveChartTab('symbols')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeChartTab === 'symbols' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Asset Volume
          </button>
          <button
            onClick={() => setActiveChartTab('wins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeChartTab === 'wins' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            Win/Loss Ratio
          </button>
        </div>
      </div>

      {/* Main Charts Canvas Container */}
      <div className="h-[320px] w-full relative">
        <AnimatePresence mode="wait">
          {!hasData ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4"
            >
              <div className="absolute inset-0 opacity-10 filter blur-[2px] select-none pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={previewData}>
                    <Area type="monotone" dataKey="cumulative" stroke="#2563eb" fill="#3b82f6" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-3 bg-blue-50 text-[#2563eb] rounded-full border border-blue-100/50 z-10 shadow-sm animate-bounce">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-sm z-10">
                <h4 className="text-xs font-bold text-slate-900 font-display">Awaiting Simulated Executed Signals</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  No trades have executed yet today. Press <strong className="text-slate-700">Ctrl + B</strong> or <strong className="text-slate-700">Ctrl + S</strong> on your keyboard to instantly trigger a simulated trade and watch the interactive charts update in real-time!
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={activeChartTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              
              {/* TAB 1: CUMULATIVE PNL */}
              {activeChartTab === 'cumulative' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.pnlHistory}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} 
                      stroke="#cbd5e1"
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} 
                      stroke="#cbd5e1"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isWin = data.pnl >= 0;
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-sans text-white space-y-1.5 z-50">
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-semibold text-slate-300">{data.symbol} ({data.type})</span>
                                <span className="text-[10px] text-slate-400 font-mono">{data.time}</span>
                              </div>
                              <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-slate-800">
                                <span className="text-[11px] text-slate-400">Trade PnL:</span>
                                <span className={`font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isWin ? '+' : ''}${data.pnl.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline gap-2">
                                <span className="text-[11px] text-slate-400">Total Net Balance:</span>
                                <span className="font-mono font-bold text-blue-400">${data.cumulative}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPnL)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* TAB 2: ASSET VOLUME */}
              {activeChartTab === 'symbols' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={symbolChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      stroke="#cbd5e1"
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} 
                      stroke="#cbd5e1"
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Lots Traded', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#94a3b8' }, offset: 10 }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-sans text-white space-y-1 z-50">
                              <span className="font-bold text-slate-300 block">{data.name} Volume</span>
                              <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
                                <span className="text-[11px] text-slate-400">Total Lots:</span>
                                <span className="font-mono font-bold text-blue-400">{data.Volume} Lots</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-[11px] text-slate-400">Trade Signals:</span>
                                <span className="font-mono font-bold text-slate-300">{data.Count} executed</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Volume" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                      {symbolChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* TAB 3: WIN / LOSS DISTRIBUTION */}
              {activeChartTab === 'wins' && (
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-full">
                  <div className="w-[180px] h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={winLossData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {winLossData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0];
                              const total = stats.winCount + stats.lossCount;
                              const percentage = total > 0 ? ((data.value as number) / total * 100).toFixed(1) : '0';
                              return (
                                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs text-white">
                                  <span className="font-semibold" style={{ color: data.color }}>{data.name}: </span>
                                  <span className="font-mono font-bold">{data.value} trades ({percentage}%)</span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legends & Details */}
                  <div className="space-y-3 font-sans">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-display">
                      Ratio Breakdown
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 bg-emerald-500 rounded-md shadow-sm shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-900">Wins ({stats.winCount} trades)</span>
                          <span className="block text-[10px] text-slate-400 leading-none">Positive PnL on executed signals</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 bg-rose-500 rounded-md shadow-sm shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-slate-900">Losses ({stats.lossCount} trades)</span>
                          <span className="block text-[10px] text-slate-400 leading-none">Negative or breakeven executions</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400">
                      Total simulated win rate is currently {stats.winRate}%
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
