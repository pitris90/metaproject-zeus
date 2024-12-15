ARG BASE_IMAGE=node:21-alpine3.17

FROM $BASE_IMAGE AS node_modules

COPY cli/package*.json /app/cli/
RUN \
	cd /app/cli &&\
	npm install

FROM $BASE_IMAGE AS dev

WORKDIR /app/cli

ENV NODE_ENV=development

# ----- copy shared modules
COPY shared/ /app/shared

# ----- copy node_modules for CLI
COPY --from=node_modules /app/cli/node_modules /app/cli/node_modules
COPY --from=node_modules /app/cli/package*.json /app/cli/

# ---- copy CLI files
COPY cli/tsconfig*.json /app/cli/
COPY cli/nest-cli.json /app/cli

COPY cli/src /app/cli/src
