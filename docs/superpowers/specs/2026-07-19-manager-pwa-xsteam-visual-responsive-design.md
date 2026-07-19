# PWA gerencial XSTEAM — visual e responsividade

**Data:** 2026-07-19  
**Status:** aprovado para planejamento de implementação

## Objetivo

Atualizar o PWA gerencial em `V2/manager/app/` para a linguagem visual XSTEAM, tomando o V1 como referência: base dark, superfícies em profundidade, lime amarelo da marca e iluminação ambiente controlada. A mesma aplicação deve priorizar o trabalho no desktop, preservando operações rápidas e legíveis no tablet e no celular.

## Direção visual

- Fundo preto/carvão em camadas, com luz ambiente sutil em lime; nenhum efeito decorativo que reduza a leitura.
- Cor de destaque: lime amarelo `#D9FF2F`; este tom identifica foco, seleção, progresso e ações primárias.
- Superfícies em grafite escuro, bordas translúcidas discretas, sombras profundas e gradientes contidos para indicar elevação.
- Texto claro de alto contraste, com níveis secundários em cinza esverdeado; estados de sucesso, atenção e erro mantêm cores semânticas próprias.
- Tipografia, espaçamento, raios, sombras e foco serão expostos como tokens CSS para garantir consistência nos módulos atuais e futuros.

## Navegação e arquitetura

### Sidebar única

O app terá uma única arquitetura de navegação em todos os formatos de tela.

- No **desktop**, a sidebar é fixa à esquerda e pode alternar entre aberta e compacta. No modo compacto, ícones permanecem legíveis e os rótulos aparecem por tooltip/foco; o conteúdo aproveita a largura extra.
- No **tablet**, ela inicia compacta e pode ser expandida sobre o conteúdo. Isso preserva espaço sem esconder os módulos disponíveis.
- No **mobile**, ela vira um drawer lateral aberto por botão no cabeçalho. Ao escolher um destino, fecha automaticamente para devolver a tela à operação.

Os módulos iniciais são Alunos, Prescrições, Acompanhamento e Saúde do App. A marca XSTEAM, o título da área e o estado de conexão ficam no cabeçalho da sidebar ou em sua versão compacta.

### Barra contextual superior

Uma faixa horizontal persistente aparecerá desde a primeira versão, logo acima do conteúdo. Inicialmente ela mostrará o contexto do módulo e uma área pronta para as subabas. Quando subabas forem implementadas, serão associadas ao módulo ativo e apresentadas nessa faixa.

- Desktop e tablet: itens alinhados horizontalmente, com ações contextuais à direita quando houver espaço.
- Mobile: faixa com rolagem horizontal e indicadores visuais; os alvos de toque terão pelo menos 44 px.
- A faixa não substituirá a sidebar: a primeira navega entre módulos; a segunda organiza o contexto interno do módulo.

## Layouts responsivos

| Formato | Largura de referência | Comportamento |
| --- | --- | --- |
| Desktop | 1024 px ou mais | Sidebar fixa, grids com duas colunas onde há lista + detalhe/editor, máxima área de trabalho. |
| Tablet | 701–1023 px | Sidebar compacta/sobreposta, conteúdo adapta entre uma e duas colunas conforme o painel, ações não essenciais podem quebrar linha. |
| Mobile | 700 px ou menos | Drawer lateral, faixa contextual rolável, conteúdo em uma coluna, formulários e cards empilhados. |

Os pontos de quebra serão definidos pelo espaço que os componentes realmente exigem, não apenas por uma classificação de dispositivo. Não haverá rolagem horizontal acidental; listas, campos e botões respeitarão a largura disponível.

## Fluxos e estados preservados

- Alunos continua priorizando busca, seleção, detalhe e criação/edição.
- Prescrições continua com seleção de aluno, fichas, editor de rascunho e catálogo; apenas a apresentação e o encaixe responsivo mudam.
- O estado visual de navegação, campos, botões, foco, carregamento, vazio, erro e seleção será intencional e acessível.
- Nenhuma regra de dados, chamada Apps Script ou comportamento de salvamento será alterado nesta etapa.

## Verificação

- Conferir visual em 1440 px, 1024 px, 768 px, 390 px e 360 px de largura.
- Verificar navegação aberta, compacta e em drawer; uso por teclado e foco visível.
- Testar listas, formulários, editor de prescrição e catálogo sem sobreposição, corte de texto ou rolagem horizontal indevida.
- Executar os testes de regressão existentes do gerenciador e validar a sintaxe do script sem alterações de comportamento.
