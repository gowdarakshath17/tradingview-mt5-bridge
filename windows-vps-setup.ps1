# ==============================================================================
# TradingView to MT5 Webhook Bridge - Windows VPS Automated Setup Script
# ==============================================================================
# Run this script in PowerShell as Administrator

Write-Host "🚀 Starting TradingView Bridge Windows VPS Setup..." -ForegroundColor Cyan

# 1. Install Node.js LTS (Requires winget, which is included in recent Windows Server versions)
Write-Host "📦 Installing Node.js LTS..." -ForegroundColor Yellow
winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements

# Refresh environment variables to use node immediately
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 2. Install project dependencies
Write-Host "📥 Installing npm dependencies..." -ForegroundColor Yellow
npm install

# 3. Build production server bundle
Write-Host "🛠 Building production server..." -ForegroundColor Yellow
npm run build

# 4. Ensure data backup directory exists for state persistence
New-Item -ItemType Directory -Force -Path "data"
New-Item -ItemType Directory -Force -Path "logs"

# 5. Install pm2 globally
Write-Host "⚙ Installing PM2 process manager globally..." -ForegroundColor Yellow
npm install -g pm2

# Note on PM2 Windows Services: PM2 works well in the console on Windows,
# but for true Windows Services that survive reboots without login, 
# 'pm2-windows-service' or 'pm2-windows-startup' is required.
Write-Host "🛡 Setting up PM2 as a Windows Service (pm2-windows-startup)..." -ForegroundColor Yellow
npm install -g pm2-windows-startup
pm2-startup install

Write-Host "🔄 Launching bridge process with PM2..." -ForegroundColor Yellow
pm2 start ecosystem.config.cjs
pm2 save

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "✅ SUCCESS! TradingView Bridge is configured to run on Windows." -ForegroundColor Green
Write-Host "   The Node server is running via PM2." -ForegroundColor Green
Write-Host "   Make sure to open port 3000 (or your configured port) in the AWS Lightsail Firewall." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
