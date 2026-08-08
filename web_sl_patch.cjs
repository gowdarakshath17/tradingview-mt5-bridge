const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldSlCalcStr = `    const directionMultiplier = sigType === "BUY" ? 1 : -1;
    let sl = !isNaN(slFromReq) ? slFromReq : sigPrice - (activeConfig.stopLossPoints * directionMultiplier);
    let tp = !isNaN(tpFromReq) ? tpFromReq : sigPrice + (activeConfig.takeProfitPoints * directionMultiplier);

    // If SL was provided in the payload, override the stopLossPoints constraint dynamically
    if (!isNaN(slFromReq)) {
       activeConfig.stopLossPoints = Math.abs(sigPrice - sl);
    }`;

const newSlCalcStr = `    const directionMultiplier = sigType === "BUY" ? 1 : -1;
    
    let dynamicSlPts = activeConfig.stopLossPoints;
    let dynamicTpPts = activeConfig.takeProfitPoints;
    const mockBalance = 10000;
    
    if (activeConfig.lotSizingMode === 'DynamicStopLoss') {
        const riskAmount = mockBalance * (activeConfig.riskPercent / 100);
        dynamicSlPts = riskAmount / activeConfig.fixedLotSize;
        dynamicTpPts = dynamicSlPts * (activeConfig.riskRewardRatio || 2.0);
    }
    
    let sl = !isNaN(slFromReq) ? slFromReq : sigPrice - (dynamicSlPts * directionMultiplier);
    let tp = !isNaN(tpFromReq) ? tpFromReq : sigPrice + (dynamicTpPts * directionMultiplier);

    // If SL was provided in the payload, override the stopLossPoints constraint dynamically
    if (!isNaN(slFromReq)) {
       activeConfig.stopLossPoints = Math.abs(sigPrice - sl);
    }`;

content = content.replace(oldSlCalcStr, newSlCalcStr);
fs.writeFileSync('server.ts', content, 'utf8');
