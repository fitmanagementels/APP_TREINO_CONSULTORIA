# Guia 08 — sessão de treino e treino livre

Este guia descreve o fluxo atual da aba **Treino** no PWA Cloudflare. Ele substitui o registro direto e solto por data: agora existe uma única sessão ativa, que precisa ser finalizada ou cancelada antes de outra começar.

## Resultado esperado

- Apenas uma sessão pode ficar em andamento.
- A sessão pode usar um treino prescrito ou começar vazia como **Treino livre**.
- Carga, repetições e **RER** aceitam rascunhos locais; RER varia de `0` a `10` em intervalos de `0,5`.
- A sessão só aparece em **Histórico** e **Carga** depois da finalização.
- Histórico e Carga continuam lendo o formato de execuções já existente.

## Iniciar um treino prescrito

1. Abra a aba **Treino**.
2. Deixe selecionado **Treino prescrito**.
3. Escolha a ficha, o treino, o ciclo e a data.
4. Toque em **Iniciar treino**.
5. A seleção é bloqueada e a tela passa a mostrar apenas a sessão em andamento.

Se a página for fechada ou recarregada, a mesma sessão é recuperada. Não é possível abrir outra ficha enquanto ela estiver ativa.

## Iniciar um treino livre

1. Abra a aba **Treino**.
2. Selecione **Treino livre**.
3. Escolha a data e toque em **Iniciar treino**.
4. Toque em **+ Adicionar exercício**.
5. Escolha um exercício do catálogo oficial.

Somente exercícios ativos sincronizados da planilha de referência podem ser adicionados. O treino livre não altera nenhuma prescrição.

## Preencher a sessão

Cada série possui três campos:

- **Carga:** valor usado no exercício;
- **Reps:** repetições executadas;
- **RER:** repetições em reserva, de `0` a `10`, em intervalos de `0,5`.

Uma série é considerada completa apenas quando os três campos estão preenchidos. Uma linha parcialmente preenchida fica destacada e impede a finalização. Linhas totalmente vazias são ignoradas.

Durante a sessão também é possível:

- adicionar ou remover séries;
- adicionar, remover ou reordenar exercícios;
- fechar e reabrir o PWA sem perder o rascunho.

O texto abaixo do resumo informa `Rascunho salvo`, `Salvando rascunho...` ou `Rascunho pendente`.

## Uso sem internet

Depois que a sessão foi iniciada online, o preenchimento continua funcionando sem conexão. Cada alteração é gravada no navegador imediatamente.

Ao recuperar a internet, o PWA tenta sincronizar automaticamente. Não limpe os dados do navegador, não desinstale o PWA e não use **Cancelar sessão** enquanto existir um rascunho que você deseja preservar.

Iniciar, finalizar e cancelar uma sessão exigem internet, pois mudam o estado oficial no D1.

## Finalizar

1. Toque em **Revisar e finalizar**.
2. Se houver uma linha parcialmente preenchida, volte e complete os três campos ou limpe a linha.
3. Confira a quantidade de exercícios e séries completas.
4. Informe a **PSE da sessão**, de `1` a `10`.
5. Toque em **Confirmar finalização**.

Antes de publicar, o PWA sincroniza exercícios e séries. Somente após a confirmação do Worker o rascunho local é removido. As séries completas passam então a aparecer em Histórico e Carga.

## Cancelar

Use **Cancelar sessão** somente quando quiser encerrar sem enviar nenhuma série ao Histórico. O servidor mantém o registro técnico da sessão como cancelada, mas não cria execuções.

## Como interpretar RER e carga de treino

RER significa **repetições em reserva**:

- `0 RER`: nenhuma repetição sobrando; esforço máximo;
- `0,5 RER`: valor intermediário permitido;
- valores maiores: mais repetições ainda poderiam ser executadas.

A métrica planejada para a futura periodização utilizará principalmente `séries × (10 − RER)` e, como medida complementar, `séries × repetições × (10 − RER)`. A tela de cronograma e a quantidade dinâmica de ciclos ainda pertencem à próxima etapa; este incremento entrega primeiro a execução confiável das sessões.

## Aceite rápido após uma publicação

1. Inicie um treino prescrito e confirme que não é possível trocar para outra ficha durante a sessão.
2. Preencha uma série com RER decimal, por exemplo `2,5`.
3. Desconecte a internet, altere outra série e recarregue a página.
4. Confirme que o rascunho reaparece.
5. Reconecte, aguarde `Rascunho salvo` e finalize com PSE.
6. Confira a execução uma única vez em **Histórico** e os indicadores em **Carga**.
7. Inicie um treino livre, adicione um exercício do catálogo e cancele a sessão.
8. Confirme que a sessão cancelada não apareceu no Histórico.

Se algum passo falhar, não edite o D1 manualmente. Preserve a sessão e registre a mensagem exibida para diagnóstico.
