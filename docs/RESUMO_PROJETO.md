# Contexto e Status do Projeto

Última atualização: 29 de agosto de 2026 (America/Fortaleza)

Este é o documento de continuidade do projeto. Ele consolida o estado verificado no repositório, as decisões que não devem ser desfeitas e as validações que ainda dependem do ambiente Google Apps Script.

## Atualização Cloudflare — staging validado

- A migração single-tenant para **Cloudflare Worker + D1** está implementada localmente: o Worker serve o PWA e as rotas `/api/*`; D1 guarda catálogo, prescrição e execuções.
- Em 29 de agosto de 2026 foi criado o banco de staging, aplicada a migração `0001_initial_schema.sql` e publicada a prévia em [xsteam-pwa.fitmanagement-els.workers.dev](https://xsteam-pwa.fitmanagement-els.workers.dev).
- A checagem remota de `/api/status` retornou HTTP 200 com banco saudável e zero registros; a checagem no navegador confirmou que o PWA vazio libera o loader e mostra o aviso de prescrição vazia.
- Os três CSVs foram exportados automaticamente da planilha, validados e importados **somente em staging**. A auditoria confirmou 62 exercícios, 15 prescrições e 27 execuções, sem sessões faltantes ou duplicadas.
- Treino, Prescrição, Prescrever, Histórico e Carga foram abertos no navegador contra os dados migrados. Falta executar o cenário controlado de escrita offline e alteração de RPE do [Guia 05](guias-operacionais/05-roteiro-de-aceite-pwa.md) antes de qualquer produção. Apps Script/Sheets seguem intactos como rollback.

## Resumo executivo

- O projeto é um Web App mobile-first de prescrição, execução e acompanhamento de treinos, construído com Google Apps Script e uma planilha Google.
- O uso diário é offline-first: séries e RPE ficam pendentes no navegador e são sincronizados com `DB_Execucao` quando há conexão.
- O carregamento inicial usa um único pacote essencial de prescrição e histórico; carga, memória e IA não bloqueiam a tela de treino.
- Há cinco telas ativas: **Treino**, **Prescrição**, **Prescrever**, **Histórico** e **Carga**.
- O editor **Prescrever** usa o catálogo manual `Demanda_Muscular`, calcula demanda muscular por ciclo e substitui somente a combinação de ficha e treino salva.
- O repositório contém testes locais de regressão e de apresentação. A publicação e o teste contra a planilha real no Apps Script continuam pendentes de validação externa.

## Objetivo do projeto

- **Objetivo principal:** permitir prescrever fichas, executar séries e consultar histórico/carga em um Web App conectado a uma planilha Google.
- **Resultado esperado:** uma experiência móvel resiliente, com abertura rápida, registros locais recuperáveis e sincronização segura com a base.
- **Uso previsto:** operação de fichas e treinos no contexto XSTeam. O público detalhado e as regras de acesso além do modo atual do Web App são **a confirmar**.
- **Critérios técnicos de sucesso:** boot sem dependência de IA ou cache de carga, escrita sem apagar dados existentes, compatibilidade com `HtmlService` e testes locais aprovados.

## Estado atual

- **Etapa:** base funcional documentada e pronta para validação integrada no Google Apps Script.
- **Código principal:** `app/Código.gs` centraliza o backend; `app/index.html`, `app/script.html` e `app/style.html` compõem o frontend.
- **Versão relevante:** o commit `1566aa7` consolidou o editor de prescrição e o acabamento do frontend antes desta atualização documental.
- **Dados essenciais de boot:** `getInitialAppData()` retorna `prescricao`, `historico`, `status`, `errors` e `error`; o HTML recebe o payload em `window.__XS_BOOTSTRAP__`.
- **Pendência imediata:** publicar o código no Apps Script e executar um teste completo com a planilha real. Essa publicação não pode ser confirmada apenas pelo repositório Git.

## Como o app funciona

1. `doGet()` renderiza `index.html`; o template injeta o payload inicial e inclui estilo e script.
2. `App.init()` recupera pendências locais, atualiza o indicador de sincronização e inicia a navegação.
3. `fetchInitialData()` consome o boot com prescrição e histórico; o loader é liberado quando esses dados essenciais terminam.
4. Se o servidor falhar ou retornar resposta inválida, o app usa cache local quando disponível e mostra diagnóstico em vez de uma tela vazia silenciosa.
5. `clientGetGestaoCarga()` roda em segundo plano e não escreve `DB_GestaoCarga` durante o boot.

## Telas e fluxos ativos

| Tela | Responsabilidade | Estado observado |
|---|---|---|
| **Treino** | Executar a sessão por ficha, treino, data e ciclo. | Permite ajustes locais por dia, séries extras/omitidas e sincronização de pendências. |
| **Prescrição** | Consultar a ficha por treino e semana. | Exibe séries, repetições, descanso e observações. |
| **Prescrever** | Criar ou editar uma combinação de ficha e treino. | Usa `Demanda_Muscular`, permite ordenar/trocar exercícios e salva ciclos nas colunas `semana_*`. |
| **Histórico** | Consultar execuções já registradas. | Agrupa sessões e abre detalhes por exercício e série. |
| **Carga** | Mostrar indicadores e gráficos de desempenho. | A apresentação atual usa o histórico no frontend; o backend também produz resumos de sessão sob demanda. |

## Dados e integração com a planilha

### Abas gerenciadas

| Aba | Finalidade | Situação no código |
|---|---|---|
| `DB_Prescricao` | Exercícios por ficha, treino e ciclos semanais. | Leitura normaliza texto; o editor substitui somente o treino selecionado. |
| `DB_Execucao` | Registros granulares de séries executadas. | Recebe upsert por `id_sessao`. |
| `DB_GestaoCarga` | Cache/resumo por sessão, ficha e treino. | Pode ser atualizado por demanda; não é atualizado no boot. |
| `DB_MemoriaBase` | Snapshots consolidados para análises futuras. | Schema e setup disponíveis; fluxo de geração ainda não foi implementado. |
| `DB_MemoriaExercicio` | Métricas por exercício dentro de um snapshot. | Schema e setup disponíveis. |
| `DB_Insights` | Contextos e respostas de IA sob demanda. | Schema e setup disponíveis; não há chamada real de IA. |

### Regras importantes

- `DB_Prescricao` usa `id_ficha`, `id_treino`, `id_exercicio`, `observacoes`, `ordem_exercicio` e campos de séries, repetições e descanso para as semanas 1 a 4.
- `DB_GestaoCarga` usa um schema de resumo rico: identificadores de sessão/grupo, ficha, treino, totais, RPE médio, melhor e1RM, maior carga, origem e atualização. Não usar o schema histórico reduzido de cinco campos.
- `Demanda_Muscular` é uma aba manual de catálogo; `setupDatabase()` não deve criá-la, limpá-la ou alterá-la.
- `setupDatabase()` é não destrutivo: cria apenas abas gerenciadas ausentes, acrescenta cabeçalhos faltantes e preserva dados/abas manuais.
- O identificador de sessão inclui ficha e treino para reduzir colisões entre sessões distintas.

## Histórico relevante

| Referência | Mudança | Impacto |
|---|---|---|
| `45301dc` | Upload inicial do projeto. | Estabeleceu a base do Web App e da documentação. |
| `c825200` | Direção de acabamento visual documentada. | Definiu a evolução visual do frontend sem alterar regras de negócio. |
| `3b43bfe` | Iluminação de fundo por aba documentada. | Diferenciou visualmente os contextos de uso. |
| `1566aa7` | Editor Prescrever, ajustes de backend, testes e polish do frontend. | Adicionou o fluxo de prescrição e consolidou compatibilidade/regressões. |

## Decisões tomadas e justificativas

| Decisão | Por que foi tomada | Onde impacta | Como verificar/retomar |
|---|---|---|---|
| Boot com dados essenciais apenas. | A carga e a IA não podem atrasar a abertura do treino. | `getInitialAppData()`, `fetchInitialData()`. | Confirmar que prescrição/histórico bastam para remover o loader. |
| Sintaxe conservadora no frontend. | `HtmlService` pode falhar com recursos modernos durante a injeção de HTML. | `app/script.html`. | Rodar `node tests/app-regression.test.js`. |
| Sincronização offline-first. | O registro da sessão não deve se perder por indisponibilidade temporária. | `localStorage`, `xs_pending`, `DB_Execucao`. | Registrar série, interromper rede e sincronizar depois. |
| Setup não destrutivo. | A planilha pode conter dados operacionais e abas manuais. | `setupDatabase()`. | Executar uma vez em cópia segura e conferir abas/cabeçalhos. |
| IA apenas sob demanda e sem custo automático. | O fluxo diário deve permanecer previsível, rápido e sem consumo automático. | Abas de memória e futuros relatórios. | Não implementar chamadas automáticas no boot ou na sincronização. |
| Catálogo muscular manual. | A prescrição precisa respeitar exercícios e demandas controlados na planilha. | `Demanda_Muscular`, tela Prescrever. | Criar/editar treino e validar exercício contra o catálogo. |

## Informações importantes vindas do chat

- O usuário solicitou que este arquivo e `docs/index.html` funcionem como documentação de **status e continuidade**.
- A cópia publicada no GitHub deve acompanhar a reorganização documental.
- A documentação não substitui o deploy no Google Apps Script: GitHub e Apps Script são etapas separadas.

## Etapa atual em desenvolvimento

- **Pronto no repositório:** backend, telas, editor de prescrição, schemas de memória, testes de regressão e documentação reorganizada.
- **Em validação externa:** publicação do projeto Apps Script e integração com a planilha real.
- **Ainda não implementado:** interface de relatórios com IA, geração de snapshots de memória, chamada real a um modelo e política de reaproveitamento de insights.
- **Cuidado ao continuar:** não reintroduzir escrita em `DB_GestaoCarga` no boot, não usar APIs modernas incompatíveis no `script.html` e não transformar `setupDatabase()` em operação destrutiva.

## Próximos passos

1. Publicar os arquivos atuais no projeto Google Apps Script e criar/atualizar a implantação do Web App.
2. Abrir a URL publicada e validar o boot com a planilha real, inclusive o diagnóstico para prescrição vazia ou resposta inválida.
3. Registrar séries, alterar RPE após uma sincronização e confirmar o upsert em `DB_Execucao`.
4. Executar `setupDatabase()` em ambiente controlado e conferir que apenas abas gerenciadas/cabeçalhos foram tratados.
5. Decidir o escopo do próximo incremento: relatórios determinísticos de carga ou a camada de IA sob demanda.

## Arquivos e pastas importantes

| Caminho | Função | Observação |
|---|---|---|
| `app/Código.gs` | Backend Apps Script, schemas e rotas. | Ponto de entrada para planilha, setup, boot e sincronização. |
| `app/index.html` | Estrutura do Web App e fallback de loader. | Injeta o payload inicial do backend. |
| `app/script.html` | Lógica do frontend. | Usar sintaxe conservadora compatível com `HtmlService`. |
| `app/style.html` | Estilos do Web App. | Inclui acabamento visual e variação de luz por aba. |
| `docs/RESUMO_PROJETO.md` | Fonte de verdade de status e continuidade. | Atualizar primeiro quando o estado mudar. |
| `docs/index.html` | Leitura visual do resumo. | Deve espelhar este documento, sem narrativa divergente. |
| `docs/ARQUITETURA_IA_HIBRIDA.md` | Detalhe da arquitetura de memória/IA. | Complementa, não substitui, este resumo. |
| `tests/app-regression.test.js` | Proteções de regressão e compatibilidade. | Executar após mudanças em app ou docs. |
| `tests/frontend-polish.test.js` | Proteções do acabamento visual. | Executar após mudanças de estilo. |
| `scripts/git-workspace.sh` | Wrapper Git do workspace. | Usar para status, commit, push e fetch. |

## Riscos, bloqueios e pendências

- **Risco externo:** a integração com a planilha e o deploy do Apps Script não podem ser validados apenas localmente.
- **Risco de compatibilidade:** recursos modernos no `script.html` podem quebrar a renderização do Web App publicado.
- **Risco de dados:** alterações destrutivas no setup ou em abas manuais podem afetar informações operacionais.
- **Pendência de produto:** o objetivo e a audiência detalhada dos relatórios de IA ainda precisam de uma definição antes de implementar a tela final.
- **Lacuna a confirmar:** regras de autenticação e acesso além da configuração atual do manifesto do Apps Script.

## Como retomar o trabalho em outra sessão

1. Leia este arquivo e, se o assunto for IA/memória, leia também `docs/ARQUITETURA_IA_HIBRIDA.md`.
2. Verifique o estado do repositório: `bash scripts/git-workspace.sh status --short --branch`.
3. Veja os commits recentes: `bash scripts/git-workspace.sh log --oneline --decorate -8`.
4. Execute `node tests/app-regression.test.js` e `node tests/frontend-polish.test.js` antes de modificar o app.
5. Para continuar o fluxo funcional, comece pela publicação no Apps Script e pelos testes com a planilha real; para evoluir produto, defina primeiro o escopo dos relatórios.

## Contexto para outro chat ou IA

- **Objetivo essencial:** manter um Web App de treinos rápido, offline-first e seguro para prescrição, execução e acompanhamento com Google Apps Script/Planilhas.
- **Estado atual:** o repositório contém o app, o editor Prescrever e os schemas de carga/memória; ainda falta validar deploy e planilha reais.
- **Arquivos a ler primeiro:** `docs/RESUMO_PROJETO.md`, `app/Código.gs`, `app/script.html`, `tests/app-regression.test.js`.
- **Decisões que não devem ser desfeitas:** boot essencial sem IA/carga, setup não destrutivo, sintaxe conservadora no frontend, IA apenas sob demanda e catálogo muscular manual.
- **Próxima ação recomendada:** publicar no Apps Script e testar o ciclo completo de boot, registro local, sincronização e RPE.
- **Antes de agir:** confirmar o estado da implantação, as permissões da planilha e se o próximo objetivo é confiabilidade operacional ou relatórios inteligentes.
