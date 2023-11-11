ARG BASE_IMAGE

FROM $BASE_IMAGE AS node_modules

COPY api/package*.json /app/api/
RUN \
	cd /app/api &&\
	npm install

FROM $BASE_IMAGE AS dev

WORKDIR /app/api

ENV NODE_ENV=development

COPY --from=node_modules /app/api/node_modules /app/api/node_modules

COPY api/tsconfig*.json /app/api/
COPY api/nest-cli.json /app/api

COPY api/config /app/api/config
COPY api/src /app/api/src

ENTRYPOINT npm run start:dev
