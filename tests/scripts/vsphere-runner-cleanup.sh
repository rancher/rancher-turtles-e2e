#!/bin/bash

# do not exit on failure
set +e

# uninstall chartmuseum
sudo systemctl stop chartmuseum
sudo rm /etc/systemd/system/chartmuseum.service
sudo systemctl daemon-reload
sudo rm /usr/local/bin/chartmuseum
sudo helm plugin uninstall cm-push
# Stop all docker containers and remove everything
docker stop $(docker ps --all --quiet)
docker system prune --all --volumes --force
# destroy k3s cluster
/usr/local/bin/k3s-killall.sh
/usr/local/bin/k3s-uninstall.sh
# Delete all files in the workspace
[ -n "${WORKSPACE}" ] && [ -d "${WORKSPACE}" ] && rm -r "${WORKSPACE}"/*

# Ensure the script always returns 0
true
