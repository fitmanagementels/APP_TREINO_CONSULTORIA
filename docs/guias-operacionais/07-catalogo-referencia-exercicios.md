# Catálogo oficial de exercícios

## Fonte autorizada

O catálogo do PWA vem exclusivamente desta aba pública:

<https://docs.google.com/spreadsheets/d/1ukUCtws2hV2_PW7JzduQV4cr_EcqVC6-EoHzut1KS0Y/edit?gid=139666673#gid=139666673>

Edite a planilha para adicionar, alterar ou remover exercícios. Não adicione exercícios diretamente no D1, no código ou por outro catálogo: o próximo sincronismo os deixará inativos.

## Como atualizar imediatamente

1. Abra o PWA e entre com a conta Google autorizada.
2. Abra a aba **Prescrever** na barra inferior.
3. Toque em **Atualizar catálogo**.
4. Aguarde o botão voltar ao texto normal.
5. Confira a linha abaixo dos botões: ela deve informar `Catálogo atualizado em ...`.
6. Abra **+ Adicionar exercício** e confirme que o exercício alterado aparece no seletor.

Também existe uma atualização automática todos os dias às 04:00 UTC. O botão manual é a forma recomendada de aplicar uma alteração da planilha sem esperar o próximo dia.

## Regras da planilha

- Mantenha os cabeçalhos `Exercício`, `Link do vídeo`, `Grupo muscular`, `N-articulação` e `Tipo`.
- `Link do vídeo` e `Tipo` podem ficar vazios.
- Cada nome de exercício deve ser único.
- As colunas musculares aceitam valores entre `0` e `1`, inclusive decimais brasileiros como `0,5`.
- Um exercício removido da referência deixa de poder ser prescrito, mas não é apagado fisicamente do D1.
- Execuções históricas não são modificadas, mesmo quando um exercício é removido ou renomeado.

Na primeira importação, somente estas duas substituições aprovadas ocorrem nas prescrições atuais:

- `Agachamento livre com barra nas costas` → `Agachamento com barra livre`;
- `Desenvolvimento com halter` → `Desenvolvimento com halteres sentado`.

O histórico de execuções preserva os nomes antigos.

## Se aparecer erro

O catálogo que já estava disponível continua intacto. Corrija a planilha e use **Atualizar catálogo** novamente.

Verifique, nesta ordem:

1. A planilha continua pública para visualização.
2. Não há nomes duplicados na coluna `Exercício`.
3. Nenhuma coluna obrigatória foi removida ou renomeada.
4. As demandas musculares são números válidos entre `0` e `1`.
5. Cada linha possui exercício e grupo muscular preenchidos.

Não apague dados do D1 para corrigir uma falha de importação.
