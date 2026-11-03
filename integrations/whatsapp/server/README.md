# Servidor da ponte WhatsApp

Modelo para VPS Linux com systemd, Node.js 22/24 e acesso SSH. Ainda requer um servidor fornecido pelo proprietário; nenhum serviço foi contratado por este projeto. O cliente roda como usuário `comuni-bot`, sem root e com sandbox do Chromium habilitado.

## Preparar (administrador do servidor)

- Instalar Node.js 22 ou 24 LTS, npm, Git e as bibliotecas de sistema necessárias ao Chrome/Puppeteer, usando os repositórios oficiais. O exemplo pressupõe Node em `/usr/bin/node`; confira com `command -v node` e ajuste `ExecStart` se necessário.
- Criar usuário de serviço `comuni-bot`, grupo de mesmo nome e diretório privado `/var/lib/comuni-bot`.
- Clonar o repositório em `/opt/comunidados`; o processo precisa ler a fonte e gravar somente os dados/caches em `/var/lib/comuni-bot`.
- Em `integrations/whatsapp`, executar `npm ci` como `comuni-bot`, com `PUPPETEER_CACHE_DIR=/var/lib/comuni-bot/browser`. Preparar a propriedade/permissões da pasta antes da instalação. A instalação baixa o navegador. Não desligue o sandbox; se o host impedir user namespaces ou bloquear Chrome, ajuste o host seguindo a documentação oficial do Puppeteer antes de iniciar.
- Criar `/etc/comunidados/whatsapp.env`, propriedade root e modo `600`, contendo:

```dotenv
PLANNER_WEBHOOK_URL=https://comunidados.vercel.app/api/whatsapp/events
WHATSAPP_BRIDGE_TOKEN=chave_gerada_no_planner
WHATSAPP_GROUP_ID=
```

A chave deve ser colocada diretamente nesse arquivo pelo proprietário, sem ser enviada pelo chat, argumento de comando ou GitHub. O systemd lê o arquivo e entrega as variáveis ao serviço.

- Copiar `comuni-whatsapp.service` para `/etc/systemd/system/`. Revisar os caminhos para esta VPS, executar `systemctl daemon-reload` e `systemctl enable --now comuni-whatsapp`.

## Parear pelo computador do proprietário

A porta do QR permanece em loopback, sem publicação na internet. Crie um túnel SSH:

```sh
ssh -N -L 3077:127.0.0.1:3077 USUARIO@ENDERECO_DO_SERVIDOR
```

Com o túnel aberto, acesse `http://127.0.0.1:3077` no seu computador e conecte pelo WhatsApp → Aparelhos conectados → Conectar aparelho. Mantenha a sessão em `/var/lib/comuni-bot/whatsapp`; não copie a sessão para o repositório. A Vercel deve indicar “Ponte online” depois do pareamento e do primeiro heartbeat.

## Verificar e manter

- `systemctl status comuni-whatsapp` informa se o processo está ativo.
- `journalctl -u comuni-whatsapp -n 50` mostra falhas do processo; a ponte não imprime QR, tokens ou conteúdo das mensagens nos logs.
- Em Casa & família → Mercado, teste uma mensagem nova e reações 👍/❌.
- O processo reinicia após falhas e boot. Após desconexão do WhatsApp, pode ser necessário reiniciar com `systemctl restart comuni-whatsapp` e parear novamente.
- Backup de `/var/lib/comuni-bot` contém sessão autenticada e mensagens privadas na fila: deve ter acesso restrito e proteção adequada.
- Atualizações: parar o serviço, atualizar o repositório, executar `npm ci` como o usuário de serviço com o mesmo cache e reiniciar. Não apagar o diretório de dados.

Veja `../README.md` para regras, limites e comportamento durante períodos offline. A integração é não oficial, sujeita a desconexões ou bloqueio pelo WhatsApp.
