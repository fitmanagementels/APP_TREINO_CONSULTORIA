# Brand visual contract

## Contexto e premissas
- Requisitos considerados: reorganizar exclusivamente o estado de abertura da aba Treino; preservar modo prescrito/livre; reunir Ficha, Treino e Ciclo; substituir controles com aparência do navegador; criar navegação diária e calendário mensal temático.
- Premissas: arquitetura single tenant; quatro ciclos atuais; backend e estado da sessão ativa permanecem inalterados; nenhuma biblioteca visual externa será adicionada.
- Tarefa e decisão principais: selecionar rapidamente o contexto e a data correta antes de iniciar uma única sessão de treino.

## Perfil
- Tipo: PWA operacional.
- Público e frequência: usuário single tenant em rotina frequente de treino, principalmente em smartphone.
- Justificativa: a tela prepara e inicia uma ação operacional recorrente; métricas e narrativa não são a prioridade deste estado.

## Tema
- Escolha: dark.
- Superfícies e justificativa: base escura existente; card do formulário; superfície ativa para modo, opção e dia selecionados; overlay escuro para o calendário. A distinção ocorre primeiro por luminância e borda, com lime reservado a foco, seleção e CTA.

## Densidade
- Escolha: compacta.
- Justificativa: o contexto do treino deve caber antes do CTA em uma tela móvel, mantendo Ficha, Treino e Ciclo na mesma linha sem rolagem horizontal.

## Hierarquia
1. Escolher Treino prescrito ou Treino livre.
2. Definir Ficha, Treino e Ciclo quando o modo exigir.
3. Confirmar ou alterar a data.
4. Iniciar treino.

## Zonas
| Zona | Objetivo | Conteúdo | Prioridade | Componente |
|---|---|---|---|---|
| Modo | Definir o tipo de sessão | Prescrito / Livre | Alta | Controle segmentado |
| Contexto | Definir a prescrição | Ficha / Treino / Ciclo | Alta no prescrito; oculta no livre | Comboboxes próprios |
| Data | Escolher o dia da sessão | Anterior / data / seguinte | Alta | Navegador diário + calendário |
| Ação | Criar a sessão | Iniciar treino | Focal | CTA lime existente |

## Componentes
- Componente focal: botão **Iniciar treino**, após todas as escolhas.
- Fluxos lineares: modo → contexto → data → início.
- Blocos de overview/bento: não aplicável; a tela é uma rotina curta, não um overview.
- Dados densos — tabela ou cards e por quê: não aplicável; há somente valores de seleção.
- Estados vazios, carregamento, erro e sucesso: lista vazia com mensagem e dependência desabilitada; carregamento integrado ao boot; erro preserva seleção anterior; sucesso muda para a sessão ativa já existente.

## Responsividade
- Mobile em coluna única: zonas empilhadas; apenas os três campos internos compartilham uma linha.
- Ordem das zonas no mobile: modo, contexto prescrito, data, CTA.
- Adaptação de dados densos: valores longos usam elipse no gatilho e aparecem completos no popover rolável.
- Expansão para telas maiores: mantém a mesma ordem e limita a largura do card; o calendário muda de bottom sheet para painel central compacto.

## Navegação e interação
- Trabalho recorrente e fluxo curto: abrir Treino, selecionar modo/contexto/data e iniciar sem sair da tela.
- Ação primária por contexto: **Iniciar treino** sem sessão ativa; nenhuma nova ação compete com ela.
- Hierarquia, retorno e contexto preservado: popovers e calendário fecham sobre a tela; modo livre não apaga as seleções prescritas; fechar sem escolher preserva o valor.
- Overlays — tipo, uso e justificativa: popover para opções breves; bottom sheet móvel/painel central para calendário mensal, pois oferece contexto complementar sem navegar para outra tela.
- Mobile — destinos, ação e transformação de overlays: navegação inferior permanece; CTA após a data; calendário sobe como bottom sheet e não altera a posição da tela de origem.

### Estados
| Superfície/ação | idle | loading | success | empty | error | disabled |
|---|---|---|---|---|---|---|
| Modo | opção atual ativa | não aplicável | troca imediata | não aplicável | preserva modo anterior | bloqueado apenas com sessão ativa |
| Combobox | valor e seta | contraste reduzido durante boot | opção atualizada e popover fechado | mensagem sem opção | mantém valor e aviso persistente existente | mostra motivo pela dependência ausente |
| Navegador de data | data atual | não aplicável | data atualizada | não aplicável | mantém data válida anterior | bloqueado apenas ao iniciar requisição |
| Calendário | fechado | não aplicável | seleciona e fecha | não aplicável | mantém data anterior | não aplicável |
| Iniciar treino | disponível com dados válidos | botão bloqueado durante requisição | transita à sessão ativa | explica seleção faltante | mensagem existente e tentativa disponível | opacidade reduzida e motivo verificável |

### Motion e acessibilidade
- Transições (`transform`/`opacity`, 180–250 ms): abertura e fechamento de popover e calendário; nenhuma animação decorativa permanente.
- Comportamento com `prefers-reduced-motion`: remove deslocamento e usa mudança instantânea de visibilidade/estado.
- Foco, teclado e toque: foco verde visível; `Escape` fecha overlays; semântica de combobox/listbox/dialog; ordem de foco linear; alvos de toque confortáveis.
