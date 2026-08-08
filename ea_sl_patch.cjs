const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldSlCalcStr = `   // 2. Set Entry, SL, and TP prices
   if(type == "BUY")
   {
      entryPrice = ask;
      slPrice = signalSL > 0 ? signalSL : entryPrice - (InpStopLossPoints);
      tpPrice = signalTP > 0 ? signalTP : entryPrice + (InpTakeProfitPts);`;

const newSlCalcStr = `   double dynamicSlPoints = InpStopLossPoints;
   double dynamicTpPoints = InpTakeProfitPts;

   if (InpUseDynamicSL) {
      double riskAmount = balance * (InpRiskPercent / 100.0);
      dynamicSlPoints = riskAmount / InpFixedLotSize;
      dynamicTpPoints = dynamicSlPoints * InpRiskRewardRatio;
      
      Print("TV_Bridge_EA: Dynamic SL/TP: Risk Amount = $", DoubleToString(riskAmount, 2), 
            ", Fixed Lot = ", DoubleToString(InpFixedLotSize, 2), 
            ", Calculated SL Pts = ", DoubleToString(dynamicSlPoints, 2), 
            ", Calculated TP Pts = ", DoubleToString(dynamicTpPoints, 2));
   }

   // 2. Set Entry, SL, and TP prices
   if(type == "BUY")
   {
      entryPrice = ask;
      slPrice = signalSL > 0 ? signalSL : entryPrice - (dynamicSlPoints);
      tpPrice = signalTP > 0 ? signalTP : entryPrice + (dynamicTpPoints);`;
content = content.replace(oldSlCalcStr, newSlCalcStr);

content = content.replace(`      slPrice = signalSL > 0 ? signalSL : entryPrice + (InpStopLossPoints);
      tpPrice = signalTP > 0 ? signalTP : entryPrice - (InpTakeProfitPts);`, `      slPrice = signalSL > 0 ? signalSL : entryPrice + (dynamicSlPoints);
      tpPrice = signalTP > 0 ? signalTP : entryPrice - (dynamicTpPoints);`);

// For Python
const oldPyExecuteStr = `    lot_size = calculate_lot_size(account.balance, SYMBOL)
    
    # Action structures
    point = mt5.symbol_info(SYMBOL).point
    digits = mt5.symbol_info(SYMBOL).digits
    
    if signal_type == "BUY":
        price = mt5.symbol_info_tick(SYMBOL).ask
        sl = signal_sl if signal_sl else price - STOP_LOSS_POINTS
        tp = signal_tp if signal_tp else price + TAKE_PROFIT_POINTS
        order_type = mt5.ORDER_TYPE_BUY
    else:
        price = mt5.symbol_info_tick(SYMBOL).bid
        sl = signal_sl if signal_sl else price + STOP_LOSS_POINTS
        tp = signal_tp if signal_tp else price - TAKE_PROFIT_POINTS
        order_type = mt5.ORDER_TYPE_SELL`;

const newPyExecuteStr = `    lot_size = calculate_lot_size(account.balance, SYMBOL)
    
    dynamic_sl_points = STOP_LOSS_POINTS
    dynamic_tp_points = TAKE_PROFIT_POINTS
    if USE_DYNAMIC_SL:
        risk_amount = account.balance * (RISK_PERCENT / 100.0)
        dynamic_sl_points = risk_amount / FIXED_LOT_SIZE
        dynamic_tp_points = dynamic_sl_points * RR_RATIO
        print(f"📉 Dynamic SL/TP Calculated: SL={dynamic_sl_points:.2f} pts, TP={dynamic_tp_points:.2f} pts")

    # Action structures
    point = mt5.symbol_info(SYMBOL).point
    digits = mt5.symbol_info(SYMBOL).digits
    
    if signal_type == "BUY":
        price = mt5.symbol_info_tick(SYMBOL).ask
        sl = signal_sl if signal_sl else price - dynamic_sl_points
        tp = signal_tp if signal_tp else price + dynamic_tp_points
        order_type = mt5.ORDER_TYPE_BUY
    else:
        price = mt5.symbol_info_tick(SYMBOL).bid
        sl = signal_sl if signal_sl else price + dynamic_sl_points
        tp = signal_tp if signal_tp else price - dynamic_tp_points
        order_type = mt5.ORDER_TYPE_SELL`;

content = content.replace(oldPyExecuteStr, newPyExecuteStr);

fs.writeFileSync('server.ts', content, 'utf8');
