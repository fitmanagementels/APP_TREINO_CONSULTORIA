# Contexto e Status do Projeto — XSTeam V2

> **Fonte de verdade para continuidade local, troca de máquina e outro chat/IA.**
>
> Última atualização: 19 de julho de 2026 (America/Sao_Paulo)

## Resumo executivo

- A V1 está preservada e não deve ser alterada em `V1_BACKUP/`. A V2 é desenvolvida exclusivamente em `V2/`.
- O produto reúne um PWA Gerenciador para o treinador e um PWA single-tenant isolado para cada aluno.
- O código local já entrega perfis, catálogo central, prescrição, publicação, réplica, PWA do aluno e provisionamento automático.
- O treinador configurou manualmente o Apps Script/Cloud do Gerenciador, executou `setupManagerDatabase()` com sucesso e cadastrou/provisionou uma instância de teste. O agente não acessa nem altera o Google Drive.
- O primeiro acesso do proprietário a cada novo Apps Script individual pede autorização única. Isso não acontece ao publicar ou ativar novas fichas.
- Faltam a validação integrada completa, importador controlado do catálogo, observabilidade/caches de demanda e atualizador de releases sem troca de URL.

## Objetivo do projeto

- **Objetivo principal:** um treinador gerencia todos os alunos em um PWA; cada aluno usa somente seu PWA e sua planilha de treino isolados.
- **Público:** um treinador e um aluno por instância single-tenant.
- **Critérios de sucesso:** UX boa dentro das quotas do Apps Script, dados isolados, publicação rastreável, aluno sem acesso à planilha/Drive e URLs estáveis em atualizações futuras.

## Estado atual

| Item | Estado observado |
|---|---|
| Branch local | `v2-manager` |
| Base local | V1 preservada; V2 é a área ativa |
| Gerenciador e PWA do aluno | Implementados em `V2/manager/app/` e `V2/app/` |
| Banco central | `setupManagerDatabase()` executado com sucesso pelo treinador |
| Ambiente Google | Drive API e Apps Script API habilitadas; projeto Cloud associado; Apps Script API habilitada para a conta do treinador |
| OAuth do Gerenciador | Externo/em teste; a conta do treinador está cadastrada como usuária de teste |
| Gerenciador remoto | PWA aberto, aluno de teste cadastrado e botão de provisionamento acionado |
| Instância de teste | PWA individual foi aberto pelo treinador; confirmar no Gerenciador se está `provisionada` e com URL/IDs gravados |
| Próxima validação | Publicar/ativar uma ficha de teste e concluir uma sessão no PWA do aluno |

## Implementado localmente

### Gerenciador central

- Páginas `Alunos`, `Prescrições`, `Acompanhamento` e `Saúde do App`.
- Cadastro de aluno, telefone normalizado para WhatsApp, status e observações.
- Setup aditivo/idempotente das abas `Alunos`, `Instancias`, `Fichas`, `Prescricoes`, `Prescricao_Itens`, `Catalogo_Exercicios`, `Publicacoes`, `Sessoes_Monitoradas`, `Eventos_Observabilidade`, `Resumo_Uso_Diario` e `Fila_Operacoes`.
- Catálogo central com coeficientes musculares, versão e fila de recálculo.
- Fichas com quatro ciclos de séries, repetições, descanso e zona de RIR; rascunho, revisão, publicação, ocultação e ativação são ações separadas.
- Publicação/ativação replicam fichas, ciclos, substitutos e catálogo em lote para a planilha do aluno, sem apagar execuções ou fichas visíveis.
- Provisionamento cria pasta do aluno, cópia do modelo de dados, Apps Script vinculado, conteúdo do modelo de código, versão, deployment e URL; falhas são registradas em `Instancias`.

### PWA do aluno

- Navegação limitada a `Treino`, `Fichas`, `Histórico` e `Progresso`; não existe prescrição no app do aluno.
- Todas as fichas visíveis podem ser lidas; apenas a ficha ativa inicia sessão.
- Rascunho local permite retomar ou descartar após recarregar/fechar o PWA.
- Sessão aceita carga, repetições, RIR opcional, PSE obrigatório, substitutos prescritos, omissões e exercícios extras sem alterar a ficha.
- RIR usa `-`, `0` a `5` a cada `0,5` e `6+`, com menu e slider colorido sincronizados. PSE usa escala obrigatória de 0 a 10.
- Histórico tem detalhe da execução. Progresso atual mostra frequência, volume e melhor e1RM por exercício/sessão.
- e1RM usa Brzycki ajustado por RIR apenas quando o RIR é numérico de 0 a 5; `-` e `6+` não calculam e1RM.

### Limites, desempenho e dados

- Planilhas diferentes isolam dados, mas web apps executados como treinador compartilham quotas da conta publicadora.
- O fluxo obrigatório é boot curto, pacote único para iniciar treino, rascunho local, nenhuma chamada por série, escrita final em lote, lock por instância, idempotência e retentativa controlada.
- O catálogo ativo completo é replicado para permitir substitutos e extras sem busca de catálogo durante uma sessão.
- Observabilidade não deve receber nome, telefone, carga, exercício ou texto livre.

## Decisões essenciais

| Decisão | Por que | Impacto |
|---|---|---|
| V1 em `V1_BACKUP/` | Recuperação segura | Nunca editar a V1 durante a V2. |
| Gerenciador separado do aluno | Prescrição é responsabilidade do treinador | O aluno só executa, consulta fichas, histórico e progresso. |
| Planilha/script por aluno | Isolamento e menor concorrência | Criar instâncias pelo Gerenciador, não manualmente. |
| Catálogo central, replicado e versionado | Correções devem alterar indicadores derivados | Importar/recalcular de forma controlada. |
| Publicar, ocultar e ativar separados | Histórico e preenchimento têm regras distintas | Somente uma ficha ativa por aluno. |
| PSE e RIR separados | PSE é da sessão; RIR é da série/exercício | PSE obrigatório e RIR opcional. |
| Execução local-first | Evita perda de treino e excesso de chamadas | Nunca adicionar chamada remota a cada série. |
| `USER_DEPLOYING` no aluno | Aluno não recebe acesso ao Drive/planilha | Treinador autoriza cada instância uma vez; aluno apenas faz login. |
| Agente sem Drive | Controle remoto permanece com o treinador | Configurações são manuais e relatadas por prints/resultados. |

## Configuração Google já realizada pelo treinador

> Não registrar IDs, links privados, telefones ou dados identificáveis aqui. Os IDs estão nas propriedades do Apps Script do Gerenciador.

1. Estrutura de Drive criada: `00_MODELOS`, `01_GERENCIADOR`, `02_ALUNOS`, `99_ALUNOS_ARQUIVADOS`.
2. Modelo de dados do aluno e modelo de código do aluno foram separados.
3. O Apps Script da planilha do Gerenciador foi associado ao projeto Cloud `XSTeam-App`.
4. Drive API e Apps Script API foram habilitadas; o acesso à Apps Script API também foi habilitado em `script.google.com/home/usersettings`.
5. OAuth configurado como externo/em teste e a conta do treinador adicionada como usuária de teste.
6. Propriedades configuradas: `MANAGER_SPREADSHEET_ID`, `STUDENTS_FOLDER_ID`, `STUDENT_TEMPLATE_SPREADSHEET_ID`, `STUDENT_TEMPLATE_SCRIPT_ID` e `STUDENT_TEMPLATE_VERSION` (`v2.0.0`).
7. `setupManagerDatabase()` foi executado com sucesso; aluno de teste cadastrado e criação de instância acionada.

## Autorização e experiência do aluno

- Criar aluno/instância no Gerenciador não pede nova permissão: o Gerenciador já autorizado faz a automação.
- O primeiro acesso do treinador ao PWA recém-criado pode pedir autorização única, por ser um novo projeto Apps Script filho. Isso é por aluno, não por ficha.
- O aluno final deve apenas entrar com Google e abrir o link; não deve aceitar permissões de Drive/Planilhas. Se vir essa tela, não deve aceitar: guardar o print e investigar.
- O OAuth externo em modo de teste permite apenas testadores listados e pode exigir nova autorização periódica. Antes de uso continuado, definir a estratégia de produção/verificação e revisar escopos mínimos.

## Histórico relevante

| Commit | Mudança | Impacto |
|---|---|---|
| `3c8ee8c` | Separou V1 e V2 | Backup recuperável. |
| `78ad264` | Publicação completa para a instância | Fichas, ciclos, substitutos e catálogo replicados. |
| `409b9e8` | Histórico e progresso do aluno | Detalhe, frequência, volume e e1RM. |
| `4451162` | Slider RIR | Controle compacto e sincronizado. |
| `9d0430f` | Provisionamento automático | Criação de instâncias pelo Gerenciador. |
| `8416cd5` | Acesso autenticado do aluno | Usuário deve estar logado em conta Google. |
| `a7d7013` | Logos oficiais embutidos | Remove dependência de SVG externo no código local. |

## Verificação local

Em 19/07/2026:

- `node V2/tests/app-regression.test.js` — passou.
- `node V2/tests/frontend-polish.test.js` — passou.
- `node V2/manager/tests/manager-regression.test.js` — uma falha conhecida: o teste ainda procura o antigo SVG `XS-Team-Alternativa-Horizontal-Cor.svg`, mas `a7d7013` usa `brand-logo-horizontal.html` e `brand-logo-symbol.html`. É uma asserção desatualizada; não houve falha funcional do backend observada.

## Pendências e próximos passos

1. Confirmar no Gerenciador que a instância de teste está `provisionada`, com `pwa_url`, `spreadsheet_id`, `script_id` e `deployment_id` preenchidos.
2. Testar o link com uma conta Google de aluno diferente da conta do treinador; confirmar login simples e ausência de permissão de Drive/Planilhas.
3. Importar o catálogo bruto `IMPORT_CATALOGO_V1__NAO_EDITAR` para `Catalogo_Exercicios` por fluxo controlado, preservando a aba bruta.
4. Criar ficha de teste, incluir exercícios/substitutos, revisar, publicar, ativar e confirmar a réplica.
5. Executar sessão completa: rascunho/retomada, substituto, extra/omitido, PSE, sincronização, histórico e progresso.
6. Atualizar a asserção de branding em `V2/manager/tests/manager-regression.test.js` e copiar os dois arquivos de logo ao Apps Script do Gerenciador antes do próximo deploy visual.
7. Completar/validar importador-recalculador de catálogo, caches de demanda, acompanhamento, saúde/observabilidade e atualizador em lote de releases preservando URLs.

## Arquivos e pastas importantes

| Caminho | Função |
|---|---|
| `V1_BACKUP/` | Versão anterior preservada; não editar. |
| `V2/app/` | Pacote-modelo do PWA do aluno. |
| `V2/app/Código.gs` | Backend de fichas, sessão, histórico e progresso. |
| `V2/manager/app/` | PWA e backend central do treinador. |
| `V2/manager/app/Codigo.gs` | Schema, publicação, réplica e provisionamento. |
| `V2/manager/app/brand-logo-*.html` | Logos embutidos locais. |
| `V2/manager/tests/manager-regression.test.js` | Regressão do Gerenciador; uma asserção de branding está pendente. |
| `V2/tests/app-regression.test.js` | Regressão do aluno e Knowledge Hub. |
| `V2/tests/frontend-polish.test.js` | Regressão visual/controles do aluno. |
| `V2/docs/knowledge hub.html` | Painel HTML deste resumo. |
| `V2/docs/superpowers/specs/` | Especificações aprovadas. |
| `V2/docs/superpowers/plans/2026-07-19-xsteam-v2-consolidated-implementation.md` | Plano histórico, parcialmente superado por este resumo. |

## Como retomar em outra máquina ou sessão

1. Copie/clonar o repositório completo e abra a branch `v2-manager`.
2. Leia este arquivo e `V2/docs/knowledge hub.html`.
3. Leia as especificações do Gerenciador e do aluno em `V2/docs/superpowers/specs/` antes de mudar regras do produto.
4. Execute as três suítes de **Verificação local**; trate a falha de branding como pendência conhecida, nunca como autorização para ignorar outras falhas.
5. Rode `git status --short` antes de editar. Não use operações Git destrutivas.
6. O agente da nova sessão não deve acessar o Drive; peça prints/resultados ao treinador.
7. Continue pelo primeiro item de **Pendências e próximos passos** ainda não validado.

## Contexto compacto para outro chat ou IA

> XSTeam V2 é um sistema de treino com PWA Gerenciador central e um PWA/planilha isolado por aluno. A V1 está congelada em `V1_BACKUP/`. O código local em `V2/manager/app` e `V2/app` implementa fluxo central, PWA do aluno, réplica e provisionamento. O treinador configurou o Apps Script/Cloud do Gerenciador, rodou `setupManagerDatabase`, cadastrou aluno de teste e abriu a primeira instância. O agente não pode acessar o Google Drive. Preserve catálogo central versionado, publicação/ocultação/ativação separadas, PSE obrigatório/RIR opcional, execução local-first, uma ficha ativa e PWA do aluno sem prescrição. Próxima validação: confirmar instância provisionada, testar com conta de aluno, publicar/ativar ficha e concluir sessão. Há uma asserção de branding antiga no teste do Gerenciador após a troca para logos HTML. Não documentar IDs, links privados, telefones ou dados de aluno.