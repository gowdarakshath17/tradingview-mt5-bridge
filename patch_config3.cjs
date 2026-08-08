const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const inputStr = `                <input
                  type="checkbox"
                  checked={dynamicTrailingStop}
                  onChange={(e) => setDynamicTrailingStop(e.target.checked)}
                  className="sr-only peer"
                />`;
const newInputStr = `                <input
                  type="checkbox"
                  checked={dynamicTrailingStop || (holdTillCounterDirection && profitLockPercentage > 0)}
                  onChange={(e) => setDynamicTrailingStop(e.target.checked)}
                  disabled={holdTillCounterDirection && profitLockPercentage > 0}
                  className="sr-only peer"
                />`;
content = content.replace(inputStr, newInputStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
