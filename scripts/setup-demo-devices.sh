#!/bin/bash

# DSLM Demo Setup - Local Build
# Builds and installs on physical devices from this machine

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")
SERVER_URL="http://${LOCAL_IP}:4000"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         DSLM Demo Setup (Local Build)        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${DIM}Local IP: ${LOCAL_IP}${NC}"
echo -e "${DIM}Server URL: ${SERVER_URL}${NC}"
echo ""

# Update .env with current IP
echo "EXPO_PUBLIC_API_URL=${SERVER_URL}" > "$PROJECT_DIR/.env"
echo -e "${GREEN}.env updated with current IP${NC}"
echo ""

echo -e "${CYAN}What would you like to do?${NC}"
echo ""
echo -e "  ${BOLD}1)${NC} Build & install on iOS device (USB)"
echo -e "  ${BOLD}2)${NC} Build & install on Android device (USB)"
echo -e "  ${BOLD}3)${NC} Start demo server"
echo -e "  ${BOLD}4)${NC} Full demo prep (server + build instructions)"
echo -e "  ${BOLD}q)${NC} Quit"
echo ""
read -p "Choose: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}━━━ iOS Local Build ━━━${NC}"
        echo ""
        echo -e "${YELLOW}Requirements:${NC}"
        echo -e "  - iPhone connected via USB"
        echo -e "  - Xcode installed"
        echo -e "  - Apple Developer account signed in to Xcode"
        echo ""
        echo -e "${CYAN}Building and installing...${NC}"
        echo -e "${DIM}API URL baked in: ${SERVER_URL}${NC}"
        echo ""

        npx expo run:ios --device --configuration Release

        echo ""
        echo -e "${GREEN}Done! App installed on device.${NC}"
        echo -e "${YELLOW}Make sure phone is on the same WiFi as this laptop.${NC}"
        ;;

    2)
        echo ""
        echo -e "${GREEN}━━━ Android Local Build ━━━${NC}"
        echo ""

        if ! command -v adb &> /dev/null; then
            echo -e "${RED}adb not found.${NC}"
            echo -e "Install: ${CYAN}brew install --cask android-platform-tools${NC}"
            exit 1
        fi

        echo -e "${YELLOW}Requirements:${NC}"
        echo -e "  - Android phone connected via USB"
        echo -e "  - USB debugging enabled"
        echo ""

        DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l | tr -d ' ')
        if [[ $DEVICES -eq 0 ]]; then
            echo -e "${YELLOW}No Android device detected.${NC}"
            echo -e "  1. Connect phone via USB"
            echo -e "  2. Enable USB debugging (Settings > Developer Options)"
            echo -e "  3. Tap Allow on phone prompt"
            echo ""
            read -p "Press Enter when ready..."
        fi

        echo -e "${CYAN}Building and installing...${NC}"
        echo -e "${DIM}API URL baked in: ${SERVER_URL}${NC}"
        echo ""

        npx expo run:android --device --variant release

        echo ""
        echo -e "${GREEN}Done! App installed on device.${NC}"
        echo -e "${YELLOW}Make sure phone is on the same WiFi as this laptop.${NC}"
        ;;

    3)
        echo ""
        echo -e "${GREEN}━━━ Starting Demo Server ━━━${NC}"
        echo ""
        echo -e "${CYAN}Server: ${SERVER_URL}${NC}"
        echo -e "${CYAN}Log viewer will open in browser${NC}"
        echo ""

        cd "$PROJECT_DIR/server"
        npm run dev
        ;;

    4)
        echo ""
        echo -e "${GREEN}━━━ Full Demo Prep ━━━${NC}"
        echo ""
        echo -e "${BOLD}Your laptop IP: ${LOCAL_IP}${NC}"
        echo -e "${BOLD}Server URL: ${SERVER_URL}${NC}"
        echo ""
        echo -e "${CYAN}Step 1: Start the server${NC}"
        echo -e "  cd server && npm run dev"
        echo -e "  ${DIM}(or run this script with option 3)${NC}"
        echo ""
        echo -e "${CYAN}Step 2: Connect phone 1 via USB${NC}"
        echo -e "  Run this script with option 1 (iOS) or 2 (Android)"
        echo ""
        echo -e "${CYAN}Step 3: Connect phone 2 via USB${NC}"
        echo -e "  Run this script again with option 1 or 2"
        echo ""
        echo -e "${CYAN}Step 4: Verify${NC}"
        echo -e "  - Both phones on same WiFi as laptop"
        echo -e "  - Open app on each phone"
        echo -e "  - Login as different users (e.g. astronaut + mission-specialist)"
        echo -e "  - Server log viewer shows connections"
        echo ""
        echo -e "${YELLOW}Demo accounts:${NC}"
        echo -e "  Check admin panel or server seed data for usernames"
        echo ""
        echo -e "${BOLD}Network diagram:${NC}"
        echo ""
        echo -e "  Phone 1 (Astronaut)  ──┐"
        echo -e "                         ├──  Laptop (${LOCAL_IP}:4000)"
        echo -e "  Phone 2 (Specialist) ──┘    Server + DB + Log Viewer"
        echo ""
        ;;

    q|Q)
        echo "Goodbye!"
        exit 0
        ;;

    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac
