const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const trailingStr = `                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Activate automatic trailing protection which secures realized gains by rolling the stop-loss behind price advances.
                </span>`;
const newTrailingStr = `                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Activate automatic trailing protection which secures realized gains by rolling the stop-loss behind price advances.
                  {(holdTillCounterDirection && profitLockPercentage > 0) && (
                    <span className="block mt-1 text-blue-600 font-semibold">
                      Auto-activated: Tied to {profitLockPercentage}% Profit Lock volume target.
                    </span>
                  )}
                </span>`;
content = content.replace(trailingStr, newTrailingStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
