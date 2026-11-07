# Publicar o backend do RotaMestre no Google Cloud (passo a passo)

Guia para quem **nunca usou o Google Cloud**. No fim, a API estará em `https://SEU-SUBDOMINIO.duckdns.org/api`, com HTTPS, reinício automático, backup do banco e o primeiro gestor criado.

Arquitetura (uma VM só):

```
App Android ──HTTPS──▶ Caddy (portas 80/443) ──▶ API Node (127.0.0.1:3000) ──▶ SQLite (disco da VM)
```

Arquivos desta pasta: `Caddyfile`, `rotamestre.service`, `swap.sh`, `backup.sh`.

> As telas do Google Cloud mudam de nome e de lugar de vez em quando. Os nomes abaixo aparecem em português, com o inglês entre parênteses. Se algo não estiver igual, procure pelo termo na barra de busca do console.

---

## 0. Leia antes: o que é grátis e o que pode ser cobrado

O plano **Always Free** do Compute Engine inclui, por mês e por conta de faturamento:

- **1 VM `e2-micro`** (2 vCPUs compartilhadas, 1 GB de RAM), só nas regiões `us-west1`, `us-central1` ou `us-east1`. Usaremos `us-central1` (Iowa).
- **30 GB de disco permanente padrão** (HDD). SSD ou "equilibrado" **não** entram.
- **1 GB de saída de dados** da América do Norte para a internet (sem China e Austrália). Passou disso, cobra. Esta API responde pouco (o upload de fotos e assinaturas é entrada, que é grátis).

Fonte oficial: <https://docs.cloud.google.com/free/docs/free-cloud-features>

**Pode gerar cobrança (e a página oficial acima não diz que o grátis cobre):**

- **Endereço IPv4 externo.** O Google passou a cobrar por IPv4 público desde 2024, na casa de **alguns dólares por mês**. Eu não consegui confirmar na página oficial se a VM gratuita é isenta. **Confira no passo 3**, no preço mostrado na criação da VM e em <https://cloud.google.com/vpc/network-pricing>. Se houver cobrança, ela deve ser pequena, mas **fere o teto de R$ 0** do projeto (DEC05). Por isso o alerta de orçamento do passo 3 é obrigatório.
- Disco que não seja "padrão", **snapshots** e imagens.
- VM ou disco fora de `us-west1`/`us-central1`/`us-east1`.
- **Apagar a VM não apaga o disco**, se você não marcar a opção. Siga o passo 18 ao desfazer.

O Google exige um **cartão de crédito** no cadastro, mesmo para o plano gratuito. Se aparecer a oferta "US$ 300 de crédito por 90 dias" (período de avaliação), ela é separada do Always Free. Ao fim dela, a conta pede para ser **ativada** (paga por uso); o Always Free continua valendo, e o alerta de orçamento protege você.

---

## 1. Conta Google e faturamento

1. Entre em <https://console.cloud.google.com> com sua conta Google.
2. Aceite os termos. Se pedir, **ative o período de avaliação gratuita** e cadastre o cartão.
3. Confirme que existe uma **conta de faturamento** ativa em **Faturamento** (Billing).

## 2. Criar o projeto

1. No topo do console, clique no seletor de projetos → **Novo projeto** (New project).
2. Nome: `rotamestre`. Deixe "Organização" como está. Clique em **Criar**.
3. Selecione o projeto criado no seletor. **Todos os passos seguintes precisam estar dentro dele.**
4. Em **Faturamento**, confirme que o projeto está ligado à sua conta de faturamento.

## 3. Alerta de orçamento (para ser avisado se algo for cobrado)

1. Menu → **Faturamento** → **Orçamentos e alertas** (Budgets & alerts) → **Criar orçamento**.
2. Nome: `rotamestre-aviso`. Escopo: o projeto `rotamestre` (todos os serviços).
3. Valor: **Valor especificado**, **R$ 10** (ou o equivalente na moeda da sua conta).
4. Limites de alerta: deixe **10%**, **50%** e **100%** do gasto real, e adicione **100% do gasto previsto** (Forecasted).
5. Em notificações, marque **Enviar alertas por e-mail** para os administradores da conta de faturamento. Confirme que seu e-mail aparece.
6. Salve.

Pontos importantes:

- Orçamento **só avisa**: não bloqueia nem desliga nada. O aviso pode demorar até um dia.
- Para ver o gasto a qualquer hora: **Faturamento → Relatórios** (Reports), agrupando por "SKU". Entre lá uns dias depois de criar a VM e veja se o endereço IP aparece com valor.

## 4. Ativar o Compute Engine

Menu → **Compute Engine** → **Instâncias de VM**. Na primeira vez, clique em **Ativar** (Enable) a API e espere 1 a 2 minutos.

## 5. Criar a VM

Em **Instâncias de VM** → **Criar instância** (Create instance). Preencha **exatamente**:

| Campo | Valor |
| :--- | :--- |
| Nome | `rotamestre-api` |
| Região | `us-central1` (Iowa). Zona: qualquer (`us-central1-a`) |
| Configuração da máquina | Série **E2** → tipo **`e2-micro`** |
| Modelo de provisionamento | **Padrão** (não use Spot: ele não é gratuito) |

Depois, em **SO e armazenamento** (OS and storage) → **Alterar** (Change):

| Campo | Valor |
| :--- | :--- |
| Sistema operacional | **Ubuntu** |
| Versão | **Ubuntu 24.04 LTS**, arquitetura **x86/64** |
| Tipo de disco de inicialização | **Disco permanente padrão** (Standard persistent disk) |
| Tamanho | **30** GB |

Em **Rede** (Networking):

- **Firewall:** marque **Permitir tráfego HTTP** e **Permitir tráfego HTTPS**. Isso coloca as etiquetas `http-server` e `https-server` na VM (veja o passo 6).
- **Interfaces de rede** → expanda a interface padrão → **Endereço IPv4 externo** → **Criar endereço IP** (Reserve static external IP address). Nome: `rotamestre-ip`. **Isso é necessário**: sem IP fixo, o endereço muda quando a VM reinicia e o subdomínio para de funcionar.

Antes de criar, olhe a **estimativa de custo mensal** no painel da direita. Ela **não** desconta o plano gratuito, então vai mostrar um valor, mas compare as linhas: a VM `e2-micro` e o disco padrão são cobertos; o **IP externo** é o item para você ficar de olho (passo 3).

Clique em **Criar**. Quando a VM ficar com a bolinha verde, anote o **IP externo** (coluna "IP externo").

## 6. Regras de rede (portas 80 e 443)

Se você marcou HTTP e HTTPS no passo 5, o Google criou as regras `default-allow-http` e `default-allow-https`. Confira:

1. Menu → **Rede VPC** (VPC network) → **Firewall**.
2. Procure as regras com **Tráfego de entrada** (Ingress), **Ação** permitir, **Protocolos/portas** `tcp:80` e `tcp:443`, **Destinos** com as etiquetas `http-server` / `https-server`, origem `0.0.0.0/0`.
3. Se não existirem, crie: **Criar regra de firewall** → nome `rotamestre-web`, rede `default`, direção **Entrada**, ação **Permitir**, destinos **Tags de destino especificadas** = `http-server,https-server`, intervalos de origem `0.0.0.0/0`, protocolos **TCP** portas `80,443`.
4. Em **Instâncias de VM** → clique na VM → **Editar**, e confira se as **Tags de rede** (Network tags) incluem `http-server` e `https-server`.

A **porta 80 precisa ficar aberta** mesmo com HTTPS: é por ela que o Caddy prova ao Let's Encrypt que o domínio é seu. A porta 3000 da API **não** deve ser aberta ao público.

A porta 22 (SSH) já vem liberada pela regra `default-allow-ssh`. Usaremos o SSH do navegador, sem chaves para gerenciar.

## 7. Subdomínio gratuito (DuckDNS)

O HTTPS exige um nome (o Let's Encrypt não emite certificado para IP puro).

1. Abra <https://www.duckdns.org> e entre com sua conta Google ou GitHub.
2. No campo **sub domain**, escolha um nome (ex.: `rotamestre-sjc`) e clique em **add domain**.
3. Na linha do domínio, no campo **current ip**, cole o **IP externo da VM** e clique em **update ip**.
4. Teste no seu computador (PowerShell): `nslookup rotamestre-sjc.duckdns.org`. Deve devolver o IP da VM.

Seu endereço será `rotamestre-sjc.duckdns.org` (use o seu nome daqui em diante). É um serviço de terceiros e gratuito: se um dia sair do ar, você troca o endereço e gera o app de novo.

## 8. Entrar na VM

Em **Instâncias de VM**, clique em **SSH** na linha da VM. Abre um terminal no navegador (a primeira vez demora e pede autorização). Os comandos dos próximos passos são digitados ali.

Atualize o sistema:

```bash
sudo apt update && sudo apt upgrade -y
```

## 9. Instalar o que a VM precisa

**Node.js 22** (o backend exige 22.13 ou mais, por causa do `node:sqlite`):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs sqlite3
node -v   # deve mostrar v22.13 ou maior
```

**Caddy** (o servidor que cuida do HTTPS):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 10. Levar o código para a VM

No **seu computador** (PowerShell, na pasta do projeto), empacote só o necessário:

```powershell
tar -czf rotamestre-vm.tgz --exclude=node_modules --exclude=data --exclude=.env --exclude=backend/test backend infra
```

No terminal SSH do navegador, abra o menu de engrenagem (⚙) no canto superior direito e escolha **Fazer upload de arquivo** e envie o `rotamestre-vm.tgz`. Ele vai para a sua pasta pessoal na VM. Então:

```bash
sudo useradd --system --home /opt/rotamestre --shell /usr/sbin/nologin rotamestre
sudo mkdir -p /opt/rotamestre
sudo tar -xzf ~/rotamestre-vm.tgz -C /opt/rotamestre
sudo mkdir -p /opt/rotamestre/backend/data
sudo chown -R rotamestre:rotamestre /opt/rotamestre
cd /opt/rotamestre/backend
sudo -u rotamestre npm ci --omit=dev
```

## 11. Swap de 1 GB

A `e2-micro` tem pouca RAM. O swap evita que o sistema mate o Node em um pico:

```bash
sudo bash /opt/rotamestre/infra/swap.sh
```

Deve terminar mostrando `Swap` com cerca de 1,0Gi.

## 12. Configurar o servidor

Crie o arquivo `.env` **na VM** (ele nunca vai para o repositório). Primeiro gere um segredo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Copie a saída e crie o arquivo:

```bash
sudo -u rotamestre nano /opt/rotamestre/backend/.env
```

Conteúdo (troque `COLE_O_SEGREDO_AQUI` pelo texto gerado):

```
JWT_SECRET=COLE_O_SEGREDO_AQUI
JWT_VALIDADE=12h
HOST=127.0.0.1
PORT=3000
```

Salve (Ctrl+O, Enter, Ctrl+X). **Não** coloque `ROTAMESTRE_SEED_DEMO`: ele cria contas com senha `123` e não pode existir num servidor público. Proteja o arquivo:

```bash
sudo chmod 600 /opt/rotamestre/backend/.env
```

Instale e inicie o serviço:

```bash
sudo cp /opt/rotamestre/infra/rotamestre.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rotamestre
systemctl status rotamestre --no-pager
curl http://127.0.0.1:3000/api/health   # deve responder {"status":"ok"}
```

Se der erro, veja o motivo com `sudo journalctl -u rotamestre -n 50 --no-pager`.

## 13. HTTPS com Caddy

```bash
sudo cp /opt/rotamestre/infra/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/SEU-SUBDOMINIO/rotamestre-sjc/' /etc/caddy/Caddyfile   # use o SEU nome do DuckDNS
sudo systemctl reload caddy
```

Na primeira vez o Caddy pede o certificado (leva uns segundos). Teste **no seu computador**:

```powershell
curl https://rotamestre-sjc.duckdns.org/api/health
```

Deve responder `{"status":"ok"}`. Se falhar, veja `sudo journalctl -u caddy -n 50 --no-pager`. As causas mais comuns são o DuckDNS apontando para o IP errado (passo 7) e as portas 80/443 fechadas (passo 6).

## 14. Criar o primeiro gestor

Sem contas de demonstração, **não existe nenhum gestor** (o cadastro público só cria motoristas). Crie o seu na VM:

```bash
cd /opt/rotamestre/backend
sudo -u rotamestre npm run criar-gestor -- "Seu Nome Completo" seu-email@exemplo.com
```

O script pede a senha sem mostrá-la na tela (mínimo de 10 caracteres). Ela é guardada com bcrypt. Depois entre no app com esse e-mail e senha. Pode rodar de novo para criar outros gestores.

## 15. Backup do banco

O `backup.sh` faz uma cópia consistente (com a API rodando), compacta e apaga cópias com mais de 7 dias, em `/var/backups/rotamestre`.

```bash
sudo bash /opt/rotamestre/infra/backup.sh      # teste manual
ls -lh /var/backups/rotamestre
echo '30 3 * * * root /bin/bash /opt/rotamestre/infra/backup.sh >> /var/log/rotamestre-backup.log 2>&1' | sudo tee /etc/cron.d/rotamestre-backup
```

Isso roda todo dia às 03:30 (horário da VM, que é UTC).

**Limite importante:** as cópias ficam **no mesmo disco** da VM. Elas protegem contra apagão e erro, mas **não** contra perder a VM. Periodicidade, retenção e cópia externa serão definidas na HU01.04. Enquanto isso, baixe uma cópia de vez em quando: no terminal SSH, ícone de **download**, caminho `/var/backups/rotamestre/<arquivo>.sqlite.gz`.

**Restaurar:**

```bash
sudo systemctl stop rotamestre
sudo gunzip -c /var/backups/rotamestre/ARQUIVO.sqlite.gz | sudo tee /opt/rotamestre/backend/data/rotamestre.sqlite > /dev/null
sudo chown rotamestre:rotamestre /opt/rotamestre/backend/data/rotamestre.sqlite
sudo systemctl start rotamestre
```

## 16. Apontar o app para o servidor

No computador, em `src/configuracao.ts`, preencha:

```ts
const URL_PRODUCAO = 'https://rotamestre-sjc.duckdns.org/api';
```

Só o build **release** usa essa URL (o de desenvolvimento continua em `127.0.0.1`). Gere e instale o release no aparelho conforme o `CLAUDE.md` (lembre de limpar `NoDefaultCurrentDirectoryInExePath` no PowerShell). Teste: abra o app, entre com o gestor criado no passo 14.

## 17. Atualizar o backend depois

No computador, refaça o `tar` do passo 10 e envie. Na VM:

```bash
sudo systemctl stop rotamestre
sudo tar -xzf ~/rotamestre-vm.tgz -C /opt/rotamestre
sudo chown -R rotamestre:rotamestre /opt/rotamestre
cd /opt/rotamestre/backend && sudo -u rotamestre npm ci --omit=dev
sudo systemctl start rotamestre
```

O banco, o `.env` e o certificado não são tocados (o `tar` não os inclui). As migrações do banco rodam sozinhas na partida e fazem um `.bak` antes da mais pesada.

## 18. Desfazer tudo (para não ficar nada cobrando)

1. **Compute Engine → Instâncias de VM** → selecione a VM → **Excluir**. **Marque** a opção de excluir também o disco de inicialização. Depois confira em **Discos** que não sobrou nenhum.
2. **Rede VPC → Endereços IP** → libere (**Liberar endereço IP estático**) o `rotamestre-ip`. Um IP reservado e sem uso **custa mais** que um em uso.
3. Apague as regras de firewall que você criou, se for o caso.
4. Opcional e mais seguro: **IAM e administrador → Configurações → Encerrar** (Shut down) o projeto inteiro.
5. No DuckDNS, apague o subdomínio. No app, volte `URL_PRODUCAO` para `''`.

## Problemas comuns

| Sintoma | O que verificar |
| :--- | :--- |
| `curl` do HTTPS não responde | Portas 80/443 (passo 6), IP do DuckDNS (passo 7), `journalctl -u caddy` |
| Certificado não é emitido | A porta 80 precisa estar aberta; o nome precisa apontar para o IP da VM |
| API não inicia | `journalctl -u rotamestre`: costuma ser `JWT_SECRET` ausente ou curto (mínimo 32 caracteres) |
| `node:sqlite` não existe | `node -v` abaixo de 22.13: refaça o passo 9 |
| App diz "Sem conexão" | O release está usando `URL_PRODUCAO`? A VM está ligada? |
| Sistema lento ou serviço morrendo | `free -h` e `sudo journalctl -k | grep -i "out of memory"`; a VM tem 1 GB |
