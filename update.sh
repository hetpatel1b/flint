#!/usr/bin/env bash
set -e

# ============================
# Flint — Update Script v2
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
echo -e "${BOLD}⬡ Flint Update${NC}"
echo ""

# Check if Flint is installed
if [ ! -d "$FLINT_APP" ]; then
    echo -e "${RED}Flint is not installed. Run ${BOLD}bash install.sh${NC} first."
    exit 1
fi

# ---- Git-based update (if installed from git repo) ----

if [ -d "$SCRIPT_DIR/.git" ]; then
    echo -e "${BLUE}[1]${NC} Checking for updates from git repository..."

    cd "$SCRIPT_DIR"

    # Get current commit
    CURRENT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

    # Fetch latest
    git fetch origin 2>/dev/null || {
        echo -e "${RED}Failed to fetch from remote. Check your internet connection.${NC}"
        exit 1
    }

    # Get remote commit
    REMOTE=$(git rev-parse origin/HEAD 2>/dev/null || git rev-parse @{u} 2>/dev/null || echo "unknown")

    if [ "$CURRENT" = "$REMOTE" ]; then
        echo ""
        echo -e "${GREEN}  ✓ App is up to date${NC}"
        echo -e "  ${DIM}Commit: $(echo $CURRENT | cut -c1-8)${NC}"
        echo ""
        exit 0
    fi

    echo -e "      ${DIM}New version available!${NC}"
    echo -e "      ${DIM}Current: $(echo $CURRENT | cut -c1-8)${NC}"
    echo -e "      ${DIM}Latest:  $(echo $REMOTE | cut -c1-8)${NC}"

    # Pull changes
    echo -e "      ${DIM}Pulling changes...${NC}"
    git pull origin HEAD || {
        echo -e "${RED}Failed to pull changes.${NC}"
        exit 1
    }

# ---- Source-based update (if files changed manually) ----

else
    echo -e "${BLUE}[1]${NC} Checking source files..."
    echo -e "      ${DIM}Not a git repo — will rebuild from current source.${NC}"
fi

# ---- Rebuild ----

echo -e "${BLUE}[2]${NC} Rebuilding Flint..."

BUILD_DIR="$FLINT_DIR/.build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy source files
for item in "$SCRIPT_DIR"/*; do
    name=$(basename "$item")
    case "$name" in
        node_modules|dist|.git) ;;
        *) cp -r "$item" "$BUILD_DIR/" ;;
    esac
done

cd "$BUILD_DIR"

echo -e "      ${DIM}Installing dependencies...${NC}"
npm install --loglevel=error 2>/dev/null || npm install

echo -e "      ${DIM}Building...${NC}"
npm run build

if [ ! -f "$BUILD_DIR/dist/index.html" ]; then
    echo -e "${RED}Build failed.${NC}"
    exit 1
fi

# Update the app directory — preserve node_modules (Electron)
echo -e "      ${DIM}Updating app files...${NC}"

# Only update dist and main.cjs, keep node_modules
rm -rf "$FLINT_APP/dist"
cp -r "$BUILD_DIR/dist" "$FLINT_APP/dist"
cp "$BUILD_DIR/electron/main.cjs" "$FLINT_APP/main.cjs"

if [ -f "$BUILD_DIR/public/flint-logo.png" ]; then
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_APP/icon.png"
    cp "$BUILD_DIR/public/flint-logo.png" "$FLINT_DIR/icon.png"
fi

# Clean up
rm -rf "$BUILD_DIR"

echo -e "      ${GREEN}✓${NC} Updated"

# ---- Check Electron still installed ----

if [ ! -d "$FLINT_APP/node_modules/electron" ]; then
    echo -e "      ${DIM}Re-installing Electron...${NC}"
    cd "$FLINT_APP"
    npm install electron --save-dev --loglevel=error 2>/dev/null || npm install electron --save-dev
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint updated successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
