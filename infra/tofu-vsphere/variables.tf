variable "template_name" {
}

variable "stack_name" {
}

variable "vsphere_datastore" {
  default = null
}

variable "vsphere_datastore_cluster" {
  default = null
}

variable "vsphere_folder" {
  default = null
}

variable "vsphere_datacenter" {
}

variable "vsphere_network" {
}

variable "vsphere_resource_pool" {
}

variable "vsphere_hardware_version" {
  default     = null
  description = "Hardware version of the virtual machine."
}

variable "wait_for_guest_net_routable" {
  default     = true
  description = "Wait for network to be routable"
}

variable "authorized_keys" {
  type        = list(string)
  default     = []
  description = "SSH keys to inject into all the nodes"
}

variable "firmware" {
  default     = "efi"
  description = "Firmware interface to use"
}

variable "guest_id" {
  default     = "sles16_64Guest"
  description = "Guest ID of the virtual machine"
}

variable "ntp_servers" {
  type        = list(string)
  default     = []
  description = "List of ntp servers to configure"
}

variable "username" {
  default     = "opensuse"
  description = "Default user for the VM"
}

variable "root_password_hash" {
  type        = string
  default     = ""
  description = "Root password hash (generate with: openssl passwd -6)"
  sensitive   = true
}

variable "nodes" {
  default     = 1
  description = "Number of node nodes"
}

variable "node_cpus" {
  default     = 8
  description = "Number of CPUs used on node node"
}

variable "node_memory" {
  default     = 16384
  description = "Amount of memory used on node node"
}

variable "node_disk_size" {
  default     = 100
  description = "Size of the root disk in GB on node node"
}

variable "private_key_path" {
  default     = "./id_rsa"
  description = "Path to the ssh private key file, public ssh has to be added in authorized_keys variable"
}

variable "hostname_from_dhcp" {
  default     = true
  description = "Set node's hostname from DHCP server"
}
