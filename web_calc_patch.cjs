const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const useStatesStr = `  const [balance, setBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(config.riskPercent);
  const [slPoints, setSlPoints] = useState<number>(config.stopLossPoints);
  const [tpPoints, setTpPoints] = useState<number>(config.takeProfitPoints);`;
const newUseStatesStr = `  const [balance, setBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(config.riskPercent);
  const [slPoints, setSlPoints] = useState<number>(config.stopLossPoints);
  const [tpPoints, setTpPoints] = useState<number>(config.takeProfitPoints);
  const [lotSizingMode, setLotSizingMode] = useState(config.lotSizingMode);
  const [fixedLotSize, setFixedLotSize] = useState(config.fixedLotSize);
  const [riskRewardRatio, setRiskRewardRatio] = useState(config.riskRewardRatio || 2.0);`;
content = content.replace(useStatesStr, newUseStatesStr);

const syncStr = `    if (hasChanged) {
      setRiskPercent(config.riskPercent);
      setSlPoints(config.stopLossPoints);
      setTpPoints(config.takeProfitPoints);
    }`;
const newSyncStr = `    if (hasChanged) {
      setRiskPercent(config.riskPercent);
      setSlPoints(config.stopLossPoints);
      setTpPoints(config.takeProfitPoints);
      setLotSizingMode(config.lotSizingMode);
      setFixedLotSize(config.fixedLotSize);
      setRiskRewardRatio(config.riskRewardRatio || 2.0);
    }`;
content = content.replace(syncStr, newSyncStr);

const calcsStr = `  const slPriceBuy = entryPrice - slPoints;
  const tpPriceBuy = entryPrice + tpPoints;
  
  const slPriceSell = entryPrice + slPoints;
  const tpPriceSell = entryPrice - tpPoints;

  // Formula: Lot Size = Risk Amount / SL Points (assuming 1 pt move = $1 per 1.0 lot)
  const lotSize = slPoints > 0
    ? Number((riskAmount / slPoints).toFixed(2)) 
    : 0;

  // Clamped and rounded
  const finalLotSize = Math.max(0.01, lotSize);
  const potentialLoss = finalLotSize * slPoints;
  const potentialProfit = finalLotSize * tpPoints;
  const rrr = slPoints > 0 ? (tpPoints / slPoints).toFixed(1) : '0.0';`;

const newCalcsStr = `  let finalLotSize = 0;
  let finalSlPoints = slPoints;
  let finalTpPoints = tpPoints;
  
  if (lotSizingMode === 'DynamicRisk') {
    finalLotSize = slPoints > 0 ? Number((riskAmount / slPoints).toFixed(2)) : 0;
    finalLotSize = Math.max(0.01, finalLotSize);
  } else if (lotSizingMode === 'DynamicStopLoss') {
    finalLotSize = fixedLotSize;
    finalSlPoints = finalLotSize > 0 ? riskAmount / finalLotSize : 10;
    finalTpPoints = finalSlPoints * riskRewardRatio;
  } else {
    finalLotSize = fixedLotSize;
  }
  
  const slPriceBuy = entryPrice - finalSlPoints;
  const tpPriceBuy = entryPrice + finalTpPoints;
  
  const slPriceSell = entryPrice + finalSlPoints;
  const tpPriceSell = entryPrice - finalTpPoints;

  const potentialLoss = finalLotSize * finalSlPoints;
  const potentialProfit = finalLotSize * finalTpPoints;
  const rrr = finalSlPoints > 0 ? (finalTpPoints / finalSlPoints).toFixed(1) : '0.0';`;
content = content.replace(calcsStr, newCalcsStr);

// Now handle JSX references to slPoints, tpPoints, lotSize... wait, lotSize var was used.
content = content.replace(/\{slPoints\}/g, '{finalSlPoints}');
content = content.replace(/slPoints \>/g, 'finalSlPoints >');
content = content.replace(/\{tpPoints\}/g, '{finalTpPoints}');
content = content.replace(/lotSize \</g, 'finalLotSize <');

fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
