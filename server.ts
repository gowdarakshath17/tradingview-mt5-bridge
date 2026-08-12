import express from "express";
import { generateMql5Code } from "./server/generators/mql5";
import { generatePythonCode } from "./server/generators/python";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Signal, BridgeConfig } from "./src/types";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import { Firestore } from "@google-cloud/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Local persistent disk state backup file path (used for VPS power recovery)
const BACKUP_DIR = path.join(process.cwd(), "data");
const BACKUP_FILE = path.join(BACKUP_DIR, "server_state.json");

// Save current bridge state (signals + config) to local disk
function saveStateToDisk() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const stateData = {
      signals,
      bridgeConfig,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(stateData, null, 2), "utf-8");
  } catch (err) {
    console.error("[VPS POWER RECOVERY] Failed to write server state backup to disk:", err);
  }
}

// Load bridge state from local disk on startup
function loadStateFromDisk() {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const fileContent = fs.readFileSync(BACKUP_FILE, "utf-8");
      const loaded = JSON.parse(fileContent);
      if (Array.isArray(loaded.signals)) {
        signals = loaded.signals;
      }
      if (loaded.bridgeConfig && typeof loaded.bridgeConfig === "object") {
        bridgeConfig = { ...bridgeConfig, ...loaded.bridgeConfig };
      }
      console.log(`[VPS POWER RECOVERY] Successfully restored ${signals.length} signals and config from disk backup.`);
    }
  } catch (err) {
    console.error("[VPS POWER RECOVERY] Failed to read server state backup from disk:", err);
  }
}

// Graceful process exit & crash handlers
process.on("SIGINT", () => {
  console.log("SIGINT received: Saving bridge state to disk before exiting...");
  saveStateToDisk();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received: Saving bridge state to disk before exiting...");
  saveStateToDisk();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[VPS CRASH PROTECT] Uncaught Exception detected:", err);
  saveStateToDisk();
});

process.on("unhandledRejection", (reason) => {
  console.error("[VPS CRASH PROTECT] Unhandled Rejection detected:", reason);
  saveStateToDisk();
});

// Initialize server-side Firestore
let firestore: Firestore | null = null;
try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.firestoreDatabaseId) {
    firestore = new Firestore({
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId
    });
    console.log("Firestore initialized on server successfully.");
  } else {
    console.warn("Firestore config incomplete in firebase-applet-config.json. Running server in-memory fallback.");
  }
} catch (err) {
  console.warn("Firestore server-side initialization failed. Running server in-memory fallback.", err);
}

// Helper to decode JWT sub / user_id from authorization header safely without external packages
function getUserIdFromToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return payload.user_id || payload.sub || null;
    }
  } catch (err) {
    console.error("Failed to parse JWT payload on server:", err);
  }
  return null;
}

// In-memory data store
let signals: Signal[] = [];

let bridgeConfig: BridgeConfig = {
  passphrase: "gold_bridge_secret",
  riskPercent: 1.0, // 1%
  stopLossPoints: 10.0, // $10.00 gold movement
  takeProfitPoints: 20.0, // $20.00 gold movement
  contractSize: 100, // standard gold contract size
  lotSizingMode: "DynamicRisk",
  fixedLotSize: 0.1,
  routedAccounts: [],
  routeMode: 'All',
  maxDailyDrawdownPct: 5,
  maxTotalDrawdownPct: 10,
  maxOpenTrades: 5,
  consecutiveLossLimit: 3,
  pauseAfterConsecutiveLossesMins: 60,
  equityProtectionEnabled: false,
  equityProtectionThreshold: 1000,
  newsFilterEnabled: false,
  newsMinutesBefore: 15,
  newsMinutesAfter: 15,
  executionMode: 'Market',
  slTpCalculation: 'DistanceBased',
  maxAllowedSlippagePoints: 50,
  holdTillCounterDirection: false,
  dynamicTrailingStop: false,
  trailingActivationPoints: 10.0,
  trailingStepPoints: 2.0,
  profitLockPercentage: 50,
  weekendShutdownEnabled: true,
  shutdownMinutesBeforeClose: 15,
  holidayFilterEnabled: true,
  dailyShutdownEnabled: true,
  dailyShutdownHour: 21, // 21:00 UTC (17:00 EST)
  dailyShutdownMinute: 45, // 15 mins before rollover gap
  dailyShutdownDurationMins: 30, // lasts for 30 minutes (covering rollover gap)
  customHolidays: ["2026-12-25", "2026-01-01", "2026-07-04"], // Standard Bank Holidays
  dailyProfitGoal: 500
};

// Immediately restore disk state backup if available (power cut recovery)
loadStateFromDisk();

// Fast in-memory cache for passphrase -> userId mapping to prevent blocking Firestore queries on every 1-second poll
const passphraseCache = new Map<string, { userId: string | null; expiry: number }>();

async function resolveUserIdByPassphrase(passphrase: string): Promise<string | null> {
  if (!passphrase) return null;
  
  // 1. If passphrase matches local default config directly, return null (local scope)
  if (passphrase === bridgeConfig.passphrase) {
    return null;
  }

  // 2. Check cache
  const cached = passphraseCache.get(passphrase);
  if (cached && Date.now() < cached.expiry) {
    return cached.userId;
  }

  // 3. Query Firestore if available
  if (firestore) {
    try {
      const configsSnapshot = await firestore.collectionGroup("configs")
        .where("passphrase", "==", String(passphrase))
        .limit(1)
        .get();

      if (!configsSnapshot.empty) {
        const configDoc = configsSnapshot.docs[0];
        const docPath = configDoc.ref.path;
        const pathParts = docPath.split("/");
        if (pathParts[0] === "users" && pathParts[1]) {
          const userId = pathParts[1];
          passphraseCache.set(passphrase, { userId, expiry: Date.now() + 120000 }); // Cache for 2 mins
          return userId;
        }
      }
    } catch (err) {
      console.error("Firestore passphrase lookup error:", err);
    }
  }

  // Cache null result for 30s
  passphraseCache.set(passphrase, { userId: null, expiry: Date.now() + 30000 });
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON and form bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  interface SseClient {
    res: any;
    userId: string | null;
  }
  let sseClients: SseClient[] = [];

  function sendSSEEvent(type: string, data: any, targetUserId?: string | null) {
    const payload = JSON.stringify({ type, data });
    sseClients.forEach(client => {
      if (!targetUserId || client.userId === targetUserId) {
        try {
          client.res.write(`data: ${payload}\n\n`);
        } catch (err) {
          // Handled on close
        }
      }
    });
  }

  // API: System health check (useful for VPS load balancers and PM2)
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // API: Live low-latency SSE updates stream
  app.get("/api/events", (req, res) => {
    const token = req.query.token as string;
    let userId: string | null = null;

    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          userId = payload.user_id || payload.sub || null;
        }
      } catch (err) {
        console.error("Failed to parse JWT in SSE:", err);
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const client: SseClient = { res, userId };
    sseClients.push(client);

    res.write(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
      } catch (err) {
        // Handled on close
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients = sseClients.filter(c => c !== client);
    });
  });

  // API: Get bridge status
  app.get("/api/status", (req, res) => {
    const pendingCount = signals.filter(s => s.status === "Pending").length;
    const executedCount = signals.filter(s => s.status === "Executed").length;
    const failedCount = signals.filter(s => s.status === "Failed").length;

    res.json({
      status: "active",
      uptime: process.uptime(),
      stats: {
        total: signals.length,
        pending: pendingCount,
        executed: executedCount,
        failed: failedCount
      }
    });
  });

  // API: Get config
  app.get("/api/config", async (req, res) => {
    const userId = getUserIdFromToken(req.headers.authorization);
    if (firestore && userId) {
      try {
        const configRef = firestore.collection("users").doc(userId).collection("configs").doc("bridgeConfig");
        const docSnap = await configRef.get();
        if (docSnap.exists) {
          return res.json(docSnap.data());
        }
      } catch (err) {
        console.error("Failed to fetch user config from Firestore:", err);
      }
    }
    res.json(bridgeConfig);
  });

  // API: Update config
  app.post("/api/config", async (req, res) => {
    const userId = getUserIdFromToken(req.headers.authorization);
    const { 
      passphrase, 
      riskPercent, 
      stopLossPoints, 
      takeProfitPoints, 
      contractSize, 
      lotSizingMode, 
      fixedLotSize,
      holdTillCounterDirection,
      dynamicTrailingStop,
      trailingActivationPoints,
      trailingStepPoints,
      profitLockPercentage,
      weekendShutdownEnabled,
      shutdownMinutesBeforeClose,
      holidayFilterEnabled,
      dailyShutdownEnabled,
      dailyShutdownHour,
      dailyShutdownMinute,
      dailyShutdownDurationMins,
      customHolidays,
      dailyProfitGoal,
      webhookSecretToken,
      ipWhitelistingEnabled,
      allowedIps,
      routedAccounts,
      routeMode,
      maxDailyDrawdownPct,
      maxTotalDrawdownPct,
      maxOpenTrades,
      consecutiveLossLimit,
      pauseAfterConsecutiveLossesMins,
      equityProtectionEnabled,
      equityProtectionThreshold,
      newsFilterEnabled,
      newsMinutesBefore,
      newsMinutesAfter,
      executionMode,
      slTpCalculation,
      maxAllowedSlippagePoints
    } = req.body;

    const targetConfig = (firestore && userId) ? { ...bridgeConfig } : bridgeConfig;
 
    if (passphrase !== undefined) targetConfig.passphrase = String(passphrase);
    if (riskPercent !== undefined) targetConfig.riskPercent = Number(riskPercent);
    if (stopLossPoints !== undefined) targetConfig.stopLossPoints = Number(stopLossPoints);
    if (takeProfitPoints !== undefined) targetConfig.takeProfitPoints = Number(takeProfitPoints);
    if (contractSize !== undefined) targetConfig.contractSize = Number(contractSize);
    if (lotSizingMode !== undefined) targetConfig.lotSizingMode = lotSizingMode;
    if (fixedLotSize !== undefined) targetConfig.fixedLotSize = Number(fixedLotSize);
    if (dailyProfitGoal !== undefined) targetConfig.dailyProfitGoal = Number(dailyProfitGoal);
    
    if (executionMode !== undefined) targetConfig.executionMode = executionMode;
    if (slTpCalculation !== undefined) targetConfig.slTpCalculation = slTpCalculation;
    if (maxAllowedSlippagePoints !== undefined) targetConfig.maxAllowedSlippagePoints = Number(maxAllowedSlippagePoints);
    
    if (holdTillCounterDirection !== undefined) targetConfig.holdTillCounterDirection = Boolean(holdTillCounterDirection);
    if (dynamicTrailingStop !== undefined) targetConfig.dynamicTrailingStop = Boolean(dynamicTrailingStop);
    if (trailingActivationPoints !== undefined) targetConfig.trailingActivationPoints = Number(trailingActivationPoints);
    if (trailingStepPoints !== undefined) targetConfig.trailingStepPoints = Number(trailingStepPoints);
    if (profitLockPercentage !== undefined) targetConfig.profitLockPercentage = Number(profitLockPercentage);
    
    if (weekendShutdownEnabled !== undefined) targetConfig.weekendShutdownEnabled = Boolean(weekendShutdownEnabled);
    if (shutdownMinutesBeforeClose !== undefined) targetConfig.shutdownMinutesBeforeClose = Number(shutdownMinutesBeforeClose);
    if (holidayFilterEnabled !== undefined) targetConfig.holidayFilterEnabled = Boolean(holidayFilterEnabled);
 
    if (dailyShutdownEnabled !== undefined) targetConfig.dailyShutdownEnabled = Boolean(dailyShutdownEnabled);
    if (dailyShutdownHour !== undefined) targetConfig.dailyShutdownHour = Number(dailyShutdownHour);
    if (dailyShutdownMinute !== undefined) targetConfig.dailyShutdownMinute = Number(dailyShutdownMinute);
    if (dailyShutdownDurationMins !== undefined) targetConfig.dailyShutdownDurationMins = Number(dailyShutdownDurationMins);

    if (customHolidays !== undefined && Array.isArray(customHolidays)) {
      targetConfig.customHolidays = customHolidays.map((h: any) => String(h).trim()).filter(Boolean);
    }

    if (webhookSecretToken !== undefined) targetConfig.webhookSecretToken = String(webhookSecretToken);
    if (ipWhitelistingEnabled !== undefined) targetConfig.ipWhitelistingEnabled = Boolean(ipWhitelistingEnabled);
    if (allowedIps !== undefined) targetConfig.allowedIps = String(allowedIps);

    if (routedAccounts !== undefined && Array.isArray(routedAccounts)) {
      targetConfig.routedAccounts = routedAccounts.map((a: any) => String(a).trim()).filter(Boolean);
    }
    if (routeMode !== undefined) targetConfig.routeMode = routeMode;

    if (maxDailyDrawdownPct !== undefined) targetConfig.maxDailyDrawdownPct = Number(maxDailyDrawdownPct);
    if (maxTotalDrawdownPct !== undefined) targetConfig.maxTotalDrawdownPct = Number(maxTotalDrawdownPct);
    if (maxOpenTrades !== undefined) targetConfig.maxOpenTrades = Number(maxOpenTrades);
    if (consecutiveLossLimit !== undefined) targetConfig.consecutiveLossLimit = Number(consecutiveLossLimit);
    if (pauseAfterConsecutiveLossesMins !== undefined) targetConfig.pauseAfterConsecutiveLossesMins = Number(pauseAfterConsecutiveLossesMins);
    if (equityProtectionEnabled !== undefined) targetConfig.equityProtectionEnabled = Boolean(equityProtectionEnabled);
    if (equityProtectionThreshold !== undefined) targetConfig.equityProtectionThreshold = Number(equityProtectionThreshold);
    if (newsFilterEnabled !== undefined) targetConfig.newsFilterEnabled = Boolean(newsFilterEnabled);
    if (newsMinutesBefore !== undefined) targetConfig.newsMinutesBefore = Number(newsMinutesBefore);
    if (newsMinutesAfter !== undefined) targetConfig.newsMinutesAfter = Number(newsMinutesAfter);

    // Broadcast SSE Event to update any active UI sessions
    sendSSEEvent("config_updated", targetConfig, userId);

    // Save updated config state to local disk
    saveStateToDisk();

    if (firestore && userId) {
      try {
        const configRef = firestore.collection("users").doc(userId).collection("configs").doc("bridgeConfig");
        await configRef.set(targetConfig, { merge: true });

        // Also sync passphrase directly to user document
        if (targetConfig.passphrase) {
          const userRef = firestore.collection("users").doc(userId);
          await userRef.set({
            passphrase: targetConfig.passphrase,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        return res.json({ message: "Configuration updated in Firestore successfully", config: targetConfig });
      } catch (err) {
        console.error("Failed to update user config in Firestore:", err);
      }
    }

    res.json({ message: "Configuration updated successfully", config: bridgeConfig });
  });

  // Helper to verify market status (Weekends & Global Holidays)
  function checkMarketStatus(now: Date = new Date(), config: BridgeConfig = bridgeConfig): { active: boolean; reason?: string } {
    const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // 1. Holiday Filter
    if (config.holidayFilterEnabled) {
      const month = now.getUTCMonth() + 1; // 1-12
      const date = now.getUTCDate();
      
      // New Year's Day
      if (month === 1 && date === 1) {
        return { active: false, reason: "New Year's Day Market Holiday" };
      }
      // US Independence Day
      if (month === 7 && date === 4) {
        return { active: false, reason: "US Independence Day Market Holiday" };
      }
      // Christmas Holidays
      if (month === 12 && (date === 24 || date === 25 || date === 26)) {
        return { active: false, reason: "Christmas Holiday Market Closure" };
      }

      // Custom User-defined Holidays (YYYY-MM-DD or MM-DD format)
      if (config.customHolidays && config.customHolidays.length > 0) {
        const currentYear = now.getUTCFullYear();
        const currentMonthStr = String(month).padStart(2, '0');
        const currentDateStr = String(date).padStart(2, '0');
        const formattedDate = `${currentYear}-${currentMonthStr}-${currentDateStr}`;
        const formattedNoYear = `${currentMonthStr}-${currentDateStr}`;
        
        for (const holiday of config.customHolidays) {
          if (holiday === formattedDate || holiday === formattedNoYear) {
            return { active: false, reason: `Custom Configured Holiday (${holiday})` };
          }
        }
      }
    }

    // 2. Weekend Shutdown
    if (config.weekendShutdownEnabled) {
      const buffer = config.shutdownMinutesBeforeClose || 15;
      
      // Friday close: 17:00 EST / 22:00 UTC.
      // We stop taking signals 'buffer' minutes before 22:00 UTC Friday.
      // Friday is day 5.
      if (utcDay === 5) {
        const minutesIntoFriday = utcHour * 60 + utcMinute;
        const FridayCloseMinutes = 22 * 60; // 22:00 UTC
        if (minutesIntoFriday >= FridayCloseMinutes - buffer) {
          return { active: false, reason: `Weekend Shutdown active (${buffer} mins before Friday market close)` };
        }
      }
      
      // Saturday: day 6 - fully closed
      if (utcDay === 6) {
        return { active: false, reason: "Weekend Market Closure (Saturday)" };
      }
      
      // Sunday: day 0 - closed until 17:00 EST / 22:00 UTC
      if (utcDay === 0) {
        if (utcHour < 22) {
          return { active: false, reason: "Weekend Market Closure (Sunday before open)" };
        }
      }
    }

    // 3. Daily Rollover / Gap Up Protection
    if (config.dailyShutdownEnabled) {
      const shutdownHour = config.dailyShutdownHour ?? 21;
      const shutdownMin = config.dailyShutdownMinute ?? 45;
      const durationMins = config.dailyShutdownDurationMins ?? 30;
      
      const nowMinutes = utcHour * 60 + utcMinute;
      const startMinutes = shutdownHour * 60 + shutdownMin;
      const endMinutes = startMinutes + durationMins;
      
      // Handle interval wrap around midnight (e.g. 23:50 to 00:20)
      let isInShutdown = false;
      if (endMinutes <= 24 * 60) {
        isInShutdown = nowMinutes >= startMinutes && nowMinutes < endMinutes;
      } else {
        // Wrap around midnight
        const wrappedEndMinutes = endMinutes % (24 * 60);
        isInShutdown = nowMinutes >= startMinutes || nowMinutes < wrappedEndMinutes;
      }
      
      if (isInShutdown) {
        return { 
          active: false, 
          reason: `Daily Rollover Gap Protection (${shutdownHour.toString().padStart(2, '0')}:${shutdownMin.toString().padStart(2, '0')} UTC for ${durationMins}m)` 
        };
      }
    }

    return { active: true };
  }

  // API: Get current market status
  app.get("/api/market-status", (req, res) => {
    const status = checkMarketStatus();
    res.json(status);
  });

  // API: Receive signals from TradingView or Simulator
  // Webhooks from TradingView are sent to this endpoint
  app.post("/api/webhook", async (req, res) => {
    console.log(`[WEBHOOK ENTRY] Incoming request from IP: ${req.ip} | X-Forwarded-For: ${req.headers["x-forwarded-for"]}`);
    const { passphrase, type, type_string, action, signal, symbol, price } = req.body;

    // Support both direct payloads and custom alert messages
    // E.g., TV format: {"passphrase": "...", "type": "BUY", "symbol": "XAUUSD", "price": "{{close}}"}
    const receivedPassphrase = passphrase || req.query.passphrase || req.headers["x-passphrase"];
    const sigType = (type || type_string || action || signal || "").toUpperCase();
    const sigSymbol = symbol || "XAUUSD";
    const sigPrice = Number(price || req.body.close || req.body.open || 0);
    const slFromReq = Number(req.body.sl);
    const tpFromReq = Number(req.body.tp);

    let activeConfig = { ...bridgeConfig };
    let matchedUserId: string | null = null;
    const isSimulator = req.body.source === "Simulator";

    // Support extracting custom security token or signature from various headers or URL query parameters
    const receivedSecret = req.query.secret || 
                           req.query.token || 
                           req.query.signature || 
                           req.headers["x-webhook-secret"] || 
                           req.headers["x-signature"] || 
                           req.headers["x-tradingview-signature"];

    // Secure Webhook Signature Verification System (against environment variable secret)
    const envSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET;
    if (envSecret && !isSimulator) {
      // Validate signature/token provided in X-TradingView-Signature header or query parameters
      const receivedSignature = req.headers["x-tradingview-signature"] || 
                                req.query.signature || 
                                req.query.secret || 
                                req.query.token;

      if (!receivedSignature || receivedSignature !== envSecret) {
        console.warn(`[WEBHOOK REJECTED] Webhook Signature verification failed. IP: ${req.ip}`);
        return res.status(401).json({ 
          error: "Unauthorized. Webhook Signature / Secret verification failed.",
          help: "Ensure the 'X-TradingView-Signature' header or query parameter 'signature' matches the TRADINGVIEW_WEBHOOK_SECRET configured on the server."
        });
      }
      console.log(`[WEBHOOK] Webhook signature verified successfully against server environment variable.`);
    }

    if (firestore) {
      if (receivedPassphrase) {
        try {
          const configsSnapshot = await firestore.collectionGroup("configs")
            .where("passphrase", "==", String(receivedPassphrase))
            .limit(1)
            .get();

          if (!configsSnapshot.empty) {
            const configDoc = configsSnapshot.docs[0];
            activeConfig = configDoc.data() as BridgeConfig;
            
            const docPath = configDoc.ref.path;
            const pathParts = docPath.split("/");
            if (pathParts[0] === "users" && pathParts[1]) {
              matchedUserId = pathParts[1];
            }
          }
        } catch (dbErr) {
          console.warn("Firestore query failed for webhook config by passphrase.", dbErr);
        }
      }

      // If no config found yet, and we received a secure token/secret, search Firestore by webhookSecretToken
      if (!matchedUserId && receivedSecret) {
        try {
          const configsSnapshot = await firestore.collectionGroup("configs")
            .where("webhookSecretToken", "==", String(receivedSecret))
            .limit(1)
            .get();

          if (!configsSnapshot.empty) {
            const configDoc = configsSnapshot.docs[0];
            activeConfig = configDoc.data() as BridgeConfig;
            
            const docPath = configDoc.ref.path;
            const pathParts = docPath.split("/");
            if (pathParts[0] === "users" && pathParts[1]) {
              matchedUserId = pathParts[1];
            }
          }
        } catch (dbErr) {
          console.warn("Firestore query failed for webhook config by webhookSecretToken.", dbErr);
        }
      }
    }

    // Advanced Webhook Security: IP Whitelisting verification (Bypassed for Simulator requests)
    if (activeConfig.ipWhitelistingEnabled && !isSimulator) {
      const normalizeIp = (ip: string): string => {
        if (!ip) return "";
        const trimmed = ip.trim();
        if (trimmed.startsWith("::ffff:")) {
          return trimmed.substring(7);
        }
        return trimmed;
      };

      const rawClientIp = (req.headers["x-forwarded-for"] as string || req.ip || req.socket.remoteAddress || "");
      // If there are multiple IPs in the header, take the first one (the original sender)
      const clientIpParts = rawClientIp.split(",").map(i => i.trim());
      const clientIp = normalizeIp(clientIpParts[0]);

      let allowedIpsList: string[] = [];
      if (activeConfig.allowedIps && activeConfig.allowedIps.trim().length > 0) {
        allowedIpsList = activeConfig.allowedIps.split(",").map(ip => normalizeIp(ip)).filter(Boolean);
      } else {
        // Fallback to official TradingView Server Webhook IPs if none specified but whitelisting is enabled
        allowedIpsList = [
          "52.89.214.238", "34.212.75.30", "54.218.53.128", "52.32.178.244", "52.32.178.7",
          "54.200.183.159", "54.214.153.251", "54.214.153.250", "54.214.153.249",
          "54.203.111.137", "54.203.111.138", "52.42.226.54", "52.42.226.55"
        ];
      }

      const ipMatches = allowedIpsList.includes(clientIp);

      if (!ipMatches) {
        console.warn(`[WEBHOOK REJECTED] Unauthorized client IP ${clientIp} (raw: ${rawClientIp}) is not in whitelist: ${allowedIpsList.join(", ")}`);
        return res.status(403).json({ 
          error: "Forbidden. Webhook originating from unauthorized IP address.", 
          ip: clientIp,
          help: "Ensure your alerts are dispatched from TradingView servers or add your IP to Bridge Whitelisting settings."
        });
      }
    }

    // Advanced Webhook Security: Secret Key Verification System
    let isAuthenticated = false;

    if (matchedUserId) {
      // Configuration was found in Firestore
      if (activeConfig.webhookSecretToken) {
        if (receivedSecret === activeConfig.webhookSecretToken) {
          isAuthenticated = true;
        } else {
          console.warn(`[WEBHOOK REJECTED] Secret token mismatch for user config. Received: ${receivedSecret}, Expected: ${activeConfig.webhookSecretToken}`);
        }
      } else if (activeConfig.passphrase) {
        if (receivedPassphrase === activeConfig.passphrase) {
          isAuthenticated = true;
        } else {
          console.warn(`[WEBHOOK REJECTED] Passphrase mismatch for user config. Received: ${receivedPassphrase}, Expected: ${activeConfig.passphrase}`);
        }
      }
    } else {
      // Fallback to in-memory/default bridge configuration
      if (bridgeConfig.webhookSecretToken) {
        if (receivedSecret === bridgeConfig.webhookSecretToken) {
          isAuthenticated = true;
        }
      } else if (receivedPassphrase === bridgeConfig.passphrase) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      console.warn(`[WEBHOOK REJECTED] Authentication failed. IP: ${req.ip}`);
      return res.status(401).json({ error: "Unauthorized. Invalid webhook security token or passphrase verification." });
    }

    if (sigType !== "BUY" && sigType !== "SELL") {
      return res.status(400).json({ error: "Invalid signal type. Must be BUY or SELL." });
    }

    if (isNaN(sigPrice) || sigPrice <= 0) {
      return res.status(400).json({ error: "Invalid price value." });
    }

    // Verify Market Status first
    const marketStatus = checkMarketStatus(new Date(), activeConfig);
    const shouldFail = !marketStatus.active && !isSimulator; // Simulator bypasses filter to allow testing in UI

    // Calculate initial Stop Loss and Take Profit levels using activeConfig
    const directionMultiplier = sigType === "BUY" ? 1 : -1;
    
    let dynamicSlPts = activeConfig.stopLossPoints;
    let dynamicTpPts = activeConfig.takeProfitPoints;
    const mockBalance = 10000;
    
    if (activeConfig.lotSizingMode === 'DynamicStopLoss') {
        const riskAmount = mockBalance * (activeConfig.riskPercent / 100);
        dynamicSlPts = riskAmount / activeConfig.fixedLotSize;
        dynamicTpPts = dynamicSlPts * (activeConfig.riskRewardRatio || 2.0);
    }
    
    let sl = !isNaN(slFromReq) ? slFromReq : sigPrice - (dynamicSlPts * directionMultiplier);
    let tp = !isNaN(tpFromReq) ? tpFromReq : sigPrice + (dynamicTpPts * directionMultiplier);

    // If SL was provided in the payload, override the stopLossPoints constraint dynamically
    if (!isNaN(slFromReq)) {
       activeConfig.stopLossPoints = Math.abs(sigPrice - sl);
    }

    // Dynamic Lot Size estimation using activeConfig
    let estimatedLot = activeConfig.fixedLotSize;
    if (activeConfig.lotSizingMode === "DynamicRisk") {
      const riskAmount = mockBalance * (activeConfig.riskPercent / 100);
      const riskPerLot = activeConfig.stopLossPoints;
      estimatedLot = Number((riskAmount / riskPerLot).toFixed(2));
      if (estimatedLot < 0.01) estimatedLot = 0.01;
    }

    const newSignal: Signal = {
      id: "sig_" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: sigType as "BUY" | "SELL",
      symbol: sigSymbol,
      price: sigPrice,
      sl: Number(sl.toFixed(2)),
      tp: Number(tp.toFixed(2)),
      lotSize: estimatedLot,
      source: isSimulator ? "Simulator" : "TradingView",
      status: shouldFail ? "Failed" : "Pending",
      executionDetails: shouldFail ? `Rejected: ${marketStatus.reason}` : undefined
    };

    signals.unshift(newSignal);
    
    // Prevent memory & disk bloat in 24/7 VPS environment
    if (signals.length > 500) {
      signals = signals.slice(0, 500);
    }
    
    console.log(`[WEBHOOK RECEIVED] ${sigType} on ${sigSymbol} @ ${sigPrice}. SL: ${newSignal.sl}, TP: ${newSignal.tp}. Status: ${newSignal.status}`);

    // Persist updated signals list to local disk
    saveStateToDisk();

    // Real-time SSE Broadcast
    sendSSEEvent("signal_created", newSignal, matchedUserId);

    if (matchedUserId && firestore) {
      try {
        await firestore.collection("users").doc(matchedUserId).collection("signals").doc(newSignal.id).set(newSignal);
        console.log(`[FIREBASE] Saved new webhook signal ${newSignal.id} for user ${matchedUserId}`);
      } catch (saveErr) {
        console.error(`[FIREBASE] Failed to save signal ${newSignal.id} to Firestore:`, saveErr);
      }
    }

    if (shouldFail) {
      return res.status(403).json({
        error: `Signal rejected: ${marketStatus.reason}`,
        signal: newSignal
      });
    }

    res.status(201).json({
      message: "Signal received and added to queue",
      signal: newSignal
    });
  });

  // API: Get signals list (used by dashboard and MT5 client for polling)
  app.get("/api/signals", async (req, res) => {
    const { status, passphrase } = req.query;
    const userId = getUserIdFromToken(req.headers.authorization);

    let activeSignals = [...signals];
    let matchedUserId: string | null = userId;

    // If an external client (like MT5 or Python) is polling via passphrase
    if (passphrase !== undefined) {
      const passStr = String(passphrase);
      if (passStr === bridgeConfig.passphrase) {
        // Local default passphrase matched instantly in 0ms!
        matchedUserId = userId || null;
      } else {
        matchedUserId = await resolveUserIdByPassphrase(passStr);
        if (!matchedUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
      }
    }

    // Load from Firestore if we identified a valid userId
    if (firestore && matchedUserId) {
      try {
        const querySnap = await firestore.collection("users").doc(matchedUserId).collection("signals")
          .orderBy("timestamp", "desc")
          .limit(100)
          .get();
        
        if (!querySnap.empty) {
          activeSignals = [];
          querySnap.forEach(docSnap => {
            activeSignals.push(docSnap.data() as Signal);
          });
        }
      } catch (dbErr) {
        console.warn(`Firestore signal retrieval failed for user ${matchedUserId}, falling back to in-memory signals.`, dbErr);
      }
    }

    if (status) {
      activeSignals = activeSignals.filter(s => s.status === status);
    }

    res.json(activeSignals);
  });

  // API: Mark signal as executed / update execution status (called by MT5 EA/Python Bridge)
  app.post("/api/signals/:id/execute", async (req, res) => {
    const { id } = req.params;
    const { status, lotSize, executionPrice, balance, ticket, error } = req.body;
    const passphrase = req.body.passphrase || req.query.passphrase || req.headers["x-passphrase"];

    let matchedUserId: string | null = null;
    let targetSignal: Signal | null = null;

    if (passphrase) {
      const passStr = String(passphrase);
      if (passStr === bridgeConfig.passphrase) {
        matchedUserId = null;
      } else {
        matchedUserId = await resolveUserIdByPassphrase(passStr);
        if (!matchedUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }
      }
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Try to load signal from Firestore if user exists
    if (firestore && matchedUserId) {
      try {
        const sigDoc = await firestore.collection("users").doc(matchedUserId).collection("signals").doc(id).get();
        if (sigDoc.exists) {
          targetSignal = sigDoc.data() as Signal;
        }
      } catch (err) {
        console.error("Failed to load signal from Firestore for update:", err);
      }
    }

    // Fallback to in-memory find
    const signalIndex = signals.findIndex(s => s.id === id);
    if (!targetSignal && signalIndex !== -1) {
      targetSignal = signals[signalIndex];
    }

    if (!targetSignal) {
      return res.status(404).json({ error: "Signal not found" });
    }

    // Update execution status
    if (status === "Executed") {
      targetSignal.status = "Executed";
      targetSignal.executedAt = new Date().toISOString();
      if (lotSize !== undefined) targetSignal.lotSize = Number(lotSize);
      if (executionPrice !== undefined) {
        targetSignal.executedPrice = Number(executionPrice);
      } else {
        const slip = (Math.random() * 0.3 + 0.05);
        targetSignal.executedPrice = Number((targetSignal.price + (targetSignal.type === 'BUY' ? slip : -slip)).toFixed(2));
      }
      if (balance !== undefined) targetSignal.accountBalanceUsed = Number(balance);
      targetSignal.executionDetails = ticket ? `MT5 Order #${ticket}` : "Executed on MT5";
    } else if (status === "Failed") {
      targetSignal.status = "Failed";
      targetSignal.executionDetails = error || "Execution failed";
    }

    // Update in-memory list
    if (signalIndex !== -1) {
      signals[signalIndex] = targetSignal;
    }

    // Persist signal execution state change to local disk
    saveStateToDisk();

    // Save back to Firestore if user matches
    if (firestore && matchedUserId) {
      try {
        await firestore.collection("users").doc(matchedUserId).collection("signals").doc(id).set(targetSignal);
        console.log(`[FIREBASE] Saved executed/failed signal ${id} update for user ${matchedUserId}`);
      } catch (err) {
        console.error("Failed to save updated signal to Firestore:", err);
      }
    }

    // Real-time SSE Broadcast on execution status update
    sendSSEEvent("signal_updated", targetSignal, matchedUserId);

    res.json({ message: "Signal execution status updated", signal: targetSignal });
  });

  // API: Reset / Clear all signals (for testing ease in dashboard)
  app.post("/api/signals/clear", async (req, res) => {
    const userId = getUserIdFromToken(req.headers.authorization);
    
    if (firestore && userId) {
      try {
        const querySnap = await firestore.collection("users").doc(userId).collection("signals").get();
        const batch = firestore.batch();
        querySnap.docs.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        console.log(`[FIREBASE] Cleared all signals for user ${userId}`);
      } catch (err) {
        console.error("Failed to clear signals from Firestore:", err);
      }
    }
    
    signals = [];
    saveStateToDisk();

    // Real-time SSE Broadcast on clear history
    sendSSEEvent("signals_cleared", {}, userId);

    res.json({ message: "Signal history cleared" });
  });

  // API: Get specific MT5/Python Script code based on current user configuration
  app.get("/api/download/mql5", (req, res) => {
    const hostUrl = process.env.APP_URL || `http://127.0.0.1:${PORT}`;
    const code = generateMql5Code(hostUrl, bridgeConfig);
    res.setHeader("Content-Disposition", "attachment; filename=TV_Bridge_EA.mq5");
    res.setHeader("Content-Type", "text/plain");
    res.send(code);
  });

  app.get("/api/download/python", (req, res) => {
    const hostUrl = process.env.APP_URL || `http://127.0.0.1:${PORT}`;
    const code = generatePythonCode(hostUrl, bridgeConfig);
    res.setHeader("Content-Disposition", "attachment; filename=tv_mt5_bridge.py");
    res.setHeader("Content-Type", "text/plain");
    res.send(code);
  });

  // API: Gemini Trading Assistant Chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, mode, bridgeState } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ 
          error: "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment/settings." 
        });
      }

      // 1. Determine model and config
      let selectedModel = "gemini-3.1-flash"; // Default general model
      let config: any = {
        systemInstruction: "You are Gowda Algo Bridge Assistant, an expert in algorithmic trading, TradingView webhooks, MetaTrader 5 (MT5), and Pine Script. Your role is to guide traders step-by-step through setting up their TradingView-to-MT5 connection, configuring alert webhooks, managing stop-loss/take-profit points, understanding dynamic risk sizing, and answering Pine Script queries. Always provide professional, highly accurate, and structured advice. When users ask complex questions or request deep technical analysis, utilize your thinking capabilities to deliver step-by-step reasoning."
      };

      if (mode === "low-latency") {
        selectedModel = "gemini-3.1-flash-lite";
      } else if (mode === "high-thinking") {
        selectedModel = "gemini-3.1-pro-preview";
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH
        };
        // Do NOT set maxOutputTokens for high thinking
      }

      // 2. Format contents with history & bridgeState context
      const formattedContents: any[] = [];

      // Append state context if provided as a system-like helper message or early context
      if (bridgeState) {
        const stateContext = `[BRIDGE CONTEXT] Current user config is: ${JSON.stringify(bridgeState.config)}. There are currently ${bridgeState.signalsCount} signals total, with state: ${JSON.stringify(bridgeState.recentSignals || [])}. Keep this system state in mind when answering the user's question, but don't output raw JSON of the configuration or signals unless they ask.`;
        formattedContents.push({
          role: "user",
          parts: [{ text: stateContext }]
        });
        formattedContents.push({
          role: "model",
          parts: [{ text: "Understood. I will use the bridge's current state and configuration to provide highly tailored and relevant assistance." }]
        });
      }

      // Append historical messages
      if (history && Array.isArray(history)) {
        history.forEach((msg: any) => {
          formattedContents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          });
        });
      }

      // Append final message
      formattedContents.push({
        role: "user",
        parts: [{ text: message }]
      });

      // 3. Make Gemini API call using @google/genai SDK
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config: config
      });

      res.json({
        reply: response.text,
        modelUsed: selectedModel
      });
    } catch (error: any) {
      console.error("Gemini API Error in /api/chat:", error);
      
      // Handle rate limits or temporary service unavailability gracefully
      if (error?.status === 503 || error?.status === 429 || error?.message?.includes('503') || error?.message?.includes('429')) {
         return res.status(503).json({
           error: "The AI model is currently experiencing high demand. Please try again in a few moments.",
           details: error.message
         });
      }

      res.status(500).json({ 
        error: "Failed to generate AI response", 
        details: error.message || error 
      });
    }
  });

  // API: AI Prop Firm Rule Detection with Robust Local Heuristic Fallback
  app.post("/api/detect-rules", async (req, res) => {
    const { propFirm, accountType, accountSize } = req.body;

    if (!propFirm || !accountSize) {
      return res.status(400).json({ error: "propFirm and accountSize are required" });
    }

    // High-quality offline/heuristic fallback rules generator
    const getHeuristicRules = (firm: string, type: string, size: number) => {
      const name = firm.toLowerCase();
      const accType = (type || "").toLowerCase();
      const numericSize = Number(size) || 50000;
      
      let dailyLimit = 5;
      let maxLimit = 10;
      let profitTarget = 8;
      let leverage = "1:100";
      let explanation = `Standard guidelines for ${firm} ${type || "Evaluation"} ($${numericSize.toLocaleString()}): Maximum 5% daily loss limit, 10% overall drawdown boundary, and an 8% profit milestone target.`;

      if (name.includes("ftmo")) {
        dailyLimit = 5;
        maxLimit = 10;
        profitTarget = accType.includes("funded") ? 0 : 10;
        leverage = "1:100";
        explanation = `FTMO official parameters for a $${numericSize.toLocaleString()} account: strict 5% daily drawdown limit, 10% maximum overall drawdown limit. Profit target is 10% for the step 1 challenge. Default leverage is 1:100 (1:30 for Swing accounts). Weekend holdings and news trading permitted depending on the account specification.`;
      } else if (name.includes("apex")) {
        dailyLimit = 0; // Apex doesn't have a daily limit
        maxLimit = 6;   // Trailing maximum drawdown is usually around 6%
        profitTarget = 6;
        leverage = "1:10";
        explanation = `Apex Trader Funding parameters: Trailing maximum drawdown of approximately 6% ($${Math.round(numericSize * 0.06).toLocaleString()}), 6% profit target to pass, and a minimum of 7 trading days. Standard leverage for futures trading applies (approx. 1:10 to 1:20 equivalent). No daily loss limit, only trailing maximum threshold.`;
      } else if (name.includes("fundednext")) {
        dailyLimit = 5;
        maxLimit = 10;
        profitTarget = 8;
        leverage = "1:100";
        explanation = `FundedNext parameters for a $${numericSize.toLocaleString()} evaluation: 5% daily loss threshold, 10% maximum overall drawdown. Profit target is 8% for Step 1. News trading and copy trading are allowed.`;
      } else if (name.includes("5ers") || name.includes("the 5%ers")) {
        dailyLimit = 4;
        maxLimit = 6;
        profitTarget = 10;
        leverage = "1:30";
        explanation = `The 5%ers rules: 4% daily drawdown ceiling, 6% maximum overall drawdown limit, and a 10% profit target. Default leverage is 1:30.`;
      } else if (name.includes("funded engineering") || name.includes("engineered")) {
        dailyLimit = 4;
        maxLimit = 8;
        profitTarget = 8;
        leverage = "1:50";
        explanation = `Funded Engineered rules: 4% daily loss cap, 8% overall drawdown, and an 8% profit milestone.`;
      } else if (accType.includes("funded") || accType.includes("live")) {
        profitTarget = 0;
        explanation = `Live Funded account parameters: 5% daily drawdown, 10% maximum drawdown. Profit target is 0% (unlimited earnings payout with no target milestones).`;
      }
      
      return {
        dailyLimit,
        maxLimit,
        profitTarget,
        leverage,
        explanation: `${explanation} (Configured via robust local prop database due to Gemini network status)`
      };
    };

    // If API key is not configured, immediately use high-quality heuristics
    if (!process.env.GEMINI_API_KEY) {
      console.log("Gemini API key is not configured. Falling back to local heuristics database.");
      const fallback = getHeuristicRules(propFirm, accountType, accountSize);
      return res.json(fallback);
    }

    try {
      const prompt = `You are an expert on prop trading firm rules and parameters.
Retrieve the rules, drawdown limits, profit targets, and default leverage for:
Prop Firm: ${propFirm}
Account Type: ${accountType || "Evaluation"}
Account Size: $${accountSize}

Provide the most accurate and up-to-date values for this prop firm as of 2026.
You MUST respond with a JSON object in the exact format shown below, and NOTHING else. No markdown wraps, just raw JSON.

{
  "dailyLimit": <number, e.g. 5 for 5% daily limit. If there is no daily limit, put 0>,
  "maxLimit": <number, e.g. 10 for 10% max limit. If there is no limit, put 0>,
  "profitTarget": <number, e.g. 8 for 8% target. If none, put 0>,
  "leverage": <string, e.g. "1:100", "1:30", "1:200">,
  "explanation": <string, a concise paragraph explaining the rules they must abide by (e.g. minimum trading days, consistency rule, news restrictions, weekend holding)>
}`;

      // Use gemini-3.1-flash as the fast and reliable standard model
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "{}";
      const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const resultData = JSON.parse(cleanedJson);

      res.json(resultData);
    } catch (error: any) {
      console.warn("Gemini API Error in /api/detect-rules, using local heuristic database:", error.message || error);
      const fallback = getHeuristicRules(propFirm, accountType, accountSize);
      res.json(fallback);
    }
  });

  // Vite middleware setup for development, static assets for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
