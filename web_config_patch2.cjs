const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const useStateStr = 'const [takeProfitPoints, setTakeProfitPoints] = useState(config.takeProfitPoints);';
const newUseStateStr = `const [takeProfitPoints, setTakeProfitPoints] = useState(config.takeProfitPoints);
  const [riskRewardRatio, setRiskRewardRatio] = useState(config.riskRewardRatio || 2.0);`;
content = content.replace(useStateStr, newUseStateStr);

const setConfigStr = 'setTakeProfitPoints(config.takeProfitPoints);';
const newSetConfigStr = `setTakeProfitPoints(config.takeProfitPoints);
      setRiskRewardRatio(config.riskRewardRatio || 2.0);`;
content = content.replace(setConfigStr, newSetConfigStr);

const updatedConfigStr = 'takeProfitPoints: Number(takeProfitPoints),';
const newUpdatedConfigStr = `takeProfitPoints: Number(takeProfitPoints),
      riskRewardRatio: Number(riskRewardRatio),`;
content = content.replace(updatedConfigStr, newUpdatedConfigStr);

const tpDivStr = `          {/* Take Profit (Points) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-blue-600" />
              Take Profit Points (TP)
            </label>
            <input
              type="number"
              min="1"
              value={takeProfitPoints}
              onChange={(e) => setTakeProfitPoints(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Recommended: <span className="font-semibold text-slate-400">20.0</span>. Represents a 2:1 risk-to-reward ratio for a 10-point Stop Loss.
            </p>
          </div>`;
          
const newTpDivStr = `          {lotSizingMode === 'DynamicStopLoss' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Risk:Reward Ratio
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={riskRewardRatio}
                onChange={(e) => setRiskRewardRatio(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">2.0</span>. Multiplies the dynamically calculated SL by this ratio to set the TP distance.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Take Profit Points (TP)
              </label>
              <input
                type="number"
                min="1"
                value={takeProfitPoints}
                onChange={(e) => setTakeProfitPoints(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">20.0</span>. Represents a 2:1 risk-to-reward ratio for a 10-point Stop Loss.
              </p>
            </div>
          )}`;
content = content.replace(tpDivStr, newTpDivStr);

fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
