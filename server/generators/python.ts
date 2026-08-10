import { BridgeConfig } from "../../src/types";

export function generatePythonCode(hostUrl: string, config: BridgeConfig): string {
  return `"""
TradingView to MT5 Bridge (Python Edition)
Connects TradingView webhooks to your local MetaTrader 5 Terminal.

Requirements:
    pip install MetaTrader5 requests

Ensure your MetaTrader 5 Terminal is OPEN and logged into your account.
"""

import sys
import time
import requests
import datetime
import MetaTrader5 as mt5

# Force UTF-8 encoding for standard output on Windows PM2 / Console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# --- Configuration
BRIDGE_URL = "${hostUrl}"
PASSPHRASE = "${config.passphrase}"
POLL_INTERVAL = ${config.takeProfitPoints > 0 ? "2" : "5"}  # Poll server every X seconds
SYMBOL = "XAUUSD"          # Symbol to trade on MT5

# Risk configuration
CONTRACT_SIZE = ${config.contractSize || 100}
USE_DYNAMIC_RISK = ${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}
USE_DYNAMIC_SL = ${config.lotSizingMode === 'DynamicStopLoss' ? 'True' : 'False'}
RR_RATIO = ${config.riskRewardRatio || 2.0}
RISK_PERCENT = ${config.riskPercent}          # Account Balance Risk % per trade
FIXED_LOT_SIZE = ${config.fixedLotSize}        # Fixed lot size if dynamic risk disabled
STOP_LOSS_POINTS = ${config.stopLossPoints}      # Stop Loss points (e.g. 10.0 gold price distance)
TAKE_PROFIT_POINTS = ${config.takeProfitPoints}    # Take Profit points (e.g. 20.0 gold price distance)

# Trailing Stop configuration
USE_TRAILING_STOP = ${config.dynamicTrailingStop ? "True" : "False"}
TRAILING_ACTIVATION = ${config.trailingActivationPoints || 10.0}
TRAILING_STEP = ${config.trailingStepPoints || 2.0}

# Weekend & Holiday Safety configuration
USE_WEEKEND_SHUTDOWN = ${config.weekendShutdownEnabled ? "True" : "False"}
SHUTDOWN_MINUTES_BEFORE_CLOSE = ${config.shutdownMinutesBeforeClose || 15}
USE_HOLIDAY_FILTER = ${config.holidayFilterEnabled ? "True" : "False"}
CUSTOM_HOLIDAYS = [${(config.customHolidays || []).map(h => `"${h}"`).join(", ")}]

# Daily Rollover Gap Protection configuration
USE_DAILY_SHUTDOWN = ${config.dailyShutdownEnabled ? "True" : "False"}
DAILY_SHUTDOWN_HOUR = ${config.dailyShutdownHour ?? 21}  # UTC hour (0-23)
DAILY_SHUTDOWN_MIN = ${config.dailyShutdownMinute ?? 45}   # UTC minute (0-59)
DAILY_SHUTDOWN_DUR = ${config.dailyShutdownDurationMins ?? 30}   # duration in minutes

print("==========================================================")
print("       TRADINGVIEW TO MT5 PYTHON BRIDGE INITIATED")
print("==========================================================")
print(f"Bridge URL: {BRIDGE_URL}")
print(f"Target Trading Symbol: {SYMBOL}")
print(f"Risk Profile: {'Dynamic Risk ' + str(RISK_PERCENT) + '%' if USE_DYNAMIC_RISK else 'Fixed Lot ' + str(FIXED_LOT_SIZE)}")
print("==========================================================\\n")

# Initialize MT5 with retry loop
while not mt5.initialize():
    print("[WAIT] Waiting for MetaTrader 5 Terminal to open... Error code:", mt5.last_error())
    time.sleep(5)

print("[OK] MetaTrader 5 Terminal connected successfully!")
account_info = mt5.account_info()
if account_info is not None:
    print(f"Account: {account_info.login} | Server: {account_info.server} | Balance: \${account_info.balance:.2f}")
else:
    print("[ERROR] Failed to fetch account info. Is MT5 logged in?")

# Track processed signals to avoid duplicates
processed_signal_ids = set()

# Initialize: fetch active pending signals to set baseline
try:
    init_res = requests.get(f"{BRIDGE_URL}/api/signals?status=Pending&passphrase={PASSPHRASE}", timeout=15)
    if init_res.status_code == 200:
        for sig in init_res.json():
            processed_signal_ids.add(sig["id"])
        print(f"[OK] Initialized baseline. Skipping {len(processed_signal_ids)} pre-existing pending signals.")
except Exception as e:
    print("[WARN] Could not fetch initial baseline from server. Continuing...", e)


def calculate_lot_size(balance, symbol):
    if not USE_DYNAMIC_RISK:
        return FIXED_LOT_SIZE
        
    # Get symbol info
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        print(f"[ERROR] Symbol {symbol} not found in MT5 MarketWatch!")
        return FIXED_LOT_SIZE
        
    # Calculate dollar risk amount
    risk_amount = balance * (RISK_PERCENT / 100.0)
    
    # Use provided contract size and STOP_LOSS_POINTS (price distance)
    # Formula: Lot Size = Risk Amount / (Stop Loss Distance * Contract Size)
    if STOP_LOSS_POINTS > 0 and CONTRACT_SIZE > 0:
        calculated_lot = risk_amount / (STOP_LOSS_POINTS * CONTRACT_SIZE)
        
        # Round to step size
        volume_step = symbol_info.volume_step
        rounded_lot = round(calculated_lot / volume_step) * volume_step
        
        # Clamp between min and max volume
        min_volume = symbol_info.volume_min
        max_volume = symbol_info.volume_max
        final_lot = max(min(rounded_lot, max_volume), min_volume)
        
        print(f"[CALC] Dynamic Position Calculator:")
        print(f"   Balance: \${balance:.2f} | Risk Amount: \${risk_amount:.2f}")
        print(f"   Calculated Lot: {final_lot:.2f} (Broker range: {min_volume} - {max_volume})")
        return round(final_lot, 2)
    else:
        print("[WARN] Could not retrieve broker tick values. Defaulting to fixed lot size.")
        return FIXED_LOT_SIZE


def execute_trade(signal_id, signal_type, signal_sl=None, signal_tp=None):
    # Prepare symbol
    symbol_info = mt5.symbol_info(SYMBOL)
    if symbol_info is None:
        print(f"[ERROR] Symbol {SYMBOL} not found. Cannot execute trade.")
        notify_server_failure(signal_id, f"Symbol {SYMBOL} not found in MT5")
        return

    # If symbol not visible, make it visible
    if not symbol_info.visible:
        print(f"[INFO] Making symbol {SYMBOL} visible in MarketWatch.")
        if not mt5.symbol_select(SYMBOL, True):
            print(f"[ERROR] Failed to select {SYMBOL} in MarketWatch.")
            notify_server_failure(signal_id, "MarketWatch selection failure")
            return

    account = mt5.account_info()
    if account is None:
        print("[ERROR] Cannot retrieve account balance. MT5 connection lost.")
        notify_server_failure(signal_id, "MT5 Account Info unavailable")
        return
        
    lot_size = calculate_lot_size(account.balance, SYMBOL)
    
    dynamic_sl_points = STOP_LOSS_POINTS
    dynamic_tp_points = TAKE_PROFIT_POINTS
    if USE_DYNAMIC_SL:
        risk_amount = account.balance * (RISK_PERCENT / 100.0)
        dynamic_sl_points = risk_amount / (FIXED_LOT_SIZE * CONTRACT_SIZE) if FIXED_LOT_SIZE > 0 and CONTRACT_SIZE > 0 else 10.0
        dynamic_tp_points = dynamic_sl_points * RR_RATIO
        print(f"[SL/TP] Dynamic SL/TP Calculated: SL={dynamic_sl_points:.2f} pts, TP={dynamic_tp_points:.2f} pts")

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
        order_type = mt5.ORDER_TYPE_SELL

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": SYMBOL,
        "volume": lot_size,
        "type": order_type,
        "price": price,
        "sl": round(sl, digits),
        "tp": round(tp, digits),
        "deviation": 30,
        "magic": 881122,
        "comment": f"TV Signal {signal_id}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,  # Standard Fill-or-Kill (can adjust if needed)
    }

    print(f"[ORDER] Sending Market Order: {signal_type} {lot_size} lots on {SYMBOL} @ {price}. SL: {sl:.2f}, TP: {tp:.2f}")
    result = mt5.order_send(request)
    
    if result is None:
        print("[ERROR] Order Send completely failed. None return.")
        notify_server_failure(signal_id, "Order Send failed completely (MT5 None)")
        return

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        # Retry with Return Book (Immediate-or-Cancel / Return) if Fill-or-Kill is not supported by broker
        if result.retcode in [10013, 10014, 10015]:  # invalid volume, price, or details
            print("[RETRY] Attempting order execution with ORDER_FILLING_IOC...")
            request["type_filling"] = mt5.ORDER_FILLING_IOC
            result = mt5.order_send(request)
            
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            # If still fails, try with ORDER_FILLING_RETURN
            print("[RETRY] Attempting order execution with ORDER_FILLING_RETURN...")
            request["type_filling"] = mt5.ORDER_FILLING_RETURN
            result = mt5.order_send(request)

    if result.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"[OK] Trade executed successfully! MT5 Ticket: {result.order}")
        notify_server_success(signal_id, lot_size, price, account.balance, result.order)
    else:
        error_msg = f"Failed! Return Code: {result.retcode}. Comment: {result.comment}"
        print(f"[ERROR] {error_msg}")
        notify_server_failure(signal_id, error_msg)


def notify_server_success(signal_id, lot, price, balance, ticket):
    try:
        url = f"{BRIDGE_URL}/api/signals/{signal_id}/execute"
        payload = {
            "passphrase": PASSPHRASE,
            "status": "Executed",
            "lotSize": lot,
            "executionPrice": price,
            "balance": balance,
            "ticket": str(ticket)
        }
        res = requests.post(url, json=payload, timeout=10)
        if res.status_code == 200:
            print("[OK] Bridge server logs updated successfully.")
    except Exception as e:
        print("[WARN] Failed to update bridge server logs.", e)


def notify_server_failure(signal_id, error_msg):
    try:
        url = f"{BRIDGE_URL}/api/signals/{signal_id}/execute"
        payload = {
            "passphrase": PASSPHRASE,
            "status": "Failed",
            "error": error_msg
        }
        res = requests.post(url, json=payload, timeout=10)
        if res.status_code == 200:
            print("[OK] Bridge server error log updated.")
    except Exception as e:
        print("[WARN] Failed to update bridge server logs.", e)


def apply_trailing_stop():
    if not USE_TRAILING_STOP:
        return
        
    positions = mt5.positions_get(magic=881122)
    if positions is None or len(positions) == 0:
        return
        
    for pos in positions:
        symbol = pos.symbol
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            continue
            
        point = symbol_info.point
        digits = symbol_info.digits
        
        # Get current bid/ask
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            continue
            
        current_price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask
        open_price = pos.price_open
        sl = pos.sl
        tp = pos.tp
        
        if pos.type == mt5.POSITION_TYPE_BUY:
            if current_price - open_price >= TRAILING_ACTIVATION * point:
                new_sl = round(current_price - TRAILING_STEP * point, digits)
                if sl < new_sl and (sl == 0 or new_sl > sl):
                    request = {
                        "action": mt5.TRADE_ACTION_SLTP,
                        "position": pos.ticket,
                        "sl": new_sl,
                        "tp": tp
                    }
                    res = mt5.order_send(request)
                    if res is not None and res.retcode == mt5.TRADE_RETCODE_DONE:
                        print(f"[OK] Trailed BUY stop-loss for position {pos.ticket} to {new_sl}")
        elif pos.type == mt5.POSITION_TYPE_SELL:
            if open_price - current_price >= TRAILING_ACTIVATION * point:
                new_sl = round(current_price + TRAILING_STEP * point, digits)
                if new_sl < sl or sl == 0:
                    request = {
                        "action": mt5.TRADE_ACTION_SLTP,
                        "position": pos.ticket,
                        "sl": new_sl,
                        "tp": tp
                    }
                    res = mt5.order_send(request)
                    if res is not None and res.retcode == mt5.TRADE_RETCODE_DONE:
                        print(f"[OK] Trailed SELL stop-loss for position {pos.ticket} to {new_sl}")


def is_market_suspended():
    if not USE_WEEKEND_SHUTDOWN and not USE_HOLIDAY_FILTER and not USE_DAILY_SHUTDOWN:
        return False, ""
        
    now = datetime.datetime.utcnow()
    
    # 1. Holiday Filter
    if USE_HOLIDAY_FILTER:
        month = now.month
        day = now.day
        # New Year's Day
        if month == 1 and day == 1:
            return True, "New Year's Day Holiday"
        # US Independence Day
        if month == 7 and day == 4:
            return True, "US Independence Day Holiday"
        # Christmas Holidays
        if month == 12 and day in [24, 25, 26]:
            return True, "Christmas Holidays"

        # Custom user-defined holidays
        formatted_date = now.strftime("%Y-%m-%d")
        formatted_no_year = now.strftime("%m-%d")
        for holiday in CUSTOM_HOLIDAYS:
            if holiday == formatted_date or holiday == formatted_no_year:
                return True, f"Custom Configured Holiday ({holiday})"

    # 2. Weekend Shutdown Filter
    if USE_WEEKEND_SHUTDOWN:
        day_of_week = now.weekday() # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
        
        # Friday close at 22:00 UTC (17:00 EST)
        if day_of_week == 4:
            minutes_into_day = now.hour * 60 + now.minute
            friday_close_minutes = 22 * 60
            if minutes_into_day >= friday_close_minutes - SHUTDOWN_MINUTES_BEFORE_CLOSE:
                return True, "Weekend Close Protection"
                
        # Saturday is fully closed
        if day_of_week == 5:
            return True, "Weekend (Saturday)"
            
        # Sunday is closed until 22:00 UTC (17:00 EST)
        if day_of_week == 6:
            if now.hour < 22:
                return True, "Weekend (Sunday before market open)"
                
    # 3. Daily Rollover Shutdown Filter
    if USE_DAILY_SHUTDOWN:
        now_minutes = now.hour * 60 + now.minute
        start_minutes = DAILY_SHUTDOWN_HOUR * 60 + DAILY_SHUTDOWN_MIN
        end_minutes = start_minutes + DAILY_SHUTDOWN_DUR
        
        is_in_shutdown = False
        if end_minutes <= 24 * 60:
            is_in_shutdown = start_minutes <= now_minutes < end_minutes
        else:
            wrapped_end_minutes = end_minutes % (24 * 60)
            is_in_shutdown = now_minutes >= start_minutes or now_minutes < wrapped_end_minutes
            
        if is_in_shutdown:
            return True, f"Daily Rollover Shutdown ({DAILY_SHUTDOWN_HOUR:02d}:{DAILY_SHUTDOWN_MIN:02d} UTC)"
                
    return False, ""


def close_all_positions(reason="Safety Shutdown"):
    positions = mt5.positions_get(magic=881122)
    if positions is None or len(positions) == 0:
        return
        
    print(f"{reason}: Closing {len(positions)} active positions for security...")
    for pos in positions:
        tick = mt5.symbol_info_tick(pos.symbol)
        if tick is None:
            continue
            
        order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": order_type,
            "position": pos.ticket,
            "price": price,
            "deviation": 30,
            "magic": 881122,
            "comment": f"{reason[:20]}",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }
        
        result = mt5.order_send(request)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            print(f"[OK] Successfully closed position {pos.ticket} on {pos.symbol}")
        else:
            # Fallback to IOC filling mode
            request["type_filling"] = mt5.ORDER_FILLING_IOC
            result = mt5.order_send(request)
            if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
                print(f"[OK] Successfully closed position {pos.ticket} on {pos.symbol} (IOC)")


# --- Core Polling Loop
print("Core Polling loop started. Listening for incoming signals...")
try:
    while True:
        try:
            # Check if market is closed or holiday active
            suspended, reason = is_market_suspended()
            if suspended:
                static_print_timer = getattr(is_market_suspended, "last_print", 0)
                if time.time() - static_print_timer > 3600:
                    print(f"[PAUSE] VPS is taking a break. Market is suspended: {reason}")
                    is_market_suspended.last_print = time.time()
                
                if "Weekend" in reason or "Daily" in reason:
                    # Close positions if open
                    close_all_positions(reason)
                    
                time.sleep(60) # Idle loop sleeps longer when market is closed
                continue
                
            url = f"{BRIDGE_URL}/api/signals?status=Pending&passphrase={PASSPHRASE}"
            res = requests.get(url, timeout=15)
            
            if res.status_code == 200:
                signals = res.json()
                for sig in signals:
                    sig_id = sig["id"]
                    if sig_id not in processed_signal_ids:
                        processed_signal_ids.add(sig_id)
                        execute_trade(sig_id, sig["type"])
                
                # Apply Trailing Stop for open positions
                apply_trailing_stop()
            elif res.status_code == 401:
                print("[ERROR] Server rejected connection! Passphrase might be incorrect.")
            else:
                print(f"[WARN] Server returned unexpected status {res.status_code}")
                
            time.sleep(2) # Prevent tight CPU/network loop while active
            
        except requests.exceptions.Timeout:
            time.sleep(2)
            continue
        except requests.exceptions.ConnectionError:
            print("[WAIT] Server offline or connection error. Retrying in 10s...")
            time.sleep(10)
            continue
        except Exception as e:
            print("[WARN] Unexpected error in polling loop:", e)
            
        time.sleep(POLL_INTERVAL)
except KeyboardInterrupt:
    print("\\n[STOP] Bridge terminated by user.")
finally:
    mt5.shutdown()
    print("MT5 Shutdown completed.")
`;
}

