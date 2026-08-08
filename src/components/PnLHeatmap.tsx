import { useState, useMemo } from 'react';
import { Signal } from '../types';
import { Calendar, Layers, BarChart2, TrendingUp, HelpCircle, Info, Filter, Zap, DollarSign } from 'lucide-react';

interface PnLHeatmapProps {
  signals: Signal[];
}

type HeatmapMode = 'weeks' | 'sessions';
type DataSource = 'live' | 'simulated';

interface HeatmapCell {
  label: string;
  pnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
}

export default function PnLHeatmap({ signals }: PnLHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>('weeks');
  const [dataSource, setDataSource] = useState<DataSource>('simulated');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell & { rowName: string; colName: string } | null>(null);

  // Define days of week for trading (Monday to Friday)
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // Define Sessions
  const sessions = [
    { name: 'Asian / Tokyo', hours: '00:00 - 08:00 UTC', id: 'asian' },
    { name: 'London / European', hours: '08:00 - 16:00 UTC', id: 'london' },
    { name: 'New York / US', hours: '16:00 - 24:00 UTC', id: 'ny' }
  ];

  // Deterministically generate a beautiful mock dataset for Simulated mode
  // This ensures the dashboard is rich with metrics instantly
  const simulatedTrades = useMemo(() => {
    const trades: { day: string; week: number; session: string; pnl: number; isWin: boolean }[] = [];
    const seed = 42;
    let index = 0;

    const pseudoRandom = () => {
      const x = Math.sin(index++) * 10000;
      return x - Math.floor(x);
    };

    // Generate 12 weeks of data
    for (let w = 1; w <= 12; w++) {
      daysOfWeek.forEach((day, dIdx) => {
        sessions.forEach((session) => {
          // Determine probability of having a trade
          const hasTrade = pseudoRandom() > 0.35; // 65% chance of trade activity
          if (hasTrade) {
            // Monday & Friday NY have slightly lower winrate, Tuesday-Thursday NY have higher
            let winChance = 0.52;
            if (['Tuesday', 'Wednesday', 'Thursday'].includes(day)) {
              winChance = session.id === 'ny' ? 0.68 : 0.58;
            } else if (day === 'Friday' && session.id === 'ny') {
              winChance = 0.38; // standard weekend-close volatility squeeze
            }

            const isWin = pseudoRandom() < winChance;
            // Reward size is slightly larger on winning days
            const baseAmount = pseudoRandom() * 450 + 50;
            const pnl = isWin ? baseAmount * 1.5 : -baseAmount * 1.1;

            trades.push({
              day,
              week: w,
              session: session.id,
              pnl: Math.round(pnl),
              isWin
            });
          }
        });
      });
    }
    return trades;
  }, []);

  // Process live signals into P&L logs
  const liveTrades = useMemo(() => {
    return signals
      .filter(s => s.status === 'Executed')
      .map((s, idx) => {
        const date = new Date(s.timestamp);
        const dayIdx = date.getDay(); // 0 is Sunday, 6 is Saturday
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = dayNames[dayIdx] === 'Sunday' || dayNames[dayIdx] === 'Saturday' ? 'Friday' : dayNames[dayIdx]; // map weekends to Friday
        
        // Group into week 1-12 based on timestamp relative to oldest signal
        const hour = date.getUTCHours();
        let session = 'asian';
        if (hour >= 8 && hour < 16) session = 'london';
        else if (hour >= 16) session = 'ny';

        // Deterministic mock outcome for live executed signals so user can see immediate color mappings
        const pnlSeed = s.price + idx;
        const isWin = (pnlSeed % 10) < 6; // 60% winrate
        const lotFactor = s.lotSize || 0.1;
        const pnlAmount = isWin ? 1500 * lotFactor : -1000 * lotFactor;

        return {
          day,
          week: Math.min(12, Math.max(1, Math.ceil((idx + 1) / 3))), // distribute smoothly
          session,
          pnl: Math.round(pnlAmount),
          isWin
        };
      });
  }, [signals]);

  // Active dataset selection
  const activeDataset = dataSource === 'live' ? liveTrades : simulatedTrades;

  // 12 Weeks Chronological Grid calculation
  const weeksData = useMemo(() => {
    const grid: Record<string, Record<number, HeatmapCell>> = {};
    
    // Initialize empty grid
    daysOfWeek.forEach(day => {
      grid[day] = {};
      for (let w = 1; w <= 12; w++) {
        grid[day][w] = { label: `W${w}`, pnl: 0, tradesCount: 0, wins: 0, losses: 0 };
      }
    });

    // Populate grid
    activeDataset.forEach(trade => {
      if (grid[trade.day] && grid[trade.day][trade.week]) {
        const cell = grid[trade.day][trade.week];
        cell.pnl += trade.pnl;
        cell.tradesCount += 1;
        if (trade.isWin) cell.wins += 1;
        else cell.losses += 1;
      }
    });

    return grid;
  }, [activeDataset]);

  // Session Breakdown Grid calculation
  const sessionsData = useMemo(() => {
    const grid: Record<string, Record<string, HeatmapCell>> = {};

    // Initialize empty grid
    daysOfWeek.forEach(day => {
      grid[day] = {};
      sessions.forEach(s => {
        grid[day][s.id] = { label: s.name, pnl: 0, tradesCount: 0, wins: 0, losses: 0 };
      });
    });

    // Populate grid
    activeDataset.forEach(trade => {
      if (grid[trade.day] && grid[trade.day][trade.session]) {
        const cell = grid[trade.day][trade.session];
        cell.pnl += trade.pnl;
        cell.tradesCount += 1;
        if (trade.isWin) cell.wins += 1;
        else cell.losses += 1;
      }
    });

    return grid;
  }, [activeDataset]);

  // Compute stats summary
  const stats = useMemo(() => {
    let totalPnL = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalTrades = activeDataset.length;

    activeDataset.forEach(t => {
      totalPnL += t.pnl;
      if (t.isWin) totalWins++;
      else totalLosses++;
    });

    // Calculate Best & Worst slot
    let bestDay = 'N/A';
    let bestPnL = -Infinity;
    let worstDay = 'N/A';
    let worstPnL = Infinity;

    // Iterate day-by-day to aggregate standard performance
    daysOfWeek.forEach(day => {
      const dayTrades = activeDataset.filter(t => t.day === day);
      const dayPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
      if (dayTrades.length > 0) {
        if (dayPnL > bestPnL) {
          bestPnL = dayPnL;
          bestDay = day;
        }
        if (dayPnL < worstPnL) {
          worstPnL = dayPnL;
          worstDay = day;
        }
      }
    });

    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    return {
      totalPnL,
      winRate: Math.round(winRate),
      bestDay,
      bestPnL: bestPnL === -Infinity ? 0 : bestPnL,
      worstDay,
      worstPnL: worstPnL === Infinity ? 0 : worstPnL,
      consistency: Math.round(Math.max(10, Math.min(98, winRate * 1.2))) // standard prop score
    };
  }, [activeDataset]);

  // Helper to determine background class for P&L intensity
  const getIntensityClass = (pnl: number, count: number) => {
    if (count === 0) return 'bg-white hover:bg-slate-100 border-slate-200';
    if (pnl > 800) return 'bg-slate-50 hover:bg-slate-50 border-slate-200/40 shadow-sm text-emerald-100'; // High profit
    if (pnl > 0) return 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/30 text-emerald-200';  // Low profit
    if (pnl < -800) return 'bg-[#b91c1c] hover:bg-[#dc2626] border-slate-200/40 shadow-sm text-rose-100'; // High loss
    return 'bg-[#991b1b]/70 hover:bg-[#b91c1c] border-slate-200/30 text-rose-200'; // Low loss
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6">
      {/* Heatmap Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-700/10 text-blue-600 rounded-xl border border-blue-600/20">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-900 flex items-center gap-2 text-base">
              Prop P&L Consistency Heatmap
              <span className="text-[10px] uppercase font-mono font-bold bg-white text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Active Guardian
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Visualize day-of-week and session trading profit distribution</p>
          </div>
        </div>

        {/* Filters/Toggles */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Data Source Toggler */}
          <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setDataSource('simulated')}
              className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                dataSource === 'simulated'
                  ? 'bg-blue-700/20 text-blue-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              Simulated Data
            </button>
            <button
              onClick={() => setDataSource('live')}
              className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer flex items-center gap-1 ${
                dataSource === 'live'
                  ? 'bg-blue-700/20 text-blue-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${signals.filter(s => s.status === 'Executed').length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
              Live Queue ({signals.filter(s => s.status === 'Executed').length})
            </button>
          </div>

          {/* Mode Toggler */}
          <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setMode('weeks')}
              className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer flex items-center gap-1.5 ${
                mode === 'weeks'
                  ? 'bg-blue-600 text-slate-900 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              12-Week Grid
            </button>
            <button
              onClick={() => setMode('sessions')}
              className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer flex items-center gap-1.5 ${
                mode === 'sessions'
                  ? 'bg-blue-600 text-slate-900 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Sessions
            </button>
          </div>
        </div>
      </div>

      {/* Main Heatmap Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Heatmap Grid Layout */}
        <div className="lg:col-span-8 space-y-4">
          <div className="overflow-x-auto pb-2">
            {mode === 'weeks' ? (
              // Chronological Grid View
              <div className="min-w-[620px]">
                {/* Column Headers (Weeks 1 to 12) */}
                <div className="grid gap-1.5 mb-1.5 text-center font-mono text-[10px] text-slate-400 font-semibold" style={{ gridTemplateColumns: '85px repeat(12, minmax(0, 1fr))' }}>
                  <div className="text-left font-sans text-xs text-slate-400 font-medium">Trading Day</div>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>W{i + 1}</div>
                  ))}
                </div>

                {/* Grid Rows (Days of the Week) */}
                <div className="space-y-1.5">
                  {daysOfWeek.map(day => (
                    <div key={day} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '85px repeat(12, minmax(0, 1fr))' }}>
                      {/* Day Label */}
                      <div className="text-xs font-semibold text-slate-700 font-display truncate pr-2">
                        {day}
                      </div>

                      {/* Cells */}
                      {Array.from({ length: 12 }).map((_, wIdx) => {
                        const weekNum = wIdx + 1;
                        const cell = weeksData[day]?.[weekNum] || { pnl: 0, tradesCount: 0, wins: 0, losses: 0 };
                        const isHovered = hoveredCell?.rowName === day && hoveredCell?.colName === `W${weekNum}`;

                        return (
                          <div
                            key={wIdx}
                            onMouseEnter={() => setHoveredCell({ ...cell, rowName: day, colName: `W${weekNum}` })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`aspect-square rounded-lg border transition-all duration-150 flex flex-col items-center justify-center cursor-pointer relative ${getIntensityClass(
                              cell.pnl,
                              cell.tradesCount
                            )} ${isHovered ? 'ring-2 ring-blue-600 scale-105 z-10' : ''}`}
                          >
                            <span className="text-[9px] font-mono font-bold select-none opacity-80">
                              {cell.tradesCount > 0 ? (cell.pnl >= 0 ? '+' : '') + Math.round(cell.pnl / 100) : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Trading Session Grid View
              <div className="min-w-[480px]">
                {/* Column Headers (Sessions) */}
                <div className="grid grid-cols-4 gap-3 mb-2 text-center font-mono text-[10px] text-slate-400 font-semibold">
                  <div className="text-left font-sans text-xs text-slate-400 font-medium">Trading Day</div>
                  {sessions.map(s => (
                    <div key={s.id} className="flex flex-col items-center">
                      <span className="text-xs text-slate-800">{s.name}</span>
                      <span className="text-[9px] text-slate-400 font-normal">{s.hours}</span>
                    </div>
                  ))}
                </div>

                {/* Grid Rows (Days of the Week) */}
                <div className="space-y-2.5">
                  {daysOfWeek.map(day => (
                    <div key={day} className="grid grid-cols-4 gap-3 items-center">
                      {/* Day Label */}
                      <div className="text-xs font-semibold text-slate-700 font-display truncate pr-2">
                        {day}
                      </div>

                      {/* Cells */}
                      {sessions.map(session => {
                        const cell = sessionsData[day]?.[session.id] || { pnl: 0, tradesCount: 0, wins: 0, losses: 0 };
                        const isHovered = hoveredCell?.rowName === day && hoveredCell?.colName === session.id;

                        return (
                          <div
                            key={session.id}
                            onMouseEnter={() => setHoveredCell({ ...cell, rowName: day, colName: session.id })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`py-5 rounded-xl border transition-all duration-150 flex flex-col items-center justify-center cursor-pointer ${getIntensityClass(
                              cell.pnl,
                              cell.tradesCount
                            )} ${isHovered ? 'ring-2 ring-blue-600 scale-102 z-10 shadow-lg' : ''}`}
                          >
                            {cell.tradesCount > 0 ? (
                              <>
                                <span className="text-sm font-bold font-mono tracking-tight">
                                  {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-mono opacity-60 mt-0.5">
                                  {cell.tradesCount} trades • {Math.round((cell.wins / cell.tradesCount) * 100)}% WR
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-mono opacity-25">Flat</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Color Legend & Guide Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/60 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Loss</span>
              <div className="w-3.5 h-3.5 bg-[#b91c1c] rounded-md border border-slate-200/40"></div>
              <div className="w-3.5 h-3.5 bg-[#991b1b]/70 rounded-md border border-slate-200/30"></div>
              <div className="w-3.5 h-3.5 bg-white rounded-md border border-slate-200"></div>
              <div className="w-3.5 h-3.5 bg-slate-50/70 rounded-md border border-slate-200/30"></div>
              <div className="w-3.5 h-3.5 bg-slate-50 rounded-md border border-slate-200/40"></div>
              <span>Profit</span>
            </div>
            
            {mode === 'weeks' && (
              <span className="text-[11px] font-mono text-slate-400">
                *Values inside cells indicate net P&L intensity factor (e.g. +10 = +$1,000)
              </span>
            )}
          </div>
        </div>

        {/* Interactive Stats Sidebar & Tooltip Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Tooltip / Hover Inspector */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl relative min-h-[160px] flex flex-col justify-between">
            {hoveredCell ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 font-mono uppercase tracking-wider">
                    Cell Inspector
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {hoveredCell.rowName} • {mode === 'weeks' ? `Week ${hoveredCell.colName.substring(1)}` : sessions.find(s => s.id === hoveredCell.colName)?.name}
                  </span>
                </div>

                <div>
                  <span className="block text-2xl font-bold font-mono tracking-tight" style={{ color: hoveredCell.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
                    {hoveredCell.pnl >= 0 ? '+' : ''}${hoveredCell.pnl.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5 font-sans">Net P&L Return in slot</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="block text-xs font-semibold text-slate-900 font-mono">{hoveredCell.tradesCount}</span>
                    <span className="block text-[10px] text-slate-400">Total Trades</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-emerald-400 font-mono">
                      {hoveredCell.tradesCount > 0 ? Math.round((hoveredCell.wins / hoveredCell.tradesCount) * 100) : 0}%
                    </span>
                    <span className="block text-[10px] text-slate-400">Win Rate</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Info className="w-6 h-6 text-slate-600 mb-2" />
                <span className="block text-xs font-semibold text-slate-400">Interactive Inspector</span>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                  Hover or touch any block in the heatmap to inspect granular net P&L metrics, win rates, and order counts for that specific trading block.
                </p>
              </div>
            )}
          </div>

          {/* Aggregated Performance Insights */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-400">
              Consistency Insights
            </h4>

            {/* Performance KPI Cards */}
            <div className="space-y-3">
              <div className="p-3.5 bg-blue-50/10 border border-blue-50/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase font-mono font-bold text-blue-600 tracking-wider">
                    Best Trading Day
                  </span>
                  <span className="block text-sm font-semibold text-slate-900 mt-0.5">{stats.bestDay}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="block text-sm font-bold text-emerald-400">+${stats.bestPnL.toLocaleString()}</span>
                  <span className="block text-[9px] text-slate-400">Combined P&L</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-950/10 border border-rose-950/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase font-mono font-bold text-rose-400 tracking-wider">
                    Least Profitable
                  </span>
                  <span className="block text-sm font-semibold text-slate-900 mt-0.5">{stats.worstDay}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="block text-sm font-bold text-rose-400">${stats.worstPnL.toLocaleString()}</span>
                  <span className="block text-[9px] text-slate-400">Combined P&L</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-white/60 border border-slate-200 rounded-xl font-mono">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    Total Heat P&L
                  </span>
                  <span className={`block text-base font-bold mt-1 ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 bg-white/60 border border-slate-200 rounded-xl font-mono">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    Consistency
                  </span>
                  <span className="block text-base font-bold text-blue-600 mt-1">
                    {stats.consistency}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
