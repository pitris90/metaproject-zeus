#!/usr/bin/env bash

SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
REPOSITORY_ROOT="$(realpath "${SCRIPT_DIR}/../..")"

source "${SCRIPT_DIR}/../../.build/includes/npm.sh"

NPM_DOCKER_ARGS=(
  --volume "${SCRIPT_DIR}/..:/app/api"
  --volume "${SCRIPT_DIR}/../../shared:/app/shared"
  --workdir /app/api
)

ENTRYPOINT_ARG=
RUN_ARGS="$@"
if [ $# -eq 0 ];  then
    ENTRYPOINT_ARG=--entrypoint ""
    RUN_ARGS=/bin/sh
fi

set -x
run_docker_npm "$@"