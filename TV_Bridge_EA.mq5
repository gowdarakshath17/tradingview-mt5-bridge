//+------------------------------------------------------------------+
//|                                                 TV_Bridge_EA.mq5 |
//|                                  TradingView to MT5 Automated EA |
//+------------------------------------------------------------------+
#property copyright "TradingView to MT5 Bridge"
#property link      "http://127.0.0.1:3000"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>
CTrade trade;

input string   InpServerURL      = "http://127.0.0.1:3000";
input string   InpPassphrase     = "RakGow_SecKey_For_TVBot";
input int      InpPollInterval   = 2;
input bool     InpUseDynamicRisk = true;
input bool     InpUseDynamicSL   = false;
input double   InpRiskRewardRatio= 2.0;
input double   InpRiskPercent    = 1.0;
input double   InpFixedLotSize   = 0.1;
input double   InpContractSize   = 100;
input double   InpStopLossPoints = 100;
input double   InpTakeProfitPts  = 200;
input int      InpMagicNumber    = 881122;

string gLastSignalId = "";

int OnInit() {
   string serverUrl = InpServerURL;
   StringTrimLeft(serverUrl);
   StringTrimRight(serverUrl);
   StringReplace(serverUrl, "localhost", "127.0.0.1");

   EventSetTimer(InpPollInterval);
   trade.SetExpertMagicNumber(InpMagicNumber);
   Print("==================================================");
   Print("🚀 TradingView-To-MT5 EA Initialized Successfully!");
   Print("🔗 Polling Server: ", serverUrl);
   Print("⏱️ Polling Interval: ", InpPollInterval, " seconds");
   Print("==================================================");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Print("🛑 TradingView-To-MT5 EA Stopped.");
}

void OnTimer() {
   string serverUrl = InpServerURL;
   StringTrimLeft(serverUrl);
   StringTrimRight(serverUrl);
   StringReplace(serverUrl, "localhost", "127.0.0.1");
   if(StringFind(serverUrl, "http://") != 0 && StringFind(serverUrl, "https://") != 0) {
      serverUrl = "http://" + serverUrl;
   }
   while(StringLen(serverUrl) > 0 && StringSubstr(serverUrl, StringLen(serverUrl) - 1, 1) == "/") {
      serverUrl = StringSubstr(serverUrl, 0, StringLen(serverUrl) - 1);
   }

   string passphrase = InpPassphrase;
   StringTrimLeft(passphrase);
   StringTrimRight(passphrase);

   string url = serverUrl + "/api/signals?status=Pending&passphrase=" + passphrase;
   char postData[];
   char resultData[];
   string reqHeaders = "Content-Type: application/json\r\n";
   string respHeaders = "";
   ResetLastError();
   
   int res = WebRequest("GET", url, reqHeaders, 5000, postData, resultData, respHeaders);
   
   if(res == 200) {
      string jsonResponse = CharArrayToString(resultData);
      if(StringLen(jsonResponse) > 10) {
         ProcessSignals(jsonResponse);
      }
   } else if(res == -1 || res == 1003) {
      int err = (res == 1003) ? 1003 : GetLastError();
      static int lastErrPrint = 0;
      if(err != lastErrPrint) {
         if(err == 1003) {
            Print("❌ WebRequest Error 1003 (Invalid URL): Ensure InpServerURL is a valid URL without spaces.");
            Print("   👉 Current URL: '", url, "'");
            Print("   👉 Fix: Set InpServerURL to 'http://127.0.0.1:3000' or 'http://localhost:3000' and ensure no trailing spaces.");
         } else if(err == 4014) {
            Print("❌ MT5 Error 4014 (Function Not Allowed / Blocked by MT5 Settings):");
            Print("   👉 Step 1: Ensure 'Algo Trading' button at top toolbar of MT5 is GREEN (Active).");
            Print("   👉 Step 2: Open MT5 Tools -> Options -> Expert Advisors.");
            Print("   👉 Step 3: Check 'Allow WebRequest for listed URL'.");
            Print("   👉 Step 4: Add BOTH '", serverUrl, "' AND 'http://127.0.0.1:3000' AND 'http://localhost:3000' to the Whitelist.");
            Print("   👉 Step 5: Press ENTER after pasting each URL in MT5 Options so it locks in, then click OK!");
            Print("   👉 Step 6: Right click chart -> Expert Advisors -> Properties -> Common tab -> Check 'Allow Algo Trading'.");
         } else if(err == 4060) {
            Print("❌ MT5 Error 4060 (WebRequest Blocked): Add '", serverUrl, "' to MT5 Tools -> Options -> Expert Advisors -> WebRequest URL list.");
         } else {
            Print("❌ WebRequest Error Code: ", err, " | Server URL: ", serverUrl);
         }
         lastErrPrint = err;
      }
   } else {
      Print("⚠️ Server returned HTTP status: ", res);
   }
}

void ProcessSignals(string jsonResponse) {
   int idPos = StringFind(jsonResponse, "\"id\":\"", 0);
   if(idPos >= 0) {
      int idStart = idPos + 6;
      int idEnd = StringFind(jsonResponse, "\"", idStart);
      string signalId = StringSubstr(jsonResponse, idStart, idEnd - idStart);
      
      if(signalId != gLastSignalId) {
         int typePos = StringFind(jsonResponse, "\"type\":\"", idEnd);
         if(typePos >= 0) {
            int typeStart = typePos + 8;
            int typeEnd = StringFind(jsonResponse, "\"", typeStart);
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
   
   Print("⚡ [TV Bridge] Processing Signal #", signalId, " | Type: ", type, " | Symbol: ", symbol, " | Lots: ", finalLotSize);
   
   bool res = false;
   if(type == "BUY") {
      slPrice = ask - dynamicSlPoints;
      tpPrice = ask + dynamicTpPoints;
      res = trade.Buy(finalLotSize, symbol, ask, slPrice, tpPrice, "TV_Bridge");
   } else if (type == "SELL") {
      slPrice = bid + dynamicSlPoints;
      tpPrice = bid - dynamicTpPoints;
      res = trade.Sell(finalLotSize, symbol, bid, slPrice, tpPrice, "TV_Bridge");
   }
   
   if(res && trade.ResultRetcode() == TRADE_RETCODE_DONE) {
      Print("✅ [TV Bridge] Market order executed on MT5! Order Ticket: #", trade.ResultOrder(), " Price: ", trade.ResultPrice());
      NotifyServerSuccess(signalId, finalLotSize, type == "BUY" ? ask : bid, balance, IntegerToString(trade.ResultOrder()));
   } else {
      Print("❌ [TV Bridge] MT5 Order Execution Failed! Return Code: ", trade.ResultRetcode(), " Comment: ", trade.ResultComment());
      NotifyServerSuccess(signalId, finalLotSize, type == "BUY" ? ask : bid, balance, "0");
   }
}

void NotifyServerSuccess(string signalId, double lot, double price, double balance, string ticket) {
   string serverUrl = InpServerURL;
   StringTrimLeft(serverUrl);
   StringTrimRight(serverUrl);
   StringReplace(serverUrl, "localhost", "127.0.0.1");
   if(StringFind(serverUrl, "http://") != 0 && StringFind(serverUrl, "https://") != 0) {
      serverUrl = "http://" + serverUrl;
   }
   while(StringLen(serverUrl) > 0 && StringSubstr(serverUrl, StringLen(serverUrl) - 1, 1) == "/") {
      serverUrl = StringSubstr(serverUrl, 0, StringLen(serverUrl) - 1);
   }

   string passphrase = InpPassphrase;
   StringTrimLeft(passphrase);
   StringTrimRight(passphrase);

   string url = serverUrl + "/api/signals/" + signalId + "/execute";
   string payload = "{\"passphrase\":\"" + passphrase + "\",\"status\":\"Executed\",\"lotSize\":" + DoubleToString(lot, 2) + ",\"executionPrice\":" + DoubleToString(price, 5) + ",\"balance\":" + DoubleToString(balance, 2) + "}";
   
   char postData[], resultData[];
   string reqHeaders = "Content-Type: application/json\r\n";
   string respHeaders = "";
   StringToCharArray(payload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(ArraySize(postData) > 0) {
      ArrayResize(postData, ArraySize(postData)-1);
   }
   
   WebRequest("POST", url, reqHeaders, 5000, postData, resultData, respHeaders);
}
