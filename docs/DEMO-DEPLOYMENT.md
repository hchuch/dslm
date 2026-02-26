# DSLM Demo Deployment Guide

This guide covers deploying DSLM for demonstration with:
- Server running on laptop (with visible logs)
- Mobile apps on iOS and Android devices
- Network connectivity via ngrok

## Prerequisites

### On Laptop (Server)

1. **Install ngrok**
   ```bash
   brew install ngrok
   ```

2. **Authenticate ngrok** (free account required)
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
   Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

### On Mobile Devices

1. **Install Expo Go** (for development builds)
   - iOS: App Store
   - Android: Play Store

2. **Or build standalone apps** (recommended for NFC)
   ```bash
   # Build for both platforms
   eas build --profile demo --platform all
   ```

## Quick Start (Demo Day)

### 1. Start the Server with Ngrok

Run the demo script from project root:
```bash
./scripts/demo-server.sh
```

This will:
- Start the API server on port 4000
- Open the log viewer in your browser
- Start ngrok tunnel
- Display the public URL for mobile devices

### 2. Configure Mobile Apps

Set the API URL on each device. The ngrok URL will look like:
```
https://abc123.ngrok-free.app
```

**For Expo Go:**
Create/update `.env` in project root:
```
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

Then restart Expo:
```bash
npx expo start --clear
```

**For Standalone Builds:**
The API URL is baked in at build time. Either:
- Rebuild with the ngrok URL in `.env`
- Use a consistent ngrok domain (paid feature)

### 3. Open Log Viewer

The log viewer opens automatically, or navigate to:
```
http://localhost:4000/logs
```

Features:
- Real-time server logs
- Filter by level (info, warn, error)
- Search functionality
- Auto-scroll toggle

## Building Demo Apps

### Development Client (with NFC)

For NFC to work, you need a development build (not Expo Go):

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile demo --platform android
```

### Installing on Devices

**iOS:**
1. Register device UDID in Apple Developer account
2. Add device to provisioning profile
3. Download and install via QR code or direct link

**Android:**
1. Enable "Install from unknown sources"
2. Download APK and install

## Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      LAPTOP                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Server    │────│    ngrok    │────│  Log Viewer │  │
│  │  :4000      │    │   tunnel    │    │  (browser)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                            │                             │
└────────────────────────────│─────────────────────────────┘
                             │
                    Public Internet
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │   iOS   │          │ Android │          │   Web   │
   │  Device │          │  Device │          │ Browser │
   └─────────┘          └─────────┘          └─────────┘
```

## Demo Scenarios

### Ground Crew (Packing)

1. Open app on Device A
2. Login as ground crew user
3. Navigate to Shipment tab
4. Pack items into CTBs
5. Tap NFC icon to assign tags to CTBs
6. Hold NFC tag to device to write

### Astronaut (Unpacking)

1. Open app on Device B
2. Login as astronaut user
3. Tap floating "Scan" button
4. Hold NFC-tagged CTB to device
5. CTB viewer opens automatically

## Troubleshooting

### "Server connection failed"
- Check ngrok is running: `curl http://localhost:4040/api/tunnels`
- Verify URL in app matches ngrok URL exactly
- Try restarting ngrok

### NFC not working
- iOS: Ensure app is built with proper entitlements (not Expo Go)
- Android: Check NFC is enabled in device settings
- Both: Hold tag steady for 1-2 seconds

### Ngrok free tier limits
- 40 connections/minute limit
- URLs change on restart
- Consider ngrok paid plan for consistent URLs

## Alternative: Local Network

If ngrok isn't available, devices can connect directly on same WiFi:

1. Find laptop's local IP:
   ```bash
   ipconfig getifaddr en0
   ```

2. Use local URL:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.XXX:4000
   ```

Note: This only works on same network and may have firewall issues.
