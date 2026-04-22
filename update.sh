#!/usr/bin/env bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"

echo ""
echo -e "${BOLD}⬡ Flint Update${NC}"
echo ""

if [ ! -d "$FLINT_DIR/src" ]; then
    echo -e "${YELLOW}Flint is not installed. Run install.sh first.${NC}"
    exit 1
fi

cd "$FLINT_DIR/src"

# Check if it's a git repo
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Not a git repository. Cannot check for updates.${NC}"
    echo -e "Reinstall with: bash install.sh"
    exit 0
fi

echo -e "Fetching latest changes..."
git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null || true

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "$LOCAL")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo ""
    echo -e "${GREEN}✓ App is up to date${NC}"
    echo -e "  Current version: $(git log --oneline -1 --format='%h %s')"
    echo ""
    exit 0
fi

echo -e "${YELLOW}Update available!${NC}"
echo -e "  Current: $(git log --oneline -1 --format='%h %s')"
echo -e "  Latest:  $(git log --oneline -1 --format='%h %s' origin/main 2>/dev/null || git log --oneline -1 --format='%h %s' origin/master 2>/dev/null)"
echo ""
echo -e "Pulling changes..."
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null

echo -e "Rebuilding..."
npm install --silent 2>/dev/null || npm install
npm run build

echo ""
echo -e "${GREEN}✓ Flint updated successfully!${NC}"
echo ""
