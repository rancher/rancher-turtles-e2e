# Use same version of ginkgo cli as the one used in go.mod to avoid version mismatch issues
GINKGO_CLI_VERSION:=$(shell go list -m -f '{{.Version}}' github.com/onsi/ginkgo/v2)

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
