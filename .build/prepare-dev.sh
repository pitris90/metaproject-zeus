#!/usr/bin/env bash

set -x
SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

mkdir -p "${SCRIPT_DIR}/../temp/bash_history"

"${SCRIPT_DIR}/../api/.build/npm-install.sh"