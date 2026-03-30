#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${GHSTATUS_URL:-https://ghstatus.party}"
API="${BASE_URL}/parties/status-room/main"

if [[ -z "${ADMIN_SECRET:-}" ]]; then
  echo "Error: ADMIN_SECRET env var is required"
  echo "Usage: ADMIN_SECRET=<secret> ./cli/moderate.sh"
  exit 1
fi

AUTH="Authorization: Bearer ${ADMIN_SECRET}"

list_messages() {
  echo ""
  echo "=== Recent Messages ==="
  echo ""
  curl -s "${API}/messages" -H "${AUTH}" | python3 -c "
import json, sys, datetime
msgs = json.load(sys.stdin)
if not msgs:
    print('  (no messages)')
    sys.exit()
for m in msgs:
    ts = datetime.datetime.fromtimestamp(m['timestamp']/1000).strftime('%Y-%m-%d %H:%M')
    print(f\"  [{ts}] {m['sender']}: {m['text']}\")
    print(f\"           id: {m['id']}\")
    print()
"
}

delete_message() {
  local id="$1"
  echo "Deleting message ${id}..."
  curl -s -X DELETE "${API}/messages/${id}" -H "${AUTH}" | python3 -c "import json,sys; r=json.load(sys.stdin); print('Deleted.' if r.get('ok') else f'Error: {r}')"
}

edit_message() {
  local id="$1"
  local text="$2"
  echo "Editing message ${id}..."
  curl -s -X PATCH "${API}/messages/${id}" -H "${AUTH}" -H "Content-Type: application/json" -d "{\"text\": \"${text}\"}" | python3 -c "import json,sys; r=json.load(sys.stdin); print('Updated.' if r.get('ok') else f'Error: {r}')"
}

show_help() {
  echo "GitHub Status Party - Message Moderator"
  echo ""
  echo "Commands:"
  echo "  list            List recent messages"
  echo "  delete <id>     Delete a message"
  echo "  edit <id> <text> Edit a message"
  echo "  interactive     Interactive mode"
  echo ""
}

interactive() {
  while true; do
    list_messages
    echo "---"
    echo "Enter command (delete <id> / edit <id> <text> / refresh / quit):"
    read -r cmd args

    case "${cmd}" in
      delete|d)
        if [[ -z "${args:-}" ]]; then
          echo "Usage: delete <message-id>"
        else
          delete_message "${args}"
        fi
        ;;
      edit|e)
        local id="${args%% *}"
        local text="${args#* }"
        if [[ -z "${id}" || "${id}" == "${text}" ]]; then
          echo "Usage: edit <message-id> <new text>"
        else
          edit_message "${id}" "${text}"
        fi
        ;;
      refresh|r|list|l)
        ;;
      quit|q|exit)
        echo "Bye."
        exit 0
        ;;
      *)
        echo "Unknown command: ${cmd}"
        ;;
    esac
  done
}

case "${1:-interactive}" in
  list|ls)
    list_messages
    ;;
  delete|rm)
    if [[ -z "${2:-}" ]]; then
      echo "Usage: moderate.sh delete <message-id>"
      exit 1
    fi
    delete_message "$2"
    ;;
  edit)
    if [[ -z "${2:-}" || -z "${3:-}" ]]; then
      echo "Usage: moderate.sh edit <message-id> <new text>"
      exit 1
    fi
    edit_message "$2" "${*:3}"
    ;;
  interactive|i)
    interactive
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    show_help
    exit 1
    ;;
esac
