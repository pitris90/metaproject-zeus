#!/bin/sh
set -e

if [ -n "$OPENSTACK_GITLAB_TOKEN" ]; then
  git config --global credential.helper \
    "!f() { echo username=oauth2; echo password=$OPENSTACK_GITLAB_TOKEN; }; f"
fi

if [ -n "$OPENSTACK_GIT_AUTHOR_NAME" ]; then
  git config --global user.name "$OPENSTACK_GIT_AUTHOR_NAME"
fi

if [ -n "$OPENSTACK_GIT_AUTHOR_EMAIL" ]; then
  git config --global user.email "$OPENSTACK_GIT_AUTHOR_EMAIL"
fi

exec npm run start:dev
