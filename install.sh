#!/bin/bash
# Flint — Local-first Knowledge Base
# Install Script v1.0.0

set -e

FLINT_DIR="$HOME/.flint"
FLINT_REPO="https://github.com/flint-app/flint"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║         ⬡ Flint ⬡               ║"
echo "  ║    Local-first Knowledge Base    ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "   Please install Node.js v18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm --version) found"

# Create Flint directory
mkdir -p "$FLINT_DIR"
mkdir -p "$FLINT_DIR/vaults"
mkdir -p "$FLINT_DIR/bin"

echo "✅ Created $FLINT_DIR"

# Clone or update the repository
if [ -d "$FLINT_DIR/src" ]; then
    echo "📦 Updating source..."
    cd "$FLINT_DIR"
    git pull origin main 2>/dev/null || true
else
    echo "📦 Downloading Flint..."
    git clone "$FLINT_REPO" "$FLINT_DIR" 2>/dev/null || {
        echo "⚠️  Could not clone from git. Building from current directory..."
        # If we're already in the project directory, just use it
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        cp -r "$SCRIPT_DIR/src" "$FLINT_DIR/src" 2>/dev/null || true
        cp -r "$SCRIPT_DIR/public" "$FLINT_DIR/public" 2>/dev/null || true
        cp "$SCRIPT_DIR/package.json" "$FLINT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR/tsconfig.json" "$FLINT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR/vite.config.ts" "$FLINT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR/index.html" "$FLINT_DIR/" 2>/dev/null || true
        cp -r "$SCRIPT_DIR/install.sh" "$FLINT_DIR/" 2>/dev/null || true
        cp -r "$SCRIPT_DIR/update.sh" "$FLINT_DIR/" 2>/dev/null || true
    }
fi

cd "$FLINT_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production=false 2>/dev/null || npm install

# Build the project
echo "🔨 Building Flint..."
npm run build

# Create launcher script
cat > "$FLINT_DIR/bin/flint" << 'LAUNCHER'
#!/bin/bash
FLINT_DIR="$HOME/.flint"
cd "$FLINT_DIR"

# Try to serve the built files
if command -v npx &> /dev/null; then
    npx serve dist -l 4200 -s &
    BROWSER_PID=$!
    echo "Flint is running at http://localhost:4200"
    echo "Press Ctrl+C to stop"
    wait $BROWSER_PID
elif command -v python3 &> /dev/null; then
    cd "$FLINT_DIR/dist"
    python3 -m http.server 4200 &
    BROWSER_PID=$!
    echo "Flint is running at http://localhost:4200"
    echo "Press Ctrl+C to stop"
    wait $BROWSER_PID
else
    echo "Open $FLINT_DIR/dist/index.html in your browser"
fi
LAUNCHER

chmod +x "$FLINT_DIR/bin/flint"

# Try to add to PATH
if [ -d "$HOME/.local/bin" ]; then
    ln -sf "$FLINT_DIR/bin/flint" "$HOME/.local/bin/flint" 2>/dev/null || true
fi

echo ""
echo "  ✅ Flint installed successfully!"
echo ""
echo "  Run 'flint' to start, or:"
echo "  → cd $FLINT_DIR && npm run preview"
echo ""
echo "  Your vaults are stored in: $FLINT_DIR/vaults/"
echo "  All data is local and secure."
echo ""
