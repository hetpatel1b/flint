#!/usr/bin/env bash

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_BIN="/usr/local/bin/flint"
DESKTOP_FILE="$HOME/.local/share/applications/flint.desktop"

echo ""
echo -e "${BOLD}⬡ Flint Uninstaller${NC}"
echo ""
echo -e "This will remove:"
echo -e "  • All vaults and notes"
echo -e "  • Application files"
echo -e "  • Desktop entry"
echo -e "  • CLI command"
echo ""

# Confirm
read -p "Are you sure you want to uninstall Flint? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Kill running processes
echo -e "Stopping Flint processes..."
pkill -f "electron.*flint" 2>/dev/null || true
pkill -f "flint-desktop" 2>/dev/null || true
pkill -f "flint-server" 2>/dev/null || true
pkill -f "python3 -m http.server 4777" 2>/dev/null || true
sleep 1

# Remove desktop entry
if [ -f "$DESKTOP_FILE" ]; then
    rm -f "$DESKTOP_FILE"
    update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
    echo -e "  ✓ Removed desktop entry"
fi

# Remove CLI command
if [ -f "$FLINT_BIN" ]; then
    sudo rm -f "$FLINT_BIN"
    echo -e "  ✓ Removed CLI command"
fi

# Ask about data
read -p "Also delete all vault data and notes? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$FLINT_DIR"
    echo -e "  ✓ Removed all data"
else
    # Keep data, just remove app
    rm -rf "$FLINT_DIR/src"
    rm -rf "$FLINT_DIR/node_modules"
    rm -f "$FLINT_DIR/flint-desktop.sh"
    rm -f "$FLINT_DIR/flint-server.sh"
    rm -f "$FLINT_DIR/package.json"
    rm -f "$FLINT_DIR/package-lock.json"
    echo -e "  ${GREEN}Vault data preserved at $FLINT_DIR/vaults${NC}"
fi

# Clean shell config
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ] && grep -q "flint" "$rc" 2>/dev/null; then
        sed -i '/flint/d' "$rc" 2>/dev/null || true
    fi
done

echo ""
echo -e "${GREEN}✓ Flint has been uninstalled${NC}"
echo ""
