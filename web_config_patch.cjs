const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const useStateStr = 'const [lotSizingMode, setLotSizingMode] = useState<"DynamicRisk" | "FixedLot">(config.lotSizingMode);';
const newUseStateStr = 'const [lotSizingMode, setLotSizingMode] = useState<"DynamicRisk" | "DynamicStopLoss" | "FixedLot">(config.lotSizingMode);';
content = content.replace(useStateStr, newUseStateStr);

const buttonsStr = `            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setLotSizingMode("DynamicRisk")}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  lotSizingMode === 'DynamicRisk'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Dynamic Risk Formula</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Calculates lot size based on account balance, risk % per trade, and SL points distance.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLotSizingMode("FixedLot")}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  lotSizingMode === 'FixedLot'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Fixed Volume</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Executes a static lot size every time a signal fires, ignoring risk distances.
                </span>
              </button>
            </div>`;

const newButtonsStr = `            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setLotSizingMode("DynamicRisk")}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  lotSizingMode === 'DynamicRisk'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Dynamic Lot</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Calculates lot size based on risk % and static SL points.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLotSizingMode("DynamicStopLoss")}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  lotSizingMode === 'DynamicStopLoss'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Dynamic SL/TP</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Calculates SL and TP based on risk %, fixed lot size and R:R ratio.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLotSizingMode("FixedLot")}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  lotSizingMode === 'FixedLot'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Fixed Volume</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Executes a static lot size every time, ignoring risk distances.
                </span>
              </button>
            </div>`;

content = content.replace(buttonsStr, newButtonsStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
