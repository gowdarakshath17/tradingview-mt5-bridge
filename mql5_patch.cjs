const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Update ExecuteTradeOnMT5 signature
content = content.replace('void ExecuteTradeOnMT5(string signalId, string type, string symbol)', 'void ExecuteTradeOnMT5(string signalId, string type, string symbol, double signalSL, double signalTP)');

// Update ExecuteTradeOnMT5 call
content = content.replace('ExecuteTradeOnMT5(signalId, signalType, _Symbol);', 'ExecuteTradeOnMT5(signalId, signalType, _Symbol, signalSL, signalTP);');

// Add SL and TP parsing before Print
const printStr = '   Print("TV_Bridge_EA: RECEIVED NEW SIGNAL! ID: ", signalId, ", Type: ", signalType, ", Symbol: ", signalSymbol, ", Price: ", signalPrice);';
const parseSlTpStr = `
   // Parse SL
   double signalSL = 0;
   int slPos = StringFind(jsonResponse, "\\"sl\\":", 0);
   if(slPos >= 0) {
      int slEndPos = StringFind(jsonResponse, ",", slPos);
      if(slEndPos < 0) slEndPos = StringFind(jsonResponse, "}", slPos);
      string slStr = StringSubstr(jsonResponse, slPos + 5, slEndPos - (slPos + 5));
      signalSL = StringToDouble(slStr);
   }

   // Parse TP
   double signalTP = 0;
   int tpPos = StringFind(jsonResponse, "\\"tp\\":", 0);
   if(tpPos >= 0) {
      int tpEndPos = StringFind(jsonResponse, ",", tpPos);
      if(tpEndPos < 0) tpEndPos = StringFind(jsonResponse, "}", tpPos);
      string tpStr = StringSubstr(jsonResponse, tpPos + 5, tpEndPos - (tpPos + 5));
      signalTP = StringToDouble(tpStr);
   }

   Print("TV_Bridge_EA: RECEIVED NEW SIGNAL! ID: ", signalId, ", Type: ", signalType, ", Symbol: ", signalSymbol, ", Price: ", signalPrice, ", SL: ", signalSL, ", TP: ", signalTP);
`;
content = content.replace(printStr, parseSlTpStr);

// Update ExecuteTradeOnMT5 to use signalSL and signalTP instead of InpStopLossPoints and InpTakeProfitPts
content = content.replace('slPrice = entryPrice - (InpStopLossPoints);', 'slPrice = signalSL > 0 ? signalSL : entryPrice - (InpStopLossPoints);');
content = content.replace('tpPrice = entryPrice + (InpTakeProfitPts);', 'tpPrice = signalTP > 0 ? signalTP : entryPrice + (InpTakeProfitPts);');
content = content.replace('slPrice = entryPrice + (InpStopLossPoints);', 'slPrice = signalSL > 0 ? signalSL : entryPrice + (InpStopLossPoints);');
content = content.replace('tpPrice = entryPrice - (InpTakeProfitPts);', 'tpPrice = signalTP > 0 ? signalTP : entryPrice - (InpTakeProfitPts);');

fs.writeFileSync('server.ts', content, 'utf8');
