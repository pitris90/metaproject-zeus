#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

PROJECT="adamvalalsky/metaproject-zeus"
IMAGE="api"
TAG="latest"

REGISTRY="ghcr.io"
FQIMAGE="${REGISTRY}/${PROJECT}/${IMAGE}:${TAG}"

docker build -t "${FQIMAGE}" -f ${SCRIPT_DIR}/../api/docker/nest-js-prod/Dockerfile ${SCRIPT_DIR}../.
docker login ${REGISTRY} -u adamvalalsky
docker push "${FQIMAGE}"