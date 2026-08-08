const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const calcStr = `  // Calculations
  const riskAmount = balance * (riskPercent / 100);
  let finalLotSize = 0;
  let finalSlPoints = slPoints;
  let finalTpPoints = tpPoints;
  
  if (lotSizingMode === 'DynamicRisk') {
    finalLotSize = finalSlPoints > 0 ? Number((riskAmount / slPoints).toFixed(2)) : 0;
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
  const potentialProfit = finalLotSize * finalTpPoints;`;

const newCalcStr = `  // Calculations
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
  const potentialProfit = finalLotSize * finalTpPoints * contractSize;`;

content = content.replace(calcStr, newCalcStr);
fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
