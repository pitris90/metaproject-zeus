ARG BASE_IMAGE

FROM $BASE_IMAGE

WORKDIR /app/api

COPY api/package*.json /app/api/
COPY api/tsconfig*.json /app/api/
COPY api/nest-cli.json /app/api
COPY api/node_modules /app/api/node_modules

COPY api/src /app/api/src

ENTRYPOINT npm run start:dev
