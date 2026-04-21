#!/bin/bash
# Flint — Update Script
# Pulls latest changes from the repo and rebuilds

set -e

FLINT_DIR="$HOME/.flint"

echo ""
echo "  ⬡ Updating Flint..."
echo ""

if [ ! -d "$FLINT_DIR" ]; then
    echo "❌ Flint is not installed. Run install.sh first."
    exit 1
fi

cd "$FLINT_DIR"

# Save current version hash
CURRENT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Pull latest changes
echo "📦 Pulling latest changes..."
git fetch origin main 2>/dev/null || true
git pull origin main 2>/dev/null || {
    echo "⚠️  Could not pull from remote. Trying local update..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cp -r "$SCRIPT_DIR/src" "$FLINT_DIR/src" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/public" "$FLINT_DIR/public" 2>/dev/null || true
    cp "$SCRIPT_DIR/package.json" "$FLINT_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/vite.config.ts" "$FLINT_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR/index.html" "$FLINT_DIR/" 2>/dev/null || true
}

# Check if anything changed
NEW_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

if [ "$CURRENT_HASH" = "$NEW_HASH" ]; then
    echo "✅ Already up to date."
    exit 0
fi

# Install new dependencies
echo "📦 Checking dependencies..."
npm install --production=false 2>/dev/null || npm install

# Rebuild
echo "🔨 Rebuilding..."
npm run build

echo ""
echo "  ✅ Flint updated successfully!"
echo "  → Run 'flint' to start"
echo ""
