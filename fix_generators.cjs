const fs = require('fs');

let mql5 = fs.readFileSync('server/generators/mql5.ts', 'utf-8');
mql5 = mql5.replace('import { BridgeConfig } from "../src/types";', 'import { BridgeConfig } from "../../src/types";');
fs.writeFileSync('server/generators/mql5.ts', mql5, 'utf-8');

let python = fs.readFileSync('server/generators/python.ts', 'utf-8');
python = python.replace('import { BridgeConfig } from "../src/types";', 'import { BridgeConfig } from "../../src/types";');
fs.writeFileSync('server/generators/python.ts', python, 'utf-8');
