#!/usr/bin/env bash

set -x
SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

PROJECT_NAME=ALL
export PROJECT_NAME

mkdir -p "${SCRIPT_DIR}/../temp/bash_history"

"${SCRIPT_DIR}/../api/.build/npm-install.sh"
"${SCRIPT_DIR}/../shared/.build/prepare-dev.sh"