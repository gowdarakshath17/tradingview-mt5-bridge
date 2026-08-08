const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const inpStr = `input double   InpFixedLotSize   = \${config.fixedLotSize};          // Fixed lot size if dynamic risk disabled
input double   InpStopLossPoints = \${config.stopLossPoints};         // Stop Loss points (distance from entry, e.g. 10.0 for XAUUSD)`;
const newInpStr = `input double   InpFixedLotSize   = \${config.fixedLotSize};          // Fixed lot size if dynamic risk disabled
input double   InpContractSize   = \${config.contractSize || 100};    // Contract size
input double   InpStopLossPoints = \${config.stopLossPoints};         // Stop Loss points (distance from entry, e.g. 10.0 for XAUUSD)`;
content = content.replace(inpStr, newInpStr);

const eaCalcStr = `      // Get tick value & size for accurate dollar-risk conversion
      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(InpStopLossPoints > 0)
      {
         // Custom fixed mapping: 1 point movement = $1 price
         finalLotSize = riskAmount / InpStopLossPoints;`;
const newEaCalcStr = `      // Get tick value & size for accurate dollar-risk conversion
      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(InpStopLossPoints > 0 && InpContractSize > 0)
      {
         // Exact math mapping based on standard contract sizes
         finalLotSize = riskAmount / (InpStopLossPoints * InpContractSize);`;
content = content.replace(eaCalcStr, newEaCalcStr);

const dynamicSlEaStr = `   if (InpUseDynamicSL) {
      double riskAmount = balance * (InpRiskPercent / 100.0);
      dynamicSlPoints = riskAmount / InpFixedLotSize;`;
const newDynamicSlEaStr = `   if (InpUseDynamicSL) {
      double riskAmount = balance * (InpRiskPercent / 100.0);
      dynamicSlPoints = (InpFixedLotSize > 0 && InpContractSize > 0) ? (riskAmount / (InpFixedLotSize * InpContractSize)) : 10.0;`;
content = content.replace(dynamicSlEaStr, newDynamicSlEaStr);

fs.writeFileSync('server.ts', content, 'utf8');
