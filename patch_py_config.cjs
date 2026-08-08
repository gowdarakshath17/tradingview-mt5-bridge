const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const riskConfigStr = `# Risk configuration
USE_DYNAMIC_RISK = \${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}
RISK_PERCENT = \${config.riskPercent}          # Account Balance Risk % per trade
FIXED_LOT_SIZE = \${config.fixedLotSize}        # Fixed lot size if dynamic risk disabled
STOP_LOSS_POINTS = \${config.stopLossPoints}      # Stop Loss points (e.g. 10.0 gold price distance)
TAKE_PROFIT_POINTS = \${config.takeProfitPoints}    # Take Profit points (e.g. 20.0 gold price distance)`;

const newRiskConfigStr = `# Risk configuration
CONTRACT_SIZE = \${config.contractSize || 100}
USE_DYNAMIC_RISK = \${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}
USE_DYNAMIC_SL = \${config.lotSizingMode === 'DynamicStopLoss' ? 'True' : 'False'}
RR_RATIO = \${config.riskRewardRatio || 2.0}
RISK_PERCENT = \${config.riskPercent}          # Account Balance Risk % per trade
FIXED_LOT_SIZE = \${config.fixedLotSize}        # Fixed lot size if dynamic risk disabled
STOP_LOSS_POINTS = \${config.stopLossPoints}      # Stop Loss points (e.g. 10.0 gold price distance)
TAKE_PROFIT_POINTS = \${config.takeProfitPoints}    # Take Profit points (e.g. 20.0 gold price distance)`;

content = content.replace(riskConfigStr, newRiskConfigStr);
fs.writeFileSync('server.ts', content, 'utf8');
