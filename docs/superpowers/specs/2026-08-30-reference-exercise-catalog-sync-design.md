# Catálogo oficial de exercícios por planilha pública

## Objetivo

Usar a aba pública `gid=139666673` da planilha de referência como a única fonte autorizada de exercícios, categorias e demandas musculares do PWA. O D1 continuará sendo o banco de leitura e validação do PWA; Google Sheets não volta a ser o banco operacional da aplicação.

O catálogo será atualizado de duas formas:

1. Pelo botão manual **Atualizar catálogo** na tela Prescrever.
2. Por uma rotina diária do Cloudflare Worker.

## Fonte de dados

Fonte pública: `https://docs.google.com/spreadsheets/d/1ukUCtws2hV2_PW7JzduQV4cr_EcqVC6-EoHzut1KS0Y/edit?gid=139666673#gid=139666673`.

O Worker buscará apenas o CSV de exportação dessa aba. A planilha é leitura pública; não haverá conta de serviço, credenciais Google ou escrita nessa planilha.

Colunas aceitas:

| Planilha | D1/PWA |
| --- | --- |
| `Exercício` | identificador e nome canônico do exercício |
| `Link do vídeo` | `video_url` |
| `Grupo muscular` | `grupo_principal` |
| `N-articulação` | `categoria_articular` |
| `Tipo` | `tipo` |
| `Glúteos` até `Eretores` | demandas musculares normalizadas entre 0 e 1 |

`Tipo` e `Link do vídeo` podem estar vazios. Exercício duplicado, ausência de `Exercício` ou `Grupo muscular`, demanda fora de 0 a 1, CSV malformado ou cabeçalho incompatível invalidam toda a sincronização. O catálogo D1 anterior permanecerá intacto nesses casos.

## Arquitetura

```text
Planilha pública CSV
        |
        v
função única de sincronização no Worker
        |-- valida CSV completo e calcula hash
        |-- não alterado: grava só estado da tentativa
        |-- alterado: atualiza D1 atomicamente
        v
D1: catálogo ativo, demandas, metadados de sincronização
        |
        v
APIs existentes de Prescrever e validação de prescrição
```

O navegador nunca busca a planilha. O botão manual chama uma API autenticada que executa a mesma função usada pelo agendamento diário. O PWA continua carregando catálogo somente quando abre Prescrever, usando a API D1 existente.

## Dados no D1

Uma migração acrescentará ao catálogo:

- `video_url TEXT NOT NULL DEFAULT ''`
- `categoria_articular TEXT NOT NULL DEFAULT ''`
- `is_active INTEGER NOT NULL DEFAULT 1`
- `source_updated_at TEXT NOT NULL DEFAULT ''`

Uma tabela de estado, `catalog_sync_state`, terá uma única linha com hash da última fonte válida, horários da última tentativa e do último sucesso, quantidade de exercícios e mensagem de erro operacional. Não armazena credenciais nem cópia bruta da planilha.

`exercise_muscle_demands` será reconstruída por exercício sincronizado, removendo demandas antigas daquele exercício antes de gravar as demandas atuais. Registros ausentes da fonte não serão apagados: terão `is_active = 0` para preservar auditoria e permitir recuperação se voltarem à planilha.

## Regras de catálogo e prescrições

- Somente `exercise_catalog.is_active = 1` aparece no seletor de Prescrever e é aceito ao salvar uma prescrição.
- Prescrições com exercício que deixou de existir na fonte permanecem guardadas, mas não aparecem como prescrição ativa; execuções históricas continuam legíveis e inalteradas.
- Nenhuma equivalência aproximada será criada automaticamente no futuro. Remoções e renomeações futuras exigirão decisão explícita.

Na primeira sincronização, antes de inativar itens fora da planilha, aplicar as substituições aprovadas pelo usuário:

| Exercício atual | Exercício canônico na referência |
| --- | --- |
| `Agachamento livre com barra nas costas` | `Agachamento com barra livre` |
| `Desenvolvimento com halter` | `Desenvolvimento com halteres sentado` |

Essas alterações alcançam somente `prescription_exercises`; `execution_records` permanece imutável para que o histórico represente o exercício registrado na data original.

Na conferência de 30 de agosto de 2026, havia 62 exercícios no catálogo atual e 89 na fonte. Cinco nomes atuais não tinham correspondência literal; quatro prescrições ativas dependiam dos dois nomes acima. Os outros três ficam inativos na primeira sincronização, sem exclusão física.

## APIs, interface e agendamento

Novas APIs, já protegidas pela sessão Google:

- `POST /api/catalog/sync`: solicita sincronização manual e devolve estado, contagens e se houve mudança.
- `GET /api/catalog/status`: devolve último sucesso, última tentativa, hash resumido, quantidade ativa e eventual erro.

O Worker também terá um `scheduled` handler diário, em horário fixo de baixa utilização. Ele chama a mesma função interna e registra o resultado; não depende de navegador aberto.

Na tela Prescrever:

- botão **Atualizar catálogo**;
- estado de progresso durante a solicitação;
- texto com data/hora da última sincronização válida;
- aviso legível se a última tentativa falhar, sem remover o catálogo disponível.

O botão não muda a carga do boot, Treino, Histórico, Carga ou sincronização de execuções.

## Segurança, desempenho e custo

O endereço de exportação é fixo no Worker e não é escolhido pelo navegador. A sincronização completa só é iniciada por cron ou por sessão Google autorizada.

O hash evita regravações quando a planilha não mudou. A fonte atual tem menos de cem exercícios e quatorze demandas por exercício, portanto a atualização diária e eventual atualização manual ficam muito abaixo das cotas gratuitas correntes de Workers e D1. O consumo é compartilhado com os demais Workers da conta, mas não introduz custo recorrente neste uso single-tenant enquanto permanecer dentro das cotas gratuitas.

## Testes e aceite

Testes automatizados cobrirão:

- leitura do CSV público com decimais brasileiros, campos opcionais e todas as demandas;
- rejeição atômica de CSV inválido, duplicado ou com demanda fora do intervalo;
- detecção de hash sem alteração e atualização quando houver alteração;
- inativação sem exclusão e bloqueio de prescrição de exercício inativo;
- substituições iniciais aprovadas sem alterar execuções;
- autorização obrigatória das novas APIs;
- contrato de interface para botão e estado de sincronização.

Aceite manual após deploy:

1. Confirmar que o catálogo de Prescrever contém apenas exercícios da fonte.
2. Editar/adicionar um exercício na planilha, usar **Atualizar catálogo** e confirmar a alteração no seletor.
3. Remover temporariamente um exercício de teste da planilha, sincronizar e confirmar que ele não pode mais ser prescrito, sem apagar histórico.
4. Confirmar em outro dia que a rotina automática atualizou o estado sem abrir o PWA.

## Fora de escopo

- Editar a planilha a partir do PWA.
- Múltiplos usuários, permissões por perfil ou catálogo personalizado por cliente.
- Reintroduzir Apps Script, Google Sheets como banco operacional ou qualquer escrita automática na planilha pública.
