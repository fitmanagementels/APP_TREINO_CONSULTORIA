# XSTeam V2 — Gerenciador e Instâncias Single-Tenant

**Status:** desenho aprovado para planejamento de implementação.

## Objetivo

Evoluir a base atual sem recomeçar do zero: um PWA Gerenciador, usado pelo treinador, administra alunos, fichas, prescrições, publicação, provisão de instâncias, observabilidade e atualizações. Cada aluno recebe um PWA próprio, uma planilha própria e um Apps Script próprio, mantendo os dados operacionais isolados.

## Limites de escopo

- A V1 permanece preservada em `V1_BACKUP/`; a implementação ocorre somente em `V2/`.
- O aluno não edita prescrição. Seu PWA executa treinos, consulta fichas visíveis, histórico e progresso.
- O treinador fará manualmente a configuração inicial do Google Drive, a inserção do código nos projetos-modelo e a autorização do Apps Script.
- O agente não acessa nem altera o Google Drive do treinador. O backend autorizado pelo treinador executará a automação posterior.
- Não haverá formulário de relato manual de erro no primeiro lançamento.

## Arquitetura

```text
PWA Gerenciador + planilha central
  ├─ cadastro, contato e WhatsApp
  ├─ catálogo mestre de exercícios e demanda muscular
  ├─ fichas, rascunhos, publicação e ativação
  ├─ provisão, atualização e arquivamento de instâncias
  └─ acompanhamento e saúde dos PWAs dos alunos

PWA single-tenant por aluno
  ├─ planilha e Apps Script próprios
  ├─ ficha ativa para preenchimento
  ├─ fichas publicadas para consulta
  ├─ histórico, carga e demanda muscular
  └─ telemetria resumida para o Gerenciador
```

## Organização do Drive

O treinador criou a raiz `XSTeam 2.0` com:

```text
00_MODELOS/
01_GERENCIADOR/
02_ALUNOS/
99_ALUNOS_ARQUIVADOS/
```

Em uma configuração única, o treinador criará uma planilha-modelo e um Script Modelo do PWA do aluno em `00_MODELOS`, além da planilha e do Apps Script do Gerenciador em `01_GERENCIADOR`. Os IDs de pastas e modelos ficam em `Script Properties` do Gerenciador, não em abas visíveis.

## PWA Gerenciador

### Páginas

1. **Alunos**: lista pesquisável, perfil, telefone, botão WhatsApp, estado técnico da instância, último acesso e último sucesso de sincronização.
2. **Prescrições**: fichas, versões, rascunho, revisão, publicação, visibilidade, ativação e catálogo de exercícios.
3. **Acompanhamento**: por aluno, ficha ativa, última sessão, exercícios planejados/concluídos, aderência, volume, RPE, demanda planejada/realizada e pendências.
4. **Saúde do App**: foco inicial nos PWAs dos alunos; métricas agregadas, erros, sincronizações, instâncias afetadas e filas.

### Fluxo de ficha

```text
Nova ficha → editar rascunho → revisar → publicar → visível ao aluno
                                                    ↓
                                           ativar quando necessário
```

A publicação e a ativação são independentes. Uma única ficha pode estar ativa por aluno. Uma ficha ativa não pode ser ocultada: antes deve ser desativada ou substituída. Ocultar não apaga dados nem sessões já registradas.

Estados independentes:

- edição: `rascunho`, `em_revisao`, `publicada`;
- visibilidade: `visivel`, `oculta`;
- uso: `ativa`, `inativa`.

## Planilha central do Gerenciador

| Aba | Função |
|---|---|
| `Alunos` | `aluno_id`, nome, telefone E.164, status e observações de gestão. |
| `Instancias` | IDs da pasta, planilha, script, deployment, URL, versão e estado técnico. |
| `Fichas` | Metadados da ficha, aluno, visibilidade, situação de uso e publicação atual. |
| `Prescricoes` | Versões de uma ficha, status de edição e datas. |
| `Prescricao_Itens` | Exercícios, ordem, observações, séries, repetições, descanso e zona de RIR por semana 1–4. |
| `Catalogo_Exercicios` | Catálogo mestre: `exercicio_id`, nome, grupo, tipo, coeficientes musculares, ativo e versão. |
| `Publicacoes` | Versões e resultado de cada publicação de ficha. |
| `Sessoes_Monitoradas` | Uma linha por sessão: ficha, treino, exercícios planejados/concluídos, séries, volume e RPE. |
| `Eventos_Observabilidade` | Eventos técnicos dos PWAs dos alunos, com retenção de 90 dias. |
| `Resumo_Uso_Diario` | Agregados históricos diários de uso, execução e falhas. |
| `Fila_Operacoes` | Provisão, publicação, recálculo de catálogo, atualização de app e arquivamento. |

## Catálogo e demanda muscular

O catálogo é central e dinâmico. Cada exercício tem coeficientes por grupo muscular. A demanda é calculada como:

```text
demanda muscular = coeficiente do exercício × número de séries
```

- Para o planejado, usar as séries prescritas da semana/ciclo.
- Para o realizado, usar as séries efetivamente executadas.
- A zona de RIR prescrita é armazenada como faixa em `semana_n_zona_rir`; o RIR executado continua registrado por série.

Cada planilha de aluno mantém uma réplica atual do catálogo e caches derivados:

| Aba do aluno | Função |
|---|---|
| `DB_Catalogo_Exercicios` | Catálogo mestre replicado na versão atual. |
| `DB_Fichas` | Metadados de todas as fichas publicadas e seus estados. |
| `DB_Prescricao` | Exercícios de fichas publicadas, com referência ao exercício do catálogo. |
| `DB_Execucao` | Fatos brutos de execução. |
| `DB_Demanda_Planejada` | Demanda pronta por ficha, treino e ciclo. |
| `DB_Demanda_Sessao` | Demanda pronta por sessão realizada. |
| `DB_Demanda_Periodo` | Agregados para gráficos de semana e mês. |

A correção de catálogo gera uma nova `versao_catalogo` e enfileira a atualização de todas as instâncias. Cada instância recebe o catálogo corrigido e reconstrói os caches de demanda. O histórico de demanda é corrigido; os fatos de execução não são alterados. Durante o recálculo, o treino não é bloqueado e o PWA pode indicar atualização de indicadores.

## UX e limites do Apps Script

Planilhas distintas evitam concorrência de dados entre alunos, mas Web Apps publicados como o treinador compartilham limites da conta publicadora. A UX prevalece sobre consultas extensas.

Requisitos obrigatórios:

- boot com um payload essencial curto;
- no máximo uma requisição ativa por cliente;
- fila local para registros de série e sincronização em pequenos lotes;
- gravações em lote e operações idempotentes;
- retentativa progressiva para falhas temporárias;
- bloqueio de escrita por instância;
- publicação e atualização repetíveis com segurança;
- telemetria automática, sanitizada e sem dados sensíveis de treino;
- painel de saúde focado inicialmente nos PWAs dos alunos.

O PWA do aluno terá apenas as áreas **Treino**, **Fichas** e **Histórico e Progresso**. As abas técnicas não produzem telas adicionais nem uma chamada por aba. O frontend pode mostrar uma prévia local durante a sessão, mas a planilha é a fonte de verdade para os indicadores calculados.

## Observabilidade

Eventos brutos: abertura, sincronização iniciada/concluída/falha, publicação recebida e erro técnico controlado. Cada evento contém somente identificadores técnicos, tipo, resultado, tela/ação, código, mensagem sanitizada, duração e versão do app.

- Eventos brutos: retenção de 90 dias.
- Resumos diários: retenção histórica.
- O dashboard de saúde usa agregados por padrão; a lista de erros consulta eventos filtrados apenas quando necessário.
- Não há relatório manual do aluno na primeira versão.

## Ciclo de vida do aluno

- **Ativo**: PWA opera normalmente.
- **Pausado**: novos preenchimentos ficam bloqueados temporariamente.
- **Arquivado**: backend deixa de servir dados ao PWA, pasta migra para `99_ALUNOS_ARQUIVADOS` e nada é apagado.
- **Reativado**: pasta retorna para `02_ALUNOS` e a instância volta a operar.

## Provisão de uma instância

O botão **Provisionar instância** cria uma operação idempotente na fila:

1. validar perfil e configuração;
2. criar a pasta do aluno em `02_ALUNOS`;
3. copiar a planilha-modelo;
4. criar Apps Script vinculado à nova planilha e aplicar o código modelo;
5. gravar propriedades da instância e criar as abas necessárias;
6. criar a implantação Web App;
7. registrar URL, IDs, versão e resultado em `Instancias`.

Falhas guardam etapa, código, resumo e tentativa. Repetir a operação continua do ponto seguro, sem duplicar planilha ou script.

## Atualização central de PWAs dos alunos

O Script Modelo do PWA do aluno é o pacote mestre. O treinador o atualiza e testa manualmente. Em seguida, no Gerenciador, usa **Distribuir versão**.

Para cada instância, uma operação `atualizar_app`:

1. valida compatibilidade e versão atual;
2. aplica o pacote completo de código e manifesto;
3. executa migrações aditivas de planilha quando necessárias;
4. cria uma versão imutável;
5. atualiza o deployment existente para essa versão;
6. executa verificação de saúde e registra o resultado;
7. permite repetição ou reversão para uma versão anterior.

A implantação existente é atualizada, não recriada. Consequentemente, a URL do aluno permanece estável. Um novo deployment só é usado em casos excepcionais de recuperação.

## Critérios de aceite

- O treinador gerencia alunos, contato e WhatsApp em um único PWA.
- O aluno consulta fichas visíveis, mas só preenche a ficha ativa.
- Publicação, ativação, ocultação, catálogo, provisão, atualização e arquivamento são rastreáveis e idempotentes.
- Correções do catálogo atualizam os indicadores de demanda de todas as instâncias sem alterar fatos de execução.
- O dashboard de saúde apresenta uso, erros e falhas dos PWAs dos alunos sem polling em massa.
- Atualizações em massa dos PWAs preservam URLs existentes e podem ser revertidas por instância.
- O fluxo de treino continua utilizável durante falhas temporárias ou recálculos em segundo plano.
## Status de implementação — 18 de julho de 2026

A Fase 1 está concluída localmente em `V2/manager/`: scaffold do Gerenciador, schema central aditivo, perfis com WhatsApp, catálogo central com versão e fila de recálculo, fichas/runs de prescrição em rascunho e prévia de demanda planejada. Ainda não houve acesso ao Drive nem deploy no Apps Script; a validação externa e a criação manual das planilhas/modelos continuam pendentes. A próxima entrega é o contrato de publicação e o PWA do aluno da Fase 2.