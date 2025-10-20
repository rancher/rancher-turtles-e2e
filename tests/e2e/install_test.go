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

var (
	// Create kubectl context
	// Default timeout is too small, so New() cannot be used
	k = &kubectl.Kubectl{
		Namespace:    "",
		PollTimeout:  tools.SetTimeout(300 * time.Second),
		PollInterval: 500 * time.Millisecond,
	}
)

func rolloutDeployment(ns, d string) {
	// NOTE: 1st or 2nd rollout command can sporadically fail, so better to use Eventually here
	Eventually(func() string {
		status, _ := kubectl.Run("rollout", "restart", "deployment/"+d,
			"--namespace", ns)
		return status
	}, tools.SetTimeout(1*time.Minute), 20*time.Second).Should(ContainSubstring("restarted"))

	// Wait for deployment to be restarted
	Eventually(func() string {
		status, _ := kubectl.Run("rollout", "status", "deployment/"+d,
			"--namespace", ns)
		return status
	}, tools.SetTimeout(2*time.Minute), 30*time.Second).Should(ContainSubstring("successfully rolled out"))
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

			By("Waiting for K3s to be started", func() {
				// Wait for all pods to be started
				checkList := [][]string{
					{"kube-system", "app=local-path-provisioner"},
					{"kube-system", "k8s-app=kube-dns"},
					{"kube-system", "app.kubernetes.io/name=traefik"},
					{"kube-system", "svccontroller.k3s.cattle.io/svcname=traefik"},
				}
				Eventually(func() error {
					return rancher.CheckPod(k, checkList)
				}, tools.SetTimeout(4*time.Minute), 30*time.Second).Should(BeNil())
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

				checkList := [][]string{
					{"cert-manager", "app.kubernetes.io/component=controller"},
					{"cert-manager", "app.kubernetes.io/component=webhook"},
					{"cert-manager", "app.kubernetes.io/component=cainjector"},
				}
				Eventually(func() error {
					return rancher.CheckPod(k, checkList)
				}, tools.SetTimeout(4*time.Minute), 30*time.Second).Should(BeNil())
			})
		}

		By("Installing/Upgrading Rancher Manager", func() {
			var extraFlags []string = nil
			if turtlesDevChart == "true" && (isRancherManagerVersion(">=2.13")) {
				// Following condition needs to be reviewed because nowadays heads build don't use any extraEnv
				// if rancherHeadVersion != "" || strings.Contains(rancherChannel, "prime-optimus") {
				//	extraEnvIndex = 2
				//}
				extraEnvIndex := 1
				extraFlags := []string{
					"--set", fmt.Sprintf("extraEnv[%d].name=CATTLE_FEATURES", extraEnvIndex),
					"--set-string", fmt.Sprintf("extraEnv[%d].value=turtles=false\\,embedded-cluster-api=true", extraEnvIndex),
				}
				// Log the extra flags
				GinkgoWriter.Write([]byte(strings.Join(extraFlags, " ") + "\n"))
			}

			err := rancher.DeployRancherManager(rancherHostname, rancherChannel, rancherVersion, rancherHeadVersion, "none", "none", extraFlags)
			Expect(err).To(Not(HaveOccurred()))

			// Wait for all pods to be started
			checkList := [][]string{
				{"cattle-system", "app=rancher"},
				{"cattle-fleet-local-system", "app=fleet-agent"},
				{"cattle-system", "app=rancher-webhook"},
			}
			Eventually(func() error {
				return rancher.CheckPod(k, checkList)
			}, tools.SetTimeout(4*time.Minute), 30*time.Second).Should(BeNil())

			// Apply the workaround for disabling embedded cluster API on dev
			if turtlesDevChart == "true" {
				// Run the bash commands from Go
				_, err := kubectl.Run("apply", "-f", "https://raw.githubusercontent.com/rancher/turtles/refs/heads/main/test/e2e/data/rancher/pre-turtles-install.yaml")
				Expect(err).To(BeNil())

				_, err = kubectl.Run("delete", "mutatingwebhookconfiguration", "mutating-webhook-configuration", "--ignore-not-found")
				Expect(err).To(BeNil())

				_, err = kubectl.Run("delete", "validatingwebhookconfiguration", "validating-webhook-configuration", "--ignore-not-found")
				Expect(err).To(BeNil())

				time.Sleep(10 * time.Second)

				_, err = kubectl.Run("rollout", "status", "deployment/rancher", "-n", "cattle-system", "--timeout=1m")
				Expect(err).To(BeNil())
			}

			// A bit dirty be better to wait a little here for all to be correctly started
			time.Sleep(2 * time.Minute)
		})
	})
})
