/// this should be working example https://github.com/dmacvicar/terraform-provider-libvirt/pull/1261/changes#diff-c2112ecc2e88eaef2a08a1796099d4838d10c2fdc7861af029ac8eeab255c5aaR35
// this is example for igintion and it should be pretty similar to combustion https://github.com/flatcar/Flatcar/issues/1996
// and this one https://github.com/dmacvicar/terraform-provider-libvirt/issues/1202
// https://github.com/dmacvicar/terraform-provider-libvirt/discussions/1235 info about rngs devices, metadata and so on
// !!! to make it work under libvirt you have to modify default network and add dns forwards
// !!! you have to switch libvirt firewall_backend to iptables from nftables otherwise VMs can't access outside network
// TODO:
// - [x] add disk resize over backing image
// - [x] add multiple VMs support
// - add network mode selection (bridge, macvtap, etc)
// - [->] switch to efi boot, see https://github.com/dmacvicar/terraform-provider-libvirt/blob/main/examples/resources/libvirt_domain/resource.tf
// - [->] configure ntp servers - there is some default so not critical 'chronyc sources' shows some servers
// - [x] wait until the VM is up and sshable
// - [x] add output with IP address of the VMs
// you have to setup /etc/libvirt/qemu.conf to spice_listen = "0.0.0.0"
// and in virtqemud.conf unix_sock_group = "libvirt" unix_sock_group = "libvirt", auth_unix_ro = "none", auth_unix_rw = "none"


provider "libvirt" {
  uri = var.libvirt_uri
}

resource "libvirt_combustion" "microos" {
  count   = var.vms
  name    = "${var.vm_name}-${count.index + 1}-combustion"
  content = templatefile("combustion/combustion.sh", { username = var.username, authorized_keys = var.authorized_keys, root_password = var.root_password, hostname = "${var.vm_name}-${count.index + 1}" })
}

resource "libvirt_volume" "combustion" {
  count = var.vms
  name  = "${var.vm_name}-${count.index + 1}-combustion-script"
  pool  = "default"

  create = {
    content = {
      url = libvirt_combustion.microos[count.index].path
    }
  }
}

resource "libvirt_volume" "base" {
  name   = "${var.vm_name}-base.qcow2"
  pool   = "default"

  create = {
    content = {
      url = var.image_uri
      format = "qcow2"
    }
  }
}

resource "libvirt_volume" "overlay" {
  count    = var.vms
  depends_on = [libvirt_volume.base]
  // overlay disk on top of base image to allow disk resizing
  // may have performance impact compared to direct use of base image
  name     = "${var.vm_name}-${count.index + 1}-overlay.qcow2"
  pool     = "default"
  capacity = var.vm_disk_size * 1024 * 1024 * 1024 // Convert GB to bytes as capacity_unit is broken
  target = {
    format = {
      type = "qcow2"
    }
  }

  backing_store = {
    path = libvirt_volume.base.path
    format = {
      type = "qcow2"
    }
  }
}

resource "libvirt_domain" "vm" {
  count      = var.vms
  name       = "${var.vm_name}-${count.index + 1}"
  memory     = var.vm_memory
  memory_unit = "GiB"
  vcpu       = var.vm_vcpu
  type       = "kvm"
  autostart  = true
  running    = true

  os = {
    type         = "hvm"
    type_arch    = "x86_64"
    type_machine = "q35"
  }

  metadata = {
    xml = <<EOFXML
    <libosinfo:libosinfo xmlns:libosinfo="http://libosinfo.org/xmlns/libvirt/domain/1.0">
      <libosinfo:os id="http://opensuse.org/opensuse/microos"/>
    </libosinfo:libosinfo>
    EOFXML
  }

  features = {
    acpi = true // needed for combustion and its exchange channel over sysinfo
  }

  cpu = {
    mode = "host-passthrough"
  }

  sys_info = [
    {
      fw_cfg = {
        entry = [
          {
            name = "opt/org.opensuse.combustion/script"
            # Reference a volume
            file = libvirt_volume.combustion[count.index].path // Using volume to support multiple VMs
            # Value must be provided but can be empty when using file
            value = ""
          }
        ]
      }
    }
  ]

  devices = {
    rngs = [
      {
        model = "virtio"
        backend = { random = "/dev/urandom" }
      }
    ]
    graphics = [
      {
        type = "spice"
        spice = {
          auto_port = true
          listeners = [
            {
              address = {
                 address = "127.0.0.1"
              }
            }
          ]
        }
      }
    ]
    disks = [
      # Main OS disk
      {
        source = {
          file = {
            file = libvirt_volume.overlay[count.index].path
          }
        }
        driver = {
          type = "qcow2"
          cache = "none"
        }
        target = {
          dev = "vda"
          bus = "virtio"
        }
      }
    ]
    consoles = [
      {
        source = {
          target = {
            type = "serial"
            port = "0"
          }
        }
      }
    ]
    channels = [
      {
        source = {
          unix = {
            }
        }
        target = {
          virt_io = {
            name = "org.qemu.guest_agent.0"
          }
        }
      }
    ]
    interfaces = [
      {
        model = {
          type = "virtio"
        }
        source = {
          bridge = {
            bridge = "br0"
          }
        }
        wait_for_ip = {
          source = "any"
          timeout = 300
        }
      }
    ]
  }
}

data "libvirt_domain_interface_addresses" "vm" {
  count       = var.vms
  domain   = libvirt_domain.vm[count.index].name
}

output "ip_vms" {
  value = {
    for i in range(var.vms) : libvirt_domain.vm[i].name => data.libvirt_domain_interface_addresses.vm[i].interfaces[0].addrs[0].addr
  }
}
