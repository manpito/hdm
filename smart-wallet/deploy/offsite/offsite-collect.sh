#!/bin/bash
# SmartWallet — recolha das cópias cifradas depositadas pelos clientes (servidor central).
# Corre como root, por cron, a cada 15 minutos.
#
# Cada cliente tem uma conta só-SFTP "sw-<cliente>" fechada em /srv/sw-offsite/sw-<cliente>,
# onde só pode escrever em incoming/ (sem apagar, sem ler, sem listar).
# Este script move cada ficheiro completo para /var/backups/sw-offsite/<cliente>/, fora do alcance
# da conta do cliente, e aplica a retenção. Uma cópia guardada nunca pode ser apagada ou alterada
# a partir do servidor do cliente.
#
# O servidor central NÃO tem a chave de decifra. Aqui só se guarda, não se lê.
set -euo pipefail

DROP_ROOT=${DROP_ROOT:-/srv/sw-offsite}
STORE_ROOT=${STORE_ROOT:-/var/backups/sw-offsite}
KEEP_DAILY=${KEEP_DAILY:-35}       # últimas N cópias
KEEP_MONTHLY=${KEEP_MONTHLY:-12}   # primeira cópia de cada um dos últimos N meses
MAX_AGE_HOURS=${MAX_AGE_HOURS:-26} # acima disto o cliente fica marcado como ATRASADO

say() { logger -t sw-offsite -- "$*" 2>/dev/null || true; echo "$(date -Is) $*"; }

mkdir -p "$STORE_ROOT"
chmod 700 "$STORE_ROOT"
status_tmp=$(mktemp)
now=$(date +%s)

shopt -s nullglob
for incoming in "$DROP_ROOT"/sw-*/incoming; do
  account=$(basename "$(dirname "$incoming")")
  tenant=${account#sw-}
  store="$STORE_ROOT/$tenant"
  mkdir -p "$store" "$store/rejeitados"
  chmod 700 "$store" "$store/rejeitados"

  # 1. Recolher ficheiros completos (o cliente só renomeia de .part para .swbk no fim do envio)
  while IFS= read -r -d '' f; do
    name=$(basename "$f")
    size=$(stat -c %s "$f")
    if [[ ! "$name" =~ ^${tenant}_database_daily_[0-9]{8}_[0-9]{6}\.swbk$ ]] || [ "$(head -c 4 "$f")" != "SWBK" ]; then
      mv -f "$f" "$store/rejeitados/$name.$(date +%s)"
      say "REJEITADO $tenant $name ($size bytes): nome ou formato inválido"
      continue
    fi
    if [ -e "$store/$name" ]; then
      rm -f "$f"
      say "DUPLICADO $tenant $name ignorado (já guardado)"
      continue
    fi
    mv "$f" "$store/$name"
    chown root:root "$store/$name"
    chmod 600 "$store/$name"
    say "RECEBIDO $tenant $name $size bytes"
  done < <(find "$incoming" -maxdepth 1 -type f -name '*.swbk' -mmin +1 -print0)

  # Envios interrompidos há mais de 1 dia
  find "$incoming" -maxdepth 1 -type f -name '*.part' -mmin +1440 -delete

  # 2. Retenção: últimas KEEP_DAILY + primeira de cada um dos últimos KEEP_MONTHLY meses
  list_store() { find "$store" -maxdepth 1 -type f -name '*.swbk' -printf '%f\n' | sort; }
  mapfile -t files < <(list_store)
  declare -A keep=()
  total=${#files[@]}
  for ((i = total - KEEP_DAILY; i < total; i++)); do
    [ "$i" -ge 0 ] && keep["${files[$i]}"]=1
  done
  declare -A month_first=()
  for name in "${files[@]}"; do
    month=$(sed -E 's/.*_daily_([0-9]{6}).*/\1/' <<<"$name")
    [ -z "${month_first[$month]:-}" ] && month_first[$month]=$name
  done
  mapfile -t months < <(printf '%s\n' "${!month_first[@]}" | sort | tail -n "$KEEP_MONTHLY")
  for m in "${months[@]}"; do [ -n "$m" ] && keep["${month_first[$m]}"]=1; done
  for name in "${files[@]}"; do
    if [ -z "${keep[$name]:-}" ]; then
      rm -f "$store/$name"
      say "RETENCAO $tenant removido $name"
    fi
  done
  unset keep month_first

  # 3. Estado: cópia mais recente e idade
  newest=$(list_store | tail -n 1)
  if [ -z "$newest" ]; then
    echo "$tenant SEM_COPIAS" >>"$status_tmp"
    say "ATENCAO $tenant ainda sem cópias"
  else
    age_h=$(( (now - $(stat -c %Y "$store/$newest")) / 3600 ))
    count=$(list_store | wc -l)
    if [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
      echo "$tenant ATRASADO ultima=$newest idade=${age_h}h copias=$count" >>"$status_tmp"
      say "ATENCAO $tenant sem cópia nova há ${age_h}h (última: $newest)"
    else
      echo "$tenant OK ultima=$newest idade=${age_h}h copias=$count" >>"$status_tmp"
    fi
  fi
done

{ echo "# actualizado $(date -Is)"; cat "$status_tmp"; } >"$STORE_ROOT/status.txt"
rm -f "$status_tmp"
