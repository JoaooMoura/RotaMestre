#!/usr/bin/env bash
# Cópia consistente do banco SQLite (segura com a API rodando) e rotação das cópias antigas.
# Requer o pacote sqlite3. Variáveis opcionais: BANCO, DESTINO, DIAS.
set -euo pipefail

BANCO="${BANCO:-/opt/rotamestre/backend/data/rotamestre.sqlite}"
DESTINO="${DESTINO:-/var/backups/rotamestre}"
DIAS="${DIAS:-7}"

if [ ! -f "$BANCO" ]; then
  echo "Banco não encontrado: $BANCO" >&2
  exit 1
fi

umask 077
mkdir -p "$DESTINO"

ARQUIVO="$DESTINO/rotamestre-$(date +%Y%m%d-%H%M%S).sqlite"
sqlite3 "$BANCO" ".backup '$ARQUIVO'"
gzip "$ARQUIVO"

find "$DESTINO" -name 'rotamestre-*.sqlite.gz' -mtime "+$DIAS" -delete

echo "Backup criado: $ARQUIVO.gz"
