resource "vsphere_virtual_machine" "node" {
  count                = var.nodes
  name                 = "${var.stack_name}-node-${count.index}"
  num_cpus             = var.node_cpus
  memory               = var.node_memory
  guest_id             = var.guest_id
  firmware             = var.firmware
  scsi_type            = data.vsphere_virtual_machine.template.scsi_type
  resource_pool_id     = data.vsphere_resource_pool.pool.id
  datastore_id         = (var.vsphere_datastore == null ? null : data.vsphere_datastore.datastore[0].id)
  datastore_cluster_id = (var.vsphere_datastore_cluster == null ? null : data.vsphere_datastore_cluster.datastore[0].id)
  folder               = var.vsphere_folder
  wait_for_guest_net_routable = var.wait_for_guest_net_routable

  clone {
    template_uuid = data.vsphere_virtual_machine.template.id
  }

  hardware_version = var.vsphere_hardware_version

  disk {
    label            = "disk0"
    size             = var.node_disk_size
    eagerly_scrub    = data.vsphere_virtual_machine.template.disks.0.eagerly_scrub
    thin_provisioned = data.vsphere_virtual_machine.template.disks.0.thin_provisioned
  }

  extra_config = {
    "guestinfo.combustion.script"          = base64gzip(templatefile("${path.module}/combustion/combustion.sh", { authorized_keys = var.authorized_keys,  root_password_hash = var.root_password_hash }))
    "guestinfo.combustion.script.encoding" = "gzip+base64"

  }

  network_interface {
    network_id = data.vsphere_network.network.id
  }
}

resource "null_resource" "node_wait_connection" {
  depends_on = [vsphere_virtual_machine.node]
  count      = var.nodes

  connection {
    host = element(
      vsphere_virtual_machine.node.*.guest_ip_addresses.0,
      count.index,
    )
    user  = var.username
    type  = "ssh"
    private_key = file(var.private_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Combustion done, initiating reboot...'",
      "sudo reboot &",
      "sleep 1"
    ]
    on_failure = continue
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Reboot initiated, waiting for VM to restart..."
      sleep 60
    EOT
  }
}

# Data source to get refreshed VM information after reboot
data "vsphere_virtual_machine" "node_refreshed" {
  depends_on = [null_resource.node_wait_connection]
  count      = var.nodes
  name       = "${var.stack_name}-node-${count.index}"
  datacenter_id = data.vsphere_datacenter.dc.id
}

# Separate resource to verify connection with refreshed IP
resource "null_resource" "node_post_reboot" {
  depends_on = [data.vsphere_virtual_machine.node_refreshed]
  count      = var.nodes

  # This will force re-execution when VM data changes
  triggers = {
    vm_id = vsphere_virtual_machine.node[count.index].id
    timestamp = timestamp()
  }

  # Use the refreshed IP from the data source
  connection {
    host = element(
      data.vsphere_virtual_machine.node_refreshed.*.guest_ip_addresses.0,
      count.index,
    )
    user  = var.username
    type  = "ssh"
    private_key = file(var.private_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'System successfully rebooted and accessible'",
      "echo 'Ready for GitHub runner deployment under opensuse user'",
    ]
  }
}

output "node_ips_post_reboot" {
  depends_on = [data.vsphere_virtual_machine.node_refreshed]
  value = data.vsphere_virtual_machine.node_refreshed.*.default_ip_address
}
