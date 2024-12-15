ARG BASE_IMAGE=node:21-alpine3.17

FROM $BASE_IMAGE AS shared_builder

RUN apk add --no-cache bash

COPY .build/ /app/.build/
COPY shared/ /app/shared/

# install all shared dependencies
RUN cd /app/shared/database && npm run build

FROM $BASE_IMAGE AS node_modules

COPY --from=shared_builder /app/shared/ /app/shared/
COPY api/package*.json /app/api/

WORKDIR /app/api

RUN npm pkg delete scripts.prepare
RUN npm install --omit=dev

FROM $BASE_IMAGE AS build

WORKDIR /app/api

ENV NODE_ENV=production

# ----- copy shared modules
COPY --from=shared_builder /app/shared/ /app/shared/

# ----- copy node_modules for API
COPY --from=node_modules /app/api/node_modules /app/api/node_modules

# ---- copy API files
COPY api/tsconfig*.json /app/api/
COPY api/nest-cli.json /app/api

COPY api/config /app/api/config
COPY api/src /app/api/src

RUN npx @nestjs/cli build

FROM $BASE_IMAGE AS prod

WORKDIR /app/api

COPY api/package*.json /app/api/
COPY --from=shared_builder /app/shared/ /app/shared/
COPY --from=build /app/api/dist /app/api/dist
COPY --from=build /app/api/node_modules /app/api/node_modules

ENTRYPOINT ["npm", "run", "start:prod"]