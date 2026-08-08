const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const webhookExtractStr = 'const sigPrice = Number(price || req.body.close || req.body.open || 0);';
const newWebhookExtractStr = `const sigPrice = Number(price || req.body.close || req.body.open || 0);
    const slFromReq = Number(req.body.sl);
    const tpFromReq = Number(req.body.tp);`;
content = content.replace(webhookExtractStr, newWebhookExtractStr);

const slTpCalcStr = `    const directionMultiplier = sigType === "BUY" ? 1 : -1;
    const sl = sigPrice - (activeConfig.stopLossPoints * directionMultiplier);
    const tp = sigPrice + (activeConfig.takeProfitPoints * directionMultiplier);`;
const newSlTpCalcStr = `    const directionMultiplier = sigType === "BUY" ? 1 : -1;
    let sl = !isNaN(slFromReq) ? slFromReq : sigPrice - (activeConfig.stopLossPoints * directionMultiplier);
    let tp = !isNaN(tpFromReq) ? tpFromReq : sigPrice + (activeConfig.takeProfitPoints * directionMultiplier);

    // If SL was provided in the payload, override the stopLossPoints constraint dynamically
    if (!isNaN(slFromReq)) {
       activeConfig.stopLossPoints = Math.abs(sigPrice - sl);
    }`;
content = content.replace(slTpCalcStr, newSlTpCalcStr);

fs.writeFileSync('server.ts', content, 'utf8');
