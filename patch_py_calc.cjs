const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const calcStr = `    # Get tick value and size
    tick_value = symbol_info.trade_tick_value
    tick_size = symbol_info.trade_tick_size
    
    if tick_value > 0 and tick_size > 0:
        points_in_ticks = STOP_LOSS_POINTS / tick_size
        calculated_lot = risk_amount / (points_in_ticks * tick_value)
        
        # Round to step size
        volume_step = symbol_info.volume_step
        rounded_lot = round(calculated_lot / volume_step) * volume_step`;

const newCalcStr = `    # Use provided contract size and STOP_LOSS_POINTS (price distance)
    # Formula: Lot Size = Risk Amount / (Stop Loss Distance * Contract Size)
    if STOP_LOSS_POINTS > 0 and CONTRACT_SIZE > 0:
        calculated_lot = risk_amount / (STOP_LOSS_POINTS * CONTRACT_SIZE)
        
        # Round to step size
        volume_step = symbol_info.volume_step
        rounded_lot = round(calculated_lot / volume_step) * volume_step`;

content = content.replace(calcStr, newCalcStr);

const dynamicSlStr = `    if USE_DYNAMIC_SL:
        risk_amount = account.balance * (RISK_PERCENT / 100.0)
        dynamic_sl_points = risk_amount / FIXED_LOT_SIZE
        dynamic_tp_points = dynamic_sl_points * RR_RATIO`;

const newDynamicSlStr = `    if USE_DYNAMIC_SL:
        risk_amount = account.balance * (RISK_PERCENT / 100.0)
        dynamic_sl_points = risk_amount / (FIXED_LOT_SIZE * CONTRACT_SIZE) if FIXED_LOT_SIZE > 0 and CONTRACT_SIZE > 0 else 10.0
        dynamic_tp_points = dynamic_sl_points * RR_RATIO`;
        
content = content.replace(dynamicSlStr, newDynamicSlStr);

fs.writeFileSync('server.ts', content, 'utf8');
