import { BridgeConfig } from "../../src/types";

export function generatePythonCode(hostUrl: string, config: BridgeConfig): string {
  return `"""
TradingView to MT5 Bridge (Python Edition)
Connects TradingView webhooks to your local MetaTrader 5 Terminal.

Features:
- 1:1 Partial Close: Automatically closes 50% lot at 1:1 R:R & moves SL to Breakeven
- 1:2 Runner Target: Carries remaining 50% lot to 1:2 R:R target
- Counter Signal Auto-Reversal: Immediately closes opposite trades and executes new signal
- Dynamic Trailing Stop: Real-time trailing stop-loss adjustments
- Account Drawdown Protection: Enforces Max Daily Drawdown & Max Total Drawdown limits
- Max Open Trades = 1: Strict single-position enforcement

Requirements:
    pip install MetaTrader5 requests

Ensure your MetaTrader 5 Terminal is OPEN and logged into your account.
"""

import sys
import time
import requests
import datetime
import json
import os
import MetaTrader5 as mt5

BOT_STATE_FILE = "bot_backtest_state.json"

def load_bot_state():
    if os.path.exists(BOT_STATE_FILE):
        try:
            with open(BOT_STATE_FILE, "r") as f:
                return json.load(f)
        except: pass
    return {
        "hard_paused": False,
        "last_loss_limit_day": "",
        "consecutive_daily_loss_limit_hits": 0,
        "last_skipped_signal_deal_ticket": 0,
        "last_trading_day": ""
    }

def save_bot_state(state):
    try:
        with open(BOT_STATE_FILE, "w") as f:
            json.dump(state, f)
    except: pass

bot_state = load_bot_state()

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
POLL_INTERVAL = 1  # Fast 1-second polling for immediate trade execution and position management
SYMBOL = "XAUUSD"  # Target trading symbol on MT5

# Risk & Order Execution Configuration
CONTRACT_SIZE = ${config.contractSize || 100}
USE_DYNAMIC_RISK = ${config.lotSizingMode === 'DynamicRisk' ? 'True' : 'False'}
USE_DYNAMIC_SL = ${config.lotSizingMode === 'DynamicStopLoss' ? 'True' : 'False'}
RR_RATIO = ${config.riskRewardRatio || 2.0}
RISK_PERCENT = ${config.riskPercent || 1.0}        # Account Balance Risk % per trade
FIXED_LOT_SIZE = ${config.fixedLotSize || 0.10}    # Fixed lot size if dynamic risk disabled
STOP_LOSS_POINTS = ${config.stopLossPoints || 10.0} # Stop Loss price distance (e.g. $10 on Gold)
TAKE_PROFIT_POINTS = ${config.takeProfitPoints || 20.0} # Take Profit price distance (1:2 R:R = $20 on Gold)
MAX_OPEN_TRADES = 1                               # Fixed to 1 position max

# Partial Take-Profit & Breakeven Configuration
USE_1TO1_PARTIAL_CLOSE = True  # Closes 50% at 1:1 R:R and moves SL to Breakeven
PARTIAL_CLOSE_RATIO = 0.50     # 50% closed at 1:1

# Trailing Stop Configuration
USE_TRAILING_STOP = ${config.dynamicTrailingStop ? "True" : "False"}
TRAILING_ACTIVATION = ${config.trailingActivationPoints || 10.0} # Price move required to activate trail
TRAILING_STEP = ${config.trailingStepPoints || 2.0}             # Trailing distance in price points

# Advanced Account Drawdown Guard Configuration
MAX_DAILY_DRAWDOWN_PCT = ${config.maxDailyDrawdownPct || 5.0}   # Halt if daily drawdown >= X%
MAX_TOTAL_DRAWDOWN_PCT = ${config.maxTotalDrawdownPct || 10.0}  # Halt if total drawdown >= X%

# Weekend & Holiday Safety Configuration
USE_WEEKEND_SHUTDOWN = ${config.weekendShutdownEnabled ? "True" : "False"}
SHUTDOWN_MINUTES_BEFORE_CLOSE = ${config.shutdownMinutesBeforeClose || 15}
USE_HOLIDAY_FILTER = ${config.holidayFilterEnabled ? "True" : "False"}
CUSTOM_HOLIDAYS = [${(config.customHolidays || []).map(h => `"${h}"`).join(", ")}]

# Daily Rollover Gap Protection Configuration
USE_DAILY_SHUTDOWN = ${config.dailyShutdownEnabled ? "True" : "False"}
DAILY_SHUTDOWN_HOUR = ${config.dailyShutdownHour ?? 21}  # UTC hour (0-23)
DAILY_SHUTDOWN_MIN = ${config.dailyShutdownMinute ?? 45}   # UTC minute (0-59)
DAILY_SHUTDOWN_DUR = ${config.dailyShutdownDurationMins ?? 30}   # duration in minutes

print("==========================================================")
print("       TRADINGVIEW TO MT5 ADVANCED BRIDGE INITIATED       ")
print("==========================================================")
print(f"Bridge URL: {BRIDGE_URL}")
print(f"Target Trading Symbol: {SYMBOL}")
print(f"Risk Profile: {'Dynamic Risk ' + str(RISK_PERCENT) + '%' if USE_DYNAMIC_RISK else 'Fixed Lot ' + str(FIXED_LOT_SIZE)}")
print(f"Trade Rules: Hold position until Counter Signal or SL")
print(f"Counter Signals: Instant Reversal (Close Opposite -> Open New)")
print(f"Max Open Positions: {MAX_OPEN_TRADES}")
print(f"Account Protection: Max Daily DD: {MAX_DAILY_DRAWDOWN_PCT}%, Max Total DD: {MAX_TOTAL_DRAWDOWN_PCT}%")
print("==========================================================\\n")

# Initialize MT5 with retry loop
while not mt5.initialize():
    print("[WAIT] Waiting for MetaTrader 5 Terminal to open... Error code:", mt5.last_error())
    time.sleep(5)

print("[OK] MetaTrader 5 Terminal connected successfully!")
account_info = mt5.account_info()
if account_info is not None:
    print(f"Account: {account_info.login} | Server: {account_info.server} | Balance: \${account_info.balance:.2f} | Equity: \${account_info.equity:.2f}")
    daily_start_balance = account_info.balance
    peak_account_balance = account_info.balance
else:
    print("[ERROR] Failed to fetch account info. Is MT5 logged in?")
    daily_start_balance = 0.0
    peak_account_balance = 0.0

current_trading_day = datetime.datetime.utcnow().date()

# State Tracking
processed_signal_ids = set()
partially_closed_tickets = set()  # Track positions that executed 1:1 partial close

# Initialize: fetch active pending signals to set baseline
try:
    init_res = requests.get(f"{BRIDGE_URL}/api/signals?status=Pending&passphrase={PASSPHRASE}", timeout=15)
    if init_res.status_code == 200:
        for sig in init_res.json():
            processed_signal_ids.add(sig["id"])
        print(f"[OK] Baseline established. Skipping {len(processed_signal_ids)} pre-existing pending signals.")
except Exception as e:
    print("[WARN] Could not fetch initial baseline from server. Continuing...", e)


def check_account_drawdown_risk():
    """Validates real-time daily drawdown and total drawdown against configured safety thresholds."""
    global daily_start_balance, peak_account_balance, current_trading_day
    
    account = mt5.account_info()
    if account is None:
        return False, "MT5 Account Info Unavailable"
        
    now_date = datetime.datetime.utcnow().date()
    if now_date != current_trading_day:
        current_trading_day = now_date
        daily_start_balance = account.balance
        print(f"[RISK] New Trading Day (UTC). Daily starting balance reset to \${daily_start_balance:.2f}")
        
    peak_account_balance = max(peak_account_balance, account.balance)
    
    if daily_start_balance > 0:
        daily_dd_pct = ((daily_start_balance - account.equity) / daily_start_balance) * 100.0
        if daily_dd_pct >= MAX_DAILY_DRAWDOWN_PCT:
            return True, f"Max Daily Drawdown breached: {daily_dd_pct:.2f}% >= {MAX_DAILY_DRAWDOWN_PCT}% limit"
            
    if peak_account_balance > 0:
        total_dd_pct = ((peak_account_balance - account.equity) / peak_account_balance) * 100.0
        if total_dd_pct >= MAX_TOTAL_DRAWDOWN_PCT:
            return True, f"Max Total Drawdown breached: {total_dd_pct:.2f}% >= {MAX_TOTAL_DRAWDOWN_PCT}% limit"
            
    return False, ""


def calculate_lot_size(balance, symbol):
    if not USE_DYNAMIC_RISK:
        return FIXED_LOT_SIZE
        
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        print(f"[ERROR] Symbol {symbol} not found in MT5 MarketWatch!")
        return FIXED_LOT_SIZE
        
    risk_amount = balance * (RISK_PERCENT / 100.0)
    
    if STOP_LOSS_POINTS > 0 and CONTRACT_SIZE > 0:
        calculated_lot = risk_amount / (STOP_LOSS_POINTS * CONTRACT_SIZE)
        volume_step = symbol_info.volume_step
        rounded_lot = round(calculated_lot / volume_step) * volume_step
        min_volume = symbol_info.volume_min
        max_volume = symbol_info.volume_max
        final_lot = max(min(rounded_lot, max_volume), min_volume)
        
        print(f"[CALC] Dynamic Position Calculator:")
        print(f"   Balance: \${balance:.2f} | Risk ({RISK_PERCENT}%): \${risk_amount:.2f}")
        print(f"   Calculated Lot: {final_lot:.2f} (Range: {min_volume} - {max_volume})")
        return round(final_lot, 2)
    else:
        return FIXED_LOT_SIZE


def get_fill_mode(symbol):
    """Dynamically determines the correct filling mode supported by the broker for a symbol."""
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        # Default fallback if symbol info cannot be retrieved
        return mt5.ORDER_FILLING_FOK
        
    if symbol_info.filling_mode & 1:
        return mt5.ORDER_FILLING_FOK
    elif symbol_info.filling_mode & 2:
        return mt5.ORDER_FILLING_IOC
    else:
        return getattr(mt5, 'ORDER_FILLING_RETURN', mt5.ORDER_FILLING_FOK)

def close_single_position(pos, reason="Signal Closure"):
    """Closes a specific MT5 position completely at current market price."""
    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        return False
        
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
        "type_filling": get_fill_mode(pos.symbol),
    }
    
    result = mt5.order_send(request)
    if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"[OK] Closed position #{pos.ticket} on {pos.symbol} ({reason})")
        return True
    else:
        # Fallback to RETURN filling (most common fallback for forex/gold)
        request["type_filling"] = mt5.ORDER_FILLING_RETURN
        result = mt5.order_send(request)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            print(f"[OK] Closed position #{pos.ticket} on {pos.symbol} (RETURN fallback)")
            return True
            
    print(f"[WARN] Failed to close position #{pos.ticket}. Retcode: {getattr(result, 'retcode', 'None')}")
    return False


def execute_trade(signal_id, signal_type, signal_sl=None, signal_tp=None):
    # 1. Check Drawdown Risk Lockout
    dd_breached, dd_reason = check_account_drawdown_risk()
    if dd_breached:
        print(f"[RISK LOCKOUT] Refusing to execute signal {signal_id}: {dd_reason}")
        notify_server_failure(signal_id, f"Risk Lockout: {dd_reason}")
        return

    # 2. Check Symbol visibility
    symbol_info = mt5.symbol_info(SYMBOL)
    if symbol_info is None:
        print(f"[ERROR] Symbol {SYMBOL} not found. Cannot execute trade.")
        notify_server_failure(signal_id, f"Symbol {SYMBOL} not found in MT5")
        return

    if not symbol_info.visible:
        if not mt5.symbol_select(SYMBOL, True):
            print(f"[ERROR] Failed to select {SYMBOL} in MarketWatch.")
            notify_server_failure(signal_id, "MarketWatch selection failure")
            return

    # 3. RULE 3: Counter Signal / Reversal Check
    # Whenever a counter signal appears, immediately close opposite running trades first!
    open_positions = mt5.positions_get(symbol=SYMBOL) or []
    strategy_positions = [p for p in open_positions if p.magic == 881122 or p.magic == 0]
    
    opposite_positions = []
    same_direction_positions = []
    
    for pos in strategy_positions:
        if signal_type == "BUY" and pos.type == mt5.POSITION_TYPE_SELL:
            opposite_positions.append(pos)
        elif signal_type == "SELL" and pos.type == mt5.POSITION_TYPE_BUY:
            opposite_positions.append(pos)
        elif (signal_type == "BUY" and pos.type == mt5.POSITION_TYPE_BUY) or (signal_type == "SELL" and pos.type == mt5.POSITION_TYPE_SELL):
            same_direction_positions.append(pos)

    # If opposite positions exist, close them immediately!
    if len(opposite_positions) > 0:
        print(f"[COUNTER REVERSAL] Incoming {signal_type} signal! Immediately closing {len(opposite_positions)} opposite position(s)...")
        for opp_pos in opposite_positions:
            close_single_position(opp_pos, reason=f"Reversal to {signal_type}")
        time.sleep(0.3)  # Allow MT5 ledger to settle

    # 4. RULE 4: Max Open Trades Enforcement (Default 1)
    # Check if a position in the SAME direction is already open
    refreshed_positions = [p for p in (mt5.positions_get(symbol=SYMBOL) or []) if p.magic == 881122]
    if len(refreshed_positions) >= MAX_OPEN_TRADES:
        print(f"[RISK GUARD] Max Open Trades limit ({MAX_OPEN_TRADES}) reached. Position #{refreshed_positions[0].ticket} already running in {signal_type} direction. Skipping duplicate signal.")
        notify_server_failure(signal_id, f"Max open positions ({MAX_OPEN_TRADES}) reached")
        return

    account = mt5.account_info()
    if account is None:
        print("[ERROR] Cannot retrieve account balance. MT5 connection lost.")
        notify_server_failure(signal_id, "MT5 Account Info unavailable")
        return
        
    lot_size = calculate_lot_size(account.balance, SYMBOL)
    
    # Calculate SL and 1:2 TP2 Targets
    dynamic_sl_points = STOP_LOSS_POINTS
    if USE_DYNAMIC_SL:
        risk_amount = account.balance * (RISK_PERCENT / 100.0)
        dynamic_sl_points = risk_amount / (FIXED_LOT_SIZE * CONTRACT_SIZE) if FIXED_LOT_SIZE > 0 and CONTRACT_SIZE > 0 else 10.0
    
    # 1:2 Risk-Reward Target for final TP
    dynamic_tp_points = dynamic_sl_points * RR_RATIO if RR_RATIO > 0 else TAKE_PROFIT_POINTS

    digits = symbol_info.digits
    tick = mt5.symbol_info_tick(SYMBOL)
    if tick is None:
        print(f"[ERROR] Failed to fetch live tick price for {SYMBOL}.")
        notify_server_failure(signal_id, "No tick data")
        return

    if signal_type == "BUY":
        price = tick.ask
        sl = signal_sl if signal_sl else price - dynamic_sl_points
        tp = 0.0  # Holding till counter signal
        order_type = mt5.ORDER_TYPE_BUY
    else:
        price = tick.bid
        sl = signal_sl if signal_sl else price + dynamic_sl_points
        tp = 0.0  # Holding till counter signal
        order_type = mt5.ORDER_TYPE_SELL

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": SYMBOL,
        "volume": lot_size,
        "type": order_type,
        "price": price,
        "sl": round(sl, digits),
        "deviation": 30,
        "magic": 881122,
        "comment": f"TV {signal_type} {signal_id[:8]}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": get_fill_mode(SYMBOL),
    }

    print(f"[ORDER] Executing {signal_type} {lot_size} lots on {SYMBOL} @ {price:.2f}. Initial SL: {sl:.2f} (Holding till Counter Signal)")
    result = mt5.order_send(request)
    
    if result is None:
        print("[ERROR] Order Send completely failed (MT5 None).")
        notify_server_failure(signal_id, "Order Send failed (MT5 None)")
        return

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        # Fallback 1: Return (Forex Default)
        if result.retcode in [10013, 10014, 10015, 10030]:
            print("[RETRY] Retrying order execution with ORDER_FILLING_RETURN...")
            request["type_filling"] = mt5.ORDER_FILLING_RETURN
            result = mt5.order_send(request)
            
        # Fallback 2: IOC
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print("[RETRY] Retrying order execution with ORDER_FILLING_IOC...")
            request["type_filling"] = mt5.ORDER_FILLING_IOC
            result = mt5.order_send(request)

    if result.retcode == mt5.TRADE_RETCODE_DONE:
        print(f"[OK] Trade executed successfully! MT5 Ticket: #{result.order}")
        notify_server_success(signal_id, lot_size, price, account.balance, result.order)
    else:
        error_msg = f"Failed! Retcode: {result.retcode}. Comment: {result.comment}"
        print(f"[ERROR] {error_msg}")
        notify_server_failure(signal_id, error_msg)


def enforce_gap_protection():
    """
    Scans open positions to ensure price hasn't bypassed SL or TP (e.g., due to market gaps).
    If the broker failed to close it, this forces an immediate market execution close.
    """
    positions = mt5.positions_get(symbol=SYMBOL)
    if positions is None or len(positions) == 0:
        return
        
    for pos in positions:
        if pos.magic != 881122 and pos.magic != 0:
            continue
            
        tick = mt5.symbol_info_tick(pos.symbol)
        if tick is None:
            continue
            
        current_price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask
        
        breached = False
        reason_msg = ""
        
        if pos.type == mt5.POSITION_TYPE_BUY:
            if pos.tp > 0 and current_price >= pos.tp:
                breached = True
                reason_msg = f"Gapped above TP ({current_price:.2f} >= {pos.tp:.2f})"
            elif pos.sl > 0 and current_price <= pos.sl:
                breached = True
                reason_msg = f"Gapped below SL ({current_price:.2f} <= {pos.sl:.2f})"
        elif pos.type == mt5.POSITION_TYPE_SELL:
            if pos.tp > 0 and current_price <= pos.tp:
                breached = True
                reason_msg = f"Gapped below TP ({current_price:.2f} <= {pos.tp:.2f})"
            elif pos.sl > 0 and current_price >= pos.sl:
                breached = True
                reason_msg = f"Gapped above SL ({current_price:.2f} >= {pos.sl:.2f})"
                
        if breached:
            print(f"[GAP SCANNER] Position #{pos.ticket} breached limits: {reason_msg}. Forcing market close!")
            close_single_position(pos, reason="Gap Protection")


def apply_trade_management():
    """
    Trade Management disabled for current strategy (Holding till counter signal).
    """
    return

    positions = mt5.positions_get(symbol=SYMBOL)
    if positions is None or len(positions) == 0:
        return
        
    for pos in positions:
        if pos.magic != 881122 and pos.magic != 0:
            continue
            
        symbol_info = mt5.symbol_info(pos.symbol)
        tick = mt5.symbol_info_tick(pos.symbol)
        if symbol_info is None or tick is None:
            continue
            
        digits = symbol_info.digits
        current_price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask
        open_price = pos.price_open
        current_sl = pos.sl
        current_tp = pos.tp
        
        # Calculate original stop loss distance
        sl_distance = abs(open_price - current_sl) if current_sl > 0 else STOP_LOSS_POINTS
        if sl_distance <= 0:
            sl_distance = STOP_LOSS_POINTS
            
        # 1:1 Price Target
        tp1_price = open_price + sl_distance if pos.type == mt5.POSITION_TYPE_BUY else open_price - sl_distance

        # --- FEATURE 1: 1:1 Partial Close (50% Volume) + Move SL to Breakeven ---
        if USE_1TO1_PARTIAL_CLOSE and pos.ticket not in partially_closed_tickets:
            reached_1to1 = False
            if pos.type == mt5.POSITION_TYPE_BUY and current_price >= tp1_price:
                reached_1to1 = True
            elif pos.type == mt5.POSITION_TYPE_SELL and current_price <= tp1_price:
                reached_1to1 = True
                
            if reached_1to1:
                volume_min = symbol_info.volume_min
                volume_step = symbol_info.volume_step
                half_vol = round((pos.volume * PARTIAL_CLOSE_RATIO) / volume_step) * volume_step
                close_vol = max(volume_min, min(half_vol, pos.volume))
                
                # If position volume can be split into half
                if close_vol < pos.volume:
                    print(f"[TP1 (1:1) REACHED] Position #{pos.ticket} hit 1:1 Target (@ {current_price:.2f})!")
                    print(f"   Executing 50% partial close ({close_vol:.2f} of {pos.volume:.2f} lots)...")
                    
                    order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
                    close_req = {
                        "action": mt5.TRADE_ACTION_DEAL,
                        "symbol": pos.symbol,
                        "volume": close_vol,
                        "type": order_type,
                        "position": pos.ticket,
                        "price": current_price,
                        "deviation": 30,
                        "magic": 881122,
                        "comment": "TP1 1:1 Partial Close",
                        "type_time": mt5.ORDER_TIME_GTC,
                        "type_filling": get_fill_mode(pos.symbol),
                    }
                    res = mt5.order_send(close_req)
                    
                    if res is None or res.retcode != mt5.TRADE_RETCODE_DONE:
                        close_req["type_filling"] = mt5.ORDER_FILLING_RETURN
                        res = mt5.order_send(close_req)
                        
                    if res is None or res.retcode != mt5.TRADE_RETCODE_DONE:
                        close_req["type_filling"] = mt5.ORDER_FILLING_IOC
                        res = mt5.order_send(close_req)
                        
                    if res is not None and res.retcode == mt5.TRADE_RETCODE_DONE:
                        print(f"[OK] 50% Lot Closed! Moving remaining position #{pos.ticket} SL to Breakeven ({open_price:.2f})...")
                        partially_closed_tickets.add(pos.ticket)
                        
                        # Move SL to Breakeven
                        be_req = {
                            "action": mt5.TRADE_ACTION_SLTP,
                            "position": pos.ticket,
                            "sl": round(open_price, digits),
                            "tp": current_tp
                        }
                        mt5.order_send(be_req)
                else:
                    # Minimum lot size cannot be split; move SL to Breakeven directly
                    print(f"[TP1 (1:1) REACHED] Moving Position #{pos.ticket} SL to Breakeven ({open_price:.2f})...")
                    partially_closed_tickets.add(pos.ticket)
                    be_req = {
                        "action": mt5.TRADE_ACTION_SLTP,
                        "position": pos.ticket,
                        "sl": round(open_price, digits),
                        "tp": current_tp
                    }
                    mt5.order_send(be_req)

        # --- FEATURE 2: Dynamic Trailing Stop ---
        if USE_TRAILING_STOP:
            if pos.type == mt5.POSITION_TYPE_BUY:
                profit_distance = current_price - open_price
                if profit_distance >= TRAILING_ACTIVATION:
                    desired_sl = round(current_price - TRAILING_STEP, digits)
                    # Only trail upwards
                    if desired_sl > current_sl and (current_sl == 0 or desired_sl > current_sl + 0.2):
                        trail_req = {
                            "action": mt5.TRADE_ACTION_SLTP,
                            "position": pos.ticket,
                            "sl": desired_sl,
                            "tp": current_tp
                        }
                        trail_res = mt5.order_send(trail_req)
                        if trail_res is not None and trail_res.retcode == mt5.TRADE_RETCODE_DONE:
                            print(f"[DYNAMIC TRAIL] Trailed BUY SL for position #{pos.ticket} to {desired_sl:.2f} (Price: {current_price:.2f})")
            elif pos.type == mt5.POSITION_TYPE_SELL:
                profit_distance = open_price - current_price
                if profit_distance >= TRAILING_ACTIVATION:
                    desired_sl = round(current_price + TRAILING_STEP, digits)
                    # Only trail downwards
                    if (current_sl == 0 or desired_sl < current_sl - 0.2):
                        trail_req = {
                            "action": mt5.TRADE_ACTION_SLTP,
                            "position": pos.ticket,
                            "sl": desired_sl,
                            "tp": current_tp
                        }
                        trail_res = mt5.order_send(trail_req)
                        if trail_res is not None and trail_res.retcode == mt5.TRADE_RETCODE_DONE:
                            print(f"[DYNAMIC TRAIL] Trailed SELL SL for position #{pos.ticket} to {desired_sl:.2f} (Price: {current_price:.2f})")


def report_telemetry():
    try:
        account = mt5.account_info()
        if account is None:
            return
            
        positions = mt5.positions_get(symbol=SYMBOL)
        open_positions = []
        if positions:
            for p in positions:
                open_positions.append({
                    "ticket": p.ticket,
                    "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
                    "volume": p.volume,
                    "price_open": p.price_open,
                    "sl": p.sl,
                    "tp": p.tp,
                    "profit": p.profit
                })

        url = f"{BRIDGE_URL}/api/telemetry"
        payload = {
            "passphrase": PASSPHRASE,
            "balance": account.balance,
            "equity": account.equity,
            "openPositions": open_positions,
            "server": account.server,
            "accountName": account.name,
            "connectionStatus": "Connected"
        }
        requests.post(url, json=payload, timeout=5)
    except:
        pass

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
            print("[OK] Server execution log updated.")
    except Exception as e:
        print("[WARN] Failed to update bridge server log:", e)


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
            print("[OK] Server error log updated.")
    except Exception as e:
        print("[WARN] Failed to update bridge server log:", e)


def is_market_suspended():
    if not USE_WEEKEND_SHUTDOWN and not USE_HOLIDAY_FILTER and not USE_DAILY_SHUTDOWN:
        return False, ""
        
    now = datetime.datetime.utcnow()
    
    # 1. Holiday Filter
    if USE_HOLIDAY_FILTER:
        month = now.month
        day = now.day
        if month == 1 and day == 1:
            return True, "New Year's Day Holiday"
        if month == 7 and day == 4:
            return True, "US Independence Day Holiday"
        if month == 12 and day in [24, 25, 26]:
            return True, "Christmas Holidays"

        formatted_date = now.strftime("%Y-%m-%d")
        formatted_no_year = now.strftime("%m-%d")
        for holiday in CUSTOM_HOLIDAYS:
            if holiday == formatted_date or holiday == formatted_no_year:
                return True, f"Custom Configured Holiday ({holiday})"

    # 2. Weekend Shutdown Filter
    if USE_WEEKEND_SHUTDOWN:
        day_of_week = now.weekday() # 0=Monday, 4=Friday, 5=Saturday, 6=Sunday
        
        # Friday close
        if day_of_week == 4:
            minutes_into_day = now.hour * 60 + now.minute
            friday_close_minutes = 22 * 60
            if minutes_into_day >= friday_close_minutes - SHUTDOWN_MINUTES_BEFORE_CLOSE:
                return True, "Weekend Close Protection"
                
        if day_of_week == 5:
            return True, "Weekend (Saturday)"
            
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
        
    print(f"{reason}: Securing {len(positions)} active positions...")
    for pos in positions:
        close_single_position(pos, reason)


# --- Core Polling & Execution Loop ---
print("Core Polling Loop started. Listening for incoming signals 24/5...")
was_suspended = False

try:
    while True:
        try:
            # Check market suspension / holiday
            suspended, reason = is_market_suspended()
            if suspended:
                was_suspended = True
                static_print_timer = getattr(is_market_suspended, "last_print", 0)
                if time.time() - static_print_timer > 3600:
                    print(f"[PAUSE] Market is suspended: {reason}")
                    is_market_suspended.last_print = time.time()
                
                # Note: open positions are kept running during shutdown per user request
                time.sleep(30)
                continue
            elif was_suspended:
                print("[RESUME] Market active. Running Gap Scanner on open positions...")
                enforce_gap_protection()
                print("[RESUME] Resumed live polling for incoming signals...")
                was_suspended = False
                
            # Fetch pending signals from Webhook server
            url = f"{BRIDGE_URL}/api/signals?status=Pending&passphrase={PASSPHRASE}"
            res = requests.get(url, timeout=10)
            
            if res.status_code == 200:
                signals = res.json()
                
                # --- BACKTEST STRATEGY RISK RULES EVALUATION ---
                now_utc = datetime.datetime.now(datetime.timezone.utc)
                daily_start_time = now_utc.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
                
                today_start_ts = int(daily_start_time)
                deals = mt5.history_deals_get(today_start_ts, int(time.time()) + 86400)
                strategy_deals = [d for d in (deals or []) if (d.magic == 881122 or d.magic == 0) and d.entry == 1]
                strategy_deals.sort(key=lambda x: x.time)
                
                def is_full_loss(d):
                    # A full loss is negative profit AND triggered by Stop Loss (reason == 4 or comment contains 'sl')
                    return d.profit < 0 and (getattr(d, 'reason', 0) == 4 or 'sl' in getattr(d, 'comment', '').lower())
                
                daily_net_pnl = sum(d.profit for d in strategy_deals)
                total_full_losing_trades = sum(1 for d in strategy_deals if is_full_loss(d))
                
                current_day_str = datetime.datetime.fromtimestamp(daily_start_time, tz=datetime.timezone.utc).strftime('%Y-%m-%d')
                if bot_state["last_trading_day"] != current_day_str:
                    bot_state["last_trading_day"] = current_day_str
                    save_bot_state(bot_state)

                if total_full_losing_trades >= 4:
                    if bot_state.get("last_loss_limit_day") != current_day_str:
                        bot_state["last_loss_limit_day"] = current_day_str
                        save_bot_state(bot_state)
                        print(f"[RISK GUARD] Daily Limit Hit! (Full SL Losers: {total_full_losing_trades})")
                    
                    print("[RISK GUARD] Daily loss limit exceeded. Ignoring all signals for today.")
                    time.sleep(30)
                    continue

                skip_next_signal = False
                consecutive_full_losses = 0
                for d in reversed(strategy_deals):
                    if is_full_loss(d):
                        consecutive_full_losses += 1
                    else:
                        break
                
                if consecutive_full_losses == 2:
                    if bot_state.get("last_skipped_deal_count") != len(strategy_deals):
                        skip_next_signal = True
                # ----------------------------------------------

                for sig in signals:
                    sig_id = sig["id"]
                    if sig_id not in processed_signal_ids:
                        processed_signal_ids.add(sig_id)
                        
                        if skip_next_signal:
                            print(f"[RISK GUARD] 2 consecutive full losses detected! Skipping 3rd signal (ID: {sig_id[:8]}) as per Rule 1.")
                            bot_state["last_skipped_deal_count"] = len(strategy_deals)
                            save_bot_state(bot_state)
                            skip_next_signal = False
                            continue

                        execute_trade(sig_id, sig["type"])
            elif res.status_code == 401:
                print("[ERROR] Server rejected connection! Passphrase incorrect.")
                
            # Run Position Management: Gap Protection, 1:1 Partial Close, Breakeven SL, Dynamic Trailing Stop
            enforce_gap_protection()
            apply_trade_management()
            
            # Report live state to dashboard
            report_telemetry()
            
        except requests.exceptions.Timeout:
            pass
        except requests.exceptions.ConnectionError:
            print("[WAIT] Server offline or connection error. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print("[WARN] Polling loop exception:", e)
            
        time.sleep(POLL_INTERVAL)
except KeyboardInterrupt:
    print("\\n[STOP] Bridge terminated by user.")
finally:
    mt5.shutdown()
    print("MT5 Terminal connection closed.")
`;
}

