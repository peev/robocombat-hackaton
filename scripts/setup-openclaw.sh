#!/usr/bin/env bash
# Install the BlackBox always-on agent into a local OpenClaw gateway (GB10, local Ollama only).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/opt/node24/bin:$PATH"
WS="$HOME/.openclaw/workspace"
MODEL="${LOCAL_LLM_MODEL:-gpt-oss:20b}"
SWEEP_EVERY="${SWEEP_EVERY:-15m}"

if ! command -v openclaw >/dev/null; then
  echo "Installing OpenClaw (needs Node >= 24)..."
  npm install -g openclaw@latest
fi

if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
  openclaw onboard --non-interactive --accept-risk --mode local --flow quickstart \
    --auth-choice ollama --custom-base-url "http://127.0.0.1:11434" --custom-model-id "$MODEL" \
    --gateway-bind loopback --gateway-auth token --install-daemon \
    --skip-channels --skip-search --agent-name BlackBox
fi

# A compact, explicit tool surface keeps a local 20B model's tool calls reliable.
openclaw config set tools.toolSearch false
openclaw config set tools.profile coding

mkdir -p "$WS/skills"
rm -rf "$WS/skills/robocombat-lab"
cp -r "$REPO/openclaw/skills/robocombat-lab" "$WS/skills/robocombat-lab"
cp "$REPO/openclaw/workspace/SOUL.md" "$REPO/openclaw/workspace/IDENTITY.md" "$WS/"
cp "$REPO/openclaw/workspace/HEARTBEAT.md" "$WS/"
rm -f "$WS/BOOTSTRAP.md"

systemctl --user restart openclaw-gateway
sleep 10

if ! openclaw automations list 2>/dev/null | grep -q "robocombat-sweep"; then
  openclaw automations create --name "RoboCombat regression sweep" \
    --declaration-key robocombat-sweep --agent blackbox --every "$SWEEP_EVERY" \
    --thinking low --light-context --no-deliver \
    --message 'Scheduled shift: use the robocombat-lab skill. Run the regression sweep with "source":"openclaw-cron", then file ONE shift report (source openclaw-cron) summarising the FLAGS with numbers, choosing severity info/warn/critical. Finish with a one-line summary.'
fi

openclaw automations list
echo "BlackBox agent ready. Control UI: openclaw dashboard"
