deps:
	@go install -mod=mod github.com/onsi/ginkgo/v2/ginkgo
	@go install -mod=mod github.com/onsi/gomega
	@go mod tidy

# Qase commands
create-qase-run: deps
	@go run e2e/helpers/qase/helper_qase.go -create
delete-qase-run: deps
	@go run e2e/helpers/qase/helper_qase.go -delete
publish-qase-run: deps
	@go run e2e/helpers/qase/helper_qase.go -publish

# Generate tests description file
generate-readme:
	@./scripts/generate-readme > README.md

# E2E tests
e2e-install-chartmuseum:
	sudo ./scripts/deploy-chartmuseum

e2e-install-rancher: deps
	ginkgo --label-filter install -r -v ./e2e

start-cypress-tests:
	@./scripts/start-cypress-tests

vsphere-runner-cleanup:
	@./scripts/vsphere-runner-cleanup.sh
