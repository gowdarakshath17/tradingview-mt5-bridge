const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace both functions with empty strings
content = content.replace(/function generateMql5Code\(hostUrl: string, config: BridgeConfig\): string \{[\s\S]*?\n\}\n/, '');
content = content.replace(/function generatePythonCode\(hostUrl: string, config: BridgeConfig\): string \{[\s\S]*?\n\}\n/, '');

// Add imports at the top
const importStr = `import { generateMql5Code } from "./server/generators/mql5";
import { generatePythonCode } from "./server/generators/python";`;
content = content.replace('import express from "express";', `import express from "express";\n${importStr}`);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log('server.ts patched successfully.');
