#!/bin/bash

PROJECT="adamvalalsky/metaproject-zeus"
IMAGE="api"
TAG="latest"

REGISTRY="ghcr.io"
FQIMAGE="${REGISTRY}/${PROJECT}/${IMAGE}:${TAG}"

docker build -t "${FQIMAGE}" -f ../api/docker/nest-js-prod/Dockerfile ../.
docker login ${REGISTRY} -u adamvalalsky
docker push "${FQIMAGE}"