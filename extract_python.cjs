const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf-8');
const match = content.match(/function generatePythonCode\(hostUrl: string, config: BridgeConfig\): string \{[\s\S]*?\n\}\n/);

if (match) {
  const fileContent = `import { BridgeConfig } from "../src/types";

export ` + match[0];
  fs.writeFileSync('server/generators/python.ts', fileContent, 'utf-8');
  console.log('python.ts created successfully.');
} else {
  console.log('generatePythonCode not found.');
}
