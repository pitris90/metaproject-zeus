#!/usr/bin/env bash

SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

source "${SCRIPT_DIR}/../../.env"
mkdir -p "$DOCKER_NPM_CACHE_FOLDER"

ENTRYPOINT_ARG=
RUN_ARGS="$@"
if [ $# -eq 0 ];  then
    ENTRYPOINT_ARG=--entrypoint ""
    RUN_ARGS=/bin/sh
fi

set -x
docker run --rm -it \
	--workdir /app/api \
	--volume "${DOCKER_NPM_CACHE_FOLDER}:/tmp/cache" \
	--env "npm_config_cache=/tmp/cache" \
	--volume "${SCRIPT_DIR}/..:/app/api" \
	--user "$(id -u):$(id -g)" \
	${ENTRYPOINT_ARG} \
	"${BASE_IMAGE_NODE}" \
	${RUN_ARGS}