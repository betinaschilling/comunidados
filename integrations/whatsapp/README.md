# WhatsApp Mercado na Vercel — consulta diária

O modo principal está em `app/api/whatsapp/cloud` e `app/api/cron/whatsapp`: uma Function abre um Chromium temporário, lê o grupo e encerra. Não precisa hospedar a ponte continuamente.

1. Em Casa & família → WhatsApp · grupo Mercado, gere/copie a chave da conexão.
2. Na Vercel, crie a variável sensível `CRON_SECRET` para Production com essa mesma chave. Salve e faça um novo deployment. A Vercel envia a variável no cabeçalho Authorization do Cron; o receptor compara seu hash com a chave autorizada no banco.
3. No planner, clique em Conectar WhatsApp por QR code. Escaneie em WhatsApp → Aparelhos conectados → Conectar aparelho. Aguarde o aviso de salvamento concluído (pode levar cerca de um minuto após o pareamento).
4. O agendamento é `0 11 * * *` UTC, por volta de 8h de Brasília; o plano Hobby pode variar dentro da hora agendada. “Sincronizar agora” permite um teste manual autenticado.

A sessão é compactada e cifrada com AES-256-GCM, com chave derivada de AUTH_SECRET, antes de ser guardada no Neon privado. Alterar AUTH_SECRET exige novo pareamento. Os QR codes também são cifrados, expiram rapidamente e só são servidos à proprietária autenticada. Nenhum token, QR ou arquivo de sessão faz parte do repositório.

O trabalho tem bloqueio contra concorrência, prazo máximo de cinco minutos e verifica as últimas 200 mensagens de texto do grupo fixado, desde a ativação, além das reações atuais dos itens nessa janela. Reações removidas são reconciliadas. Mensagens mais antigas fora da janela não têm atualização garantida. Nenhuma mídia é baixada. A primeira conexão real depende de validação com o WhatsApp e pode falhar caso o serviço rejeite o ambiente. O uso é não oficial, sujeito a desconexões ou bloqueio do número. Para revalidar sessão expirada, use “Parear novamente”.

Desativar conexão revoga a chave e impede consultas seguintes; para remover o aparelho do WhatsApp, use Aparelhos conectados no celular. Ao substituir a chave, atualize CRON_SECRET e publique novamente.

## Alternativa: ponte contínua fora das Functions

Conexão não oficial usando whatsapp-web.js. Pode desconectar ou resultar em bloqueio pelo WhatsApp. A ponte precisa permanecer ligada em um computador ou servidor com armazenamento persistente. O projeto Next.js na Vercel recebe os eventos. A ponte atual usa disco persistente; uma implantação em Vercel Daemons exige adaptar a sessão e a fila para armazenamento externo, pois o disco dos Daemons é temporário. Essa adaptação ainda não está ativada.

## Instalar no computador que ficará ligado

1. Instale Node.js 22 ou 24 LTS pelo site oficial nodejs.org e Git, se ainda não tiver.
2. Baixe/clone este repositório, abra um terminal em `integrations/whatsapp` e execute `npm ci`. O Puppeteer instala o navegador de que precisa. Não execute como root; o sandbox do Chromium permanece habilitado.
3. Copie `.env.example` para `.env`.
4. No planner: Casa & família → WhatsApp · grupo Mercado → Conectar ou gerenciar WhatsApp → Gerar chave da ponte. Copie a chave para `WHATSAPP_BRIDGE_TOKEN` no `.env`. A URL já aponta para o endpoint do ComuniDados. Não envie essa chave pelo chat.
5. Execute `npm start`.
6. No mesmo computador, abra `http://127.0.0.1:3077`. Em seu celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie o QR code. O código e a sessão não são enviados ao GitHub nem ao planner.
7. A conta precisa participar de um único grupo com nome exato **Mercado**. O identificador é fixado na primeira conexão. Se houver nomes duplicados, configure `WHATSAPP_GROUP_ID` antes de conectar. Renomear um grupo não autoriza outro com o mesmo nome.
8. Teste enviando `Comprar leite` nesse grupo: deve surgir em Casa & família → Mercado. Reaja com 👍 e depois ❌; confira em Acompanhamento → Registros, categoria Casa, seção Mercado. Múltiplos itens na mesma mensagem devem ser escritos um por linha; a reação vale para todos eles.

## Comportamento

- Importa textos novos, sem baixar fotos, áudios, contatos ou mídia.
- Mensagens curtas como `Leite` e `Comprar leite` entram como pendentes. `Comprei leite` conclui o único item pendente com esse nome, se houver; caso contrário, cria o registro comprado. Correspondências ambíguas ficam separadas por mensagem.
- Conversas ou perguntas ficam para revisão no planner. A classificação é determinística; nenhuma conversa é enviada a um modelo de IA.
- 👍 (inclusive variações de tom de pele) = comprado. ❌/✖/❎ = não comprado. Entre reações de pessoas diferentes, prevalece a reação válida com horário mais recente. Se uma reação for removida/substituída por outro emoji, volta a valer a próxima reação válida; sem reações válidas, volta ao estado inicial da mensagem.
- Mensagens repetidas/reentregas não geram itens duplicados. Fila local persiste eventos e tenta reenviá-los quando o planner volta. Na reconexão, consulta as últimas 100 mensagens desde a ativação. Reações ocorridas enquanto a ponte estava desligada não têm recuperação garantida: confira esses casos manualmente.
- O nome é usado apenas para a primeira identificação. O planner exige o identificador fixo do grupo e uma chave exclusiva, armazenada apenas como hash no banco.
- O histórico inicial suporta 1.000 mensagens no banco; fila local suporta 5.000 eventos. Ao atingir o limite, a sincronização exige manutenção, sem apagar o histórico automaticamente.
- Compras não têm vencimento automático. ✓/✕ permanecem disponíveis no planner e os concluídos saem das pendências.
- A ponte não envia mensagens, não reage e não altera configurações no grupo.

## Dados e conexão

`data/` contém sessão autenticada, mensagens na fila e o vínculo com o grupo: mantenha privada e com acesso apenas ao usuário que executa a ponte. Nunca publique ou compartilhe essa pasta. `.env` também é privado. O servidor de QR code atende somente em loopback, não deve ser exposto à internet.

Para uma VPS, use túnel SSH local para acessar a porta 3077 sem expô-la, mantendo processo e volume persistentes. Reiniciar exige preservar `data/` e `.env`. Para desvincular, encerre o processo e remova a sessão em WhatsApp → Aparelhos conectados. Em Casa & família, “Desativar conexão” revoga a chave do recebimento. Gerar outra chave invalida a anterior.

Documentação upstream: https://docs.wwebjs.dev/ e https://wwebjs.dev/guide/creating-your-bot/authentication.html.

Para VPS/systemd, veja o modelo em [server/README.md](server/README.md). O modelo mantém a porta de pareamento em loopback, com acesso por túnel SSH.
