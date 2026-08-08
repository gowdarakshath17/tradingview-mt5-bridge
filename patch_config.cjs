const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const effectStr = `  // Synchronize when parent config changes
  useEffect(() => {`;
const newEffectStr = `  // Auto-enable Trailing Stop when Hold Till Counter is activated and a profit lock > 0 is selected
  useEffect(() => {
    if (holdTillCounterDirection && profitLockPercentage > 0) {
      setDynamicTrailingStop(true);
      
      // Usually Profit Lock happens at 1:1 risk/reward. To trail AFTER profit lock,
      // the trailing activation should be equal to the SL points distance.
      if (lotSizingMode !== 'DynamicStopLoss') {
        setTrailingActivationPoints(stopLossPoints);
      }
    }
  }, [holdTillCounterDirection, profitLockPercentage, lotSizingMode, stopLossPoints]);

  // Synchronize when parent config changes
  useEffect(() => {`;
content = content.replace(effectStr, newEffectStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
