# OCI Always Free Infrastructure

Reusable OpenTofu / Terraform configuration for the Oracle Cloud Infrastructure host (`eu-frankfurt-1`):

- `civo-vcn` (`10.10.0.0/16`), `civo-igw`, `civo-public-rt`, `civo-base-seclist`, and `civo-public-subnet` (`10.10.1.0/24`).
- `civo-web-nsg`: allows inbound TCP `443` **only** from Cloudflare's published IPv4 edge CIDRs, TCP `22` for forced-command/admin SSH, and ICMP `3/4` for Path MTU discovery. All other inbound ports (`80`, `3000`, `8025`, `5432`) stay closed at the VCN perimeter.
- `civo-app-1`: `VM.Standard.A1.Flex` (`2` OCPUs, `12 GB` RAM, `100 GB` boot volume on Canonical Ubuntu 24.04 aarch64) within Always Free limits.
- Reuses an existing reserved public IP (`oci_core_public_ip.reserved`, marked `prevent_destroy = true`); import an already-provisioned reserved IP before `apply`:

```bash
terraform init
terraform import oci_core_public_ip.reserved <reserved-public-ip-ocid>
terraform apply
```

If `eu-frankfurt-1` returns `Out of host capacity` for `VM.Standard.A1.Flex`, [`retry-a1.sh`](./retry-a1.sh) loops across all Frankfurt availability domains (`2/12`, `2/8`, `1/6`, `1/4` OCPU/GB within Always Free limits) until capacity opens and attaches the reserved public IP.
