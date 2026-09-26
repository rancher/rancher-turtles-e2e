#!/bin/bash

set -eo pipefail

# Variables

# Rancher support-tools log collector (pinned by commit + checksum)
RANCHER_LOG_COLLECTER_COMMIT="e7f54d109240991a5477444eb855cf3a4a52c224"
RANCHER_LOG_COLLECTER_PATH="collection/rancher/v2.x/logs-collector/rancher2_logs_collector.sh"
RANCHER_LOG_COLLECTER="https://raw.githubusercontent.com/rancherlabs/support-tools/${RANCHER_LOG_COLLECTER_COMMIT}/${RANCHER_LOG_COLLECTER_PATH}"
RANCHER_LOG_COLLECTER_SHA256="e5ba2d6b89d00bbb062b0d6c54809137961a388c21fe98ad001bd4c22451514d"
# To refresh SHA256:
# RANCHER_LOG_COLLECTER_SHA256="$(curl -sSfL "${RANCHER_LOG_COLLECTER}" | sha256sum | awk '{print $1}')"

# crust-gather installer (pinned by tag + checksum)
CRUST_GATHER_INSTALLER_VERSION="v0.17.1"
CRUST_GATHER_INSTALLER="https://raw.githubusercontent.com/crust-gather/crust-gather/refs/tags/${CRUST_GATHER_INSTALLER_VERSION}/install.sh"
CRUST_GATHER_INSTALLER_SHA256="b51cb2f18a7452e70b0d0f3090428a46ed97257ed0572c808f06e30885c29e4b"
# To refresh SHA256:
# CRUST_GATHER_INSTALLER_SHA256="$(curl -sSfL "${CRUST_GATHER_INSTALLER}" | sha256sum | awk '{print $1}')"

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
# Delete the script
rm rancherlogcollector.sh

# Move back to logs dir
cd ..

# Download, install and run the crust-gather script
mkdir -p -m 755 crust-gather-logs
cd crust-gather-logs

curl -L ${CRUST_GATHER_INSTALLER} -o crust-gather-installer.sh
echo "${CRUST_GATHER_INSTALLER_SHA256}  crust-gather-installer.sh" | sha256sum -c -

chmod +x crust-gather-installer.sh
sudo VERSION=${CRUST_GATHER_INSTALLER_VERSION} ./crust-gather-installer.sh -y

# Turn the comma-separated SECRET_KEYS_TO_MASK list into one --secret flag per key.
IFS=',' read -ra SECRET_KEYS <<< "${SECRET_KEYS_TO_MASK:?SECRET_KEYS_TO_MASK is required}"
SECRET_ARGS=()
for KEY in "${SECRET_KEYS[@]}"; do
  [ -n "${KEY}" ] && SECRET_ARGS+=(--secret "${KEY}")
done

# Read keys from VSPHERE_SECRETS_JSON_BASE64, export them as envvars and add them to the SECRET_ARGS array.
# This ensures they are also masked in logs.
VSPHERE_SECRETS_JSON_BASE64_DECODED=$(base64 -d <<< "${VSPHERE_SECRETS_JSON_BASE64:?VSPHERE_SECRETS_JSON_BASE64 is required}")

# ensure the secrets are JSON compliant with identifier-safe keys;
# this is to ensure we do not accidentally log the json to output.
# On failure we skip the export loop instead of aborting, so the rest of the collection still runs.
if jq -e 'type == "object" and all(keys[]; test("^[A-Za-z_][A-Za-z0-9_]*$"))' >/dev/null 2>&1 <<< "${VSPHERE_SECRETS_JSON_BASE64_DECODED}"; then
  # read keys from VSPHERE_SECRETS_JSON_BASE64, export them as envvars and add them to the SECRET_ARGS array.
  while IFS= read -r -d '' KEY && IFS= read -r -d '' VAL; do
    export "${KEY}=${VAL}"
    SECRET_ARGS+=(--secret "${KEY}")
  done < <(jq -j 'to_entries[] | "\(.key)\u0000\(.value)\u0000"' 2>/dev/null <<< "${VSPHERE_SECRETS_JSON_BASE64_DECODED}")
else
  echo "ERROR: VSPHERE_SECRETS_JSON_BASE64 is not a JSON object with identifier-safe keys; skipping vSphere secret masking" >&2
fi


crust-gather collect "${SECRET_ARGS[@]}"


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
