#!/bin/bash

# Archives a directory and GPG-encrypts it (symmetric AES256) in a single stream,
# so the plaintext archive is never written to disk.
#
# Usage: encrypt-artifact.sh <source-dir> <output-file>
#
# The passphrase is read from the LOG_ENCRYPTION_KEY environment variable.
# The archive is never gzipped: the upload step compresses it anyway, and the
# largest payload -- Cypress videos -- is already-compressed mp4.
#
# A missing source directory is not an error: nothing is written and the caller's
# upload step skips the artifact via "if-no-files-found: ignore".

set -eo pipefail

SOURCE_DIR="${1:?source directory is required}"
OUTPUT="${2:?output file is required}"
: "${LOG_ENCRYPTION_KEY:?LOG_ENCRYPTION_KEY is required}"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "No ${SOURCE_DIR} directory found; skipping ${OUTPUT}."
  exit 0
fi

# The passphrase goes over fd 3 rather than the command line to keep it out of
# the process table; fd 0 is taken by the tar stream.
#
# Encrypt to a .part file and rename only on success, so a failing tar (e.g. a
# video still being flushed) can never leave a truncated archive for the upload
# step -- which runs under always() -- to publish as if it were valid.
tar -c -C "${SOURCE_DIR}" . \
  | gpg --symmetric --cipher-algo AES256 --batch --passphrase-fd 3 --output "${OUTPUT}.part" 3<<<"${LOG_ENCRYPTION_KEY}"

mv "${OUTPUT}.part" "${OUTPUT}"
