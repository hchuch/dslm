#!/bin/bash

# DSLM Demo Server Script
# Starts the API server and exposes it via ngrok for mobile device access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PORT=${PORT:-4000}

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         DSLM Demo Server Setup           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}Error: ngrok is not installed${NC}"
    echo -e "Install it with: ${YELLOW}brew install ngrok${NC}"
    echo -e "Or download from: https://ngrok.com/download"
    exit 1
fi

# Check if ngrok is authenticated
if ! ngrok config check &> /dev/null; then
    echo -e "${YELLOW}Warning: ngrok may not be configured${NC}"
    echo -e "Run: ${YELLOW}ngrok config add-authtoken YOUR_TOKEN${NC}"
    echo ""
fi

# Kill any existing processes on the port
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Start the server in the background
echo -e "${GREEN}Starting DSLM API server on port $PORT...${NC}"
cd "$(dirname "$0")/../server"
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
echo -e "${YELLOW}Waiting for server to start...${NC}"
sleep 3

# Check if server is running
if ! curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
    echo -e "${RED}Server failed to start. Check the logs.${NC}"
    exit 1
fi

echo -e "${GREEN}Server is running!${NC}"
echo ""

# Start ngrok
echo -e "${GREEN}Starting ngrok tunnel...${NC}"
echo ""
ngrok http $PORT --log=stdout &
NGROK_PID=$!

# Wait for ngrok to initialize
sleep 2

# Get the ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    DEMO READY!                               ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}Ngrok URL:${NC} ${YELLOW}$NGROK_URL${NC}"
    echo ""
    echo -e "  ${BLUE}Log Viewer:${NC} http://localhost:$PORT/logs"
    echo ""
    echo -e "  ${BLUE}For mobile apps, set:${NC}"
    echo -e "  ${YELLOW}EXPO_PUBLIC_API_URL=$NGROK_URL${NC}"
    echo ""
    echo -e "  ${BLUE}Press Ctrl+C to stop all services${NC}"
    echo ""
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    echo -e "${GREEN}Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
