# Cópia cifrada fora do cliente (offsite)

O servidor de cada cliente guarda as suas cópias locais (`scripts/backup.js`). Uma vez por dia, `scripts/offsite.js` comprime e cifra a cópia diária mais recente e deposita-a no servidor central por SFTP.

## Princípios

A cifra (AES-256-GCM) é feita no servidor do cliente. A chave `OFFSITE_KEY` existe em dois sítios: no `.env` do backend do cliente e no gestor de senhas do responsável. Nunca é copiada para o servidor central, que guarda ficheiros que não consegue ler.

Cada cliente tem a sua conta de depósito `sw-<cliente>` no servidor central. A conta não tem shell nem reencaminhamento de portas, fica fechada (chroot) na sua própria pasta e só pode escrever em `incoming/`. Não pode ler, listar nem apagar. Um cliente nunca vê os ficheiros de outro.

O script `offsite-collect.sh` corre como root a cada 15 minutos. Move cada ficheiro completo para `/var/backups/sw-offsite/<cliente>/`, fora do alcance da conta do cliente, e aplica a retenção: últimas 35 cópias, mais a primeira de cada um dos últimos 12 meses. Se o servidor do cliente for comprometido, as cópias já guardadas não podem ser apagadas nem alteradas a partir dele.

O servidor central não liga a nenhum cliente. A ligação é sempre de saída, do cliente para o servidor central, na porta SSH.

## Ficheiros

| Ficheiro | Onde corre |
| --- | --- |
| `backend/scripts/offsite.js` | Servidor do cliente (tarefa agendada diária, depois da cópia diária) |
| `backend/scripts/offsite-decrypt.js` | Onde for preciso restaurar (precisa da `OFFSITE_KEY`) |
| `deploy/offsite/50-sw-offsite.conf` | Servidor central, em `/etc/ssh/sshd_config.d/` |
| `deploy/offsite/offsite-collect.sh` | Servidor central, em `/usr/local/sbin/`, por cron do root |

## Estado

No servidor central, `/var/backups/sw-offsite/status.txt` mostra, por cliente, a última cópia recebida, a idade em horas e o número de cópias guardadas. `ATRASADO` significa que não chegou nenhuma cópia nas últimas 26 horas. Os eventos ficam no syslog com a etiqueta `sw-offsite`.

No servidor do cliente, cada envio fica registado em `BACKUP_DIR\backup.log` com o prefixo `OFFSITE`.

## Restaurar

1. Copiar o ficheiro `.swbk` pretendido de `/var/backups/sw-offsite/<cliente>/` para o servidor onde vai ser restaurado.
2. Decifrar para um ficheiro novo: `npm run backup:decrypt -- <ficheiro.swbk> <destino.sqlite>`. O comando falha se a chave estiver errada ou se o ficheiro tiver sido alterado, e no fim corre `integrity_check`.
3. Com o backend parado, guardar a base de dados actual e só depois substituí-la pelo ficheiro decifrado.
