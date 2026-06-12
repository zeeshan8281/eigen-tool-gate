#!/bin/bash
# Build, push, and deploy the gate to EigenCompute, sealing the policy hash into
# the image so it enters the TDX attestation measurement.
set -euo pipefail

REGISTRY="${REGISTRY:?set REGISTRY, e.g. docker.io/youruser}"
TAG="${TAG:-latest}"
POLICY_PATH="${POLICY_PATH:-policies/demo-policy.yaml}"
NAME="${NAME:-eigen-tool-gate}"
IMAGE="${REGISTRY}/${NAME}:${TAG}"

# 1. Seal the policy → compute the hash that goes into the attestation.
POLICY_HASH=$(node --import tsx src/gate/seal.ts --policy "${POLICY_PATH}" \
  | grep 'Policy hash:' | awk '{print $3}')
echo "Sealed policy hash: ${POLICY_HASH}"

# 2. Build for the TEE (linux/amd64), pinning the policy + its hash.
docker build --platform linux/amd64 \
  --build-arg POLICY_PATH="${POLICY_PATH}" \
  --build-arg POLICY_HASH="${POLICY_HASH}" \
  -t "${IMAGE}" .

# 3. Push.
docker push "${IMAGE}"

# 4. Deploy to EigenCompute. Secrets come from .env (sealed by KMS).
ecloud compute app deploy \
  --name "${NAME}" \
  --image-ref "${IMAGE}" \
  --env-file .env \
  --instance-type g1-standard-4t \
  --log-visibility public \
  --resource-usage-monitoring enable \
  --force

echo ""
echo "Deployed. Verify the live attestation:"
echo "  ecloud compute app list"
echo "  curl https://<app-domain>/gate/attestation   # policyHash should equal ${POLICY_HASH}"
