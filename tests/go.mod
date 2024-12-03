module github.com/rancher/rancher-turtles-e2e/tests

go 1.22.0

toolchain go1.23.3

require (
	github.com/onsi/ginkgo/v2 v2.22.0
	github.com/onsi/gomega v1.34.2
	github.com/rancher-sandbox/ele-testhelpers v0.0.0-20241114104736-0d5b41ca9158
	github.com/rancher-sandbox/qase-ginkgo v1.0.1
	github.com/sirupsen/logrus v1.9.3
)

require (
	github.com/antihax/optional v1.0.0 // indirect
	github.com/bramvdbogaerde/go-scp v1.2.1 // indirect
	github.com/go-logr/logr v1.4.2 // indirect
	github.com/go-task/slim-sprig/v3 v3.0.0 // indirect
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/google/pprof v0.0.0-20241203143554-1e3fdc7de467 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	go.qase.io/client v0.0.0-20231114201952-65195ec001fa // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	golang.org/x/crypto v0.29.0 // indirect
	golang.org/x/net v0.31.0 // indirect
	golang.org/x/oauth2 v0.24.0 // indirect
	golang.org/x/sys v0.27.0 // indirect
	golang.org/x/text v0.20.0 // indirect
	golang.org/x/tools v0.27.0 // indirect
	google.golang.org/protobuf v1.35.2 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	libvirt.org/libvirt-go-xml v7.4.0+incompatible // indirect
)

replace go.qase.io/client => github.com/rancher/qase-go/client v0.0.0-20231114201952-65195ec001fa
