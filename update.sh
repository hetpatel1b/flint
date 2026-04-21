#!/bin/bash
# ============================================================
#  Flint — Update Script
#  Checks for updates and applies them if available
# ============================================================

set -e

FLINT_DIR="$HOME/.flint"
REPO_DIR="$FLINT_DIR/repo"
REPO_URL="https://github.com/flint-editor/flint.git"

echo ""
echo "  Flint Update Checker"
echo "  ─────────────────────────────"
echo ""

# Check if Flint is installed
if [ ! -d "$FLINT_DIR" ]; then
    echo "  ✗ Flint is not installed."
    echo "    Run: bash install.sh"
    exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
    echo "  ✗ Flint repository not found."
    echo "    Run: bash install.sh first."
    exit 1
fi

cd "$REPO_DIR"

# Save current version
CURRENT_VERSION=$(cat "$FLINT_DIR/.version" 2>/dev/null || echo "unknown")
echo "  Current version: $CURRENT_VERSION"
echo ""

# Fetch latest changes
echo "  Checking for updates..."

# Get current commit hash
OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")

# Fetch from remote
if git remote | grep -q origin; then
    git fetch origin main 2>/dev/null || {
        # If fetch fails (offline or repo not available), check local changes
        echo "  ! Cannot reach remote repository."
        echo ""
        
        # Check if there are local changes
        LOCAL_CHANGES=$(git status --porcelain 2>/dev/null | head -1)
        if [ -n "$LOCAL_CHANGES" ]; then
            echo "  Local changes detected. Rebuilding..."
        else
            echo "  App is up to date. (offline mode)"
            echo ""
            exit 0
        fi
    }
else
    echo "  ! No remote configured."
    echo "  App is up to date."
    exit 0
fi

# Get new hash after fetch
NEW_HASH=$(git rev-parse origin/main 2>/dev/null || echo "$OLD_HASH")

# Compare
if [ "$OLD_HASH" = "$NEW_HASH" ]; then
    echo ""
    echo "  ✓ App is up to date."
    echo "    No new changes found."
    echo ""
    exit 0
fi

echo ""
echo "  Updates found! Applying changes..."
echo ""

# Backup current state
echo "  [1/3] Backing up..."
BACKUP_DIR="$FLINT_DIR/backups/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r dist "$BACKUP_DIR/dist" 2>/dev/null || true
cp "$FLINT_DIR/.version" "$BACKUP_DIR/.version" 2>/dev/null || true
echo "    Backup saved to: $BACKUP_DIR"

# Pull changes
echo "  [2/3] Pulling updates..."
git pull origin main 2>/dev/null || {
    echo "    ! Pull failed. Restoring from backup..."
    cp -r "$BACKUP_DIR/dist" . 2>/dev/null || true
    exit 1
}

# Get new version info
NEW_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "$CURRENT_VERSION")

# Install dependencies and rebuild
echo "  [3/3] Rebuilding..."
npm install --silent 2>/dev/null || npm install
npm run build

# Update version file
echo "$NEW_VERSION" > "$FLINT_DIR/.version"

echo ""
echo "  ─────────────────────────────"
echo "  ✓ Flint updated successfully!"
echo "  $CURRENT_VERSION → $NEW_VERSION"
echo ""
echo "  Your vault data is preserved."
echo "  Restart Flint to use the new version."
echo ""
