#!/usr/bin/env bash
# Retries launching the Always Free Ampere A1 VM across every Frankfurt Availability Domain
# until capacity opens, then attaches the reserved public IP.
#
# Required environment variables:
#   COMPARTMENT_OCID   OCI compartment OCID
#   SUBNET_OCID        civo-public-subnet OCID
#   NSG_OCID           civo-web-nsg OCID
#   IMAGE_OCID         Canonical Ubuntu 24.04 aarch64 image OCID
#   RESERVED_IP_OCID   Existing Always Free reserved public IP OCID
#   SSH_PUBKEY_FILE    Path to initial admin SSH public key
#
# Optional:
#   SLEEP_SECONDS      Delay between full rounds (default: 40)
set -Eeuo pipefail

: "${COMPARTMENT_OCID:?set COMPARTMENT_OCID}"
: "${SUBNET_OCID:?set SUBNET_OCID}"
: "${NSG_OCID:?set NSG_OCID}"
: "${IMAGE_OCID:?set IMAGE_OCID}"
: "${RESERVED_IP_OCID:?set RESERVED_IP_OCID}"
: "${SSH_PUBKEY_FILE:?set SSH_PUBKEY_FILE}"

SLEEP_SECONDS="${SLEEP_SECONDS:-40}"
REGION="${OCI_REGION:-eu-frankfurt-1}"

readarray -t ADS < <(
  oci iam availability-domain list \
    --compartment-id "${COMPARTMENT_OCID}" \
    --query 'data[].name' \
    --raw-output | tr -d '[]," ' | sed '/^$/d'
)

existing_id="$(
  oci compute instance list \
    --compartment-id "${COMPARTMENT_OCID}" \
    --display-name 'civo-app-1' \
    --query 'data[?"lifecycle-state"!=`TERMINATED` && "lifecycle-state"!=`TERMINATING`].id | [0]' \
    --raw-output || true
)"

instance_id="${existing_id:-}"
round=0

while [[ -z "${instance_id}" || "${instance_id}" == "null" ]]; do
  round=$((round + 1))
  if (( round % 2 == 0 )); then
    profiles=("2:12" "2:8" "1:6" "1:4")
  else
    profiles=("2:12")
  fi

  printf '[%s] Round %d across %d ADs (%s)...\n' "$(date -u +%FT%TZ)" "${round}" "${#ADS[@]}" "${REGION}"
  for profile in "${profiles[@]}"; do
    ocpus="${profile%%:*}"
    mem="${profile##*:}"
    for ad in "${ADS[@]}"; do
      out="$(
        oci compute instance launch \
          --compartment-id "${COMPARTMENT_OCID}" \
          --availability-domain "${ad}" \
          --display-name 'civo-app-1' \
          --shape 'VM.Standard.A1.Flex' \
          --shape-config "{\"ocpus\":${ocpus},\"memoryInGBs\":${mem}}" \
          --image-id "${IMAGE_OCID}" \
          --boot-volume-size-in-gbs 100 \
          --subnet-id "${SUBNET_OCID}" \
          --assign-public-ip false \
          --hostname-label 'civo-app-1' \
          --nsg-ids "[\"${NSG_OCID}\"]" \
          --ssh-authorized-keys-file "${SSH_PUBKEY_FILE}" \
          --is-pv-encryption-in-transit-enabled true \
          --query 'data.id' \
          --raw-output 2>&1 || true
      )"
      if [[ "${out}" == ocid1.instance.* ]]; then
        instance_id="${out}"
        printf '[%s] Launched %s (%s OCPU / %s GB) in %s\n' "$(date -u +%FT%TZ)" "${instance_id}" "${ocpus}" "${mem}" "${ad}"
        break 2
      fi
      sleep 2
    done
  done

  if [[ -z "${instance_id}" || "${instance_id}" == "null" ]]; then
    sleep "${SLEEP_SECONDS}"
  fi
done

printf 'Waiting for %s to enter RUNNING state...\n' "${instance_id}"
while true; do
  state="$(
    oci compute instance get --instance-id "${instance_id}" \
      --query 'data."lifecycle-state"' --raw-output
  )"
  [[ "${state}" == "RUNNING" ]] && break
  sleep 8
done

vnic_id="$(
  oci compute vnic-attachment list \
    --compartment-id "${COMPARTMENT_OCID}" \
    --instance-id "${instance_id}" \
    --query 'data[0]."vnic-id"' --raw-output
)"
private_ip_id="$(
  oci network private-ip list \
    --vnic-id "${vnic_id}" \
    --query 'data[?"is-primary"].id | [0]' --raw-output
)"

oci network public-ip update \
  --public-ip-id "${RESERVED_IP_OCID}" \
  --private-ip-id "${private_ip_id}" \
  --force >/dev/null

printf 'OCI host ready: %s (reserved IP %s attached)\n' "${instance_id}" "${RESERVED_IP_OCID}"

