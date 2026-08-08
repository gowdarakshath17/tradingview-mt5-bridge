const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const inputStr = `              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="10000"
              />`;
const newInputStr = `              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="10000"
              />
              {user && (
                <p className="text-[10px] text-blue-500 mt-1 font-medium flex items-center gap-1">
                  {isFetchingBalance ? (
                    <span className="animate-pulse">Loading from Funded Account...</span>
                  ) : (
                    "✓ Auto-loaded from Funded Account"
                  )}
                </p>
              )}`;
content = content.replace(inputStr, newInputStr);
fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
