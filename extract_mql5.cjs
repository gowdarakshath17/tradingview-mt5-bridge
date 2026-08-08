const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf-8');
const match = content.match(/function generateMql5Code\(hostUrl: string, config: BridgeConfig\): string \{[\s\S]*?\n\}\n/);

if (match) {
  const fileContent = `import { BridgeConfig } from "../src/types";

export ` + match[0];
  fs.writeFileSync('server/generators/mql5.ts', fileContent, 'utf-8');
  console.log('mql5.ts created successfully.');
} else {
  console.log('generateMql5Code not found.');
}
