#!/usr/bin/env bash
# Run Cursor CLI `agent` from Cursor's embedded terminal without connection drops.
#
# Cause: Cursor injects CURSOR_AGENT, VSCODE_IPC_HOOK, etc. Nested `agent` can hit
# "Connection lost, reconnecting" loops. Clearing these before exec fixes it.
#
# Usage (from Dentago repo or anywhere):
#   ~/dentago/scripts/agent-from-cursor-terminal.sh --print "hello"
#   ~/dentago/scripts/agent-from-cursor-terminal.sh
#
set -euo pipefail
unset CURSOR_AGENT CURSOR_EXTENSION_HOST_ROLE CURSOR_LAYOUT CURSOR_WORKSPACE_LABEL \
  VSCODE_IPC_HOOK VSCODE_CODE_CACHE_PATH VSCODE_NLS_CONFIG \
  CURSOR_TERM_SESSION 2>/dev/null || true
AGENT_BIN="$(command -v agent)"
if [[ -z "$AGENT_BIN" ]]; then
  echo "agent not found in PATH. Install: curl https://cursor.com/install -fsS | bash" >&2
  exit 127
fi
exec "$AGENT_BIN" "$@"
