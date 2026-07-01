# Frontend Polish Design

Data: 2026-07-01

## Objetivo

Melhorar a estetica do app principal XSTeam Wellness sem alterar funcionalidade, fluxo, textos, IDs, callbacks ou estrutura de navegacao. O foco e reduzir a sensacao de "verde e preto" puro, preservando as cores da marca com acabamento mais moderno.

## Escopo

- Aplicar o polish somente no app principal, em `app/style.html`.
- Manter `docs/index.html` fora do escopo.
- Nao alterar JavaScript, dados, eventos, navegacao, seletores, filtros, modais ou layout funcional.

## Direcao Visual

Direcao aprovada: premium atletico discreto.

O app deve continuar escuro e energetico, mas com mais profundidade: fundo preto menos chapado, superficies em camadas, gradientes sutis, sombras refinadas e uma luz verde discreta em direcao irregular para um canto. O verde principal continua sendo a assinatura da marca, mas deixa de ser o unico elemento visual dominante.

## Mudancas Propostas

- Refinar tokens de tema: background, cards, inputs, bordas, textos, glow, sombras e gradientes.
- Criar background global com camadas radiais/lineares discretas e luz verde diagonal irregular.
- Modernizar cards, KPIs, charts, linhas de prescricao, badges, bottom nav e modais com glass leve, bordas suaves e sombras mais profundas.
- Transformar CTA principal em gradiente verde controlado, com hover/focus mais polido.
- Ajustar estados ativos, skeleton e toast para acompanhar a nova linguagem visual.
- Preservar contraste e legibilidade em mobile.

## Nao Objetivos

- Nao mudar UI/UX, hierarquia de telas ou comportamento.
- Nao trocar icones, textos ou componentes.
- Nao adicionar dependencias.
- Nao mexer na pagina de documentacao.

## Verificacao

- Rodar os testes existentes se houver comando disponivel.
- Fazer checagem estatica dos arquivos alterados.
- Se possivel, abrir ou servir o HTML localmente para inspecao visual em viewport mobile e desktop.
