# Tab Specific Light Design

Data: 2026-07-02

## Objetivo

Fazer o rastro de luz do fundo mudar conforme a aba ativa do app, mantendo o polish visual aprovado e sem alterar o fluxo funcional.

## Escopo

- Aplicar a mudanca no app principal.
- Atualizar a aba ativa no `body` com `data-screen`.
- Variar somente tokens visuais de luz, brilho e direcao por aba.
- Preservar navegacao, eventos, dados e layout funcional.

## Direcao Por Aba

- Treino: verde principal mais energetico, vindo do canto superior direito.
- Prescricao: verde mais frio e organizado, com luz mais vertical e suave.
- Prescrever: verde com toque ambar discreto, comunicando criacao/edicao.
- Historico: luz mais baixa e lateral, menos intensa.
- Carga: verde com toque ciano, mais analitico e de dashboard.

## Verificacao

- Teste visual textual deve confirmar `data-screen` no script e regras CSS por aba.
- Testes existentes devem ser executados para registrar o estado real do workspace.
