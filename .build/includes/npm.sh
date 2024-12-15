function run_docker_npm() {
  : "${REPOSITORY_ROOT?"Missing REPOSITORY_ROOT variable"}"
  : "${NPM_DOCKER_ARGS?"Missing NPM_DOCKER_ARGS variable (need at least volume with project files)"}"

  source "${REPOSITORY_ROOT}/.env"
  mkdir -p "$DOCKER_NPM_CACHE_FOLDER"

  docker run --rm -it \
    "${NPM_DOCKER_ARGS[@]}" \
    --volume "${DOCKER_NPM_CACHE_FOLDER}:/tmp/cache" \
    --env "npm_config_cache=/tmp/cache" \
    --user "$(id -u):$(id -g)" \
    ${ENTRYPOINT_ARG} \
    "${BASE_IMAGE_NODE}" \
    "$@"
}

function run_docker_npm_shared() {
  : "${PROJECT_NAME?"Missing PROJECT_NAME variable"}"
  [ ! -d "${REPOSITORY_ROOT}/shared/${PROJECT_NAME}" ] && (
    echo "Invalid PROJECT_NAME value"
    exit 1
  )

  NPM_DOCKER_ARGS=(
		--volume "${REPOSITORY_ROOT}/shared:/app/shared"
		--workdir "/app/shared/${PROJECT_NAME}"
	)
  run_docker_npm "$@"
}