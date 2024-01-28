#!/usr/bin/env bash

set -e
SCRIPT_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
REPOSITORY_ROOT="$(realpath "${SCRIPT_DIR}/../..")"
source "${REPOSITORY_ROOT}/.build/includes/npm.sh"

run_docker_npm_shared npm install
