#!/bin/sh
set -e

mkdir -p /root/.ssh

if [ -n "$OPENSTACK_GITLAB_HOST" ]; then
  ssh-keyscan "$OPENSTACK_GITLAB_HOST" >> /root/.ssh/known_hosts 2>/dev/null || true
fi

exec npm run start:dev
