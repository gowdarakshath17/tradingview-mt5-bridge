#!/usr/bin/env bash
# ==============================================================================
# TradingView to MT5 Webhook Bridge - VPS Automated Installation & Setup Script
# ==============================================================================

set -e

echo "🚀 Starting TradingView Bridge VPS Setup..."

# 1. Install Node.js LTS if not installed
if ! command -v node &> /dev/null; then
  echo "📦 Node.js not detected. Installing Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2. Install PM2 globally if missing
if ! command -v pm2 &> /dev/null; then
  echo "⚙ Installing PM2 process manager globally..."
  npm install -g pm2
fi

# 3. Install project dependencies
echo "📥 Installing npm dependencies..."
npm install

# 4. Build production server bundle
echo "🛠 Building production server & web app..."
npm run build

# 5. Ensure data backup directory exists for state persistence
mkdir -p data logs

# 6. Start or restart PM2 service
echo "🔄 Launching bridge process with PM2..."
pm2 start ecosystem.config.cjs

# 7. Configure auto-restart on VPS system reboot
echo "🛡 Setting up PM2 auto-start on server boot..."
pm2 startup || true
pm2 save

echo "=============================================================================="
echo "✅ SUCCESS! TradingView Bridge is running on port 3000."
echo "   PM2 Status:    pm2 status"
echo "   Live Logs:     pm2 logs tradingview-bridge"
echo "   Restart:       pm2 restart tradingview-bridge"
echo "=============================================================================="
