const fs = require('fs');
let content = fs.readFileSync('src/components/ConfigPanel.tsx', 'utf8');

const updatedConfigStr = `    const updatedConfig: BridgeConfig = {
      passphrase,`;
const newUpdatedConfigStr = `    const updatedConfig: BridgeConfig = {
      passphrase,
      contractSize: config.contractSize || 100,`;
content = content.replace(updatedConfigStr, newUpdatedConfigStr);
fs.writeFileSync('src/components/ConfigPanel.tsx', content, 'utf8');
