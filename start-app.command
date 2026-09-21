#!/bin/bash
cd "$(dirname "$0")"
export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found. Run once in Terminal:"
  echo '  curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-arm64.tar.gz -o /tmp/node.tar.gz'
  echo '  mkdir -p ~/.local && tar -xzf /tmp/node.tar.gz -C ~/.local'
  read -r -p "Press Enter to close…"
  exit 1
fi
echo "Starting Fenix Wardrobe planner at http://localhost:3001"
echo "Leave this window open. Press Ctrl+C to stop."
npm run dev
