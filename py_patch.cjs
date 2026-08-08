const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldExecuteStr = 'def execute_trade(signal_id, signal_type):';
const newExecuteStr = 'def execute_trade(signal_id, signal_type, signal_sl=None, signal_tp=None):';
content = content.replace(oldExecuteStr, newExecuteStr);

const oldCallStr = 'execute_trade(signal_id, signal_type)';
const newCallStr = 'execute_trade(signal_id, signal_type, signal.get("sl"), signal.get("tp"))';
content = content.replace(oldCallStr, newCallStr);

// Now in python execute_trade, use signal_sl and signal_tp if present
content = content.replace('sl = price - STOP_LOSS_POINTS', 'sl = signal_sl if signal_sl else price - STOP_LOSS_POINTS');
content = content.replace('tp = price + TAKE_PROFIT_POINTS', 'tp = signal_tp if signal_tp else price + TAKE_PROFIT_POINTS');
content = content.replace('sl = price + STOP_LOSS_POINTS', 'sl = signal_sl if signal_sl else price + STOP_LOSS_POINTS');
content = content.replace('tp = price - TAKE_PROFIT_POINTS', 'tp = signal_tp if signal_tp else price - TAKE_PROFIT_POINTS');

fs.writeFileSync('server.ts', content, 'utf8');
