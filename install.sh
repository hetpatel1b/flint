#!/usr/bin/env bash
#
#  ███████╗██╗██████╗ 
#  ██╔════╝██║██╔══██╗
#  █████╗  ██║██████╔╝
#  ██╔══╝  ██║██╔═══╝ 
#  ██║     ██║██║     
#  ╚═╝     ╚═╝╚═╝     
#
#  Flint — Local-first Vault Installer
#  https://github.com/Chintanpatel24/flint
#

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

FLINT_DIR="$HOME/.flint"
FLINT_BIN="$FLINT_DIR/bin"
REPO_URL="${FLINT_REPO_URL:-https://github.com/Chintanpatel24/flint.git}"

echo ""
echo -e "${CYAN}$(cat <<'ASCII'
  ███████╗██╗██████╗ 
  ██╔════╝██║██╔══██╗
  █████╗  ██║██████╔╝
  ██╔══╝  ██║██╔═══╝ 
  ██║     ██║██║     
  ╚═╝     ╚═╝╚═╝     
ASCII
)${NC}"
echo ""
echo -e "${BOLD}  Flint — Your Local Vault${NC}"
echo -e "  Local-first. Secure. Forever free."
echo ""
echo -e "─────────────────────────────────────────"
echo ""

# Check dependencies
check_deps() {
  local missing=()
  
  if ! command -v node &> /dev/null; then
    missing+=("node")
  fi
  
  if ! command -v npm &> /dev/null; then
    missing+=("npm")
  fi
  
  if ! command -v git &> /dev/null; then
    missing+=("git")
  fi
  
  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing dependencies:${NC}"
    for dep in "${missing[@]}"; do
      echo -e "  ${RED}• $dep${NC}"
    done
    echo ""
    echo "Please install them first:"
    echo ""
    echo "  macOS:   brew install node git"
    echo "  Ubuntu:  sudo apt install nodejs npm git"
    echo "  Arch:    sudo pacman -S node npm git"
    echo ""
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} All dependencies found"
}

# Create directory structure
setup_dirs() {
  echo -e "${YELLOW}→${NC} Setting up Flint directories..."
  
  mkdir -p "$FLINT_DIR"
  mkdir -p "$FLINT_BIN"
  mkdir -p "$FLINT_DIR/vaults"
  mkdir -p "$FLINT_DIR/config"
  
  echo -e "${GREEN}✓${NC} Directory structure created at $FLINT_DIR"
}

# Clone or update repository
clone_repo() {
  if [ -d "$FLINT_DIR/src/.git" ]; then
    echo -e "${YELLOW}→${NC} Repository already exists, pulling latest..."
    cd "$FLINT_DIR/src"
    git pull --ff-only origin main 2>/dev/null || {
      echo -e "${YELLOW}!${NC} Could not pull latest. Using existing code."
    }
  else
    echo -e "${YELLOW}→${NC} Cloning Flint repository..."
    rm -rf "$FLINT_DIR/src" 2>/dev/null || true
    
    if git clone "$REPO_URL" "$FLINT_DIR/src" 2>/dev/null; then
      echo -e "${GREEN}✓${NC} Repository cloned"
    else
      echo -e "${YELLOW}!${NC} Could not clone from remote. Checking for local source..."
      # If running from the source directory itself
      SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      if [ -f "$SCRIPT_DIR/package.json" ]; then
        echo -e "${YELLOW}→${NC} Using local source from $SCRIPT_DIR"
        mkdir -p "$FLINT_DIR/src"
        cp -r "$SCRIPT_DIR/"* "$FLINT_DIR/src/" 2>/dev/null || true
        cp "$SCRIPT_DIR/".* "$FLINT_DIR/src/" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Local source copied"
      else
        echo -e "${RED}✗${NC} No source found. Please check your installation."
        exit 1
      fi
    fi
  fi
}

# Build the application
build_app() {
  echo -e "${YELLOW}→${NC} Building Flint..."
  
  cd "$FLINT_DIR/src"
  npm install --silent 2>/dev/null
  npm run build 2>/dev/null
  
  echo -e "${GREEN}✓${NC} Build complete"
}

# Create launcher scripts
create_launcher() {
  echo -e "${YELLOW}→${NC} Creating launcher..."
  
  # Create the main flint command
  cat > "$FLINT_BIN/flint" << 'LAUNCHER'
#!/usr/bin/env bash
# Flint Launcher

FLINT_DIR="$HOME/.flint"
PORT="${FLINT_PORT:-4512}"

case "${1:-open}" in
  open|run|"")
    # Start local server
    cd "$FLINT_DIR/src"
    echo "🔥 Starting Flint on http://localhost:$PORT"
    echo "   Press Ctrl+C to stop"
    echo ""
    
    # Use python or node to serve
    if command -v python3 &> /dev/null; then
      python3 -m http.server $PORT --directory dist
    elif command -v python &> /dev/null; then
      python -m SimpleHTTPServer $PORT --directory dist
    elif command -v npx &> /dev/null; then
      npx serve dist -l $PORT
    fi
    ;;
  
  build)
    cd "$FLINT_DIR/src"
    echo "🔨 Building Flint..."
    npm run build
    echo "✓ Done!"
    ;;
  
  update)
    bash "$FLINT_DIR/src/update.sh"
    ;;
  
  vaults)
    echo "Flint Vaults:"
    echo "─────────────"
    if [ -d "$FLINT_DIR/vaults" ]; then
      ls -1 "$FLINT_DIR/vaults" 2>/dev/null || echo "(empty)"
    fi
    ;;
  
  uninstall)
    echo "Are you sure you want to uninstall Flint? [y/N]"
    read -r confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      rm -rf "$FLINT_DIR"
      echo "Flint has been uninstalled."
    fi
    ;;
  
  version|--version|-v)
    echo "Flint v1.0.0"
    ;;
  
  help|--help|-h)
    echo ""
    echo "Flint — Your Local Vault"
    echo ""
    echo "Usage: flint [command]"
    echo ""
    echo "Commands:"
    echo "  open        Open Flint (default)"
    echo "  build       Rebuild from source"
    echo "  update      Update to latest version"
    echo "  vaults      List vaults"
    echo "  uninstall   Remove Flint completely"
    echo "  version     Show version"
    echo "  help        Show this help"
    echo ""
    echo "Environment:"
    echo "  FLINT_PORT  Port for local server (default: 4512)"
    echo ""
    ;;
  
  *)
    echo "Unknown command: $1"
    echo "Run 'flint help' for available commands."
    exit 1
    ;;
esac
LAUNCHER
  
  chmod +x "$FLINT_BIN/flint"
  
  echo -e "${GREEN}✓${NC} Launcher created at $FLINT_BIN/flint"
}

# Add to PATH
setup_path() {
  local shell_rc=""
  
  if [ -n "${ZSH_VERSION:-}" ]; then
    shell_rc="$HOME/.zshrc"
  elif [ -n "${BASH_VERSION:-}" ]; then
    shell_rc="$HOME/.bashrc"
  fi
  
  if [ -n "$shell_rc" ]; then
    if ! grep -q "FLINT_BIN" "$shell_rc" 2>/dev/null; then
      echo "" >> "$shell_rc"
      echo "# Flint" >> "$shell_rc"
      echo "export FLINT_BIN=\"\$HOME/.flint/bin\"" >> "$shell_rc"
      echo "export PATH=\"\$FLINT_BIN:\$PATH\"" >> "$shell_rc"
      echo -e "${GREEN}✓${NC} Added to PATH in $shell_rc"
    else
      echo -e "${GREEN}✓${NC} Already in PATH"
    fi
  fi
}

# Create desktop entry (Linux)
create_desktop_entry() {
  if [ -d "$HOME/.local/share/applications" ]; then
    cat > "$HOME/.local/share/applications/flint.desktop" << DESKTOP
[Desktop Entry]
Name=Flint
Comment=Local-first Knowledge Vault
Exec=$FLINT_BIN/flint open
Icon=$FLINT_DIR/src/public/icon.png
Terminal=true
Type=Application
Categories=Office;Utility;
Keywords=notes;markdown;knowledge;vault;
DESKTOP
    
    echo -e "${GREEN}✓${NC} Desktop entry created"
  fi
}

# Create default config
create_config() {
  if [ ! -f "$FLINT_DIR/config/settings.json" ]; then
    cat > "$FLINT_DIR/config/settings.json" << CONFIG
{
  "version": "1.0.0",
  "theme": "dark",
  "editor": {
    "fontSize": 14,
    "fontFamily": "monospace",
    "tabSize": 2,
    "wordWrap": true
  },
  "vaults": {
    "defaultPath": "$HOME/.flint/vaults"
  },
  "graph": {
    "showGrid": true,
    "nodeSize": "adaptive"
  }
}
CONFIG
    echo -e "${GREEN}✓${NC} Default config created"
  fi
}

# Main installation
main() {
  check_deps
  setup_dirs
  clone_repo
  build_app
  create_launcher
  setup_path
  create_desktop_entry 2>/dev/null || true
  create_config
  
  echo ""
  echo -e "─────────────────────────────────────────"
  echo ""
  echo -e "${GREEN}✓ Flint installed successfully!${NC}"
  echo ""
  echo "  ${BOLD}Quick start:${NC}"
  echo ""
  echo "    1. Restart your terminal (or run: source ~/.bashrc)"
  echo "    2. Run: ${CYAN}flint${NC}"
  echo "    3. Open http://localhost:4512 in your browser"
  echo ""
  echo "  ${BOLD}Commands:${NC}"
  echo ""
  echo "    ${CYAN}flint${NC}          — Start Flint"
  echo "    ${CYAN}flint update${NC}   — Update to latest version"
  echo "    ${CYAN}flint vaults${NC}   — List your vaults"
  echo "    ${CYAN}flint help${NC}     — Show all commands"
  echo ""
  echo -e "  ${YELLOW}🔒 All data is stored locally at ${FLINT_DIR}${NC}"
  echo ""
  echo -e "─────────────────────────────────────────"
  echo ""
}

main "$@"
