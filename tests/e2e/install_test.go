/*
Copyright © 2022 - 2023 SUSE LLC

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
	"os"
	"os/exec"
	"strings"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/rancher-sandbox/ele-testhelpers/kubectl"
	"github.com/rancher-sandbox/ele-testhelpers/rancher"
	"github.com/rancher-sandbox/ele-testhelpers/tools"
)

func waitForResourceCondition(ns, resource, condition string) {
	// Wait for resource to be created
	status, err := kubectl.Run("wait", "--namespace", ns, "--for=create", resource, "--timeout=300s")
	GinkgoWriter.Printf("kubectl wait --for=create %s/%s: %s", ns, resource, status)
	Expect(err).To(Not(HaveOccurred()), "kubectl wait --for=create %s failed: %s", resource, status)

	// Wait for the requested condition
	status, err = kubectl.Run("wait", "--namespace", ns, "--for=condition="+condition, resource, "--timeout=300s")
	GinkgoWriter.Printf("kubectl wait --for=condition=%s %s/%s: %s", condition, ns, resource, status)
	Expect(err).To(Not(HaveOccurred()), "kubectl wait --for=condition=%s %s failed: %s", condition, resource, status)
}

var _ = Describe("E2E - Install/Upgrade Rancher Manager", Label("install", "upgrade"), func() {
	It("Install/Upgrade Rancher Manager", func() {
		if Label("install").MatchesLabelFilter(GinkgoLabelFilter()) {
			By("Installing K3s", func() {
				// Get K3s installation script
				fileName := "k3s-install.sh"
				Eventually(func() error {
					return tools.GetFileFromURL("https://get.k3s.io", fileName, true)
				}, tools.SetTimeout(2*time.Minute), 10*time.Second).ShouldNot(HaveOccurred())

				// Set command and arguments
				installCmd := exec.Command("sh", fileName)
				installCmd.Env = append(os.Environ(), "INSTALL_K3S_EXEC=--disable metrics-server --write-kubeconfig-mode 0644")

				// Retry in case of (sporadic) failure...
				count := 1
				Eventually(func() error {
					// Execute K3s installation
					out, err := installCmd.CombinedOutput()
					GinkgoWriter.Printf("K3s installation loop %d:\n%s\n", count, out)
					count++
					return err
				}, tools.SetTimeout(2*time.Minute), 5*time.Second).Should(BeNil())
			})

			By("Starting K3s", func() {
				err := exec.Command("sudo", "systemctl", "start", "k3s").Run()
				Expect(err).To(Not(HaveOccurred()))

				// Delay few seconds before checking
				time.Sleep(tools.SetTimeout(20 * time.Second))
			})

			By("Waiting for K3s resources", func() {
				waitForResourceCondition("kube-system", "deployment/local-path-provisioner", "Available")
				waitForResourceCondition("kube-system", "deployment/coredns", "Available")
				waitForResourceCondition("kube-system", "deployment/traefik", "Available")
			})

			By("Configuring Kubeconfig file", func() {
				err := os.Setenv("KUBECONFIG", "/etc/rancher/k3s/k3s.yaml")
				Expect(err).To(Not(HaveOccurred()))
			})

			By("Installing CertManager", func() {
				RunHelmCmdWithRetry("repo", "add", "jetstack", "https://charts.jetstack.io")
				RunHelmCmdWithRetry("repo", "update")

				// Set flags for cert-manager installation
				flags := []string{
					"upgrade", "--install", "cert-manager", "jetstack/cert-manager",
					"--namespace", "cert-manager",
					"--create-namespace",
					"--set", "crds.enabled=true",
					"--wait", "--wait-for-jobs",
				}

				RunHelmCmdWithRetry(flags...)

				waitForResourceCondition("cert-manager", "deployment/cert-manager", "Available")
			})
		}

		By("Installing/Upgrading Rancher Manager", func() {
			// Used for providing artifical system chart during install/upgrade
			var extraFlags []string = nil
			// TODO: is this condition suitable for upgrade?
			if (isRancherManagerVersion(">=2.13")) && turtlesDevChart {
				extraEnvIndex := 1
				// For prime-optimus[-alpha] channels extraEnvIndex needs to be shifted
				// Ref. https://github.com/rancher-sandbox/ele-testhelpers/blob/main/rancher/install.go#L93
				if strings.Contains(rancherChannel, "prime-optimus") {
					extraEnvIndex = 2
				}

				entries := []struct {
					name  string
					value string
				}{
					{"CATTLE_CHART_DEFAULT_URL", "http://" + rancherHostname + ":4080" + "/git/charts"}, // Can we leave it hardcoded?
					{"CATTLE_CHART_DEFAULT_BRANCH", "dev-v2.13"},
					{"CATTLE_RANCHER_TURTLES_VERSION", "108.0.0+up99.99.99"}, // Ensure using custom built turtles
				}

				extraFlags = []string{}
				for i, e := range entries {
					idx := extraEnvIndex + i
					extraFlags = append(extraFlags,
						"--set", fmt.Sprintf("extraEnv[%d].name=%s", idx, e.name),
						"--set-string", fmt.Sprintf("extraEnv[%d].value=%s", idx, e.value),
					)
				}
				// Log the extra flags
				GinkgoWriter.Write([]byte(strings.Join(extraFlags, " ") + "\n"))
			}

			err := rancher.DeployRancherManager(rancherHostname, rancherChannel, rancherVersion, rancherHeadVersion, "none", "none", extraFlags)
			Expect(err).To(Not(HaveOccurred()))

			waitForResourceCondition("cattle-system", "deployments/rancher-webhook", "Available")

			if isRancherManagerVersion(">=2.13") {
				waitForResourceCondition("cattle-turtles-system", "deployments/rancher-turtles-controller-manager", "Available")
				waitForResourceCondition("cattle-capi-system", "deployments/capi-controller-manager", "Available")
			}
		})
	})
})
