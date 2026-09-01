# Design — seletores e calendário da abertura de treino

Data: 1º de setembro de 2026

## Objetivo

Melhorar somente o estado **Iniciar treino** da aba Treino, mantendo o design geral do PWA e o fluxo de sessão já publicado. A tela deve organizar modo, ficha, treino, ciclo e data com componentes controlados pelo próprio PWA, sem depender da aparência dos seletores e do calendário do navegador.

## Decisões aprovadas

- A primeira linha continua sendo o controle segmentado **Treino prescrito / Treino livre**.
- A segunda linha reúne **Ficha / Treino / Ciclo**, nessa ordem e na mesma linha.
- No modo Treino livre, a segunda linha desaparece por completo.
- A data fechada mostra um dia por vez, no formato `‹  Terça-feira, 1 de setembro  ›`.
- Cada seta altera a seleção em exatamente um dia.
- Tocar no texto central abre um calendário mensal customizado e coerente com o tema do PWA.
- O botão **Iniciar treino** permanece como a ação primária ao final do bloco.
- O estado de sessão em andamento, Prescrição, Prescrever, Histórico, Carga, APIs e banco não mudam.

## Abordagens consideradas

### 1. Componentes próprios do PWA — escolhida

Comboboxes controlados em JavaScript, lista temática em popover e calendário mensal em painel próprio. Entrega aparência consistente, controle de estados e experiência igual nos navegadores suportados.

### 2. Elementos nativos apenas estilizados

Manter `select` e `input type="date"` com CSS. Tem menor código, mas a lista de opções e o calendário continuam herdando aparência do sistema ou navegador, contrariando o requisito central.

### 3. Calendário mensal sempre expandido

Evita overlay, mas ocupa área excessiva antes do treino e reduz a prioridade do CTA. Não combina com o pedido de um retângulo discreto.

## Hierarquia e composição

O bloco segue um fluxo linear:

1. Título **Iniciar treino**.
2. Controle segmentado de modo.
3. Linha compacta com Ficha, Treino e Ciclo, visível somente no modo prescrito.
4. Navegador de data em retângulo horizontal.
5. Botão **Iniciar treino**.

No mobile, Ficha, Treino e Ciclo permanecem na mesma linha. As colunas usam proporções aproximadas de 34%, 42% e 24%; valores longos são truncados visualmente, mas o texto completo permanece disponível no seletor aberto.

## Seletores próprios

Cada campo tem rótulo pequeno em verde, botão escuro, borda sutil, texto claro e ícone de expansão próprio. O navegador não desenha a superfície nem a lista.

Ao tocar:

- abre um popover ancorado ao campo;
- a opção atual recebe superfície ativa, borda e indicador verde;
- a lista usa rolagem interna se exceder o espaço disponível;
- tocar em uma opção seleciona e fecha;
- tocar fora ou pressionar `Escape` fecha sem alterar;
- Ficha atualiza as opções válidas de Treino;
- Ciclo atualiza `currentWeek` e continua enviando os valores `1` a `4` ao backend.

Trocar para Treino livre apenas oculta a linha, sem apagar a última seleção. Ao retornar ao modo prescrito, a seleção anterior reaparece.

## Navegador de data

O controle fechado é um retângulo escuro de altura semelhante aos demais campos. Possui:

- seta esquerda para subtrair um dia;
- botão central com dia da semana e data por extenso em português;
- seta direita para adicionar um dia.

O valor canônico continua sendo `selectedDate` no formato `YYYY-MM-DD`. A conversão deve usar data local, sem deslocamento de fuso causado por UTC.

O controle tem destaque discreto e nítido: borda sutil em repouso, borda verde no foco e sem glow permanente.

## Calendário mensal

Tocar no centro do navegador abre um painel temático sobre a tela atual:

- cabeçalho com mês/ano e setas de mês;
- colunas de domingo a sábado;
- grade de dias com alvos de toque confortáveis;
- dia atual indicado por ponto ou contorno sutil;
- dia selecionado com superfície ativa e acento verde;
- dias de meses adjacentes visualmente rebaixados;
- escolha de um dia atualiza `selectedDate` e fecha o painel;
- botão explícito **Hoje** permite retorno rápido;
- tocar fora, usar o botão voltar do painel ou `Escape` fecha sem alterar.

No mobile, o calendário funciona como bottom sheet. Em telas maiores, usa um painel central compacto. O fundo recebe overlay escuro sem alterar o estado da tela.

## Estados

- **Idle:** valores atuais visíveis e controles habilitados.
- **Hover/foco:** borda e texto ganham acento verde; foco de teclado permanece visível.
- **Aberto:** superfície do gatilho e opção selecionada usam estado ativo.
- **Loading:** enquanto dados iniciais não chegam, seletores ficam desabilitados e preservam o skeleton/loader global.
- **Vazio:** campo sem opções mostra `Nenhuma opção disponível` no popover e não permite seleção inválida.
- **Erro:** mantém a seleção anterior e usa o sistema de aviso já existente; o erro importante não depende somente do toast.
- **Disabled:** Treino e Ciclo ficam indisponíveis quando suas dependências ainda não existem, com `aria-disabled` e contraste reduzido.

## Acessibilidade e motion

- Gatilhos expõem nome, valor, `aria-expanded` e relação com a lista.
- Listas usam semântica de `listbox` e `option`.
- O calendário usa `role="dialog"`, título associado e botões reais para os dias.
- Ordem de foco acompanha a ordem visual: modo, ficha, treino, ciclo, data anterior, data, data seguinte, CTA.
- Alvos de toque têm pelo menos 44 px quando isolados; a grade do calendário mantém área equivalente.
- Transições usam somente `opacity` e `transform`, entre 180 e 250 ms.
- `prefers-reduced-motion` remove deslocamentos e preserva as mudanças instantâneas de estado.

## Dados e integração

Não existem alterações no Worker, D1 ou payloads. Os componentes atualizam os estados já existentes:

- `trainingMode`;
- `selectedFicha`;
- `selectedTreino`;
- `currentWeek`;
- `selectedDate`.

`startTrainingSession()` continua enviando `session_date`, `id_ficha`, `id_treino` e `cycle_reference` como hoje. Os elementos nativos atuais podem permanecer ocultos somente se forem necessários como ponte temporária, mas não devem controlar a experiência visual.

## Fora de escopo

- Redesenho do estado de sessão ativa.
- Mudanças em Prescrição, Prescrever, Histórico ou Carga.
- Quantidade dinâmica de ciclos.
- Cronograma de periodização.
- Mudanças de autenticação, API ou D1.
- Inclusão de bibliotecas externas de calendário ou UI.

## Verificação

- Testes de contrato confirmam a ordem modo → seletores → data → CTA.
- Testes de regressão confirmam que Ficha, Treino, Ciclo e data atualizam os estados existentes.
- Testes cobrem mudança de dia atravessando mês e ano, retorno para Hoje e seleção pelo calendário.
- O modo livre oculta a linha prescrita e mantém data/CTA.
- O calendário e os popovers fecham por seleção, toque externo e `Escape`.
- A geração dos assets e toda a suíte Worker continuam aprovadas.
- Verificação em navegador móvel confirma ausência de overflow, aparência temática e preservação das demais abas.
