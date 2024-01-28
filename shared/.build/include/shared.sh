#!/usr/bin/env bash

function findProjectPaths() {
	if [ -z "${PROJECT_NAME}" ]; then
		echo "Missing PROJECT_NAME variable"
		exit 1
	fi

	if [ "${PROJECT_NAME}" == "ALL" ]; then
		PROJECT_PATHS=$(find "${SHARED_DIR}" -mindepth 1 -maxdepth 1 -type d ! -name '.*' | sort)
	else
		if [ ! -d "${SHARED_DIR}/${PROJECT_NAME}" ]; then
			echo "PROJECT_NAME \"${PROJECT_NAME}\" is invalid"
			exit 1
		fi

		PROJECT_PATHS="${SHARED_DIR}/${PROJECT_NAME}"
	fi
}
