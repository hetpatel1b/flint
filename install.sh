#!/usr/bin/env bash
set -e

# ============================
# Flint — Install Script v3
# ============================

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_APP="$FLINT_DIR/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  ⬡ Flint — Local Knowledge Base${NC}"
echo -e "${DIM}  Secure, private, desktop-first${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ---- Step 1: Check Node.js ----

echo -e "${BLUE}[1/7]${NC} Checking Node.js..."

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found.${NC}"
    echo -e "Install it from ${BOLD}https://nodejs.org${NC} (v18+) and re-run this script."
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. You have $(node -v). Please upgrade.${NC}"
    exit 1
fi

echo -e "      ${GREEN}✓${NC} Node.js $(node -v)"
echo -e "      ${GREEN}✓${NC} npm $(npm -v)"

# ---- Step 2: Clean old installation ----

echo -e "${BLUE}[2/7]${NC} Preparing installation directory..."

if [ -d "$FLINT_DIR" ]; then
    echo -e "      ${DIM}Removing old installation...${NC}"
    rm -rf "$FLINT_DIR"
fi

mkdir -p "$FLINT_APP"

# ---- Step 3: Build the web app ----

echo -e "${BLUE}[3/7]${NC} Building Flint..."

BUILD_DIR="$FLINT_DIR/.build"
mkdir -p "$BUILD_DIR"

for item in "$SCRIPT_DIR"/*; do
    name=$(basename "$item")
    case "$name" in
        node_modules|dist|.git) ;;
        *) cp -r "$item" "$BUILD_DIR/" ;;
    esac
done

cd "$BUILD_DIR"

echo -e "      ${DIM}Installing npm dependencies...${NC}"
npm install --loglevel=error 2>/dev/null || npm install

echo -e "      ${DIM}Compiling...${NC}"
npm run build

if [ ! -f "$BUILD_DIR/dist/index.html" ]; then
    echo -e "${RED}Build failed — dist/index.html not created.${NC}"
    exit 1
fi

echo -e "      ${GREEN}✓${NC} Build complete"

# ---- Step 4: Create desktop icon ----

echo -e "${BLUE}[4/7]${NC} Creating application icon..."

# Generate PNG icon using Node.js (canvas-free approach: use the SVG + convert)
ICON_DIR="$FLINT_DIR/icons"
mkdir -p "$ICON_DIR"

# Copy SVG icon
if [ -f "$BUILD_DIR/public/flint-icon.svg" ]; then
    cp "$BUILD_DIR/public/flint-icon.svg" "$ICON_DIR/flint.svg"
fi

# Copy PNG icon
if [ -f "$BUILD_DIR/public/flint-logo.png" ]; then
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_DIR/icon.png"
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_APP/icon.png"
    # Create various sizes for desktop
    cp "$BUILD_DIR/public/flint-logo.png" "$ICON_DIR/flint.png"
fi

# Try to convert SVG to PNG using available tools
if command -v convert &> /dev/null; then
    convert -background none -resize 256x256 "$ICON_DIR/flint.svg" "$ICON_DIR/flint-256.png" 2>/dev/null || true
    convert -background none -resize 128x128 "$ICON_DIR/flint.svg" "$ICON_DIR/flint-128.png" 2>/dev/null || true
    convert -background none -resize 64x64 "$ICON_DIR/flint.svg" "$ICON_DIR/flint-64.png" 2>/dev/null || true
    convert -background none -resize 48x48 "$ICON_DIR/flint.svg" "$ICON_DIR/flint-48.png" 2>/dev/null || true
    # Use the 256px as the main icon
    if [ -f "$ICON_DIR/flint-256.png" ]; then
        cp "$ICON_DIR/flint-256.png" "$FLINT_DIR/icon.png"
        cp "$ICON_DIR/flint-256.png" "$FLINT_APP/icon.png"
    fi
    echo -e "      ${GREEN}✓${NC} Icon created (ImageMagick)"
elif command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 256 -h 256 "$ICON_DIR/flint.svg" -o "$ICON_DIR/flint-256.png" 2>/dev/null || true
    if [ -f "$ICON_DIR/flint-256.png" ]; then
        cp "$ICON_DIR/flint-256.png" "$FLINT_DIR/icon.png"
        cp "$ICON_DIR/flint-256.png" "$FLINT_APP/icon.png"
    fi
    echo -e "      ${GREEN}✓${NC} Icon created (rsvg-convert)"
else
    echo -e "      ${YELLOW}⚠${NC} Using default PNG icon (install ImageMagick for better icons)"
fi

# ---- Step 5: Set up Electron app ----

echo -e "${BLUE}[5/7]${NC} Setting up desktop mode..."

# Create isolated Electron app directory with NO "type":"module"
cat > "$FLINT_APP/package.json" << 'PKGJSON'
{
  "name": "flint-desktop",
  "version": "1.0.0",
  "private": true,
  "main": "main.cjs"
}
PKGJSON

# Copy Electron main process (uses .cjs = guaranteed CommonJS)
cp "$BUILD_DIR/electron/main.cjs" "$FLINT_APP/main.cjs"

# Copy built web app
cp -r "$BUILD_DIR/dist" "$FLINT_APP/dist"

# Install Electron in the APP directory only
cd "$FLINT_APP"
echo -e "      ${DIM}Installing Electron (this may take a minute)...${NC}"
npm install electron --save-dev --loglevel=error 2>/dev/null || {
    echo -e "      ${YELLOW}Electron install from npm failed, retrying...${NC}"
    npm install electron --save-dev
}

ELECTRON_OK=false
if [ -d "$FLINT_APP/node_modules/electron" ]; then
    ELECTRON_OK=true
    EVERSION=$(node -e "console.log(require('./node_modules/electron/package.json').version)" 2>/dev/null || echo "installed")
    echo -e "      ${GREEN}✓${NC} Electron v$EVERSION"
else
    echo -e "      ${YELLOW}⚠ Electron not available. Will use browser mode.${NC}"
fi

# Clean up build directory
rm -rf "$BUILD_DIR"

# ---- Step 6: Create launcher scripts ----

echo -e "${BLUE}[6/7]${NC} Creating launcher..."

# Main launcher
cat > "$FLINT_DIR/flint" << LAUNCHER
#!/usr/bin/env bash
# Flint Desktop Launcher
if [ -d "$FLINT_APP/node_modules/electron" ]; then
    exec "$FLINT_APP/node_modules/.bin/electron" "$FLINT_APP" "\$@"
else
    echo "Flint: Electron not found, opening in browser..."
    python3 -m http.server 4777 --directory "$FLINT_APP/dist" &
    xdg-open http://localhost:4777 2>/dev/null || sensible-browser http://localhost:4777
fi
LAUNCHER
chmod +x "$FLINT_DIR/flint"

# System-wide command
FLINT_BIN="/usr/local/bin/flint"
if [ -w "/usr/local/bin" ] || [ -w "$FLINT_BIN" ]; then
    ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || {
        sudo ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || true
    }
else
    sudo ln -sf "$FLINT_DIR/flint" "$FLINT_BIN" 2>/dev/null || true
fi

echo -e "      ${GREEN}✓${NC} Command: ${BOLD}flint${NC}"

# ---- Step 7: Create desktop entry ----

echo -e "${BLUE}[7/7]${NC} Creating app menu entry..."

DESKTOP_FILE="$HOME/.local/share/applications/flint.desktop"
mkdir -p "$(dirname "$DESKTOP_FILE")"

# Determine best icon path
ICON_PATH="$FLINT_DIR/icon.png"
if [ -f "$ICON_DIR/flint-256.png" ]; then
    ICON_PATH="$ICON_DIR/flint-256.png"
fi

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=Flint
Comment=Local Knowledge Base
Exec=$FLINT_DIR/flint %U
Icon=$ICON_PATH
Type=Application
Categories=Office;Utility;TextEditor;
Keywords=notes;markdown;knowledge;
StartupNotify=true
Terminal=false
StartupWMClass=Flint
DESKTOP

chmod +x "$DESKTOP_FILE"
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true

echo -e "      ${GREEN}✓${NC} Added to app menu"

# ---- Done ----

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Open from app menu:   ${BOLD}Search 'Flint' in your app launcher${NC}"
echo -e "  Run from terminal:    ${BOLD}flint${NC}"
echo -e "  Installed at:         ${DIM}$FLINT_APP${NC}"
if [ "$ELECTRON_OK" = true ]; then
    echo -e "  Mode:                 ${GREEN}Desktop app (Electron)${NC}"
else
    echo -e "  Mode:                 ${YELLOW}Browser mode (install Electron for desktop mode)${NC}"
fi
echo ""
echo -e "  ${DIM}Update:  bash update.sh${NC}"
echo -e "  ${DIM}Remove:  bash uninstall.sh${NC}"
echo ""
