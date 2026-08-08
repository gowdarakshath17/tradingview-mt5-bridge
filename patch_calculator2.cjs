const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const str1 = `              <span className="text-slate-900 font-mono">\${(slPoints).toLocaleString()}</span>`;
const str2 = `              <span className="text-slate-900 font-mono">\${(slPoints * contractSize).toLocaleString()}</span>`;

content = content.replace(str1, str2);
fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
