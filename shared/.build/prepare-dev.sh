#!/usr/bin/env bash

set -e

: "${PROJECT_NAME?"Missing PROJECT_NAME variable"}"

SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
SHARED_DIR="$(realpath "${SCRIPT_DIR}/..")"

. "${SCRIPT_DIR}/include/shared.sh"

findProjectPaths

for PROJECT_PATH in ${PROJECT_PATHS}; do
	PROJECT_NAME="$(basename "${PROJECT_PATH}")"

	if [ ! -f "${PROJECT_PATH}/package.json" ]; then
		echo "Project \"${PROJECT_NAME}\" has no package.json"
		return
	fi

	echo "Installing package.json dependencies for \"${PROJECT_NAME}\""
	PROJECT_NAME="${PROJECT_NAME}" "${SHARED_DIR}/.build/node-install.sh"

	PREPARE_DEV_SCRIPT="${PROJECT_PATH}/.build/prepare-dev.sh"
	if [ -f "${PREPARE_DEV_SCRIPT}" ]; then
		echo "Running custom prepare-dev for \"${PROJECT_NAME}\""
		"${PREPARE_DEV_SCRIPT}"
	fi

done