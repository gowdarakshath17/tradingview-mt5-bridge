export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  approved: boolean;
  maxAccounts: number;
  isAdmin: boolean;
  role?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  passphrase?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Signal {
  id: string;
  timestamp: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  price: number;
  sl: number;
  tp: number;
  lotSize: number;
  source: 'TradingView' | 'Simulator';
  status: 'Pending' | 'Executed' | 'Failed';
  executedAt?: string;
  executedPrice?: number;
  executionDetails?: string;
  accountBalanceUsed?: number;
}

export interface BridgeConfig {
  passphrase: string;
  riskPercent: number;
  stopLossPoints: number;
  riskRewardRatio?: number; // e.g. 2 for 1:2 R:R
  takeProfitPoints: number;
  contractSize: number; // e.g. 100 for gold
  lotSizingMode: 'DynamicRisk' | 'DynamicStopLoss' | 'FixedLot';
  fixedLotSize: number;
  
  // Multi-Account Routing
  routedAccounts?: string[];
  routeMode?: 'All' | 'RoundRobin' | 'BalanceWeighted';

  // Advanced Risk Management
  maxDailyDrawdownPct?: number;
  maxTotalDrawdownPct?: number;
  maxOpenTrades?: number;
  consecutiveLossLimit?: number;
  pauseAfterConsecutiveLossesMins?: number;
  equityProtectionEnabled?: boolean;
  equityProtectionThreshold?: number;
  newsFilterEnabled?: boolean;
  newsMinutesBefore?: number;
  newsMinutesAfter?: number;

  // Data Feed Sync & Execution
  executionMode?: 'Market' | 'Limit' | 'Stop';
  slTpCalculation?: 'Absolute' | 'DistanceBased';
  maxAllowedSlippagePoints?: number;

  // Dynamic profit/risk controls
  holdTillCounterDirection?: boolean;
  dynamicTrailingStop?: boolean;
  trailingActivationPoints?: number;
  trailingStepPoints?: number;
  profitLockPercentage?: number;
  // Weekend & Holiday safety settings
  weekendShutdownEnabled?: boolean;
  shutdownMinutesBeforeClose?: number;
  holidayFilterEnabled?: boolean;
  // Daily Rollover / Gap Up Protection
  dailyShutdownEnabled?: boolean;
  dailyShutdownHour?: number;
  dailyShutdownMinute?: number;
  dailyShutdownDurationMins?: number;
  // Custom user-defined holidays list
  customHolidays?: string[];
  // Daily profit goal visual indicator target
  dailyProfitGoal?: number;
  // Webhook security enhancements
  webhookSecretToken?: string;
  ipWhitelistingEnabled?: boolean;
  allowedIps?: string;
}

export interface Trade {
  id: number;
  direction: 'BUY' | 'SELL';
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  points: number;
  result: 'WIN' | 'LOSS' | 'BE';
}

export interface DashboardState {
  signals: Signal[];
  config: BridgeConfig;
  mockBalance: number;
  activeTab: 'dashboard' | 'setup' | 'calculator' | 'backtest';
}

export interface FundedAccount {
  id: string;
  propFirm: string;
  accountType: 'Evaluation' | 'Funded' | 'Express' | 'Stellar';
  accountSize: number;
  accountNumber: string;
  mt5Login: string;
  mt5Server: string;
  status: 'Pending' | 'Authorized' | 'Disconnected' | 'Failed';
  authorizedAt?: string;
  rules?: {
    dailyLimit: number;
    maxLimit: number;
    profitTarget: number;
    leverage: string;
    explanation?: string;
  };
}
