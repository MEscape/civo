variable "tenancy_ocid" {
  type        = string
  description = "OCI tenancy OCID (also root compartment OCID when no subcompartment is used)."
}

variable "compartment_ocid" {
  type        = string
  description = "OCI compartment OCID that owns the VCN, NSG, and compute instance."
}

variable "region" {
  type        = string
  default     = "eu-frankfurt-1"
  description = "OCI home/deployment region."
}

variable "availability_domain" {
  type        = string
  description = "Availability domain for the Ampere A1 instance (for example PKaw:EU-FRANKFURT-1-AD-1)."
}

variable "ubuntu_aarch64_image_ocid" {
  type        = string
  description = "Platform Canonical Ubuntu 24.04 aarch64 image OCID for VM.Standard.A1.Flex."
}

variable "reserved_public_ip_ocid" {
  type        = string
  description = "Existing Always Free reserved public IP OCID to attach to the VM primary private IP."
}

variable "admin_ssh_public_key" {
  type        = string
  description = "Initial Ed25519 SSH public key placed in ubuntu authorized_keys for host bootstrapping."
}

variable "instance_ocpus" {
  type        = number
  default     = 2
  description = "OCPUs for VM.Standard.A1.Flex (Always Free-only tenancy ceiling in eu-frankfurt-1: 2)."
}

variable "instance_memory_gb" {
  type        = number
  default     = 12
  description = "RAM in GB for VM.Standard.A1.Flex (Always Free-only tenancy ceiling in eu-frankfurt-1: 12)."
}

variable "boot_volume_size_gb" {
  type        = number
  default     = 100
  description = "Boot volume size in GB (Always Free total block volume ceiling: 200)."
}

variable "cloudflare_ipv4_cidrs" {
  type = list(string)
  default = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
  ]
  description = "Cloudflare IPv4 edge CIDRs allowed to reach HTTPS (443) on the origin NSG."
}
