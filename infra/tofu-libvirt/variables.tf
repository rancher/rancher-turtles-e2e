variable "libvirt_uri" {
  default     = "qemu:///system"
  description = "URL of libvirt connection - default to localhost"
}

variable "bridge" {
  default     = "br0"
  description = "Brctl device with enslaved adapter connected to uplink on hypervisor"
}

variable "pool" {
  default     = "default"
  description = "Pool to be used to store all the volumes"
}

variable "image_uri" {
  default     = ""
  description = "URL of the image to use"
}

variable "vm_name" {
  default     = ""
  description = "Identifier to make all your resources unique and avoid clashes with other users of this terraform project"
}

variable "authorized_keys" {
  type        = list(string)
  default     = []
  description = "SSH keys to inject into all the nodes"
}

variable "ntp_servers" {
  type        = list(string)
  default     = []
  description = "List of NTP servers to configure"
}

variable "username" {
  default     = "opensuse"
  description = "Username for the cluster nodes"
}

variable "root_password" {
  default     = "linux"
  description = "Password for the cluster nodes"
}

variable "network_mode" {
  type        = string
  default     = "bridge"
  description = "Network mode used by the cluster"
}

variable "vms" {
  default     = 1
  description = "Number of vm instances"
}

variable "vm_memory" {
  default     = 2048
  description = "Amount of RAM for a vm"
}

variable "vm_vcpu" {
  default     = 2
  description = "Amount of virtual CPUs for a vm"
}

variable "vm_disk_size" {
  default     = "30"
  description = "Disk size GB"
}

variable "private_key_path" {
  default     = "/home/user/.ssh/id_rsa"
  description = "Path to the private SSH key"
}
