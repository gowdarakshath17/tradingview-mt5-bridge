const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const mainButtonsStr = `            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

const newMainButtonsStr = `            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setLotSizingMode(lotSizingMode === 'FixedLot' ? 'DynamicRisk' : lotSizingMode)}
                className={\`p-4 rounded-xl border text-left transition-all cursor-pointer \${
                  (lotSizingMode === 'DynamicRisk' || lotSizingMode === 'DynamicStopLoss')
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }\`}
              >
                <span className="block font-semibold text-sm">Dynamic Risk Formula</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Auto-calculates position parameters based on risk % and account balance.
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
                  Executes a static lot size every time, ignoring risk calculations.
                </span>
              </button>
            </div>`;
content = content.replace(mainButtonsStr, newMainButtonsStr);

const sizingParamsStr = `          {/* Sizing Parameters based on Mode */}
          {lotSizingMode === 'DynamicRisk' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                Risk Percentage per Trade
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                  required
                />
                <span className="absolute right-3 top-3.5 text-slate-400 font-mono text-xs">%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">1.0% - 2.0%</span>. Sizes lot automatically using MT5 account balance.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Fixed Lot Size (Volume)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={fixedLotSize}
                onChange={(e) => setFixedLotSize(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Executes exactly this lot volume (e.g. <span className="font-semibold text-slate-400">0.10 lots</span> is 10 ounces of Gold).
              </p>
            </div>
          )}

          {lotSizingMode === 'DynamicStopLoss' ? (`;

const newSizingParamsStr = `          {/* Sizing Parameters based on Mode */}
          {(lotSizingMode === 'DynamicRisk' || lotSizingMode === 'DynamicStopLoss') ? (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  Risk Percentage per Trade
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-3.5 text-slate-400 font-mono text-xs">%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Recommended: <span className="font-semibold text-slate-400">1.0% - 2.0%</span>. Sizes lot automatically using MT5 account balance.
                </p>
              </div>

              <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                  Dynamic Calculation Target
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLotSizingMode("DynamicRisk")}
                    className={\`py-2.5 px-3 rounded-lg border text-center transition-all cursor-pointer text-sm font-semibold \${
                      lotSizingMode === 'DynamicRisk'
                        ? 'border-blue-600 bg-white text-blue-600 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500 bg-transparent'
                    }\`}
                  >
                    Calculate Lot Size
                  </button>
                  <button
                    type="button"
                    onClick={() => setLotSizingMode("DynamicStopLoss")}
                    className={\`py-2.5 px-3 rounded-lg border text-center transition-all cursor-pointer text-sm font-semibold \${
                      lotSizingMode === 'DynamicStopLoss'
                        ? 'border-blue-600 bg-white text-blue-600 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500 bg-transparent'
                    }\`}
                  >
                    Calculate SL/TP
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed text-center">
                  {lotSizingMode === 'DynamicRisk' 
                    ? "Requires fixed Stop Loss points. Calculates the lot size based on risk %." 
                    : "Requires fixed Lot Size. Calculates Stop Loss and Take Profit based on risk %."}
                </p>
              </div>

              {lotSizingMode === 'DynamicStopLoss' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                    Fixed Lot Size (Volume)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fixedLotSize}
                    onChange={(e) => setFixedLotSize(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Executes exactly this lot volume.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Fixed Lot Size (Volume)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={fixedLotSize}
                onChange={(e) => setFixedLotSize(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Executes exactly this lot volume (e.g. <span className="font-semibold text-slate-400">0.10 lots</span> is 10 ounces of Gold).
              </p>
            </div>
          )}

          {lotSizingMode === 'DynamicStopLoss' ? (`;

content = content.replace(sizingParamsStr, newSizingParamsStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
