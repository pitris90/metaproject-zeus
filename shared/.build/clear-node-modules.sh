#!/usr/bin/env bash

set -e
SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
SHARED_DIR="$(realpath "${SCRIPT_DIR}/..")"

. "${SCRIPT_DIR}/include/shared.sh"

findProjectPaths

for PROJECT_PATH in ${PROJECT_PATHS}; do
	rm -rf "${PROJECT_PATH}/node_modules"
done
