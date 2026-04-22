#!/usr/bin/env bash
set -e

# ============================
# Flint — Install Script
# ============================

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_REPO="https://github.com/flint-editor/flint.git"
FLINT_BIN="/usr/local/bin/flint"

echo ""
echo -e "${BOLD}⬡ Flint Installer${NC}"
echo -e "${DIM}Secure, local-first knowledge base${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    if command -v curl &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v brew &> /dev/null; then
        brew install node
    else
        echo -e "${RED}Cannot install Node.js automatically. Please install it manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Create Flint directory
mkdir -p "$FLINT_DIR"
mkdir -p "$FLINT_DIR/vaults"

# Copy project files if running from source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo -e "${DIM}Installing from source directory...${NC}"
    cp -r "$SCRIPT_DIR/." "$FLINT_DIR/src/"
    cd "$FLINT_DIR/src"
else
    # Clone from repo
    if [ ! -d "$FLINT_DIR/src" ]; then
        echo -e "${DIM}Cloning Flint repository...${NC}"
        git clone "$FLINT_REPO" "$FLINT_DIR/src"
    fi
    cd "$FLINT_DIR/src"
fi

# Install dependencies
echo -e "${DIM}Installing dependencies...${NC}"
npm install --silent 2>/dev/null || npm install

# Build the project
echo -e "${DIM}Building Flint...${NC}"
npm run build

# Install Electron for desktop mode
echo -e "${DIM}Setting up desktop mode...${NC}"
if [ ! -d "$FLINT_DIR/node_modules/electron" ]; then
    cd "$FLINT_DIR"
    npm init -y --silent 2>/dev/null || true
    npm install electron --save-dev --silent 2>/dev/null || npm install electron --save-dev
fi

# Create launcher script
cat > "$FLINT_DIR/flint-desktop.sh" << 'LAUNCHER'
#!/usr/bin/env bash
FLINT_DIR="$HOME/.flint"
cd "$FLINT_DIR"
npx electron "$FLINT_DIR/src/electron/main.js" "$@"
LAUNCHER
chmod +x "$FLINT_DIR/flint-desktop.sh"

# Create CLI command (opens in browser as fallback)
cat > "$FLINT_DIR/flint-server.sh" << 'SERVER'
#!/usr/bin/env bash
FLINT_DIR="$HOME/.flint"
PORT=4777
cd "$FLINT_DIR/src"

# Kill existing server
pkill -f "python3 -m http.server $PORT" 2>/dev/null || true
pkill -f "npx serve.*$PORT" 2>/dev/null || true

# Start server
echo "Starting Flint on http://localhost:$PORT"
if command -v python3 &> /dev/null; then
    cd dist && python3 -m http.server $PORT &
elif command -v npx &> /dev/null; then
    npx serve dist -l $PORT &
else
    echo "Error: Need python3 or npx to run server"
    exit 1
fi

sleep 1

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT"
elif command -v open &> /dev/null; then
    open "http://localhost:$PORT"
fi

echo "Flint is running at http://localhost:$PORT"
echo "Press Ctrl+C to stop"
wait
SERVER
chmod +x "$FLINT_DIR/flint-server.sh"

# Create main flint command
sudo tee "$FLINT_BIN" > /dev/null << 'CMD'
#!/usr/bin/env bash
FLINT_DIR="$HOME/.flint"
# Try desktop mode first (Electron)
if [ -d "$FLINT_DIR/node_modules/electron" ]; then
    "$FLINT_DIR/flint-desktop.sh" "$@"
else
    "$FLINT_DIR/flint-server.sh" "$@"
fi
CMD
sudo chmod +x "$FLINT_BIN"

# Create desktop entry (shows in app menu)
DESKTOP_FILE="$HOME/.local/share/applications/flint.desktop"
mkdir -p "$(dirname "$DESKTOP_FILE")"

# Try to find or download an icon
ICON_PATH="$FLINT_DIR/flint-logo.png"
if [ -f "$FLINT_DIR/src/public/flint-logo.png" ]; then
    cp "$FLINT_DIR/src/public/flint-logo.png" "$ICON_PATH"
fi

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=Flint
Comment=Secure, local-first knowledge base
Exec=$FLINT_DIR/flint-desktop.sh
Icon=$ICON_PATH
Type=Application
Categories=Office;Utility;TextEditor;
Keywords=notes;markdown;knowledge;
StartupNotify=true
DESKTOP

update-desktop-database ~/.local/share/applications/ 2>/dev/null || true

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Open from app menu:  ${BOLD}Flint${NC}"
echo -e "  Or run in terminal:  ${BOLD}flint${NC}"
echo -e "  Data stored at:      ${DIM}$FLINT_DIR${NC}"
echo ""
echo -e "  Update:  ${BOLD}bash $FLINT_DIR/src/update.sh${NC}"
echo -e "  Remove:  ${BOLD}bash $FLINT_DIR/src/uninstall.sh${NC}"
echo ""
