#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo "🚀 Updating TradingView-To-MT5 VPS App"
echo "=========================================="

# 1. Fetch latest changes from Git
echo "📥 1. Pulling latest updates from Git repository..."
git pull origin main || git pull

# 2. Install dependencies
echo "📦 2. Installing npm dependencies..."
npm install

# 3. Build project
echo "🔨 3. Building application..."
npm run build

# 4. Restart server via PM2
echo "🔄 4. Restarting PM2 process 'tradingview-bridge'..."
if command -v pm2 &> /dev/null; then
    pm2 restart tradingview-bridge || pm2 restart server || pm2 start dist/server.cjs --name "tradingview-bridge"
    echo "✅ PM2 process restarted successfully!"
else
    echo "⚠️ PM2 is not installed globally. Restarting with npm start..."
    npm start
fi

echo "=========================================="
echo "🎉 Update complete! Your VPS application is live."
echo "=========================================="
