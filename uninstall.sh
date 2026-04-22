#!/usr/bin/env bash

# ============================
# Flint — Uninstall Script v2
# ============================

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_BIN="/usr/local/bin/flint"
DESKTOP_FILE="$HOME/.local/share/applications/flint.desktop"

echo ""
echo -e "${BOLD}⬡ Flint Uninstaller${NC}"
echo ""

if [ ! -d "$FLINT_DIR" ]; then
    echo -e "${YELLOW}Flint is not installed.${NC}"
    exit 0
fi

# Ask for confirmation
echo -e "This will remove Flint from your system."
echo ""
read -p "  Remove all vault data too? (y/N): " REMOVE_DATA
echo ""

# Remove CLI command
echo -e "${DIM}Removing CLI command...${NC}"
sudo rm -f "$FLINT_BIN" 2>/dev/null || rm -f "$FLINT_BIN" 2>/dev/null || true

# Remove desktop entry
echo -e "${DIM}Removing app menu entry...${NC}"
rm -f "$DESKTOP_FILE" 2>/dev/null || true
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true

# Remove the application
echo -e "${DIM}Removing application files...${NC}"
if [ "$REMOVE_DATA" = "y" ] || [ "$REMOVE_DATA" = "Y" ]; then
    rm -rf "$FLINT_DIR"
    echo -e "  ${GREEN}✓${NC} All data removed"
else
    # Keep vault data directory if it exists
    if [ -d "$FLINT_DIR/data" ]; then
        mv "$FLINT_DIR/data" "/tmp/flint-data-backup" 2>/dev/null || true
        rm -rf "$FLINT_DIR"
        mkdir -p "$FLINT_DIR"
        mv "/tmp/flint-data-backup" "$FLINT_DIR/data" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} App removed, data kept at ${DIM}$FLINT_DIR/data${NC}"
    else
        rm -rf "$FLINT_DIR"
        echo -e "  ${GREEN}✓${NC} App removed"
    fi
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ Flint uninstalled${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
