# rancher-turtles-e2e

What tests are doing:
1. Create the infra stack ( GCP runner, cert-manager, rancher )
2. Install the Turtles operator with locally built nightly chart
3. Deploy the Turtles UI extension
4. Test the Turtles menu, namespaces import features
5. Perform CAPD setup prerequisites
6. Create & Import CAPD cluster using fleet
7. Install App on imported cluster


[![UI-RM_head_2.8](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-rm_head_2.8.yaml/badge.svg?branch=main)](https://github.com/rancher-sandbox/rancher-turtles-e2e/actions/workflows/ui-rm_head_2.8.yaml)
