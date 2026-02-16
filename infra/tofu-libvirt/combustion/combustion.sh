#!/bin/bash
# combustion: network
# Redirect output to the console
exec > >(exec tee -a /dev/tty0) 2>&1

# Set a password for root
root_password_hash=$(openssl passwd -6 ${root_password})
echo "root:$root_password_hash" | chpasswd -e

# Install packages
zypper -n install -t pattern devel_basis
zypper -n install docker docker-buildx vim vim-data bash-completion wget curl iptables npm jq yq git go yarn helm

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

# Hostname
echo ${hostname} > /etc/hostname

# Configure opensuse user
mount /home
useradd -m ${username}
usermod -aG docker ${username}
chmod 700 /home/${username}
mkdir -p /home/${username}/.ssh
chmod 700 /home/${username}/.ssh
# Provide public ssh keys for "${username}" account
AUTHORIZED_KEYS="
%{ for key in authorized_keys ~}
${key}
%{ endfor ~}
"
echo "$AUTHORIZED_KEYS" > /home/${username}/.ssh/authorized_keys
chmod 600 /home/${username}/.ssh/authorized_keys
cat >> /home/${username}/.bashrc << 'EOF'
export PATH=$PATH:$HOME/go/bin:/usr/local/bin
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
alias k=kubectl
if [ -x "$(command -v kubectl)" ]; then
  source <(kubectl completion bash 2>/dev/null )
  source <(kubectl completion bash 2>/dev/null | sed 's/kubectl/k/g')
fi
EOF

chown -R ${username}:users /home/${username}/
echo "${username} ALL=(ALL:ALL) NOPASSWD: ALL" >> /etc/sudoers.d/01_${username}

umount /home

# Leave a marker
echo "Configured with combustion" > /etc/issue.d/85-combustion.conf
echo "Configured with combustion" > /etc/issue.d/85-combustion.issue

# Close outputs and wait for tee to finish.
exec 1>&- 2>&-; wait;
