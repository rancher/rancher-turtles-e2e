module github.com/rancher/rancher-turtles-e2e/tests

go 1.24.0

toolchain go1.24.6

require (
	github.com/onsi/ginkgo/v2 v2.25.2
	github.com/onsi/gomega v1.38.2
	github.com/rancher-sandbox/ele-testhelpers v0.0.0-20250711071119-c33617a1af7a
	github.com/rancher-sandbox/qase-ginkgo v1.0.1
	github.com/sirupsen/logrus v1.9.3
)

require (
	github.com/Masterminds/semver/v3 v3.4.0 // indirect
	github.com/antihax/optional v1.0.0 // indirect
	github.com/bramvdbogaerde/go-scp v1.2.1 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-task/slim-sprig/v3 v3.0.0 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/pprof v0.0.0-20250830080959-101d87ff5bc3 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	go.qase.io/client v0.0.0-20231114201952-65195ec001fa // indirect
	go.uber.org/automaxprocs v1.6.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	go.yaml.in/yaml/v3 v3.0.4 // indirect
	golang.org/x/crypto v0.41.0 // indirect
	golang.org/x/net v0.43.0 // indirect
	golang.org/x/oauth2 v0.30.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
	golang.org/x/text v0.28.0 // indirect
	golang.org/x/tools v0.36.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	libvirt.org/libvirt-go-xml v7.4.0+incompatible // indirect
)

replace go.qase.io/client => github.com/rancher/qase-go/client v0.0.0-20231114201952-65195ec001fa
