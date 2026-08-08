import { Signal } from '../types';

/**
 * Deterministically calculates a simulated PnL outcome for an executed signal
 * to make the dashboard feel active and supply real data to the charts.
 */
export function calculateSignalPnL(sig: Signal, index: number): number {
  if (sig.status !== 'Executed') return 0;
  
  // Use a hash of the ID combined with the price and index to make it fully deterministic
  const charSum = sig.id ? sig.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const pnlSeed = Math.floor(sig.price) + index + charSum;
  
  // 62% win rate
  const isWin = (pnlSeed % 100) < 62; 
  const lotFactor = sig.lotSize || 0.1;
  
  // Gold pricing or other pairs
  const multiplier = sig.symbol.includes('JPY') ? 0.1 : 10;
  const baseAmount = ((pnlSeed % 80) + 20) * lotFactor * multiplier;
  
  const tradePnl = isWin ? baseAmount * 1.4 : -baseAmount * 1.05;
  return Number(tradePnl.toFixed(2));
}

export interface TradingStats {
  dailyPnL: number;
  cumulativePnL: number;
  winRate: number;
  totalLots: number;
  winCount: number;
  lossCount: number;
  pnlHistory: {
    id: string;
    time: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    pnl: number;
    cumulative: number;
  }[];
  symbolDistribution: { [symbol: string]: { volume: number; count: number } };
}

export function getTradingStats(signals: Signal[]): TradingStats {
  const executedSignals = [...signals]
    .filter(s => s.status === 'Executed')
    // Sort oldest first to calculate correct running cumulative PnL
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dailyPnL = 0;
  let cumulativePnL = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalLots = 0;
  
  const pnlHistory: TradingStats['pnlHistory'] = [];
  const symbolDistribution: TradingStats['symbolDistribution'] = {};

  executedSignals.forEach((sig, index) => {
    const tradePnl = calculateSignalPnL(sig, index);
    cumulativePnL += tradePnl;
    totalLots += sig.lotSize || 0.1;

    if (tradePnl > 0) {
      winCount++;
    } else if (tradePnl < 0) {
      lossCount++;
    }

    // Check if executed today
    const sigDate = new Date(sig.timestamp);
    if (sigDate.getTime() >= today.getTime()) {
      dailyPnL += tradePnl;
    }

    // Symbol distribution
    if (!symbolDistribution[sig.symbol]) {
      symbolDistribution[sig.symbol] = { volume: 0, count: 0 };
    }
    symbolDistribution[sig.symbol].volume += sig.lotSize || 0.1;
    symbolDistribution[sig.symbol].count += 1;

    // Time representation
    const timeStr = sigDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    pnlHistory.push({
      id: sig.id,
      time: timeStr,
      symbol: sig.symbol,
      type: sig.type,
      pnl: tradePnl,
      cumulative: Number(cumulativePnL.toFixed(2))
    });
  });

  const totalExecuted = winCount + lossCount;
  const winRate = totalExecuted > 0 ? (winCount / totalExecuted) * 100 : 0;

  return {
    dailyPnL: Number(dailyPnL.toFixed(2)),
    cumulativePnL: Number(cumulativePnL.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    totalLots: Number(totalLots.toFixed(2)),
    winCount,
    lossCount,
    pnlHistory,
    symbolDistribution
  };
}
