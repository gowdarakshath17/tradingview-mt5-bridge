const fs = require('fs');

const code = `import { BridgeConfig } from "../src/types";

export function generateMql5Code(hostUrl: string, config: BridgeConfig): string {
  return \`//+------------------------------------------------------------------+
//|                                                 TV_Bridge_EA.mq5 |
//|                                  TradingView to MT5 Automated EA |
//+------------------------------------------------------------------+
#property copyright "TradingView to MT5 Bridge"
#property link      "\${hostUrl}"
#property version   "1.00"
#property strict

#include <Trade\\\\Trade.mqh>
CTrade trade;

input string   InpServerURL      = "\${hostUrl}";
input string   InpPassphrase     = "\${config.passphrase}";
input int      InpPollInterval   = 2;
input bool     InpUseDynamicRisk = \${config.lotSizingMode === 'DynamicRisk' ? 'true' : 'false'};
input bool     InpUseDynamicSL   = \${config.lotSizingMode === 'DynamicStopLoss' ? 'true' : 'false'};
input double   InpRiskRewardRatio= \${config.riskRewardRatio || 2.0};
input double   InpRiskPercent    = \${config.riskPercent};
input double   InpFixedLotSize   = \${config.fixedLotSize};
input double   InpContractSize   = \${config.contractSize || 100};
input double   InpStopLossPoints = \${config.stopLossPoints};
input double   InpTakeProfitPts  = \${config.takeProfitPoints};
input int      InpMagicNumber    = 881122;

string gLastSignalId = "";

int OnInit() {
   EventSetTimer(InpPollInterval);
   trade.SetExpertMagicNumber(InpMagicNumber);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
}

void OnTimer() {
   string url = InpServerURL + "/api/signals?status=Pending&passphrase=" + InpPassphrase;
   char post[], result[];
   string headers;
   int res = WebRequest("GET", url, NULL, NULL, 5000, post, 0, result, headers);
   
   if(res == 200) {
      string jsonResponse = CharArrayToString(result);
      if(StringLen(jsonResponse) > 10) {
         ProcessSignals(jsonResponse);
      }
   }
}

void ProcessSignals(string jsonResponse) {
   int idPos = StringFind(jsonResponse, "\\\\"id\\\\":\\\\"", 0);
   if(idPos >= 0) {
      int idStart = idPos + 6;
      int idEnd = StringFind(jsonResponse, "\\\\"", idStart);
      string signalId = StringSubstr(jsonResponse, idStart, idEnd - idStart);
      
      if(signalId != gLastSignalId) {
         int typePos = StringFind(jsonResponse, "\\\\"type\\\\":\\\\"", idEnd);
         if(typePos >= 0) {
            int typeStart = typePos + 8;
            int typeEnd = StringFind(jsonResponse, "\\\\"", typeStart);
            string signalType = StringSubstr(jsonResponse, typeStart, typeEnd - typeStart);
            
            gLastSignalId = signalId;
            ExecuteTrade(signalId, signalType, _Symbol);
         }
      }
   }
}

void ExecuteTrade(string signalId, string type, string symbol) {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double finalLotSize = InpFixedLotSize;
   double dynamicSlPoints = InpStopLossPoints;
   double dynamicTpPoints = InpTakeProfitPts;
   
   // 1. DYNAMIC LOT SIZING
   if(InpUseDynamicRisk) {
      double riskAmount = balance * (InpRiskPercent / 100.0);
      if(InpStopLossPoints > 0 && InpContractSize > 0) {
         finalLotSize = riskAmount / (InpStopLossPoints * InpContractSize);
         double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
         if (lotStep > 0) {
            finalLotSize = MathRound(finalLotSize / lotStep) * lotStep;
         }
      }
   }
   
   // 2. ADJUSTING TP/SL
   if(InpUseDynamicSL) {
      double riskAmount = balance * (InpRiskPercent / 100.0);
      dynamicSlPoints = (InpFixedLotSize > 0 && InpContractSize > 0) ? (riskAmount / (InpFixedLotSize * InpContractSize)) : 10.0;
      dynamicTpPoints = dynamicSlPoints * InpRiskRewardRatio;
   }
   
   // 3. EXECUTING TRADE WITH PROPER RISK MANAGEMENT
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   
   double slPrice = 0.0;
   double tpPrice = 0.0;
   
   if(type == "BUY") {
      slPrice = ask - dynamicSlPoints;
      tpPrice = ask + dynamicTpPoints;
      trade.Buy(finalLotSize, symbol, ask, slPrice, tpPrice, "TV_Bridge");
   } else if (type == "SELL") {
      slPrice = bid + dynamicSlPoints;
      tpPrice = bid - dynamicTpPoints;
      trade.Sell(finalLotSize, symbol, bid, slPrice, tpPrice, "TV_Bridge");
   }
   
   NotifyServerSuccess(signalId, finalLotSize, type == "BUY" ? ask : bid, balance, "0");
}

void NotifyServerSuccess(string signalId, double lot, double price, double balance, string ticket) {
   string url = InpServerURL + "/api/signals/" + signalId + "/execute";
   string payload = "{\\\\"passphrase\\\\":\\\\"" + InpPassphrase + "\\\\",\\\\"status\\\\":\\\\"Executed\\\\",\\\\"lotSize\\\\":" + DoubleToString(lot, 2) + ",\\\\"executionPrice\\\\":" + DoubleToString(price, 5) + ",\\\\"balance\\\\":" + DoubleToString(balance, 2) + "}";
   
   char post[], result[];
   string headers = "Content-Type: application/json\\\\r\\\\n";
   StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8);
   
   ArrayResize(post, ArraySize(post)-1);
   
   WebRequest("POST", url, headers, 5000, post, result, headers);
}
\`;
}
`;
fs.writeFileSync('server/generators/mql5.ts', code, 'utf-8');
