# Use same version of ginkgo cli as the one used in go.mod to avoid version mismatch issues
GINKGO_CLI_VERSION:=$(shell go list -m -f '{{.Version}}' github.com/onsi/ginkgo/v2)
KIND_VERSION := v0.31.0
KIND_VERSION_SHA256 := eb244cbafcc157dff60cf68693c14c9a75c4e6e6fedaf9cd71c58117cb93e3fa
KIND_KUBERNETES_VERSION := v1.36.1

deps:
	@echo "--------------------------------------------------"
	@echo "Current Ginkgo CLI Version: $(GINKGO_CLI_VERSION)"
	@echo "--------------------------------------------------"
	@go install github.com/onsi/ginkgo/v2/ginkgo@$(GINKGO_CLI_VERSION)
	@go mod tidy

# Generate tests description file
generate-readme:
	@./scripts/generate-readme > README.md

# E2E tests
e2e-install-chartmuseum:
	sudo ./scripts/deploy-chartmuseum

e2e-install-rancher: deps
	ginkgo --label-filter install -r -v ./e2e

e2e-upgrade-rancher: deps
	ginkgo --label-filter upgrade -r -v ./e2e

start-cypress-tests:
	@./scripts/start-cypress-tests

vsphere-runner-cleanup:
	@./scripts/vsphere-runner-cleanup.sh

kind-node-image:
	curl -Lo ./kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64"
	echo "${KIND_VERSION_SHA256} ./kind" | sha256sum -c -
	chmod +x ./kind
	sudo mv ./kind /usr/local/bin/kind
	kind version
	kind build node-image --type release --image kindest/node:${KIND_KUBERNETES_VERSION} ${KIND_KUBERNETES_VERSION}
