import { useState, useEffect, useRef } from 'react';
import { DollarSign, ShieldAlert, Percent, Settings, Scale, TrendingUp } from 'lucide-react';
import { BridgeConfig } from '../types';
import { User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface PositionCalculatorProps {
  config: BridgeConfig;
  user?: User | null;
}

export default function PositionCalculator({ config, user }: PositionCalculatorProps) {
  const [balance, setBalance] = useState<number>(10000);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  
  useEffect(() => {
    const fetchFundedBalance = async () => {
      if (!user) return;
      setIsFetchingBalance(true);
      try {
        const collRef = collection(db, `users/${user.uid}/funded_accounts`);
        const snapshot = await getDocs(collRef);
        if (!snapshot.empty) {
          // Find the first active or highest balance account
          const accounts = snapshot.docs.map(d => d.data());
          const activeAccounts = accounts.filter(a => a.status === 'Active');
          const targetAccount = activeAccounts.length > 0 ? activeAccounts[0] : accounts[0];
          
          if (targetAccount && targetAccount.currentBalance) {
            setBalance(targetAccount.currentBalance);
          } else if (targetAccount && targetAccount.accountSize) {
            setBalance(targetAccount.accountSize);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch funded accounts for calculator:", err);
      } finally {
        setIsFetchingBalance(false);
      }
    };
    
    fetchFundedBalance();
  }, [user]);
  const [riskPercent, setRiskPercent] = useState<number>(config.riskPercent);
  const [slPoints, setSlPoints] = useState<number>(config.stopLossPoints);
  const [tpPoints, setTpPoints] = useState<number>(config.takeProfitPoints);
  const [lotSizingMode, setLotSizingMode] = useState(config.lotSizingMode);
  const [fixedLotSize, setFixedLotSize] = useState(config.fixedLotSize);
  const [riskRewardRatio, setRiskRewardRatio] = useState(config.riskRewardRatio || 2.0);
  const [entryPrice, setEntryPrice] = useState<number>(4050.00);

  // Store reference to the last parent config we synchronized with
  const lastParentConfigRef = useRef<BridgeConfig>(config);

  // Synchronize when parent config changes
  useEffect(() => {
    const hasChanged = JSON.stringify(config) !== JSON.stringify(lastParentConfigRef.current);
    if (hasChanged) {
      setRiskPercent(config.riskPercent);
      setSlPoints(config.stopLossPoints);
      setTpPoints(config.takeProfitPoints);
      lastParentConfigRef.current = config;
    }
  }, [config]);

  // Calculations
  const riskAmount = balance * (riskPercent / 100);
  const contractSize = config.contractSize || 100;
  let finalLotSize = 0;
  let finalSlPoints = slPoints;
  let finalTpPoints = tpPoints;
  
  if (lotSizingMode === 'DynamicRisk') {
    finalLotSize = finalSlPoints > 0 ? Number((riskAmount / (slPoints * contractSize)).toFixed(2)) : 0;
    finalLotSize = Math.max(0.01, finalLotSize);
  } else if (lotSizingMode === 'DynamicStopLoss') {
    finalLotSize = fixedLotSize;
    finalSlPoints = finalLotSize > 0 ? riskAmount / (finalLotSize * contractSize) : 10;
    finalTpPoints = finalSlPoints * riskRewardRatio;
  } else {
    finalLotSize = fixedLotSize;
  }
  
  const slPriceBuy = entryPrice - finalSlPoints;
  const tpPriceBuy = entryPrice + finalTpPoints;
  
  const slPriceSell = entryPrice + finalSlPoints;
  const tpPriceSell = entryPrice - finalTpPoints;

  const potentialLoss = finalLotSize * finalSlPoints * contractSize;
  const potentialProfit = finalLotSize * finalTpPoints * contractSize;
  const rrr = finalSlPoints > 0 ? (finalTpPoints / finalSlPoints).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Settings Column */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-white text-[#2563eb] rounded-lg border border-slate-200">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-900">Dynamic Lot Size Calculator</h3>
            <p className="text-xs text-slate-400">Calculate exact position sizes based on capital risk</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Account Balance (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="10000"
              />
              {user && (
                <p className="text-[10px] text-blue-500 mt-1 font-medium flex items-center gap-1">
                  {isFetchingBalance ? (
                    <span className="animate-pulse">Loading from Funded Account...</span>
                  ) : (
                    "✓ Auto-loaded from Funded Account"
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Risk Percent */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
              <span>Risk Per Trade</span>
              <span className="text-blue-600 font-bold font-mono">{riskPercent}%</span>
            </label>
            <div className="relative flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="relative w-20 shrink-0">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full pr-6 pl-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600 text-slate-900"
                />
                <span className="absolute right-2 top-2 text-slate-400 text-xs">%</span>
              </div>
            </div>
          </div>

          {/* Stop Loss & Take Profit in Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Stop Loss (Points)
              </label>
              <input
                type="number"
                value={slPoints}
                onChange={(e) => setSlPoints(Math.max(1, Number(e.target.value)))}
                disabled={lotSizingMode === 'DynamicStopLoss'}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="10"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-mono">E.g. $10.00 Gold move</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Take Profit (Points)
              </label>
              <input
                type="number"
                value={tpPoints}
                onChange={(e) => setTpPoints(Math.max(1, Number(e.target.value)))}
                disabled={lotSizingMode === 'DynamicStopLoss'}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="20"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-mono">E.g. $20.00 Gold move</p>
            </div>
          </div>

          {/* Current Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Simulated Entry Price
              </label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="4050"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Output / Analysis Column */}
      <div className="lg:col-span-7 space-y-6">
        {/* Sizing Report */}
        <div className="bg-white text-slate-900 rounded-xl p-6 shadow-xl border border-slate-200">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 font-mono">
            Position Sizing Solution
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div className="p-4 bg-white/60 rounded-xl border border-slate-200">
              <span className="block text-[10px] text-slate-400 uppercase font-mono">Risk Budget</span>
              <span className="block text-xl font-bold font-mono text-emerald-400 mt-1">
                ${riskAmount.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">({riskPercent}% of balance)</span>
            </div>

            <div className="p-4 bg-white/60 rounded-xl border border-slate-200">
              <span className="block text-[10px] text-slate-400 uppercase font-mono">Calculated Lot</span>
              <span className="block text-xl font-bold font-mono text-blue-600 mt-1">
                {finalLotSize.toFixed(2)} Lots
              </span>
              <span className="text-[10px] text-slate-400 font-sans">
                {finalLotSize < 0.01 ? 'Adjusted to min lot' : 'Theoretical size'}
              </span>
            </div>

            <div className="col-span-2 md:col-span-1 p-4 bg-white/60 rounded-xl border border-slate-200">
              <span className="block text-[10px] text-slate-400 uppercase font-mono">Risk/Reward (R:R)</span>
              <span className="block text-xl font-bold font-mono text-blue-600 mt-1">
                1:{rrr}
              </span>
              <span className="text-[10px] text-slate-400">Targeting {finalTpPoints} pts profit</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Risk Per Lot (1.0 lot):</span>
              <span className="text-slate-900 font-mono">${(slPoints * contractSize).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Loss on SL ({finalLotSize.toFixed(2)} lots):</span>
              <span className="text-rose-400 font-semibold font-mono">-${potentialLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Profit on TP ({finalLotSize.toFixed(2)} lots):</span>
              <span className="text-emerald-400 font-semibold font-mono">+${potentialProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Visual Target Chart Map */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4 font-display">
            Visual Target Levels (XAUUSD BUY scenario)
          </h4>

          <div className="relative pl-6 py-2 border-l-2 border-dashed border-slate-200 space-y-6">
            {/* Take Profit Line */}
            <div className="relative">
              <div className="absolute -left-8.5 top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-slate-200 flex items-center justify-center shadow-xs"></div>
              <div className="flex items-center justify-between col-span-2">
                <div>
                  <span className="text-xs font-semibold text-emerald-400">TAKE PROFIT (TP)</span>
                  <p className="text-[10px] text-slate-400 font-mono">+{finalTpPoints} points exit</p>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold">
                  ${tpPriceBuy.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Entry Line */}
            <div className="relative">
              <div className="absolute -left-8.5 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-slate-200 flex items-center justify-center shadow-xs"></div>
              <div className="flex items-center justify-between col-span-2">
                <div>
                  <span className="text-xs font-semibold text-blue-600">MARKET ENTRY</span>
                  <p className="text-[10px] text-slate-400 font-mono">Immediate fill on signal</p>
                </div>
                <div className="bg-blue-50/20 border border-blue-100/50 text-blue-600 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold">
                  ${entryPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Stop Loss Line */}
            <div className="relative">
              <div className="absolute -left-8.5 top-1.5 w-4 h-4 rounded-full bg-rose-500 border-4 border-slate-200 flex items-center justify-center shadow-xs"></div>
              <div className="flex items-center justify-between col-span-2">
                <div>
                  <span className="text-xs font-semibold text-rose-400">STOP LOSS (SL)</span>
                  <p className="text-[10px] text-slate-400 font-mono">-{finalSlPoints} points exit</p>
                </div>
                <div className="bg-rose-950/20 border border-rose-900/50 text-rose-400 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold">
                  ${slPriceBuy.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-black/20 rounded-xl border border-slate-200 text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-400">Formula Note:</span> Assuming standard gold specs where a $1.00 move per 1.0 lot equals $1.00.
          </div>
        </div>
      </div>
    </div>
  );
}
