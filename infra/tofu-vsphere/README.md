# GitHub Runner on vSphere Provisioned by Tofu/Terraform IaC

> Current configuration is suitable for the `rancher/rancher-turtles-e2e` project.

## Preparation

1. Copy `.env.example` to `.env` and fill in the required values, then run `source .env`.
2. Copy `terraform.tfvars.example` to `terraform.tfvars` and modify the variables according to your needs.
3. Adapt the `combustion/combustion.sh` script, which executes at first boot to create users, add SSH keys, install packages, and apply other configurations.

> **Note:** The script runs on MicroOS before entering user mode within a `transactional-update shell` environment.

## VM Provisioning with Tofu

1. Run `tofu init` to install needed providers.
2. Run `tofu validate` and `tofu plan` to verify the state is valid.
3. Run `tofu apply --auto-approve` to provision the VM(s).
4. If an issue occurs, run `tofu refresh` to retrieve the current state.
5. To display the VM IP address(es), wait for the previous command to complete or run `tofu output`.
6. To delete the VM(s) provisioned by this state, run `tofu destroy --auto-approve`.

## Install GitHub Runner as a Systemd Service

1. Connect to the VM via SSH: `ssh opensuse@<ip_from_tofu_output>`
2. Navigate to [GitHub Settings > Actions > Runners](https://github.com/rancher/rancher-turtles-e2e/settings/actions/runners) and click **New self-hosted runner**.
3. Register the GitHub runner according to the instructions provided.
4. During the `config.sh` execution:
    - Keep the **Default** group
    - Provide the runner name: `vsphere-<runner-name>`
    - Add labels: `vsphere,vsphere-<runner-name>`
5. Do not run the runner using `run.sh`.
6. Install and start the GitHub runner as a systemd service: `sudo ./svc.sh install` and `sudo ./svc.sh start`.
7. Return to the runners page and verify the runner is registered and its state is **Idle**.

## Extra manual steps for rancher/turtles runners
1. Install kind by `go install sigs.k8s.io/kind@latest`
2. Install helm by `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash`
3. Install kubectl by using kuberlr:
    - `curl -L https://github.com/flavio/kuberlr/releases/download/v0.6.1/kuberlr_0.6.1_linux_amd64.tar.gz -o ~/kuberlr_0.6.1_linux_amd64.tar.gz`
    - `tar xf kuberlr_0.6.1_linux_amd64.tar.gz`
    - `cd kuberlr_0.6.1_linux_amd64/`
    - `sudo mv kuberlr /usr/local/bin/`
    - `cd /usr/local/bin/`
    - `sudo ln -s $PWD/kuberlr $PWD/kubectl`
4. Install clusterctl by:
    - `curl -L https://github.com/kubernetes-sigs/cluster-api/releases/download/v1.10.6/clusterctl-linux-amd64 -o ~/clusterctl`
    - `chmod +x ~/clusterctl`
    - `sudo mv ~/clusterctl /usr/local/bin/`
