
# MetaProject Zeus

This application provides REST API interface for MetaProject Zeus.

MetaProject Zeus is project implemented as part of a master thesis for FI MUNI. It is a system used for managing projects related to HPC, their workflows and entities related to projects. Part of this system is integration with Perun and OIDC.


## Authors

- [Adam Valalský (@adamvalalsky)](https://www.github.com/adamvalalsky)


## Run Locally

First, clone project and navigate to the project directory.

If you are using UNIX-based system or you are using WSL (have access to bash), you can run following helper script:

```bash
.build/prepare-dev.sh
```

This script should automatically install `node_modules` in all projects.

(If you don't have UNIX based system or something fails, you need to run `npm install` in this directories manually: `api`, `cli`, `shared/database`).

Then copy `.env.example` to `.env` and fill relevant variables (more in section about environment variables)


Then start server

```bash
  docker compose up
```

(If you want to have access to CLI console, start project with `docker compose up --profile cli`)

## Environment Variables

If you want to test this project, you need to copy variables from `.env.example` to `.env` and fill some variables with your values.

Most values are fine for local testing and don't have to be changed, but some values should be registered correctly. This is list of variables that should be changed for local development:

```
IDENTITY_CLIENT_ID=my-client-id
IDENTITY_CLIENT_SECRET=my-client-secret
```
Need to use correct e-infra OIDC server. Values for MetaProject Zeus server won't be public and will be provided by other channel.

```
API_PUBLICATION_MAIL_TO=test@mail.com
```
Contact mail where some logs from Crossreg API will be sent.

```
PERUN_URL=https://perun-dev.cesnet.cz/
PERUN_USER=user
PERUN_PASSWORD=password
```
Need to use for group synchronization. Requires some configuration in Perun, correct values can be provided by other channel.


## Deployment

When deploying this project only production docker image is provided for API application. If you want to run CLI commands on production later, you can create similar Dockerfile.

When deploying, application needs PostgreSQL 16.0 and Redis 7.4 to function properly (it is possible to use other versions, if you test it first). You can deploy these services separately or in containers depending on the environment. You can also use Nginx, but it is not required.

To create production image run

```bash
  docker build -t nest-js-prod -f api/docker/nest-js-prod/Dockerfile .
```

You can use this image via `docker run nest-js-prod` and provide correct enviornment variables.


## License

[MIT](https://choosealicense.com/licenses/mit/)

