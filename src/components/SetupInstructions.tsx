import { useState } from 'react';
import { BookOpen, Copy, Check, Download, ExternalLink, Terminal, Cpu, FolderOpen, Sparkles, Info, Activity } from 'lucide-react';
import { BridgeConfig } from '../types';

interface SetupInstructionsProps {
  config: BridgeConfig;
}

export default function SetupInstructions({ config }: SetupInstructionsProps) {
  const [activeStepTab, setActiveStepTab] = useState<'tv' | 'mql5' | 'python'>('tv');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedPineScript, setCopiedPineScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedPathTip, setCopiedPathTip] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
  const [installError, setInstallError] = useState<string | null>(null);

  // Derive full URL dynamically
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url.run.app';
  const webhookUrl = `${appOrigin}/api/webhook`;

  const pineScriptCode = `//@version=5
indicator("MT5 Trailing Stop Bridge", overlay=true, explicit_plot_zorder=true)

// --- Inputs for custom parameters ---
AtrCoef    = input.float(4.0, title="ATR Coefficient (Sensitivity)")
AtrLen     = input.int(10, title="ATR Period")
passphrase = input.string("${config.passphrase}", title="Bridge Passphrase")
symbolName = input.string("XAUUSD", title="Symbol Name for MT5")

// --- ATR Calculation ---
atr = ta.atr(AtrLen)
loss = atr * AtrCoef

// --- Trailing Stop Series ---
C1 = 0.0
C1 := bar_index <= 1 ? close : na

if bar_index > 1
    C1_prev = nz(C1[1], close)
    t1 = close > C1_prev ? close - loss : close + loss
    t2 = close < C1_prev and close[1] < C1_prev ? math.min(C1_prev, close + loss) : t1
    C1 := close > C1_prev and close[1] > C1_prev ? math.max(C1_prev, close - loss) : t2

C1_prev_val = nz(C1[1], close)

// --- Signal Conditions ---
bullSignal = close > C1 and close[1] <= C1_prev_val
bearSignal = close < C1 and close[1] >= C1_prev_val

// --- State Tracking (Prevent Consecutive Same-Direction Signals) ---
var int currentPos = 0 // 1 for Long, -1 for Short

validBullSignal = bullSignal and currentPos != 1
validBearSignal = bearSignal and currentPos != -1

if validBullSignal
    currentPos := 1
if validBearSignal
    currentPos := -1

// --- Visual Chart Shapes ---
plotshape(validBullSignal, title="BUY Signal", style=shape.labelup, location=location.belowbar, color=color.rgb(0, 200, 120), text="BUY", textcolor=color.white, size=size.small)
plotshape(validBearSignal, title="SELL Signal", style=shape.labeldown, location=location.abovebar, color=color.rgb(255, 100, 120), text="SELL", textcolor=color.white, size=size.small)

// --- Plot Trailing Stop Line ---
plot(C1, title="Trailing Stop (C1)", color=close > C1 ? color.rgb(0, 200, 120) : color.rgb(255, 100, 120), linewidth=2, style=plot.style_stepline)

// --- Webhook Payload Automation ---
buyPayload  = '{"passphrase": "' + passphrase + '", "type": "BUY", "symbol": "' + symbolName + '", "price": ' + str.tostring(close) + '}'
sellPayload = '{"passphrase": "' + passphrase + '", "type": "SELL", "symbol": "' + symbolName + '", "price": ' + str.tostring(close) + '}'

// Trigger automated alerts on bar close
if validBullSignal
    alert(buyPayload, alert.freq_once_per_bar_close)

if validBearSignal
    alert(sellPayload, alert.freq_once_per_bar_close)`;

  const tradingviewPayload = `{
  "passphrase": "${config.passphrase}",
  "type": "BUY",
  "symbol": "XAUUSD",
  "price": "{{close}}"
}`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectInstall = async () => {
    setInstallStatus('installing');
    setInstallError(null);
    try {
      // 1. Fetch configured code from the backend
      const response = await fetch('/api/download/mql5');
      if (!response.ok) {
        throw new Error("Failed to fetch generated EA script from the server.");
      }
      const code = await response.text();

      // 2. Open Save File Picker directly to their disk
      if ('showSaveFilePicker' in window) {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: 'TV_Bridge_EA.mq5',
          types: [{
            description: 'MQL5 Source File (.mq5)',
            accept: {
              'text/plain': ['.mq5'],
            },
          }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(code);
        await writable.close();

        setInstallStatus('success');
        setTimeout(() => setInstallStatus('idle'), 5000);
      } else {
        // Fallback for browsers not supporting the File System Access API
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'TV_Bridge_EA.mq5';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setInstallStatus('success');
        setTimeout(() => setInstallStatus('idle'), 5000);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User canceled the dialog, reset peacefully
        setInstallStatus('idle');
      } else {
        console.error("Direct installation error:", err);
        setInstallStatus('error');
        setInstallError(err.message || "Failed to write file. Please download normally.");
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white text-blue-600 rounded-lg border border-slate-200">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-900">Connection & Setup Guide</h3>
            <p className="text-xs text-slate-400">Step-by-step instructions to link TradingView alerts to MT5</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white border border-slate-200 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveStepTab('tv')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeStepTab === 'tv'
                ? 'bg-blue-700/20 text-slate-900 border-blue-700/30 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            TradingView
          </button>
          <button
            onClick={() => setActiveStepTab('mql5')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeStepTab === 'mql5'
                ? 'bg-blue-700/20 text-slate-900 border-blue-700/30 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            MT5 Expert Advisor (EA)
          </button>
          <button
            onClick={() => setActiveStepTab('python')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
              activeStepTab === 'python'
                ? 'bg-blue-700/20 text-slate-900 border-blue-700/30 shadow-sm'
                : 'text-slate-400 border-transparent hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Python Bridge
          </button>
        </div>
      </div>

      {/* Webhook Endpoint Highlight */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-inner">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 font-mono">Your Personal Public Webhook URL</span>
        <div className="flex items-center gap-3 mt-1.5">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="w-full bg-black/30 border border-slate-200 px-3 py-2 rounded-lg text-xs font-mono text-slate-900 focus:outline-none"
          />
          <button
            onClick={() => copyToClipboard(webhookUrl, setCopiedWebhook)}
            className="shrink-0 bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-lg shadow-blue-600/10 min-w-24 justify-center"
          >
            {copiedWebhook ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          Paste this URL inside the <strong>"Webhook URL"</strong> field under the <strong>Notifications</strong> tab when setting up your TradingView indicator alert.
        </p>
      </div>

      {/* Price Alignment & Data Feed Sync Explanation */}
      <div className="bg-white/80 border border-blue-600/10 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600/10 text-blue-600 rounded-lg border border-blue-600/20 shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 animate-pulse text-blue-600" />
              TradingView vs. MT5 Price Feed & Spread Alignment
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              TradingView price feeds (usually supplied by OANDA, ICE, or FXCM) <strong>inherently differ</strong> from your specific MT5 broker's live spreads, liquidity pool, and pricing feeds. To ensure seamless and flawless order execution, our code is engineered with built-in auto-adjustments:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
          <div className="p-3 bg-black/10 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-600 font-mono block">
              1. Live On-Market Execution
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Instead of placing rigid limit orders at TradingView's incoming signal price, the MT5 EA/Python script executes a <strong>Market Order</strong> immediately at the broker's actual Bid/Ask tick, ensuring instant, 100% fill rates without delay.
            </p>
          </div>
          <div className="p-3 bg-black/10 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-600 font-mono block">
              2. Relative Risk Offsets
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Stop Loss and Take Profit levels are calculated as <strong>point offsets relative to your actual MT5 fill price</strong>, not the TradingView price. Your configured points (e.g. {config.stopLossPoints} SL) remain mathematically precise relative to execution.
            </p>
          </div>
          <div className="p-3 bg-black/10 rounded-lg border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-600 font-mono block">
              3. Slippage & Deviation Guards
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              The order send request contains an integrated <strong>slippage deviation limit</strong> (default 30 points) to protect your account against abnormal gaps, high spreads, or sudden volatility during high-impact economic news.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      {activeStepTab === 'tv' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2.5">1. Creating the TradingView Alert</h4>
            <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>Open your TradingView chart on <strong className="text-slate-700">OANDA:XAUUSD</strong>.</li>
              <li>Load your indicator giving the buy and sell signals.</li>
              <li>Click the <strong className="text-slate-700">Alert icon (Clock)</strong> on the top toolbar or press <kbd className="bg-black/30 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600 text-[10px]">Alt+A</kbd>.</li>
              <li>Set <strong className="text-slate-700">Condition</strong> to your custom indicator and select the Buy Signal option.</li>
              <li>Set <strong className="text-slate-700">Trigger</strong> to <span className="font-semibold text-slate-700">"Once Per Bar Close"</span> to avoid noisy/repainting triggers.</li>
            </ol>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2.5">2. Setting Up notifications</h4>
            <ul className="list-disc pl-5 text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>Navigate to the <strong className="text-slate-700">Notifications</strong> tab in the alert dialog.</li>
              <li>Check the box for <strong className="text-slate-700">Webhook URL</strong>.</li>
              <li>Paste your unique public bridge URL: <code className="bg-black/20 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-blue-600 select-all">{webhookUrl}</code>.</li>
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900">3. Setting the Webhook Message Payload</h4>
              <button
                onClick={() => copyToClipboard(tradingviewPayload, setCopiedPayload)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedPayload ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy JSON
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              In the <strong className="text-slate-700">Settings</strong> tab, paste the following JSON payload exactly inside the <strong className="text-slate-700">Message</strong> box. Replace <code className="font-mono bg-black/20 border border-slate-200 px-1 rounded text-blue-600">"BUY"</code> with <code className="font-mono bg-black/20 border border-slate-200 px-1 rounded text-blue-600">"SELL"</code> when setting up the Sell signal alert.
            </p>
            <pre className="bg-black/40 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-200">
              {tradingviewPayload}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900">4. Clean Pine Script v5 Indicator Code (No EMA Filter)</h4>
              <button
                onClick={() => copyToClipboard(pineScriptCode, setCopiedPineScript)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedPineScript ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied PineScript!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy PineScript
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Clean ATR Trailing Stop Pine Script v5 without EMA filter (triggers signals directly without filtering major buy/sell points):
            </p>
            <pre className="bg-black/40 text-blue-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-200 max-h-80 overflow-y-auto">
              {pineScriptCode}
            </pre>
          </div>
        </div>
      )}

      {activeStepTab === 'mql5' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">1. Allow MetaTrader 5 WebRequests</h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              By default, MetaTrader 5 blocks outgoing network queries to arbitrary servers. You must explicitly allow your terminal to communicate with your bridge server:
            </p>
            <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>Inside MetaTrader 5, click <strong className="text-slate-700">Tools</strong> in the top menu bar, and open <strong className="text-slate-700">Options</strong> (or press <kbd className="bg-black/30 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600 text-[10px]">Ctrl+O</kbd>).</li>
              <li>Navigate to the <strong className="text-slate-700">Expert Advisors</strong> tab.</li>
              <li>Check the box for <strong className="text-slate-700">"Allow WebRequest for listed URL:"</strong>.</li>
              <li>Double-click the <strong className="text-slate-700">"Add new URL"</strong> option (with the green plus icon) and paste: <code className="bg-black/20 border border-slate-200 px-1.5 py-0.5 rounded font-mono font-medium text-blue-600">http://127.0.0.1:3000</code>.</li>
              <li className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 font-medium my-2 space-y-1">
                <p>⚠️ <strong>IMPORTANT - ONLY ONE LOCAL URL NEEDED:</strong> Press <kbd className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900 font-mono text-[11px]">Enter</kbd> on your keyboard after pasting <code className="font-mono text-amber-950 font-bold">http://127.0.0.1:3000</code>.</p>
                <p className="text-[11px] text-amber-800">
                  💡 <strong>Why MT5 won't let you add "http://localhost:3000" as a 2nd link:</strong> MT5 recognizes <code className="font-mono font-semibold">127.0.0.1</code> and <code className="font-mono font-semibold">localhost</code> as the exact same local IP address, so MT5 automatically prevents adding <code className="font-mono font-semibold">localhost</code> as a duplicate! <strong>Adding <code className="font-mono font-bold">http://127.0.0.1:3000</code> alone is 100% sufficient and all you need!</strong> Simply click <strong className="text-amber-950">OK</strong> at the bottom.
                </p>
              </li>
              <li>Click <strong className="text-slate-700">OK</strong> to save settings.</li>
            </ol>

            <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Info className="w-4 h-4 text-amber-400" />
                <span>Troubleshooting: URL Disappearing, Rejected, or Blocked by MT5?</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                If MT5 deletes the URL after clicking OK, refuses to lock it, or shows error <code className="text-rose-400 font-mono">WebRequest failed (4014 / 4060)</code> when running the EA, check these 5 common causes:
              </p>
              <ul className="text-[11px] text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                <li>
                  <strong className="text-slate-200">1. Remove Trailing Slashes & Paths:</strong> MT5 ONLY accepts base origins without paths or trailing slashes. Enter <code className="text-blue-400 font-mono">{appOrigin}</code> (Do NOT add <code className="text-slate-500 font-mono">/api/webhook</code> or a trailing <code className="text-slate-500 font-mono">/</code> at the end!).
                </li>
                <li>
                  <strong className="text-slate-200">2. Strip Invisible Trailing Spaces:</strong> When pasting from a web browser, invisible spaces or newlines get copied. Paste the URL into MT5, press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-200 font-mono text-[10px]">Backspace</kbd> once to delete any trailing space, then press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-200 font-mono text-[10px]">Enter</kbd>.
                </li>
                <li>
                  <strong className="text-slate-200">3. Master Checkbox Enabled:</strong> Ensure the master box <strong className="text-slate-200">"Allow WebRequest for listed URL:"</strong> is checked <kbd className="text-emerald-400">[x]</kbd>. If it is unchecked, MT5 discards all table inputs when you close the dialog.
                </li>
                <li>
                  <strong className="text-slate-200">4. Run MT5 as Administrator:</strong> Windows User Account Control (UAC) sometimes prevents MT5 from saving its <code className="text-slate-300 font-mono">terminal.ini</code> config. Right-click your MT5 shortcut on your Windows VPS desktop and select <strong className="text-slate-200">"Run as Administrator"</strong> before changing Options.
                </li>
                <li>
                  <strong className="text-slate-200">5. Single Local URL Entry:</strong> If running locally on your VPS, enter <code className="text-emerald-400 font-mono">http://127.0.0.1:3000</code>. Do not try to add <code className="text-slate-400 font-mono">http://localhost:3000</code> as MT5 considers it a duplicate and will reject the 2nd entry.
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">2. Install the Bridge EA on your MT5</h4>
            <div className="bg-white border border-blue-600/20 rounded-xl p-4.5 mb-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">Automated Direct Installation (Recommended)</span>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Click below to save the pre-configured Expert Advisor <strong className="text-blue-600 font-mono">TV_Bridge_EA.mq5</strong> file <strong>directly inside your MT5 Experts folder</strong>. This skips downloading to your general Downloads folder and manual copying.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleDirectInstall}
                  disabled={installStatus === 'installing'}
                  className={`inline-flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg ${
                    installStatus === 'success'
                      ? 'bg-emerald-600 text-white shadow-emerald-500/15'
                      : installStatus === 'error'
                      ? 'bg-rose-600 text-slate-900'
                      : 'bg-blue-700 hover:bg-blue-600 text-white shadow-blue-600/15'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 animate-pulse" />
                  {installStatus === 'installing' ? 'Installing...' : installStatus === 'success' ? '✓ Successfully Installed!' : installStatus === 'error' ? 'Retry Direct Install' : 'Direct Auto-Install to MT5 Experts'}
                </button>

                <a
                  href="/api/download/mql5"
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  title="Manual download"
                >
                  <Download className="w-4 h-4" />
                  Manual Download (.mq5)
                </a>
              </div>

              {installError && (
                <p className="text-xs text-rose-400 mt-3 font-mono">
                  Error: {installError}
                </p>
              )}

              {/* Instant Path-Finder Help Panel */}
              <div className="mt-4 pt-3.5 border-t border-slate-200 space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  💡 How to find your MT5 Experts Folder instantly:
                </span>
                <ol className="list-decimal pl-4 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <li>In MetaTrader 5, click <strong className="text-slate-400">File</strong> (top menu) -&gt; <strong className="text-slate-400">Open Data Folder</strong>.</li>
                  <li>Double-click the <strong className="text-slate-400">MQL5</strong> folder, then double-click the <strong className="text-slate-400">Experts</strong> folder.</li>
                  <li>Click on the Windows Explorer address bar to copy the exact folder path, and paste it/select it in the file dialog.</li>
                </ol>

                {/* Path Helper Shortcut to copy */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="bg-black/30 border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-blue-600 select-all truncate flex-1">
                    %appdata%\MetaQuotes\Terminal\
                  </div>
                  <button
                    onClick={() => copyToClipboard('%appdata%\\MetaQuotes\\Terminal\\', setCopiedPathTip)}
                    className="shrink-0 text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPathTip ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Shortcut Path
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 leading-normal">
                  *Pasting the shortcut above in the file dialog's address bar instantly jumps to your MT5 installations folder.
                </p>
              </div>
            </div>

            <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-2 leading-relaxed">
              <li className="mt-3">Inside MT5, open <strong className="text-slate-700">MetaEditor</strong> by clicking <strong className="text-slate-700">Tools -&gt; MetaQuotes Language Editor</strong> or pressing <kbd className="bg-black/30 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600 text-[10px]">F4</kbd>.</li>
              <li>In the MetaEditor's Navigator panel (left side), double click the <strong className="text-slate-700">Experts</strong> folder. The <code className="font-mono bg-black/20 border border-slate-200 px-1.5 text-blue-600 rounded">TV_Bridge_EA.mq5</code> file will already be sitting inside.</li>
              <li>Open the file in MetaEditor and click <strong className="text-slate-700">Compile</strong> (green checkmark or press <kbd className="bg-black/30 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-600 text-[10px]">F7</kbd>). Ensure there are 0 errors in the build logs.</li>
            </ol>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">3. Activate Algo Trading</h4>
            <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>Go back to MetaTrader 5 and refresh the Navigator Panel (or right click Experts and click Refresh).</li>
              <li>Drag <strong className="text-slate-700">TV_Bridge_EA</strong> onto your <strong className="text-slate-700">XAUUSD (Gold)</strong> chart (ensure timeframe is 15m).</li>
              <li>In the EA settings popup, under the <strong className="text-slate-700">Common</strong> tab, check the box for <strong className="text-slate-700">"Allow Algo Trading"</strong>.</li>
              <li>Ensure the main <strong className="text-slate-700">"Algo Trading"</strong> toggle button in MT5's top main toolbar is glowing <span className="text-emerald-400 font-semibold">GREEN</span>.</li>
              <li>The EA is now polling! When a TradingView signal lands on this server, MT5 will instantly calculate the lot size based on your real account balance and open the market trade.</li>
            </ol>
          </div>
        </div>
      )}

      {activeStepTab === 'python' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">1. Local Python Setup</h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              The Python bridge script runs on your local desktop where MT5 is installed. It communicates with your running MT5 terminal via the official MetaTrader 5 SDK and listens to this webhook server in real-time.
            </p>
            <pre className="bg-black/40 text-blue-600 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-200">
              pip install MetaTrader5 requests
            </pre>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">2. Running the Bridge script</h4>
            <ol className="list-decimal pl-5 text-xs text-slate-400 space-y-2.5 leading-relaxed">
              <li>
                Download your pre-configured Python bridge script:
                <div className="mt-2.5">
                  <a
                    href="/api/download/python"
                    className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-blue-600/10 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download tv_mt5_bridge.py
                  </a>
                </div>
              </li>
              <li className="mt-3">Make sure your <strong className="text-slate-700">MetaTrader 5 Desktop Terminal is open</strong> and logged into your real or demo broker account.</li>
              <li>Open your terminal/command prompt inside the folder where you downloaded the script.</li>
              <li>Run the script:
                <pre className="bg-black/40 text-emerald-400 p-3 rounded-lg text-[11px] font-mono mt-2 overflow-x-auto border border-slate-200">
                  python tv_mt5_bridge.py
                </pre>
              </li>
              <li>The python script will instantly bind to the MT5 application and print your current account balance, then enter a low-overhead loop. When TradingView posts a signal, the python script calculates the lot size based on your MT5 balance and triggers the market order inside MT5 with your exact SL/TP parameters.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
