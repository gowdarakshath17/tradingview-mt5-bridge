# Windows VPS Setup Guide (AWS Lightsail / EC2)

This guide walks you through setting up the TradingView to MT5 Bridge on a Windows VPS, ensuring it runs 24/7 as a background Windows Service and automatically recovers from server reboots.

## 1. Prerequisites

1.  Connect to your Windows VPS via **Remote Desktop (RDP)**.
2.  Install [Node.js LTS](https://nodejs.org/en/download/) (Windows Installer).
3.  Install [Git for Windows](https://git-scm.com/download/win) (Optional, but recommended for cloning this repository).
4.  Download [NSSM (Non-Sucking Service Manager)](http://nssm.cc/download).

## 2. Prepare the Application

Open Command Prompt or PowerShell and navigate to the project directory:

```powershell
# Install dependencies
npm install

# Build the production server
npm run build
```

## 3. Run as a Windows Service using NSSM

To ensure your bridge runs 24/7—even if AWS reboots your server for updates or if you log out of your RDP session—you must run it as a Windows Service.

1.  Extract the downloaded NSSM ZIP file.
2.  Open Command Prompt as **Administrator**.
3.  Navigate to the extracted NSSM folder (e.g., `cd nssm-2.24\win64`).
4.  Install the service by running:

    ```cmd
    nssm install TradingViewBridge
    ```

5.  The NSSM GUI will open. Configure the following fields:

    *   **Path:** `C:\Program Files\nodejs\node.exe` (or wherever your `node.exe` is installed).
    *   **Arguments:** `C:\Path\To\Your\Project\dist\server.cjs` (Update with your actual project path).
    *   **Details Tab:** Set the Display Name to "TradingView Webhook Bridge".
    *   **Environment Tab:** Add your environment variables:
        ```text
        NODE_ENV=production
        PORT=3000
        TRADINGVIEW_WEBHOOK_SECRET=your_secret_here
        ```

6.  Click **Install service**.
7.  Start the service from the command line:

    ```cmd
    nssm start TradingViewBridge
    ```

## 4. AWS Lightsail / EC2 Firewall Configuration

By default, AWS blocks incoming web traffic. You must explicitly open the port you configured (default: `3000`) for the webhooks to reach your server.

1.  Go to your AWS Lightsail or EC2 console.
2.  Navigate to **Networking** -> **IPv4 Firewall**.
3.  Add a new rule:
    *   **Application:** Custom
    *   **Protocol:** TCP
    *   **Port:** 3000 (or your chosen port)
4.  *(Highly Recommended)* Restrict the source IPs to the official TradingView webhook IP addresses:
    *   `52.89.214.238`
    *   `34.212.75.30`
    *   `54.218.53.128`
    *   `52.32.178.7`
    *   `52.32.178.244`

## 5. Testing

Your VPS is now configured! To test, send a webhook from TradingView using your server's Public Static IP:
`http://YOUR_VPS_IP:3000/api/webhook`

Ensure your TradingView alert message payload contains your security passphrase or signature to pass the authorization checks.
