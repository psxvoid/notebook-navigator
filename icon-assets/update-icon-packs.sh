#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="${SCRIPT_DIR}/scripts/update-icon-packs.ts"

if [[ ! -f "${SCRIPT_PATH}" ]]; then
    echo "Unable to locate update script at ${SCRIPT_PATH}" >&2
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "npx is required to run icon pack updates" >&2
    exit 1
fi

npx tsx "${SCRIPT_PATH}" "$@"
