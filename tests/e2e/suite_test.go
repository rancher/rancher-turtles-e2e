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
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Masterminds/semver/v3"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/rancher-sandbox/ele-testhelpers/kubectl"
	"github.com/rancher-sandbox/ele-testhelpers/tools"
)

var (
	arch                string
	CertManagerVersion  string
	clusterName         string
	clusterNS           string
	rancherHostname     string
	rancherChannel      string
	rancherHeadVersion  string
	rancherLogCollector string
	rancherVersion      string
	turtlesDevChart     string
)

/**
 * Execute RunHelmBinaryWithCustomErr within a loop with timeout
 * @param s options to pass to RunHelmBinaryWithCustomErr command
 * @returns Nothing, the function will fail through Ginkgo in case of issue
 */
func RunHelmCmdWithRetry(s ...string) {
	Eventually(func() error {
		output, err := kubectl.RunHelmBinaryWithOutput(s...)
		GinkgoWriter.Write([]byte(output))
		if err != nil {
			return err
		}
		return nil
	}, tools.SetTimeout(2*time.Minute), 20*time.Second).Should(Not(HaveOccurred()))
}

/**
 * isRancherManagerVersion checks if RANCHER_VERSION satisfies a semver constraint.
 * Assumes rancherEnv is always like "head/2.13", "alpha/2.13.1-rc1", "latest/2.13.0"
 * @param constraint Semver constraint string (e.g., ">=2.13", "<2.14", "2.13" etc.)
 * @returns true if RANCHER_VERSION satisfies the constraint, false otherwise
 */
func isRancherManagerVersion(constraint string) bool {
	rancherEnv := os.Getenv("RANCHER_VERSION")

	// Split "prefix/version" -> take the part after "/"
	parts := strings.SplitN(rancherEnv, "/", 2)
	versionStr := parts[1]

	// Coerce "2.13" -> "2.13.0"
	if strings.Count(versionStr, ".") == 1 {
		versionStr += ".0"
	}

	v, _ := semver.NewVersion(versionStr)
	c, _ := semver.NewConstraint(constraint)

	return c.Check(v)
}

func FailWithReport(message string, callerSkip ...int) {
	// Ensures the correct line numbers are reported
	Fail(message, callerSkip[0]+1)
}

func TestE2E(t *testing.T) {
	RegisterFailHandler(FailWithReport)
	RunSpecs(t, "Turtles End-To-End Test Suite")
}

var _ = BeforeSuite(func() {
	arch = os.Getenv("ARCH")
	CertManagerVersion = os.Getenv("CERT_MANAGER_VERSION")
	clusterName = os.Getenv("CLUSTER_NAME")
	clusterNS = os.Getenv("CLUSTER_NS")
	rancherHostname = os.Getenv("PUBLIC_DNS")
	rancherLogCollector = os.Getenv("RANCHER_LOG_COLLECTOR")
	rancherVersion = os.Getenv("RANCHER_VERSION")
	turtlesDevChart = os.Getenv("TURTLES_DEV_CHART")

	// Extract Rancher Manager channel/version to install
	if rancherVersion != "" {
		// Split rancherVersion and reset it
		s := strings.Split(rancherVersion, "/")
		rancherVersion = ""

		// Get needed informations
		rancherChannel = s[0]
		if len(s) > 1 {
			rancherVersion = s[1]
		}
		if len(s) > 2 {
			rancherHeadVersion = s[2]
		}
	}
})
