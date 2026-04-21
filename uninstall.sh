#!/bin/bash
# ============================================================
#  Flint — Uninstall Script
#  Removes Flint from the system
# ============================================================

FLINT_DIR="$HOME/.flint"
FLINT_BIN="/usr/local/bin/flint"
LOCAL_BIN="$HOME/.local/bin/flint"

echo ""
echo "  Flint Uninstaller"
echo "  ─────────────────────────────"
echo ""

# Check if Flint is installed
if [ ! -d "$FLINT_DIR" ]; then
    echo "  Flint is not installed. Nothing to remove."
    exit 0
fi

# Ask for confirmation
echo "  This will remove:"
echo "    • Flint application ($FLINT_DIR)"
echo "    • All vaults and notes"
echo "    • Configuration files"
echo "    • CLI launcher"
echo ""
read -p "  Are you sure? This cannot be undone. [y/N]: " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo "  Cancelled. Flint remains installed."
    exit 0
fi

echo ""
echo "  Removing Flint..."

# Remove CLI symlinks
if [ -L "$FLINT_BIN" ] || [ -f "$FLINT_BIN" ]; then
    rm -f "$FLINT_BIN" 2>/dev/null && echo "  ✓ Removed /usr/local/bin/flint" || echo "  ! Cannot remove /usr/local/bin/flint (try sudo)"
fi

if [ -L "$LOCAL_BIN" ] || [ -f "$LOCAL_BIN" ]; then
    rm -f "$LOCAL_BIN" 2>/dev/null && echo "  ✓ Removed ~/.local/bin/flint"
fi

# Remove the Flint directory
if [ -d "$FLINT_DIR" ]; then
    rm -rf "$FLINT_DIR"
    echo "  ✓ Removed $FLINT_DIR"
fi

# Remove any shell config additions
for rcfile in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rcfile" ] && grep -q "flint" "$rcfile" 2>/dev/null; then
        echo "  Note: Flint references found in $rcfile"
        echo "  You may want to clean these up manually."
    fi
done

echo ""
echo "  ─────────────────────────────"
echo "  ✓ Flint has been completely removed."
echo ""
echo "  All vault data has been deleted."
echo "  Thank you for using Flint."
echo ""
