# TradingView-To-MT5 Windows VPS Update Script

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Updating TradingView-To-MT5 VPS App" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Git Pull
Write-Host "📥 1. Pulling latest updates from Git..." -ForegroundColor Yellow
git pull origin main

# 2. Install Dependencies
Write-Host "📦 2. Installing dependencies..." -ForegroundColor Yellow
npm install

# 3. Build Application
Write-Host "🔨 3. Building application..." -ForegroundColor Yellow
npm run build

# 4. Restart PM2 Process
Write-Host "🔄 4. Restarting PM2 process..." -ForegroundColor Yellow
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 restart tradingview-bridge
} else {
    Write-Host "⚠️ PM2 not found globally. Starting server with node..." -ForegroundColor Red
    node dist/server.cjs
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "🎉 Update complete! Application updated." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
