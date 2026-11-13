output "vcn_id" {
  value = oci_core_vcn.civo.id
}

output "subnet_id" {
  value = oci_core_subnet.public.id
}

output "nsg_id" {
  value = oci_core_network_security_group.web.id
}

output "instance_id" {
  value = oci_core_instance.app.id
}

output "public_ip" {
  value = oci_core_public_ip.reserved.ip_address
}
