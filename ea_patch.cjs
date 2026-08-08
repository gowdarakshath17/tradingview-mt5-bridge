const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Add inputs
const inputsStr = `input group "=== Risk Management ==="
input bool     InpUseDynamicRisk = \${config.lotSizingMode === 'DynamicRisk' ? 'true' : 'false'}; // Calculate lot based on balance risk
input double   InpRiskPercent    = \${config.riskPercent};          // Account Balance Risk % per trade`;

const newInputsStr = `input group "=== Risk Management ==="
input bool     InpUseDynamicRisk = \${config.lotSizingMode === 'DynamicRisk' ? 'true' : 'false'}; // Calculate lot based on balance risk
input bool     InpUseDynamicSL   = \${config.lotSizingMode === 'DynamicStopLoss' ? 'true' : 'false'}; // Calculate SL based on balance risk
input double   InpRiskRewardRatio= \${config.riskRewardRatio || 2.0}; // Risk:Reward ratio for Dynamic SL mode
input double   InpRiskPercent    = \${config.riskPercent};          // Account Balance Risk % per trade`;

content = content.replace(inputsStr, newInputsStr);

// In Python
const pyInputsStr = `RISK_PERCENT = \${config.riskPercent}
USE_DYNAMIC_RISK = \${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}`;

const newPyInputsStr = `RISK_PERCENT = \${config.riskPercent}
USE_DYNAMIC_RISK = \${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}
USE_DYNAMIC_SL = \${config.lotSizingMode === 'DynamicStopLoss' ? 'True' : 'False'}
RR_RATIO = \${config.riskRewardRatio || 2.0}`;
content = content.replace(pyInputsStr, newPyInputsStr);

fs.writeFileSync('server.ts', content, 'utf8');
