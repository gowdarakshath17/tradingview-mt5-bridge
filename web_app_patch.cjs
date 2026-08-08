const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const calcStr = `    const directionMultiplier = type === "BUY" ? 1 : -1;
    const sl = price - (config.stopLossPoints * directionMultiplier);
    const tp = price + (config.takeProfitPoints * directionMultiplier);

    const mockBalance = 10000;
    let estimatedLot = config.fixedLotSize;
    if (config.lotSizingMode === "DynamicRisk") {
      const riskAmount = mockBalance * (config.riskPercent / 100);
      const riskPerLot = config.stopLossPoints;
      estimatedLot = Number((riskAmount / riskPerLot).toFixed(2));
      if (estimatedLot < 0.01) estimatedLot = 0.01;
    }`;
const newCalcStr = `    const directionMultiplier = type === "BUY" ? 1 : -1;
    
    let dynamicSlPts = config.stopLossPoints;
    let dynamicTpPts = config.takeProfitPoints;
    const mockBalance = 10000;
    let estimatedLot = config.fixedLotSize;
    
    if (config.lotSizingMode === 'DynamicStopLoss') {
        const riskAmount = mockBalance * (config.riskPercent / 100);
        dynamicSlPts = riskAmount / config.fixedLotSize;
        dynamicTpPts = dynamicSlPts * (config.riskRewardRatio || 2.0);
    } else if (config.lotSizingMode === 'DynamicRisk') {
        const riskAmount = mockBalance * (config.riskPercent / 100);
        estimatedLot = Number((riskAmount / config.stopLossPoints).toFixed(2));
        if (estimatedLot < 0.01) estimatedLot = 0.01;
    }
    
    const sl = price - (dynamicSlPts * directionMultiplier);
    const tp = price + (dynamicTpPts * directionMultiplier);`;
content = content.replace(calcStr, newCalcStr);

fs.writeFileSync('src/App.tsx', content, 'utf8');
