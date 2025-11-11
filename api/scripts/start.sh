#!/bin/sh
set -e

if [ -n "$OPENSTACK_GITLAB_TOKEN" ]; then
  git config --global credential.helper \
    "!f() { echo username=oauth2; echo password=$OPENSTACK_GITLAB_TOKEN; }; f"
fi

exec npm run start:dev
