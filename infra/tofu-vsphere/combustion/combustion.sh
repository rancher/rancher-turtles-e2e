#!/bin/bash
# Redirect output to the console
# combustion: network
exec > >(exec tee -a /dev/tty0) 2>&1

# Set a password for root, generate the hash with "openssl passwd -6"
echo 'root:${root_password_hash}' | chpasswd -e

# Install packages
zypper -n install -t pattern devel_basis
zypper -n install docker docker-buildx vim vim-data bash-completion wget curl iptables npm jq yq git go

# Disable SELinux by modifying boot arguments
rm /etc/selinux/config
if [ -f /etc/default/grub ]; then
    sed -i 's/security=selinux selinux=1/selinux=0/g' /etc/default/grub
fi
update-bootloader
dracut -f

# Services
systemctl disable transactional-update.timer
systemctl disable rebootmgr.service
systemctl enable docker

# Configure opensuse user
mount /home
useradd -m opensuse
usermod -aG docker opensuse
chmod 700 /home/opensuse
mkdir -p /home/opensuse/.ssh
chmod 700 /home/opensuse/.ssh

# Provide public ssh keys for opensuse account
AUTHORIZED_KEYS="
%{ for key in authorized_keys ~}
${key}
%{ endfor ~}
"
echo "$AUTHORIZED_KEYS" > /home/opensuse/.ssh/authorized_keys
chmod 600 /home/opensuse/.ssh/authorized_keys

cat >> /home/opensuse/.bashrc << 'EOF'
export PATH=$PATH:$HOME/go/bin
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
alias k=kubectl
if [ -x "$(command -v kubectl)" ]; then
  source <(kubectl completion bash 2>/dev/null )
  source <(kubectl completion bash 2>/dev/null | sed 's/kubectl/k/g')
fi
EOF

chown -R opensuse:users /home/opensuse/
echo "opensuse ALL=(ALL:ALL) NOPASSWD: ALL" >> /etc/sudoers.d/01_opensuse

umount /home

# Leave a marker
echo "Configured with combustion" > /etc/issue.d/combustion

# Close outputs and wait for tee to finish.
exec 1>&- 2>&-; wait;
