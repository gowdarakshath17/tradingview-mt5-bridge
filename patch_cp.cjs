const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

content = content.replace('const [fixedLotSize, setFixedLotSize] = useState(config.fixedLotSize);', 
  'const [fixedLotSize, setFixedLotSize] = useState(config.fixedLotSize);\n  const [contractSize, setContractSize] = useState(config.contractSize || 100);');

content = content.replace('contractSize: config.contractSize || 100,', 'contractSize: Number(contractSize),');

const htmlInput = `            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Contract Size
              </label>
              <input
                type="number"
                value={contractSize}
                onChange={(e) => setContractSize(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
              <p className="text-[10px] text-slate-400 mt-1">Standard lot size (e.g., 100 for XAUUSD)</p>
            </div>
            `;
            
content = content.replace('{/* Fixed Lot Size */}', htmlInput + '\n            {/* Fixed Lot Size */}');

fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
