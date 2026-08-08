import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  decimals: number;
  lastDirection: 'up' | 'down' | 'flat';
}

const INITIAL_PAIRS: TickerItem[] = [
  { symbol: 'XAUUSD', price: 2341.50, change: 12.40, changePercent: 0.53, decimals: 2, lastDirection: 'flat' },
  { symbol: 'EURUSD', price: 1.08720, change: -0.00120, changePercent: -0.11, decimals: 5, lastDirection: 'flat' },
  { symbol: 'GBPUSD', price: 1.26850, change: 0.00340, changePercent: 0.27, decimals: 5, lastDirection: 'flat' },
  { symbol: 'USDJPY', price: 156.420, change: -0.180, changePercent: -0.11, decimals: 3, lastDirection: 'flat' },
  { symbol: 'AUDUSD', price: 0.66250, change: 0.00080, changePercent: 0.12, decimals: 5, lastDirection: 'flat' },
  { symbol: 'USDCAD', price: 1.36820, change: -0.00050, changePercent: -0.04, decimals: 5, lastDirection: 'flat' },
  { symbol: 'BTCUSD', price: 67240.00, change: 1420.00, changePercent: 2.16, decimals: 2, lastDirection: 'flat' },
  { symbol: 'ETHUSD', price: 3495.50, change: 85.20, changePercent: 2.50, decimals: 2, lastDirection: 'flat' },
  { symbol: 'US30', price: 39120.00, change: -110.00, changePercent: -0.28, decimals: 2, lastDirection: 'flat' },
];

export default function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>(INITIAL_PAIRS);
  const [activeTickIndex, setActiveTickIndex] = useState<number | null>(null);

  // Periodically update one random ticker to simulate market tick movements
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * items.length);
      
      setItems(prev => prev.map((item, idx) => {
        if (idx !== randomIndex) return item;

        const isUp = Math.random() > 0.45; // slightly upwards bias
        const tickSize = item.symbol === 'BTCUSD' 
          ? (Math.random() * 45 + 5) 
          : item.symbol === 'XAUUSD' 
          ? (Math.random() * 1.5 + 0.1)
          : item.symbol === 'USDJPY' || item.symbol === 'US30'
          ? (Math.random() * 0.25 + 0.01)
          : (Math.random() * 0.00025 + 0.00001);

        const changeDelta = isUp ? tickSize : -tickSize;
        const nextPrice = Math.max(0.00001, item.price + changeDelta);
        const nextChange = item.change + changeDelta;
        // recalculate percentage
        const referencePrice = item.price - item.change;
        const nextChangePercent = referencePrice !== 0 ? (nextChange / referencePrice) * 100 : 0;

        return {
          ...item,
          price: nextPrice,
          change: nextChange,
          changePercent: nextChangePercent,
          lastDirection: isUp ? 'up' : 'down'
        };
      }));

      // Highlight the active tick
      setActiveTickIndex(randomIndex);
      const timer = setTimeout(() => setActiveTickIndex(null), 800);
      return () => clearTimeout(timer);

    }, 1800);

    return () => clearInterval(interval);
  }, [items.length]);

  return (
    <div className="w-full bg-slate-900 border-y border-slate-800 py-2.5 overflow-hidden shadow-inner flex items-center select-none relative z-10">
      {/* Decorative pulse on left indicating real-time feed */}
      <div className="absolute left-0 top-0 bottom-0 px-3 bg-slate-950 flex items-center gap-1.5 border-r border-slate-800/80 z-20 shadow-lg">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">
          MT5.LIVE
        </span>
      </div>

      {/* Ticker tape row with duplicate items to achieve infinite scrolling */}
      <div className="flex whitespace-nowrap pl-24 animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] gap-12">
        {[...items, ...items, ...items].map((item, idx) => {
          const isUp = item.change >= 0;
          const isActive = activeTickIndex === (idx % items.length);

          return (
            <motion.div
              key={`${item.symbol}-${idx}`}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border transition-all duration-300 ${
                isActive
                  ? item.lastDirection === 'up'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 scale-[1.03] shadow-md shadow-emerald-500/5'
                    : 'bg-rose-500/10 border-rose-500/50 text-rose-400 scale-[1.03] shadow-md shadow-rose-500/5'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-xs font-bold font-sans tracking-wide text-white">
                {item.symbol}
              </span>
              <span className="text-xs font-mono font-medium">
                {item.price.toFixed(item.decimals)}
              </span>
              <span className={`flex items-center text-[10px] font-mono font-semibold ${
                isUp ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {isUp ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {isUp ? '+' : ''}
                {item.changePercent.toFixed(2)}%
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
