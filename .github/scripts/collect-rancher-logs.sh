#!/bin/bash

set -evx

# Variables
RANCHER_LOG_COLLECTER="https://raw.githubusercontent.com/rancherlabs/support-tools/master/collection/rancher/v2.x/logs-collector/rancher2_logs_collector.sh"
CRUST_GATHER_INSTALLER="https://github.com/crust-gather/crust-gather/raw/main/install.sh"
# Due to GH API rate limiting, we need to specify the crust version
CRUST_VERSION="v0.11.0"

# Create directory to store logs
mkdir -p -m 755 logs
cd logs


# Download and run the log collector script
mkdir -p -m 755 cluster-logs
cd cluster-logs
curl -L ${RANCHER_LOG_COLLECTER} -o rancherlogcollector.sh
chmod +x rancherlogcollector.sh
sudo ./rancherlogcollector.sh -d ../cluster-logs

# Move back to logs dir
cd ..

# Download, install and run the crust-gather script
mkdir -p -m 755 crust-gather-logs
cd crust-gather-logs

curl -L ${CRUST_GATHER_INSTALLER} -o crust-gather-installer.sh
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
