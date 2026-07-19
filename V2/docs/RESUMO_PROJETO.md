# Contexto e Status do Projeto — XSTeam V2

Última atualização: 18 de julho de 2026 (America/Sao_Paulo)

## Resumo executivo

- A V1 permanece preservada, sem edições, em `V1_BACKUP/`.
- A V2 constrói um PWA Gerenciador central para o treinador e uma instância single-tenant por aluno.
- A Fase 1 foi concluída localmente: estrutura do Gerenciador, schema central não destrutivo, perfis de alunos, WhatsApp, catálogo de exercícios e rascunhos de fichas.
- Nenhuma operação foi feita no Google Drive do treinador. A criação de planilhas-modelo, scripts, permissões e o primeiro teste integrado continuarão manuais.
- A próxima etapa é o contrato de publicação com o PWA do aluno: fichas visíveis, ficha ativa e histórico somente-leitura.

## Objetivo do projeto

- **Objetivo principal:** permitir que um treinador administre todos os alunos a partir de um único PWA Gerenciador, enquanto cada aluno usa um PWA isolado para executar o treino.
- **Usuários:** treinador (Gerenciador) e cada aluno (sua própria instância single-tenant).
- **Critérios de sucesso:** boa UX mesmo sob limites do Apps Script; dados isolados por aluno; publicação, atualização e arquivamento rastreáveis; URLs dos alunos estáveis após o primeiro deploy.

## Estado atual

- **Branch:** `v2-manager`.
- **Fase atual:** Fase 1 concluída localmente e testada.
- **PWA Gerenciador:** `V2/manager/app/`.
- **PWA-modelo do aluno:** `V2/app/`; ainda conserva o comportamento herdado da V1 e será transformado na Fase 2.
- **Validação externa pendente:** colar/publicar o Gerenciador no Apps Script ligado à planilha central e testar com uma cópia não produtiva. Essa validação é responsabilidade manual do treinador; o agente não acessa o Drive.

## Fase 1 entregue

### Gerenciador e dados centrais

- PWA com páginas `Alunos`, `Prescrições`, `Acompanhamento` e `Saúde do App`.
- Implantação inicial configurada como `USER_DEPLOYING` + `MYSELF`: somente o treinador acessa o Gerenciador.
- `setupManagerDatabase()` é aditivo: cria apenas abas ausentes e acrescenta cabeçalhos ausentes; não limpa, apaga ou substitui dados.
- Abas centrais: `Alunos`, `Instancias`, `Fichas`, `Prescricoes`, `Prescricao_Itens`, `Catalogo_Exercicios`, `Publicacoes`, `Sessoes_Monitoradas`, `Eventos_Observabilidade`, `Resumo_Uso_Diario` e `Fila_Operacoes`.

### Alunos e contato

- Perfil com nome, telefone brasileiro normalizado em `telefone_e164`, status e observações de gestão.
- Botão de WhatsApp baseado em `https://wa.me/<telefone>`.
- Cada novo perfil cria exatamente um registro de instância com estado `nao_provisionada`; a planilha/script do aluno ainda não são criados nesta fase.

### Catálogo e rascunhos

- O catálogo passou a ser central, em `Catalogo_Exercicios`, com IDs estáveis, grupo, tipo, coeficientes musculares, ativo e `versao_catalogo`.
- Uma alteração de coeficiente incrementa a versão e cria uma operação `recalcular_catalogo` pendente. O processamento em cada instância será implementado posteriormente.
- Uma ficha nova nasce como `rascunho`, `oculta` e `inativa`.
- O rascunho registra para cada exercício quatro ciclos de séries, repetições, descanso e `zona_rir`.
- A prévia de demanda usa `coeficiente muscular × séries prescritas`. Ela é uma ajuda no editor; os caches oficiais por aluno serão construídos na Fase 3.

## Decisões que não devem ser desfeitas

| Decisão | Motivo | Impacto |
|---|---|---|
| V1 em `V1_BACKUP/` | Preservar uma versão recuperável enquanto a V2 evolui. | Nunca editar a V1 durante a V2. |
| Gerenciador separado do aluno | O treinador concentra cadastro, prescrição, publicação e análise. | O aluno não terá editor de prescrição. |
| Planilhas isoladas por aluno | Evita concorrência e vazamento de dados entre alunos. | Dados operacionais permanecem single-tenant. |
| Catálogo central e dinâmico | Correções precisam recalcular estatísticas históricas derivadas. | Não congelar demanda como fato imutável. |
| Publicar, ocultar e ativar são ações distintas | Uma ficha pode aparecer no histórico sem ser preenchível. | Apenas uma ficha ativa recebe novas execuções. |
| Atualização no mesmo deployment | Alunos não devem receber link novo em uma atualização normal. | A Fase 4 usará `deployments.update`. |
| Drive fora do acesso do agente | O treinador mantém controle de arquivos, permissões e autorizações. | Código local + instruções; nenhuma manipulação remota pelo agente. |

## Limites do Apps Script e UX

Planilhas diferentes isolam dados, porém Web Apps executados como o treinador podem compartilhar quotas e concorrência da conta publicadora. Por isso, são obrigatórios: boot curto, no máximo uma requisição ativa por cliente, fila local de sincronização, operações idempotentes, lotes de escrita, retentativa progressiva e bloqueio de escrita por instância. A experiência do aluno não pode depender de uma chamada longa ou síncrona a cada interação.

## Histórico relevante

| Commit | Mudança | Impacto |
|---|---|---|
| `3c8ee8c` | Organizou `V1_BACKUP/` e `V2/`. | Separação segura entre versões. |
| `109d480` | Registrou a especificação aprovada da V2. | Fonte das decisões arquiteturais. |
| `0d9f127` | Registrou o plano de implementação. | Fases e testes definidos. |
| `a78edd1` | Scaffold do PWA Gerenciador. | Base das quatro páginas. |
| `76e3676` | Schema central não destrutivo. | Planilha do Gerenciador preparada. |
| `8a0ed15` | Perfis de aluno e WhatsApp. | Cadastro e contato centralizados. |
| `5cc94f1` | Catálogo e rascunhos. | RIR, demanda planejada e versão de catálogo. |

## Próximos passos

1. Executar a Fase 2: converter `V2/app/` no produto exclusivo do aluno, sem editor de prescrição.
2. Criar o contrato de publicação: ficha visível no histórico, ficha ativa preenchível e validação também no backend.
3. Depois da Fase 2, construir caches de demanda, sessões monitoradas e painel de saúde dos PWAs dos alunos.
4. Ao chegar à fase de provisão, o treinador criará manualmente os modelos no Drive (`00_MODELOS`) e inserirá/autorizará o código do Gerenciador na planilha de `01_GERENCIADOR`.

## Arquivos e pastas importantes

| Caminho | Função |
|---|---|
| `V1_BACKUP/` | Código da versão anterior, preservado. |
| `V2/manager/app/Codigo.gs` | Backend do Gerenciador e schema central. |
| `V2/manager/app/index.html` | Shell do Gerenciador. |
| `V2/manager/app/script.html` | Navegação, Alunos, catálogo e rascunhos. |
| `V2/manager/app/style.html` | Interface responsiva do Gerenciador. |
| `V2/manager/tests/manager-regression.test.js` | Regressões estáticas da Fase 1. |
| `V2/docs/superpowers/specs/2026-07-18-xsteam-v2-manager-single-tenant-design.md` | Especificação aprovada. |
| `V2/docs/superpowers/plans/2026-07-18-xsteam-v2-implementation.md` | Plano por fases. |

## Como retomar em outra sessão

1. Leia este arquivo, a especificação e o plano.
2. Execute `node V2/manager/tests/manager-regression.test.js`, `node V2/tests/app-regression.test.js` e `node V2/tests/frontend-polish.test.js`.
3. Verifique `git status --short` e mantenha `V1_BACKUP/` intocado.
4. Continue pela Fase 2, começando com testes que removem a prescrição do PWA do aluno e definem fichas visíveis/ativas.

## Contexto para outro chat ou IA

- **Objetivo essencial:** PWA Gerenciador central + instâncias single-tenant de alunos atualizáveis sem troca de URL.
- **Onde parei:** Fase 1 local concluída; Gerenciador já cadastra alunos, mantém catálogo e prepara rascunhos.
- **Não desfazer:** V1 preservada, setup aditivo, catálogo central dinâmico, separação publicar/ocultar/ativar, Drive fora do acesso do agente e UX protegida contra quotas.
- **Próxima ação:** Fase 2 — contrato de publicação e conversão do PWA do aluno.
- **Lacuna externa:** teste real no Apps Script/Planilha central feito manualmente pelo treinador.