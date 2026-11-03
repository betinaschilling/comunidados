# ComuniDados — Vercel

Página institucional pública e planner privado. Login por e-mail e senha exclusivamente para cheila@comunidados.tech. Sem dependência de Google OAuth.

## Ativar

1. Conectar Neon Postgres ao projeto na Vercel e definir DATABASE_URL.
2. Gerar AUTH_SECRET aleatório de pelo menos 32 bytes e cadastrar como Secret na Vercel. Não colocar segredos no código, no GitHub ou no chat.
3. AUTH_URL deve ser https://comunidados.vercel.app enquanto o domínio próprio não estiver ativo.
4. Configurar um remetente verificado no Resend. Cadastrar RESEND_API_KEY e AUTH_EMAIL_FROM (ex.: ComuniDados <acesso@comunidados.tech>, após verificar esse remetente/domínio). Não precisa usar essa caixa como conta de login no serviço de envio.
5. Executar npm ci e npm run db:migrate com DATABASE_URL configurado. A migração cria tabelas que faltam e preserva os registros existentes.
6. Publicar no projeto existente comunidados. Abrir /recuperar-senha, informar cheila@comunidados.tech e usar o link recebido para definir a primeira senha. Senha mínima de 12 caracteres.
7. Testar login, senha incorreta, recusa do Gmail, recuperação e invalidação do link após uso. A recuperação também encerra sessões anteriores.
8. Para fotos, conectar Vercel Blob Private e BLOB_READ_WRITE_TOKEN. Upload até 4 MB; arquivos servidos apenas por API autenticada.

## Segurança

Senha protegida com scrypt e salt individual, sessão JWT em cookie gerido por Auth.js, versão de sessão verificada no banco em cada acesso protegido. Dez tentativas por 15 minutos para a conta, três envios de recuperação por hora. Reset com token aleatório de 256 bits, somente hash no banco, expiração em 30 minutos, consumo único por UPDATE condicional. Primeiro acesso exige controle da caixa do e-mail autorizado, sem cadastro público de outras contas. Não existe senha padrão.

## Planner

Rotinas geradas idempotentemente ao abrir, até 14 dias à frente. Rotinas passadas não feitas ficam no histórico; compromissos vencidos continuam pendentes. Concluídos saem das pendências. Gráfico usa a data planejada; horários históricos desconhecidos permanecem nulos. Dados pessoais não fazem parte deste pacote.

POST /api/import aceita {items:[...]} com Bearer PLANNER_AGENT_TOKEN (32 ou mais caracteres); /mcp exige o mesmo token de serviço. A conexão de manutenção por ChatGPT ainda precisa ser configurada separadamente. Não apagar dados do Notion antes da migração conferida.

## Validação

npm test; npm run build.
Testes locais de allowlist, hash/verificação de senha, água, agenda semanal e datas. Fluxos de banco, e-mail e login real exigem integração configurada e validação em produção. O projeto está publicado na Vercel por integração com o GitHub.

## Registros e situações

Acompanhamento → Registros abre o tabelão completo, inclusive datas futuras, ordenado por data crescente e ordem. Cada linha permite ✓ Feito ou ✕ Não feito; marcações são reversíveis no histórico e mutuamente exclusivas. Ambos saem das listas de pendências. Uma rotina vencida sem resposta é Não feito; um compromisso pontual vencido permanece Em atraso até ser marcado. Ordem pode ser editada no registro. Migração adiciona not_done e sort_order sem remover dados. Registros do Notion foram importados diretamente no banco autorizado, sem dados pessoais no pacote.

## comuni-bot — GitHub → Vercel

Fonte: betinaschilling/comunidados. Produção: branch main. Workflow comuni-bot executa testes e build em pushes, PRs e manualmente. Vercel usa integração Git nativa e também executa testes antes do build; publicação falha se os testes falharem. Não precisa de token Vercel dentro do GitHub. As chaves de banco, sessão e e-mail ficam nas variáveis da Vercel. O workflow valida código; não faz mudanças autônomas, nem edita dados ou resolve problemas sozinho.

Publicar os arquivos na raiz do repositório, incluindo .github/workflows/comuni-bot.yml e vercel.json. Não enviar node_modules, .next, .env.local, exports pessoais ou o SQL privado da importação. Verificar o deployment disparado pelo commit da main antes de considerar a migração do fluxo concluída. O fluxo está ativo; alterações na main disparam o deploy na Vercel.

## Casa e família

Quatro seções: Contas, Manutenções, Projetos e Lazer e diversão. Compromissos podem ter data exata ou período descritivo. Sem data exata, não geram atraso artificial. Dependências só liberam a conclusão quando o item de confirmação foi marcado como feito. As colunas household_group, period e depends_on são adicionadas por migração sem apagar dados.


Nothing is easy, my friend