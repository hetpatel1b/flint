#!/usr/bin/env bash
#
#  Flint Update Script
#  Pulls the latest changes and rebuilds
#

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_SRC="$FLINT_DIR/src"

echo ""
echo -e "${CYAN}🔥 Flint Update${NC}"
echo ""
echo -e "─────────────────────────────────────────"
echo ""

# Check if Flint is installed
if [ ! -d "$FLINT_DIR" ]; then
  echo -e "${RED}✗ Flint is not installed.${NC}"
  echo "  Run ${CYAN}bash install.sh${NC} first."
  exit 1
fi

# Save current version
CURRENT_VERSION="unknown"
if [ -f "$FLINT_DIR/config/settings.json" ]; then
  CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$FLINT_DIR/config/settings.json" | cut -d'"' -f4)
fi

echo -e "${YELLOW}Current version:${NC} $CURRENT_VERSION"
echo ""

# Pull latest changes
echo -e "${YELLOW}→${NC} Checking for updates..."

cd "$FLINT_SRC" 2>/dev/null || {
  echo -e "${RED}✗ Source directory not found.${NC}"
  echo "  Try running ${CYAN}bash install.sh${NC} again."
  exit 1
}

# Fetch and check for changes
git fetch origin main 2>/dev/null || {
  echo -e "${YELLOW}!${NC} Cannot reach remote repository."
  echo "  Checking for local changes..."
}

LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
  echo -e "${GREEN}✓${NC} Already up to date ($CURRENT_VERSION)"
  echo ""
  
  # Still rebuild in case of local changes
  read -p "Rebuild anyway? [y/N] " -r
  if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
    echo ""
    echo -e "${YELLOW}→${NC} Rebuilding..."
    npm install --silent 2>/dev/null
    npm run build 2>/dev/null
    echo -e "${GREEN}✓${NC} Rebuild complete"
  fi
  
  echo ""
  exit 0
fi

# Show changelog
echo -e "${YELLOW}→${NC} New version available!"
echo ""
echo -e "  ${BOLD}Changes:${NC}"
git log --oneline HEAD..origin/main 2>/dev/null | head -10 | while read -r line; do
  echo -e "    ${CYAN}•${NC} $line"
done
echo ""

# Pull changes
echo -e "${YELLOW}→${NC} Pulling latest changes..."
git stash 2>/dev/null || true
git pull --ff-only origin main 2>/dev/null
git stash pop 2>/dev/null || true
echo -e "${GREEN}✓${NC} Code updated"

# Install dependencies
echo -e "${YELLOW}→${NC} Installing dependencies..."
npm install --silent 2>/dev/null
echo -e "${GREEN}✓${NC} Dependencies installed"

# Build
echo -e "${YELLOW}→${NC} Building..."
npm run build 2>/dev/null
echo -e "${GREEN}✓${NC} Build complete"

# Update version in config
NEW_VERSION=$(git describe --tags --always 2>/dev/null || echo "1.0.0-$(date +%Y%m%d)")
if [ -f "$FLINT_DIR/config/settings.json" ]; then
  # Update version field
  if command -v sed &> /dev/null; then
    sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$FLINT_DIR/config/settings.json" 2>/dev/null
    rm -f "$FLINT_DIR/config/settings.json.bak"
  fi
fi

echo ""
echo -e "─────────────────────────────────────────"
echo ""
echo -e "${GREEN}✓ Flint updated to $NEW_VERSION${NC}"
echo ""
echo "  Run ${CYAN}flint${NC} to start."
echo ""
echo -e "─────────────────────────────────────────"
echo ""
