#!/usr/bin/env bash
# Backend of the qase composite action, see action.yml for the commands and env.
# POST_MIGRATION_DEFAULT_RANCHER_VERSION and POST_UPGRADE_DEFAULT_RANCHER_VERSION
# are taken from the workflow env (master-e2e.yaml).
set -euo pipefail

API=https://api.qase.io/v1

qase() {
  curl -s --show-error --fail -H "Token: ${QASE_API_TOKEN}" -H "accept: application/json" "$@"
}

milestone() {
  # Migration and upgrade runs end on the upgrade target, so the milestone
  # must track that version rather than the one installed first.
  # WARN: Unlike e2e job, this will not flag if RANCHER_UPGRADE_VERSION is invalid,
  # so a milestone might still be created even if the job later fails.
  if [[ "${GREPTAGS}" =~ @migration ]]; then
    RANCHER_VERSION="${RANCHER_UPGRADE_VERSION:-${POST_MIGRATION_DEFAULT_RANCHER_VERSION}}"
  fi
  if [[ "${GREPTAGS}" =~ @upgrade ]]; then
    RANCHER_VERSION="${RANCHER_UPGRADE_VERSION:-${POST_UPGRADE_DEFAULT_RANCHER_VERSION}}"
  fi

  local channel="${RANCHER_VERSION%%/*}"
  local version="${RANCHER_VERSION#*/}"
  # Extract base version (e.g. "v2.15.1-<sha>-head" -> "2.15.1")
  # Examples: 2.15.10. v2.15, v2.15-1-head-bla
  if [[ "${version}" =~ ^v?([0-9]+\.[0-9]+(\.[0-9]+)?) ]]; then
    # Rematch returns first () matching group
    version="${BASH_REMATCH[1]}"
  fi

  local title
  # If no patch version found (for e.g. version=2.15), calculate the latest patch version
  if [[ "${version}" =~ ^[0-9]+\.[0-9]+$ ]]; then
    # Query the latest released patch for this minor version
    local latest latest_patch
    latest=$(gh api --paginate "repos/rancher/rancher/releases?per_page=100" \
      --jq '.[] | select(.prerelease == false) | .tag_name' | \
      { grep "^v${version}\." || true; } | sort -V | tail -n 1)
    if [[ -z "${latest}" ]]; then
      latest_patch=-1
    else
      latest_patch="${latest##*.}"
    fi
    title="v${version}.$(( latest_patch + 1 ))" # For not released yet: -1+1=0
  else
    title="v${version}"
  fi

  # Append "-head" to the milestone title if the channel is "head" and this is a dev run
  if [[ "${channel}" =~ head && "${TURTLES_DEV_CHART}" == "true" ]]; then
    title="${title}-head"
  fi

  echo "milestone=${title}" | tee -a "${GITHUB_OUTPUT}"

  # Finish here if QASE reporting not enabled
  if [[ "${QASE_REPORT}" != "true" ]]; then
    return
  fi

  # 1. Try to find existing milestone ID
  local id
  id=$(qase --request GET --url "${API}/milestone/${QASE_PROJECT_CODE}?search=${title}&limit=100" \
    | jq -r --arg TITLE "${title}" '[.result.entities[]? | select(.title == $TITLE) | .id] | min // empty')

  # 2. If not found, create it and get the new ID
  if [[ -z "${id}" ]]; then
    echo "Creating new milestone ${title} in QASE"
    id=$(qase --request POST --url "${API}/milestone/${QASE_PROJECT_CODE}" \
      --header "Content-Type: application/json" \
      --data "$(jq -n --arg t "${title}" '{title: $t, description: $t}')" \
      | jq -r '.result.id // empty')
  fi

  echo "milestone_id=${id}" | tee -a "${GITHUB_OUTPUT}"
}

set_run_milestone() {
  local status
  status=$(qase --request PATCH --url "${API}/run/${QASE_PROJECT_CODE}/${RUN_ID}" \
    --header "Content-Type: application/json" \
    --data "$(jq -n --argjson id "${MILESTONE_ID}" '{milestone_id: $id}')" \
    | jq -r '.status // empty')
  if [[ "${status}" != "true" ]]; then
    echo "Failed to set milestone ID ${MILESTONE_ID} for run ${RUN_ID}"
  fi
}

describe_run() {
  local url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
  qase --request PATCH --url "${API}/run/${QASE_PROJECT_CODE}/${RUN_ID}" \
    --header "Content-Type: application/json" \
    --data "$(jq -n --arg url "${url}" --rawfile desc "${DESCRIPTION_FILE}" '{description: ($url + "\n\n" + $desc)}')"
}

complete_run() {
  qase --request POST --url "${API}/run/${QASE_PROJECT_CODE}/${RUN_ID}/complete"
  echo "QASE run ${RUN_ID} marked as Completed" >> "${GITHUB_STEP_SUMMARY}"
}

case "${1:-}" in
  milestone)         milestone ;;
  set-run-milestone) set_run_milestone ;;
  describe-run)      describe_run ;;
  complete-run)      complete_run ;;
  *) echo "Unknown command: ${1:-}" >&2; exit 1 ;;
esac
