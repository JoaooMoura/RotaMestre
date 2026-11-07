#!/usr/bin/env bash
# Cria 1 GB de swap na VM e2-micro (1 GB de RAM). Pode rodar mais de uma vez sem efeito colateral.
set -euo pipefail

ARQUIVO=/swapfile
TAMANHO=1G

if swapon --show=NAME --noheadings | grep -qx "$ARQUIVO"; then
  echo "Swap já ativo em $ARQUIVO."
  exit 0
fi

if [ ! -f "$ARQUIVO" ]; then
  fallocate -l "$TAMANHO" "$ARQUIVO"
  chmod 600 "$ARQUIVO"
  mkswap "$ARQUIVO"
fi

swapon "$ARQUIVO"
grep -q "^$ARQUIVO " /etc/fstab || echo "$ARQUIVO none swap sw 0 0" >> /etc/fstab

# Usa o swap só quando a RAM estiver realmente apertada.
echo 'vm.swappiness=10' > /etc/sysctl.d/99-rotamestre-swap.conf
sysctl -p /etc/sysctl.d/99-rotamestre-swap.conf

echo "Swap de $TAMANHO ativo."
free -h
