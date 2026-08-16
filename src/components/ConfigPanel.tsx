import { useState, useEffect, useRef, FormEvent } from 'react';
import { Settings, Shield, Percent, Crosshair, HelpCircle, Save, Loader2, Check, Zap, Sliders, Calendar, Clock, AlertTriangle, Plus, Trash2, X, DollarSign, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BridgeConfig } from '../types';

interface ConfigPanelProps {
  config: BridgeConfig;
  onUpdateConfig: (newConfig: BridgeConfig) => Promise<boolean>;
}

export default function ConfigPanel({ config, onUpdateConfig }: ConfigPanelProps) {
  const [passphrase, setPassphrase] = useState(config.passphrase);
  const [riskPercent, setRiskPercent] = useState(config.riskPercent);
  const [stopLossPoints, setStopLossPoints] = useState(config.stopLossPoints);
  const [takeProfitPoints, setTakeProfitPoints] = useState(config.takeProfitPoints);
  const [riskRewardRatio, setRiskRewardRatio] = useState(config.riskRewardRatio || 2.0);
  const [lotSizingMode, setLotSizingMode] = useState<"DynamicRisk" | "DynamicStopLoss" | "FixedLot">(config.lotSizingMode);
  const [fixedLotSize, setFixedLotSize] = useState(config.fixedLotSize);
  const [contractSize, setContractSize] = useState(config.contractSize || 100);
  const [dailyProfitGoal, setDailyProfitGoal] = useState(config.dailyProfitGoal || 500);
  
  // Dynamic Stop Loss and Profit Locking states
  const [holdTillCounterDirection, setHoldTillCounterDirection] = useState(config.holdTillCounterDirection || false);
  const [dynamicTrailingStop, setDynamicTrailingStop] = useState(config.dynamicTrailingStop || false);
  const [trailingActivationPoints, setTrailingActivationPoints] = useState(config.trailingActivationPoints || 10.0);
  const [trailingStepPoints, setTrailingStepPoints] = useState(config.trailingStepPoints || 2.0);
  const [profitLockPercentage, setProfitLockPercentage] = useState(config.profitLockPercentage || 50);

  // Weekend & Holiday safety settings
  const [weekendShutdownEnabled, setWeekendShutdownEnabled] = useState(config.weekendShutdownEnabled ?? true);
  const [shutdownMinutesBeforeClose, setShutdownMinutesBeforeClose] = useState(config.shutdownMinutesBeforeClose ?? 15);
  const [holidayFilterEnabled, setHolidayFilterEnabled] = useState(config.holidayFilterEnabled ?? true);

  // Daily Rollover Gap Protection settings
  const [dailyShutdownEnabled, setDailyShutdownEnabled] = useState(config.dailyShutdownEnabled ?? true);
  const [dailyShutdownHour, setDailyShutdownHour] = useState(config.dailyShutdownHour ?? 21);
  const [dailyShutdownMinute, setDailyShutdownMinute] = useState(config.dailyShutdownMinute ?? 45);
  const [dailyShutdownDurationMins, setDailyShutdownDurationMins] = useState(config.dailyShutdownDurationMins ?? 30);

  // Custom Holiday management states
  const [customHolidays, setCustomHolidays] = useState<string[]>(config.customHolidays || []);
  const [newHolidayInput, setNewHolidayInput] = useState('');

  // Advanced Webhook Security states
  const [webhookSecretToken, setWebhookSecretToken] = useState(config.webhookSecretToken || '');
  const [ipWhitelistingEnabled, setIpWhitelistingEnabled] = useState(config.ipWhitelistingEnabled ?? false);
  const [allowedIps, setAllowedIps] = useState(config.allowedIps || '');

  // Multi-Account Routing states
  const [routedAccountsInput, setRoutedAccountsInput] = useState(config.routedAccounts?.join(', ') || '');
  const [routeMode, setRouteMode] = useState<"All" | "RoundRobin" | "BalanceWeighted">(config.routeMode || 'All');

  // Advanced Risk Management states
  const [maxDailyDrawdownPct, setMaxDailyDrawdownPct] = useState(config.maxDailyDrawdownPct || 4);
  const [maxTotalDrawdownPct, setMaxTotalDrawdownPct] = useState(config.maxTotalDrawdownPct || 8);
  const [maxOpenTrades, setMaxOpenTrades] = useState(config.maxOpenTrades || 1);
  const [consecutiveLossLimit, setConsecutiveLossLimit] = useState(config.consecutiveLossLimit || 3);
  const [pauseAfterConsecutiveLossesMins, setPauseAfterConsecutiveLossesMins] = useState(config.pauseAfterConsecutiveLossesMins || 60);
  const [equityProtectionEnabled, setEquityProtectionEnabled] = useState(config.equityProtectionEnabled || false);
  const [equityProtectionThreshold, setEquityProtectionThreshold] = useState(config.equityProtectionThreshold || 1000);
  const [newsFilterEnabled, setNewsFilterEnabled] = useState(config.newsFilterEnabled || false);
  const [newsMinutesBefore, setNewsMinutesBefore] = useState(config.newsMinutesBefore || 15);
  const [newsMinutesAfter, setNewsMinutesAfter] = useState(config.newsMinutesAfter || 15);

  // Data Feed Sync & Execution states
  const [executionMode, setExecutionMode] = useState<"Market" | "Limit" | "Stop">(config.executionMode || 'Market');
  const [slTpCalculation, setSlTpCalculation] = useState<"Absolute" | "DistanceBased">(config.slTpCalculation || 'DistanceBased');
  const [maxAllowedSlippagePoints, setMaxAllowedSlippagePoints] = useState(config.maxAllowedSlippagePoints || 50);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savingPassphrase, setSavingPassphrase] = useState(false);
  const [passphraseSaved, setPassphraseSaved] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const handleCopyTradingViewPayload = () => {
    const samplePayload = JSON.stringify({
      passphrase: passphrase || 'your_key',
      ticker: 'XAUUSD',
      action: 'BUY',
      volume: 0.10,
      sl: 2650.00,
      tp: 2700.00,
      comment: 'Gold Bridge Signal'
    }, null, 2);

    navigator.clipboard.writeText(samplePayload);
    setCopiedPayload(true);
    toast.success('TradingView JSON alert message copied to clipboard!');
    setTimeout(() => setCopiedPayload(false), 3000);
  };

  const handleSavePassphraseOnly = async () => {
    if (!passphrase || !passphrase.trim()) {
      toast.error('Passphrase cannot be empty');
      return;
    }
    setSavingPassphrase(true);
    setPassphraseSaved(false);

    const updatedConfig: BridgeConfig = {
      ...config,
      passphrase: passphrase.trim(),
      contractSize: Number(contractSize),
      riskPercent: Number(riskPercent),
      stopLossPoints: Number(stopLossPoints),
      takeProfitPoints: Number(takeProfitPoints),
      riskRewardRatio: Number(riskRewardRatio),
      lotSizingMode,
      fixedLotSize: Number(fixedLotSize),
      dailyProfitGoal: Number(dailyProfitGoal),
      holdTillCounterDirection,
      dynamicTrailingStop,
      trailingActivationPoints: Number(trailingActivationPoints),
      trailingStepPoints: Number(trailingStepPoints),
      profitLockPercentage: Number(profitLockPercentage),
      weekendShutdownEnabled,
      shutdownMinutesBeforeClose: Number(shutdownMinutesBeforeClose),
      holidayFilterEnabled,
      dailyShutdownEnabled,
      dailyShutdownHour: Number(dailyShutdownHour),
      dailyShutdownMinute: Number(dailyShutdownMinute),
      dailyShutdownDurationMins: Number(dailyShutdownDurationMins),
      customHolidays,
      webhookSecretToken,
      ipWhitelistingEnabled,
      allowedIps,
      routedAccounts: routedAccountsInput.split(',').map(s => s.trim()).filter(Boolean),
      routeMode,
      maxDailyDrawdownPct: Number(maxDailyDrawdownPct),
      maxTotalDrawdownPct: Number(maxTotalDrawdownPct),
      maxOpenTrades: Number(maxOpenTrades),
      consecutiveLossLimit: Number(consecutiveLossLimit),
      pauseAfterConsecutiveLossesMins: Number(pauseAfterConsecutiveLossesMins),
      equityProtectionEnabled,
      equityProtectionThreshold: Number(equityProtectionThreshold),
      newsFilterEnabled,
      newsMinutesBefore: Number(newsMinutesBefore),
      newsMinutesAfter: Number(newsMinutesAfter),
      executionMode,
      slTpCalculation,
      maxAllowedSlippagePoints: Number(maxAllowedSlippagePoints),
    };

    const isSuccessful = await onUpdateConfig(updatedConfig);
    setSavingPassphrase(false);
    if (isSuccessful) {
      toast.success('Security passphrase saved successfully!');
      setPassphraseSaved(true);
      setTimeout(() => setPassphraseSaved(false), 3000);
    } else {
      toast.error('Failed to save passphrase');
    }
  };

  // Store reference to the last parent config we synchronized with
  const lastParentConfigRef = useRef<BridgeConfig>(config);

  // Auto-enable Trailing Stop when Hold Till Counter is activated and a profit lock > 0 is selected
  useEffect(() => {
    if (holdTillCounterDirection && profitLockPercentage > 0) {
      setDynamicTrailingStop(true);
      
      // Usually Profit Lock happens at 1:1 risk/reward. To trail AFTER profit lock,
      // the trailing activation should be equal to the SL points distance.
      if (lotSizingMode !== 'DynamicStopLoss') {
        setTrailingActivationPoints(stopLossPoints);
      }
    }
  }, [holdTillCounterDirection, profitLockPercentage, lotSizingMode, stopLossPoints]);

  // Synchronize when parent config changes
  useEffect(() => {
    // Check if the config has actually changed from the last parent config we synchronized with
    const hasChanged = JSON.stringify(config) !== JSON.stringify(lastParentConfigRef.current);
    if (hasChanged) {
      setPassphrase(config.passphrase);
      setRiskPercent(config.riskPercent);
      setStopLossPoints(config.stopLossPoints);
      setTakeProfitPoints(config.takeProfitPoints);
      setRiskRewardRatio(config.riskRewardRatio || 2.0);
      setLotSizingMode(config.lotSizingMode);
      setFixedLotSize(config.fixedLotSize);
      setHoldTillCounterDirection(config.holdTillCounterDirection || false);
      setDynamicTrailingStop(config.dynamicTrailingStop || false);
      setTrailingActivationPoints(config.trailingActivationPoints || 10.0);
      setTrailingStepPoints(config.trailingStepPoints || 2.0);
      setProfitLockPercentage(config.profitLockPercentage || 50);
      setWeekendShutdownEnabled(config.weekendShutdownEnabled ?? true);
      setShutdownMinutesBeforeClose(config.shutdownMinutesBeforeClose ?? 15);
      setHolidayFilterEnabled(config.holidayFilterEnabled ?? true);
      setDailyShutdownEnabled(config.dailyShutdownEnabled ?? true);
      setDailyShutdownHour(config.dailyShutdownHour ?? 21);
      setDailyShutdownMinute(config.dailyShutdownMinute ?? 45);
      setDailyShutdownDurationMins(config.dailyShutdownDurationMins ?? 30);
      setCustomHolidays(config.customHolidays || []);
      setDailyProfitGoal(config.dailyProfitGoal || 500);
      setWebhookSecretToken(config.webhookSecretToken || '');
      setIpWhitelistingEnabled(config.ipWhitelistingEnabled ?? false);
      setAllowedIps(config.allowedIps || '');
      
      setRoutedAccountsInput(config.routedAccounts?.join(', ') || '');
      setRouteMode(config.routeMode || 'All');
      setMaxDailyDrawdownPct(config.maxDailyDrawdownPct || 5);
      setMaxTotalDrawdownPct(config.maxTotalDrawdownPct || 10);
      setMaxOpenTrades(config.maxOpenTrades || 5);
      setConsecutiveLossLimit(config.consecutiveLossLimit || 3);
      setPauseAfterConsecutiveLossesMins(config.pauseAfterConsecutiveLossesMins || 60);
      setEquityProtectionEnabled(config.equityProtectionEnabled || false);
      setEquityProtectionThreshold(config.equityProtectionThreshold || 1000);
      setNewsFilterEnabled(config.newsFilterEnabled || false);
      setNewsMinutesBefore(config.newsMinutesBefore || 15);
      setNewsMinutesAfter(config.newsMinutesAfter || 15);
      
      setExecutionMode(config.executionMode || 'Market');
      setSlTpCalculation(config.slTpCalculation || 'DistanceBased');
      setMaxAllowedSlippagePoints(config.maxAllowedSlippagePoints || 50);
      
      lastParentConfigRef.current = config;
    }
  }, [config]);

  const handleAddHoliday = (dateStr: string) => {
    if (!dateStr) return;
    const trimmed = dateStr.trim();
    // Validate format slightly (YYYY-MM-DD or MM-DD)
    if (!customHolidays.includes(trimmed)) {
      setCustomHolidays([...customHolidays, trimmed]);
    }
    setNewHolidayInput('');
  };

  const handleRemoveHoliday = (holiday: string) => {
    setCustomHolidays(customHolidays.filter(h => h !== holiday));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const updatedConfig: BridgeConfig = {
      passphrase,
      contractSize: Number(contractSize),
      riskPercent: Number(riskPercent),
      stopLossPoints: Number(stopLossPoints),
      takeProfitPoints: Number(takeProfitPoints),
      riskRewardRatio: Number(riskRewardRatio),
      lotSizingMode,
      fixedLotSize: Number(fixedLotSize),
      holdTillCounterDirection,
      dynamicTrailingStop,
      trailingActivationPoints: Number(trailingActivationPoints),
      trailingStepPoints: Number(trailingStepPoints),
      profitLockPercentage: Number(profitLockPercentage),
      weekendShutdownEnabled,
      shutdownMinutesBeforeClose: Number(shutdownMinutesBeforeClose),
      holidayFilterEnabled,
      dailyShutdownEnabled,
      dailyShutdownHour: Number(dailyShutdownHour),
      dailyShutdownMinute: Number(dailyShutdownMinute),
      dailyShutdownDurationMins: Number(dailyShutdownDurationMins),
      customHolidays,
      dailyProfitGoal: Number(dailyProfitGoal),
      webhookSecretToken,
      ipWhitelistingEnabled,
      allowedIps,
      routedAccounts: routedAccountsInput.split(',').map(a => a.trim()).filter(Boolean),
      routeMode,
      maxDailyDrawdownPct: Number(maxDailyDrawdownPct),
      maxTotalDrawdownPct: Number(maxTotalDrawdownPct),
      maxOpenTrades: Number(maxOpenTrades),
      consecutiveLossLimit: Number(consecutiveLossLimit),
      pauseAfterConsecutiveLossesMins: Number(pauseAfterConsecutiveLossesMins),
      equityProtectionEnabled,
      equityProtectionThreshold: Number(equityProtectionThreshold),
      newsFilterEnabled,
      newsMinutesBefore: Number(newsMinutesBefore),
      newsMinutesAfter: Number(newsMinutesAfter),
      executionMode,
      slTpCalculation,
      maxAllowedSlippagePoints: Number(maxAllowedSlippagePoints),
    };

    const isSuccessful = await onUpdateConfig(updatedConfig);
    setSaving(false);
    if (isSuccessful) {
      toast.success('Configuration saved successfully!');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      toast.error('Failed to save configuration');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
        <div className="p-2 bg-white text-blue-600 rounded-lg border border-slate-200">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-slate-900">Bridge Parameter Control</h3>
          <p className="text-xs text-slate-400">Tune the automation engine rules and risk formulas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Webhook Security Passphrase */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Security Passphrase
              </label>
              {passphrase !== config.passphrase && (
                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type={showPassphrase ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="Enter secure webhook key"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  title={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSavePassphraseOnly}
                disabled={savingPassphrase}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold font-sans transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
                  passphraseSaved
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {savingPassphrase ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : passphraseSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Passphrase Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Passphrase</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Required in TradingView JSON payloads as <code className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-blue-600">"passphrase": "{passphrase || 'your_key'}"</code>.
              </p>
              <button
                type="button"
                onClick={handleCopyTradingViewPayload}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer transition-all"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPayload ? 'Copied Alert Payload!' : 'Copy Sample TradingView JSON'}</span>
              </button>
            </div>
          </div>

          {/* Advanced Security Enhancements */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="md:col-span-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                Advanced Webhook Verification
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Harden your endpoint against malicious spoofing or port scans</span>
            </div>

            {/* Secret URL Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                URL Query Token / Header Secret
              </label>
              <input
                type="text"
                value={webhookSecretToken}
                onChange={(e) => setWebhookSecretToken(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="e.g. secret_token_123"
              />
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                If set, alerts must include query parameter <code className="font-mono bg-slate-100 border border-slate-200 px-1 rounded text-blue-600">?secret=YOUR_TOKEN</code> or custom header <code className="font-mono bg-slate-100 border border-slate-200 px-1 rounded text-blue-600">X-Webhook-Secret</code>.
              </p>
            </div>

            {/* IP Whitelisting */}
            <div className="flex flex-col justify-between">
              <div>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-2 mb-1.5">
                  <input
                    type="checkbox"
                    checked={ipWhitelistingEnabled}
                    onChange={(e) => setIpWhitelistingEnabled(e.target.checked)}
                    className="rounded border-slate-200 text-blue-600 focus:ring-blue-600 h-3.5 w-3.5"
                  />
                  Enable IP Whitelisting
                </label>
                <input
                  type="text"
                  value={allowedIps}
                  onChange={(e) => setAllowedIps(e.target.value)}
                  disabled={!ipWhitelistingEnabled}
                  className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors ${
                    !ipWhitelistingEnabled ? 'opacity-50 bg-slate-100 cursor-not-allowed' : ''
                  }`}
                  placeholder="e.g. 52.89.214.238, 34.212.75.1"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Restricts webhook access to a list of comma-separated IP addresses.
              </p>
            </div>
          </div>

          {/* Sizing Mode Selection */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Lot Sizing Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setLotSizingMode(lotSizingMode === 'FixedLot' ? 'DynamicRisk' : lotSizingMode)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  (lotSizingMode === 'DynamicRisk' || lotSizingMode === 'DynamicStopLoss')
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }`}
              >
                <span className="block font-semibold text-sm">Dynamic Risk Formula</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Auto-calculates position parameters based on risk % and account balance.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLotSizingMode("FixedLot")}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  lotSizingMode === 'FixedLot'
                    ? 'border-blue-600 bg-blue-700/10 text-slate-900 shadow-lg shadow-blue-600/5'
                    : 'border-slate-200 hover:border-slate-200/30 text-slate-400 bg-white'
                }`}
              >
                <span className="block font-semibold text-sm">Fixed Volume</span>
                <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                  Executes a static lot size every time, ignoring risk calculations.
                </span>
              </button>
            </div>
          </div>

          {/* Sizing Parameters based on Mode */}
          {lotSizingMode === 'DynamicRisk' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                Risk Percentage per Trade
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                  required
                />
                <span className="absolute right-3 top-3.5 text-slate-400 font-mono text-xs">%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">1.0% - 2.0%</span>. Sizes lot automatically using MT5 account balance.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Fixed Lot Size (Volume)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={fixedLotSize}
                onChange={(e) => setFixedLotSize(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Executes exactly this lot volume (e.g. <span className="font-semibold text-slate-400">0.10 lots</span> is 10 ounces of Gold).
              </p>
            </div>
          )}

          {/* Stop Loss (Points) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-blue-600" />
              Stop Loss Points (SL)
            </label>
            <input
              type="number"
              min="1"
              value={stopLossPoints}
              onChange={(e) => setStopLossPoints(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Recommended: <span className="font-semibold text-slate-400">10.0</span>. Point distance. On standard Gold, 10.0 points is a $10.00 price move.
            </p>
          </div>

          {lotSizingMode === 'DynamicStopLoss' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Risk:Reward Ratio
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={riskRewardRatio}
                onChange={(e) => setRiskRewardRatio(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">2.0</span>. Multiplies the dynamically calculated SL by this ratio to set the TP distance.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                Take Profit Points (TP)
              </label>
              <input
                type="number"
                min="1"
                value={takeProfitPoints}
                onChange={(e) => setTakeProfitPoints(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Recommended: <span className="font-semibold text-slate-400">20.0</span>. Represents a 2:1 risk-to-reward ratio for a 10-point Stop Loss.
              </p>
            </div>
          )}

          {/* Daily Profit Goal ($) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
              Daily Profit Goal ($)
            </label>
            <input
              type="number"
              min="10"
              step="10"
              value={dailyProfitGoal}
              onChange={(e) => setDailyProfitGoal(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Target daily dollar profit (e.g., <span className="font-semibold text-slate-400">$500</span>). Tracks your real-time progress bar on the dashboard.
            </p>
          </div>
        </div>

        {/* Dynamic Profit Control & Advanced Risk Management Section */}
        {/* Data Feed Sync & Execution Mode */}
        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 font-display">Data Feed Sync & Execution Mode</h4>
              <p className="text-xs text-slate-400">Handle price discrepancies between TradingView and your Broker's MT5 feed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/30 border border-slate-200 p-5 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                Order Execution
              </label>
              <select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="Market">Market Execution</option>
                <option value="Limit">Limit Order</option>
                <option value="Stop">Stop Order</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Use <span className="font-medium text-slate-900">Market Execution</span> to ensure instant fill regardless of minor price differences.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                SL/TP Calculation Method
              </label>
              <select
                value={slTpCalculation}
                onChange={(e) => setSlTpCalculation(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="DistanceBased">Distance-Based (Recommended)</option>
                <option value="Absolute">Absolute Price Matching</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                <span className="font-medium text-slate-900">Distance-Based</span> calculates SL/TP pips relative to actual MT5 fill price, preventing rejection.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                Max Slippage (Points)
              </label>
              <input
                type="number"
                min="0"
                value={maxAllowedSlippagePoints}
                onChange={(e) => setMaxAllowedSlippagePoints(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Maximum allowed point difference between TradingView signal price and MT5 market price before rejecting trade.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 font-display">Dynamic Profit & Advanced Risk Control</h4>
              <p className="text-xs text-slate-400">Lock in profits, automate trailing stops, and hold trades till counter directions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/30 border border-slate-200 p-5 rounded-xl">
            {/* Hold till Counter Direction Toggle */}
            <div className="flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                  Hold Till Counter Signal
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Hold positions active until the opposite trend signal fires (e.g. close BUY and reverse only when a SELL signal is received).
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={holdTillCounterDirection}
                  onChange={(e) => setHoldTillCounterDirection(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            {/* Dynamic Trailing Stop-Loss Toggle */}
            <div className="flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                  Dynamic Trailing Stop
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Activate automatic trailing protection which secures realized gains by rolling the stop-loss behind price advances.
                  {(holdTillCounterDirection && profitLockPercentage > 0) && (
                    <span className="block mt-1 text-blue-600 font-semibold">
                      Auto-activated: Tied to {profitLockPercentage}% Profit Lock volume target.
                    </span>
                  )}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dynamicTrailingStop || (holdTillCounterDirection && profitLockPercentage > 0)}
                  onChange={(e) => setDynamicTrailingStop(e.target.checked)}
                  disabled={holdTillCounterDirection && profitLockPercentage > 0}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            {/* Trailing Parameters (Show only if Trailing Stop is enabled) */}
            {dynamicTrailingStop && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 animate-fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    Trailing Trigger (Points)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={trailingActivationPoints}
                    onChange={(e) => setTrailingActivationPoints(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Activate the trailing engine once the trade gains <span className="text-slate-400 font-mono font-medium">{trailingActivationPoints} points</span>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    Trailing Step distance (Points)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={trailingStepPoints}
                    onChange={(e) => setTrailingStepPoints(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Distance to lock stop loss behind the high-water price of the trade (e.g. <span className="text-slate-400 font-mono font-medium">{trailingStepPoints} points</span>).
                  </p>
                </div>
              </div>
            )}

            {/* Profit Lock Percentage Dropdown */}
            <div className="md:col-span-2 bg-white/40 border border-slate-200/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                  Partial Profit Lock Volume (%)
                </span>
                <span className="block text-[11px] text-slate-400 leading-normal max-w-md">
                  When trade hits 1:1 risk-to-reward ratio, automatically close this portion of the lot size to secure profits while letting the rest run.
                </span>
              </div>
              <div className="w-full sm:w-44 shrink-0">
                <select
                  value={profitLockPercentage}
                  onChange={(e) => setProfitLockPercentage(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors cursor-pointer"
                >
                  <option value="0">No Profit Lock (0%)</option>
                  <option value="25">Lock 25% of Volume</option>
                  <option value="50">Lock 50% of Volume</option>
                  <option value="75">Lock 75% of Volume</option>
                  <option value="90">Lock 90% of Volume</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* VPS Continuous Operation, Weekend & Holiday Safety Controls */}
        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 font-display">VPS Automation, Weekend & Holiday Protection</h4>
              <p className="text-xs text-slate-400">Enable safety filters for 24/7 VPS execution to pause trading and close positions during market gaps</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/30 border border-slate-200 p-5 rounded-xl">
            {/* Weekend Shutdown Toggle */}
            <div className="flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Auto-Exit Before Weekend Close
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Safely close active trades before Friday close and ignore/pause new incoming signals. Prevents high weekend gap risk.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={weekendShutdownEnabled}
                  onChange={(e) => setWeekendShutdownEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            {/* Global Holiday Filter Toggle */}
            <div className="flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Global Holiday Filter
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Identify major holidays (Christmas, New Year's, Good Friday, etc.). Pauses VPS trading automatically to avoid extreme low-liquidity spikes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={holidayFilterEnabled}
                  onChange={(e) => setHolidayFilterEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            {/* Daily Rollover Gap Protection Toggle */}
            <div className="flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Daily Rollover / Gap Protection
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Automatically close active positions and pause trading before the daily market rollover gap / maintenance hour to protect against extreme spread spikes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dailyShutdownEnabled}
                  onChange={(e) => setDailyShutdownEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>

            {/* Daily Rollover Gap inputs (Show only if Daily Shutdown is enabled) */}
            {dailyShutdownEnabled && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white/40 border border-slate-200/40 rounded-xl animate-fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Shutdown Time Hour (UTC)
                  </label>
                  <select
                    value={dailyShutdownHour}
                    onChange={(e) => setDailyShutdownHour(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00 UTC (EST {(i >= 5 ? i - 5 : i + 19).toString().padStart(2, '0')}:00)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Shutdown Minute
                  </label>
                  <select
                    value={dailyShutdownMinute}
                    onChange={(e) => setDailyShutdownMinute(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                    Break Duration (Minutes)
                  </label>
                  <select
                    value={dailyShutdownDurationMins}
                    onChange={(e) => setDailyShutdownDurationMins(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
                  >
                    {[15, 30, 45, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>
                        {d} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Weekend Lead Time Buffer (Show only if Weekend Shutdown is enabled) */}
            {weekendShutdownEnabled && (
              <div className="md:col-span-2 bg-white/40 border border-slate-200/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                    Exit & Shutdown Buffer (Minutes before Friday close)
                  </span>
                  <span className="block text-[11px] text-slate-400 leading-normal max-w-md">
                    Execute a forced market-close command and suspend webhook signals this many minutes prior to Friday 17:00 EST / 22:00 UTC.
                  </span>
                </div>
                <div className="w-full sm:w-44 shrink-0">
                  <select
                    value={shutdownMinutesBeforeClose}
                    onChange={(e) => setShutdownMinutesBeforeClose(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
                  >
                    <option value="5">5 Minutes Before Close</option>
                    <option value="15">15 Minutes Before Close</option>
                    <option value="30">30 Minutes Before Close</option>
                    <option value="45">45 Minutes Before Close</option>
                    <option value="60">1 Hour Before Close</option>
                  </select>
                </div>
              </div>
            )}

            {/* Inline Custom No-Trade Days Scheduler */}
            {holidayFilterEnabled && (
              <div className="md:col-span-2 p-5 bg-white/60 border border-slate-200/60 rounded-xl space-y-4">
                <div className="flex items-start gap-4 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-white border border-blue-600/25 rounded-lg text-blue-600 shadow-sm shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                      Custom "No-Trade" Bank Holidays
                    </span>
                    <span className="block text-xs text-slate-400 leading-relaxed font-sans">
                      Add specific dates (e.g. major bank holidays, high-impact news days) to block signal execution and protect your MT5 terminal.
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                        Select No-Trade Date
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={newHolidayInput}
                          onChange={(e) => setNewHolidayInput(e.target.value)}
                          className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddHoliday(newHolidayInput)}
                          disabled={!newHolidayInput}
                          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-700 text-slate-900 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Date</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Dates List */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                      Scheduled Inactive Days ({customHolidays.length})
                    </span>
                    {customHolidays.length > 0 ? (
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                        {customHolidays.map((holiday) => (
                          <span key={holiday} className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 text-slate-900 font-mono text-[11px] px-3 py-1 rounded-lg shadow-sm">
                            <span>{holiday}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveHoliday(holiday)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                              title={`Remove ${holiday}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-400 italic">No custom bank holidays configured. Bridge will trade 24/5.</p>
                      </div>
                    )}
                  </div>

                  {/* Preset quick-add */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">
                      Quick-Add 2026 Bank Holiday Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: "New Year", date: "2026-01-01" },
                        { name: "Good Friday", date: "2026-04-03" },
                        { name: "Memorial Day", date: "2026-05-25" },
                        { name: "Labor Day", date: "2026-09-07" },
                        { name: "Thanksgiving", date: "2026-11-26" },
                        { name: "Christmas", date: "2026-12-25" }
                      ].map((preset) => {
                        const exists = customHolidays.includes(preset.date);
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => handleAddHoliday(preset.date)}
                            disabled={exists}
                            className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                              exists 
                                ? 'bg-slate-50 text-slate-400 border-slate-200/50 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm active:scale-95'
                            }`}
                          >
                            {preset.name} ({preset.date})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex gap-2 items-start p-3.5 bg-blue-600/5 border border-blue-600/10 rounded-xl text-xs text-blue-600/90 leading-relaxed font-sans">
              <AlertTriangle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">VPS Long-Term Execution Note:</span>
                These rules are applied both on this server and inside your generated MetaTrader EA. During weekend market shutdown or holidays, the VPS server automatically flags TradingView alert webhooks as <strong>Failed / Paused</strong> and keeps trading idle. It will automatically take a break, take no action, and resume fully on the next live-market Monday signal!
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Account Routing */}
        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 font-display">Multi-Account Routing</h4>
              <p className="text-xs text-slate-400">Distribute webhook signals across multiple MT5 instances and prop firms</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/30 border border-slate-200 p-5 rounded-xl">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Target Accounts (Comma-Separated MT5 Logins)
              </label>
              <input
                type="text"
                value={routedAccountsInput}
                onChange={(e) => setRoutedAccountsInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
                placeholder="e.g. 1002341, 5509123, 982312"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                Leave empty to run on the single MT5 terminal where the EA is attached. If you provide specific MT5 Logins, the bridge will route the signal only to those connected terminals.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Routing Mode
              </label>
              <select
                value={routeMode}
                onChange={(e) => setRouteMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
              >
                <option value="All">Duplicate to All (Trade Copier)</option>
                <option value="RoundRobin">Round-Robin (Distribute 1 signal per account sequentially)</option>
                <option value="BalanceWeighted">Balance Weighted (Adjust volume proportional to account sizes)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Risk Management Algorithm */}
        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 font-display">Advanced Risk Management Algorithm</h4>
              <p className="text-xs text-slate-400">Prop-firm tailored drawdown limits, equity protection, and consecutive loss safeguards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/30 border border-slate-200 p-5 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Max Daily Drawdown (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={maxDailyDrawdownPct}
                onChange={(e) => setMaxDailyDrawdownPct(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Max Total Drawdown (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={maxTotalDrawdownPct}
                onChange={(e) => setMaxTotalDrawdownPct(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Max Open Trades
                </label>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">Default: 1</span>
              </div>
              <input
                type="number"
                min="1"
                max="1"
                readOnly
                value={1}
                className="w-full px-4 py-2 bg-slate-100/70 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-1">Locked to 1 position max to strictly enforce single trade execution & counter-reversal.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Consecutive Loss Limit
              </label>
              <input
                type="number"
                min="0"
                value={consecutiveLossLimit}
                onChange={(e) => setConsecutiveLossLimit(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-200 transition-colors"
              />
            </div>

            {/* News Filter Toggle */}
            <div className="md:col-span-2 flex items-start justify-between p-4 bg-white/60 border border-slate-200/60 rounded-xl hover:border-blue-600/30 transition-colors mt-2">
              <div className="space-y-1 pr-4">
                <span className="block text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                  High-Impact News Filter
                </span>
                <span className="block text-[11px] text-slate-400 leading-relaxed">
                  Automatically pause signal execution before and after major macroeconomic events to prevent extreme volatility slippage.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newsFilterEnabled}
                  onChange={(e) => setNewsFilterEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-700 peer-checked:after:bg-white peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Parameters will immediately update generated code & formulas.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              success
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-blue-700 hover:bg-blue-600 text-white shadow-lg shadow-blue-600/20'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Rules...</span>
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                <span>Updated Successfully!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Parameters</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
