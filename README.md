
# MetaProject Zeus

This application provides REST API interface for MetaProject Zeus.

MetaProject Zeus is project implemented as part of a master thesis for FI MUNI. It is a system used for managing projects related to HPC, their workflows and entities related to projects. Part of this system is integration with Perun, OpenStack and OIDC.


## Authors

- [Adam Valalský (@adamvalalsky)](https://www.github.com/adamvalalsky) - original author
- [Petr Balnar (@pitris90)](https://www.github.com/pitris90) - resource usage module, collector integration


## Prerequisites
- Node.js 21
- Docker & Docker Compose
- npm


## Run Locally

1. Clone project and navigate to the project directory.
1. Copy variables from `.env.example` to `.env`
1. Change variables accordingly (see section `Environment Variables`)
1. Make sure openstack-external submodule's origin is using https instead of ssh

If you are using UNIX-based system or you are using WSL (and have access to bash), you can run following helper script:

```bash
.build/prepare-dev.sh
```

This script should automatically install `node_modules` in all projects.

(If you don't have UNIX based system or something fails, you need to run `npm install` in these directories manually: `api`, `cli`, `shared/database`).

If you are running application for the first time, you should seed database with required values (such as roles, basic resources and attributes):

```bash
docker compose run --rm nest-js-cli sh -c "npm run execute seed"
```

Then start server:

```bash
docker compose up
```

(If you want to have access to CLI console, start project with `docker compose up --profile cli`)


## Environment Variables

If you want to test this project, you need to copy variables from `.env.example` to `.env` and fill some variables with your values.

Most values are self-explanatory, are fine for local testing and don't have to be changed, but some values are confidential and should be configured correctly.

### Docker Base Images

```
BASE_IMAGE_NODE=node:21-alpine3.17
BASE_IMAGE_NGINX=nginx:1.25.3-alpine
BASE_IMAGE_POSTGRES=timescale/timescaledb:2.23.0-pg18
BASE_IMAGE_REDIS=redis:7.4.0-alpine
```
Base images for Docker containers. Usually don't need to be changed unless upgrading versions.

### Database Configuration

```
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=admin
POSTGRES_DATABASE=resource-manager
```
PostgreSQL/TimescaleDB connection settings. Default values work for local Docker development.

```
REDIS_HOST=redis.resource-manager
REDIS_PORT=6379
REDIS_PASSWORD=password
```
Redis connection settings for caching and session management. Default values work for local Docker development.

### OIDC Authentication

```
IDENTITY_ISSUER=https://login.e-infra.cz/oidc
IDENTITY_CLIENT_ID=my-client-id
IDENTITY_CLIENT_SECRET=my-client-secret
IDENTITY_CALLBACK_URL=http://localhost:3001/auth/callback
```
Used for OIDC authentication. Need to use correct e-infra OIDC server. Callback variable depends on environment, should always end with `/auth/callback`. Client ID and secret must be requested and obtained from https://spadmin.e-infra.cz/auth . After approving your request and clicking on particular service, in SAML/OIDC tab of your service you will see Client ID and Client Secret.

### API Configuration

```
CORS_ALLOW_ORIGIN=http://localhost:5137
FRONTEND_URL=http://localhost:5137
API_URL=http://nest-js-api:3000
EXTERNAL_API_PORT_HTTP=3001
```
CORS and URL configuration. `CORS_ALLOW_ORIGIN` should match where the GUI is running. `FRONTEND_URL` is used for generating links. `API_URL` is internal Docker network address.

### ReDoc API Documentation

```
REDOC_USERNAME=admin
REDOC_PASSWORD=admin
```
Basic auth credentials for accessing API documentation at `/docs`. Change in production environment.

### Perun Integration

```
PERUN_URL=https://perun-dev.cesnet.cz/
PERUN_USER=user
PERUN_PASSWORD=password
```
Used for group synchronization with Perun identity management system. Requires proper VO configuration in Perun. Credentials must be obtained from Perun administrators.

### OpenStack GitOps Integration

```
OPENSTACK_REPO_PATH=./api/src/openstack-module/openstack-external
OPENSTACK_ALLOWED_DOMAINS=einfra_cz
OPENSTACK_GIT_BASE_BRANCH=master
OPENSTACK_GIT_TARGET_BRANCH=master
OPENSTACK_GIT_AUTHOR_NAME=Zeus Bot
OPENSTACK_GIT_AUTHOR_EMAIL=zeus@example.com
OPENSTACK_GITLAB_PROJECT_ID=123
OPENSTACK_GITLAB_HOST=https://gitlab.example.com
OPENSTACK_GITLAB_TOKEN=gitlab-token
```
Configuration for OpenStack allocation requests via GitOps workflow. `OPENSTACK_REPO_PATH` points to the external submodule containing OpenStack definitions. GitLab project access token must have permissions to create merge requests on the target project. Configuration for particular OpenStack repository must be obtained from OpenStack administrator in Metacentrum, and after you will have access to the repository, you will need to generate and set `OPENSTACK_GITLAB_TOKEN` to generated project access token for given repository.

### Collector Integration

```
COLLECTOR_API_KEY=replace-me-with-generated-key
```
API key for authenticating the collector service. Generate with: `openssl rand -hex 32`. This key must match `ZEUS_API_KEY` in the collector module's `.env`.

### Other Settings

```
FILE_UPLOAD_FOLDER=./uploads
API_PUBLICATION_MAIL_TO=test@mail.com
```
`FILE_UPLOAD_FOLDER` - directory for uploaded files. `API_PUBLICATION_MAIL_TO` - contact mail where some logs from Crossref API will be sent. Not needed for proper functionality but Crossref devs can contact this email if application behaves irresponsibly.


## Deployment

When deploying this project only production docker image is provided for API application. If you want to run CLI commands on production later, you can create similar Dockerfile.

When deploying, application needs TimescaleDB (PostgreSQL 17/18 compatible build, we default to `timescale/timescaledb:2.23.0-pg18`) and Redis 7.4 to function properly (it is possible to use other versions, if you test it first). You can deploy these services separately or in containers depending on the environment. You can also use Nginx, but it is not required.

To create production image run:

```bash
docker build -t nest-js-prod -f api/docker/nest-js-prod/Dockerfile .
```

You can use this image via `docker run nest-js-prod` and provide correct environment variables.


## License

[MIT](https://choosealicense.com/licenses/mit/)

