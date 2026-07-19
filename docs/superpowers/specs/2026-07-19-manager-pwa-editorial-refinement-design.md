# PWA gerencial XSTEAM — refinamento editorial

**Data:** 2026-07-19  
**Status:** aprovado para planejamento

## Objetivo

Refinar o PWA gerencial já migrado para o tema XSTEAM para uma leitura editorial e sofisticada, sem perder rapidez operacional, responsividade ou o sistema de navegação atual.

## Diagnóstico

A primeira versão possui contraste adequado, mas os tamanhos e pesos de títulos, rótulos e textos auxiliares estão próximos demais. O lime também aparece em microtextos que deveriam apenas estruturar a leitura, reduzindo a hierarquia percebida.

## Direção aprovada: editorial técnico

- Títulos serão mais presentes, com peso forte, tracking compacto e linha mais generosa.
- Rótulos e metadados serão menores, espaçados e em tom cinza-esverdeado, usando lime apenas para marcador ativo e ações.
- Texto de conteúdo ganhará tamanho e line-height próprios para leitura rápida, em vez de herdar a aparência dos rótulos.
- A sidebar será mais silenciosa; somente o módulo ativo terá contraste lime forte.
- Cabeçalho, barra contextual, título da seção e cards receberão uma escala de espaçamento regular para que cada nível tenha respiro.
- Campos, botões e estados mantêm contraste e alvos de toque atuais.

## Limites

- Não alterar HTML de dados, chamadas Apps Script, navegação, breakpoints ou comportamento de formulário.
- Não inserir fontes externas ou novas dependências.
- Não ampliar excessivamente títulos em tablet/mobile; os tamanhos seguem limites responsivos legíveis.

## Verificação

- Confirmar que `h1`, `h2`, rótulos, corpo, metadados e botão primário tenham escalas distintas.
- Confirmar que lime é dominante apenas para ação e seleção.
- Conferir leitura em desktop, tablet e mobile e rodar a regressão do gerenciador e a sintaxe do script.