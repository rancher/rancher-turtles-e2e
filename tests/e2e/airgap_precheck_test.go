/*
Copyright © 2022 - 2026 SUSE LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package e2e_test

import (
	"fmt"
	"regexp"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"gopkg.in/yaml.v3"
)

// Global state for parsed versions
var (
	vTurtles      string
	vTurtlesChart string
	vCoreCAPI     string
	vFleet        string
	vAws          string
	vAzure        string
	vAso          string
	vGcp          string
	vVsphere      string
	vRke2         string
	vKubeadm      string
)

type imageRef struct {
	repo   string
	verVar string
}

func allProviderImages() []imageRef {
	return []imageRef{
		{"rancher/turtles", vTurtles},
		{"rancher/charts/rancher-turtles-providers", vTurtlesChart}, // This is actually chart repo
		{"rancher/cluster-api-controller", vCoreCAPI},
		{"rancher/cluster-api-addon-provider-fleet", vFleet},
		{"rancher/cluster-api-aws-controller", vAws},
		{"rancher/cluster-api-azure-controller", vAzure},
		{"rancher/cluster-api-gcp-controller", vGcp},
		{"rancher/cluster-api-vsphere-controller", vVsphere},
		{"rancher/cluster-api-provider-rke2-bootstrap", vRke2},
		{"rancher/cluster-api-provider-rke2-controlplane", vRke2},
		{"rancher/kubeadm-bootstrap-controller", vKubeadm},
		{"rancher/kubeadm-control-plane-controller", vKubeadm},
		{"rancher/azureserviceoperator", vAso},
	}
}

func componentManifestImages() []imageRef {
	return []imageRef{
		{"rancher/cluster-api-controller-components", vCoreCAPI}, // This also contains capd and kubeadm manifests
		{"rancher/cluster-api-addon-provider-fleet-components", vFleet},
		{"rancher/cluster-api-aws-controller-components", vAws},
		{"rancher/cluster-api-azure-controller-components", vAzure},
		{"rancher/cluster-api-gcp-controller-components", vGcp},
		// {"rancher/cluster-api-provider-rke2-components", vRke2}, // rke2 components in version 0.21.1 for 2.13.x is not released - known issue
		{"rancher/cluster-api-vsphere-controller-components", vVsphere},
	}
}

func getAsoVersion() string {
	// ASO doesn't have a standard release pattern, so we need to parse it differently from providers values.yaml
	asoURL := fmt.Sprintf("https://raw.githubusercontent.com/rancher/turtles/refs/tags/%s/charts/rancher-turtles-providers/values.yaml", vTurtles)
	var val struct {
		Images struct {
			InfrastructureAzure struct {
				AzureServiceOperator struct {
					Tag string `yaml:"tag"`
				} `yaml:"azureServiceOperator"`
			} `yaml:"infrastructureAzure"`
		} `yaml:"images"`
	}
	Expect(yaml.Unmarshal(fetchBytes(asoURL), &val)).To(Succeed())
	vAso = val.Images.InfrastructureAzure.AzureServiceOperator.Tag
	GinkgoWriter.Printf("ASO version from values.yaml: %s\n", vAso)
	return vAso
}

var _ = Describe("E2E - Airgap Precheck Tests", Label("airgap"), func() {
	BeforeEach(func() {
		// Test is suitable for Prime and rancher >= 2.13 only
		// Although it can be expanded to support community channels where we need basically check only rancher/cluster-api-controller (also in env) and rancher/turtles images
		if !strings.Contains(rancherChannel, "prime") || isRancherManagerVersion("<2.13") {
			Skip(fmt.Sprintf("Skipping airgap precheck: requires prime channel and Rancher >= 2.13 (channel=%q, version=%s)", rancherChannel, rancherVersion))
		}
	})

	It("Phase 1: Data gathering", func() {
		By("Fetch and Parse Versions from Rancher & Turtles Sources", func() {
			// 1. Parse Rancher build.yaml
			buildURL := fmt.Sprintf("https://raw.githubusercontent.com/rancher/rancher/v%s/build.yaml", rancherVersion)
			var build struct {
				TurtlesVersion string `yaml:"turtlesVersion"`
			}
			Expect(yaml.Unmarshal(fetchBytes(buildURL), &build)).To(Succeed())
			GinkgoWriter.Printf("Turtles version from build.yaml: %s\n", build.TurtlesVersion)
			// Convert to OCI-compatible format (replace '+' with '_')
			vTurtlesChart = strings.ReplaceAll(build.TurtlesVersion, "+", "_")
			parts := strings.Split(build.TurtlesVersion, "+up")
			Expect(parts).To(HaveLen(2))
			vTurtles = "v" + strings.TrimPrefix(parts[1], "v")
			GinkgoWriter.Printf("Trimmed Turtles version: %s\n", vTurtles)

			// 2. Parse Turtles config-prime.yaml
			turtlesURL := fmt.Sprintf("https://raw.githubusercontent.com/rancher/turtles/refs/tags/%s/internal/controllers/clusterctl/config-prime.yaml", vTurtles)
			var configMap struct {
				Data struct {
					Clusterctl string `yaml:"clusterctl.yaml"`
				} `yaml:"data"`
			}
			Expect(yaml.Unmarshal(fetchBytes(turtlesURL), &configMap)).To(Succeed())

			var inner struct {
				Providers []struct {
					Name string `yaml:"name"`
					URL  string `yaml:"url"`
				} `yaml:"providers"`
			}
			Expect(yaml.Unmarshal([]byte(configMap.Data.Clusterctl), &inner)).To(Succeed())

			re := regexp.MustCompile(`\/releases\/([^/]+)`)
			for _, p := range inner.Providers {
				if p.URL == "" {
					continue
				}
				matches := re.FindStringSubmatch(p.URL)
				if len(matches) != 2 {
					continue
				}

				switch p.Name {
				case "cluster-api":
					vCoreCAPI = matches[1]
				case "rancher-fleet":
					vFleet = matches[1]
				case "aws":
					vAws = matches[1]
				case "azure":
					vAzure = matches[1]
				case "gcp":
					vGcp = matches[1]
				case "vsphere":
					vVsphere = matches[1]
				case "rke2":
					vRke2 = matches[1]
				case "kubeadm":
					vKubeadm = matches[1]
				}
			}

			// vAso is not listed in config-prime.yaml, will be fetched separately from providers values.yaml
			vAso = getAsoVersion()

		})
	})
	It("Phase 2: Validation", func() {
		By("Verify images exist in the registry", func() {
			host := primeRegistry
			if strings.Contains(rancherVersion, "-rc") || strings.Contains(rancherVersion, "-alpha") {
				host = stgPrimeRegistry
			}
			images := allProviderImages()

			for _, i := range images {
				checkOCI(host, i.repo, i.verVar)
			}
		})

		By("Verify component manifests exist in the registry", func() {
			// Components are always stored on prime registry, even for rc/alpha releases
			host := primeRegistry
			components := componentManifestImages()

			for _, c := range components {
				checkOCI(host, c.repo, c.verVar)
			}
		})

		By("Verify images are listed in rancher-images.txt", func() {
			url := fmt.Sprintf("%s/rancher/v%s/rancher-images.txt", primeArtifactsURL, rancherVersion)
			content := string(fetchBytes(url))

			images := allProviderImages()

			for _, i := range images {
				expected := fmt.Sprintf("%s:%s", i.repo, i.verVar)
				Expect(content).To(ContainSubstring(expected), "Missing %s in rancher-images.txt", expected)
			}
		})

		By("Verify CAPI version match in package-env", func() {
			url := fmt.Sprintf("https://raw.githubusercontent.com/rancher/rancher/refs/tags/v%s/scripts/package-env", rancherVersion)
			re := regexp.MustCompile(`CLUSTER_API_CONTROLLER_TAG=(v[0-9]+\.[0-9]+\.[0-9]+)`)
			matches := re.FindStringSubmatch(string(fetchBytes(url)))
			Expect(matches).To(HaveLen(2), "CLUSTER_API_CONTROLLER_TAG not found in package-env")
			GinkgoWriter.Printf("CAPI version in package-env: %s\n", matches[1])
			Expect(matches[1]).To(Equal(vCoreCAPI), "Mismatch between config-prime.yaml and package-env")
		})
	})
})
