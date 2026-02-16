terraform {
  required_version = ">= 0.13"
  required_providers {
    libvirt = {
      source = "dmacvicar/libvirt"
      version = "0.9.2" # Latest at time of writing

    }
    null = {
      source = "hashicorp/null"
    }
  }
}
