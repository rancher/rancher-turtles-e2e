#!/bin/bash

set -evxo pipefail

# Variables
RANCHER_LOG_COLLECTER_COMMIT="29c3f69978a1480fa918b32775a57993750739a4"
RANCHER_LOG_COLLECTER="https://github.com/rancherlabs/support-tools/raw/${RANCHER_LOG_COLLECTER_COMMIT}/collection/rancher/v2.x/logs-collector/rancher2_logs_collector.sh"
# RANCHER_LOG_COLLECTER_SHA256=$(curl -sSfL ${RANCHER_LOG_COLLECTER} | sha256sum)
RANCHER_LOG_COLLECTER_SHA256="c3a29113c74149da2232ca3510a373d3ac7e225d04ef5ebf12371e2f9fe5e6ac" # commit 29c3f69978a1480fa918b32775a57993750739a4
RANCHER_LOG_COLLECTER="https://raw.githubusercontent.com/rancherlabs/support-tools/master/collection/rancher/v2.x/logs-collector/rancher2_logs_collector.sh"

CRUST_VERSION="v0.13.1"
CRUST_GATHER_INSTALLER="https://raw.githubusercontent.com/crust-gather/crust-gather/refs/tags/${CRUST_VERSION}/install.sh"
# CRUST_GATHER_INSTALLER_SHA256=$(curl -sSfL ${CRUST_GATHER_INSTALLER} | sha256sum)
CRUST_GATHER_INSTALLER_SHA256="b51cb2f18a7452e70b0d0f3090428a46ed97257ed0572c808f06e30885c29e4b" # v0.13.1

# Create directory to store logs
mkdir -p -m 755 logs
cd logs

# Download and run the log collector script
mkdir -p -m 755 cluster-logs
cd cluster-logs
curl -L ${RANCHER_LOG_COLLECTER} -o rancherlogcollector.sh
echo "${RANCHER_LOG_COLLECTER_SHA256}  rancherlogcollector.sh" | sha256sum -c -

chmod +x rancherlogcollector.sh
sudo ./rancherlogcollector.sh -d ../cluster-logs

# Move back to logs dir
cd ..

# Download, install and run the crust-gather script
mkdir -p -m 755 crust-gather-logs
cd crust-gather-logs

curl -L ${CRUST_GATHER_INSTALLER} -o crust-gather-installer.sh
echo "${CRUST_GATHER_INSTALLER_SHA256}  crust-gather-installer.sh" | sha256sum -c -

chmod +x crust-gather-installer.sh
sudo VERSION=${CRUST_VERSION} ./crust-gather-installer.sh -y

crust-gather collect

cat > USAGE.md <<EOF
To use crust-gather; do the following:
1. Make the 'crust-gather-installer.sh' script executable with: 'chmod +x crust-gather-installer.sh'.
2. Run the command 'sudo crust-gather-installer.sh -y' to install 'crust-gather' binary.
3. 'touch kubeconfig'
4. 'export KUBECONFIG=kubeconfig'
5. Start the server in backgroud on a port: 'crust-gather serve --socket 127.0.0.1:8089 &'
6. Check the content of kubeconfig file: 'cat kubeconfig'
7. Run any kubectl command to check if it works: 'kubectl get pods -A'.

Ref: https://github.com/crust-gather/crust-gather
EOF

# Move back to logs dir
cd ..

# Done!
exit 0
