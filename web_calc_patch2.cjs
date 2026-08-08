const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const slInputStr = `value={finalSlPoints}
                onChange={(e) => setSlPoints(Math.max(1, Number(e.target.value)))}`;
const newSlInputStr = `value={slPoints}
                onChange={(e) => setSlPoints(Math.max(1, Number(e.target.value)))}
                disabled={lotSizingMode === 'DynamicStopLoss'}`;
content = content.replace(slInputStr, newSlInputStr);

const tpInputStr = `value={finalTpPoints}
                onChange={(e) => setTpPoints(Math.max(1, Number(e.target.value)))}`;
const newTpInputStr = `value={tpPoints}
                onChange={(e) => setTpPoints(Math.max(1, Number(e.target.value)))}
                disabled={lotSizingMode === 'DynamicStopLoss'}`;
content = content.replace(tpInputStr, newTpInputStr);

fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
