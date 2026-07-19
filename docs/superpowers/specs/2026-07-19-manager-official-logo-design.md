# PWA gerencial XSTEAM — logo oficial

**Data:** 2026-07-19  
**Status:** aprovado para planejamento

## Objetivo

Substituir a marca improvisada na sidebar do PWA gerencial por ativos oficiais da biblioteca XSTEAM, preservando legibilidade e o comportamento responsivo atual.

## Direção aprovada

- Sidebar aberta: usar a versão oficial `XS-Team-Alternativa-Horizontal-Cor.svg` e a assinatura textual discreta `GESTÃO` como contexto do produto.
- Sidebar compacta e mobile: usar `XS-Team-Símbolo-Principal-Cor.svg`, sem texto redundante.
- Usar `<img>` com texto alternativo adequado; não desenhar, recolorir ou reproduzir a marca por CSS.
- O logo terá dimensões estáveis, `object-fit: contain` e não alterará a largura, o toggle ou o comportamento da sidebar.

## Limites e verificação

- Não alterar dados, chamadas Apps Script, rotas, formulários ou breakpoints.
- Não usar os quatro arquivos `Principal Horizontal/Vertical` que estão binários sob extensão SVG.
- Validar a presença dos dois caminhos oficiais no shell, regressão do gerenciador e sintaxe do script.