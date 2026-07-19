# XSTeam V2 — PWA do Aluno

**Status:** desenho aprovado; pronto para planejamento detalhado da Fase 2.

## Objetivo

Evoluir o PWA single-tenant da V1 sem recomeçar do zero. O aluno executa apenas a ficha ativa, consulta todas as fichas visíveis em modo leitura, revisa seu histórico e acompanha progresso. Prescrição, catálogo mestre, publicação e ativação permanecem exclusivamente no Gerenciador.

## Navegação

O PWA terá quatro abas:

1. **Treino** — única área que cria ou edita uma execução.
2. **Fichas** — todas as fichas visíveis, sempre em modo leitura.
3. **Histórico** — experiência visual herdada da V1 para sessões concluídas.
4. **Progresso** — frequência, volume e e1RM por exercício.

## Treino

### Entrada e início

- A tela inicial mostra a ficha ativa, o último treino concluído e um seletor suspenso de treino pertencente à ficha ativa.
- Antes de o aluno tocar em **Iniciar treino**, não há cards de exercícios na tela.
- Iniciar treino carrega, em um pacote curto, a prescrição daquele treino, os substitutos autorizados e as referências necessárias do histórico.
- Se existir uma sessão local incompleta, o PWA mostra **Retomar** ou **Descartar**. Nada é descartado automaticamente.

### Preenchimento e persistência

- Durante o preenchimento, carga, repetições, RIR, exercício removido, substituto e exercício extra são persistidos no rascunho local do dispositivo.
- Atualizar a página, fechar o PWA ou perder conexão não pode apagar o rascunho.
- O preenchimento não grava cada alteração na planilha. A sincronização envia a sessão inteira em lote, ao finalizar ou quando a fila local voltar a ter conexão.
- A PSE é obrigatória no encerramento da sessão; RIR é opcional por série.

### Referência do último treino

- Cada exercício prescrito pode exibir uma referência discreta de seu último treino comparável.
- A ação **Mostrar treino anterior** abre um modal com a última sessão completa relevante: data, PSE, exercícios e séries (carga, repetições e RIR quando houver).
- O card não é expandido com dados históricos; o modal evita poluir a execução.

### Substitutos

- O treinador define substitutos por aluno, ficha e item prescrito.
- O card contém um ícone de substitutos. Ao tocar, o aluno abre um modal com blocos contendo somente opções autorizadas.
- A confirmação informa que a troca vale apenas para a sessão atual.
- O card mantém sua posição e mostra o exercício escolhido; a ficha publicada não muda.
- O aluno pode usar **Restaurar exercício prescrito** antes de finalizar.
- A referência de um substituto é a última vez em que esse exercício foi executado, independentemente de ficha.
- O substituto herda, inicialmente, séries, repetições, descanso e zona de RIR do item original.

### Exercícios removidos e extras

- **Remover da sessão** tira o card da lista ativa, sem mudar a ficha. O item fica em uma área recolhida **Não realizados** com ação **Desfazer**.
- O exercício removido é registrado tecnicamente como não realizado para cálculo de aderência, mas não polui o histórico visual normal.
- **Adicionar exercício** fica no fim da lista. O aluno pesquisa o catálogo local e o novo card aparece abaixo dos exercícios prescritos, marcado como **Extra**.
- Extra e substituto participam da demanda realizada, com o exercício efetivamente executado.

### RIR e PSE

- **PSE**: obrigatório, uma vez por sessão, escala de 0 a 10.
- **RIR**: opcional por série, opções `-`, `0`, `0,5`, `1`, `1,5`, `2`, `2,5`, `3`, `3,5`, `4`, `4,5`, `5` e `6+`.
- Ambos possuem seletor suspenso e slider sincronizados.
- A escala visual de PSE vai de azul (0) a vermelho (10), passando por roxo.
- Para RIR, a escala é invertida: `6+` azul e `0` vermelho, pois RIR menor representa maior proximidade da falha.

### Finalização

1. O aluno abre um resumo de prescritos concluídos, removidos, substitutos e extras.
2. Preenche a PSE obrigatória.
3. Toca em **Finalizar e salvar**.
4. O PWA envia um lote idempotente ou mantém o lote na fila local até a sincronização concluir.

## Fichas

- A ficha ativa recebe destaque visual e selo **Ativa**.
- Todas as fichas visíveis — inclusive a ativa — são leitura somente.
- Fichas anteriores podem ser abertas com exercícios, ciclos, séries, repetições, descanso, RIR e observações.
- A aba Fichas não possui ação de iniciar ou preencher treino.

## Histórico

- Mantém a apresentação da V1: sessões agrupadas por data, cards com volume total, exercícios e séries, e modal detalhado ao tocar.
- A única adaptação semântica obrigatória é renomear RPE para **PSE**.
- Exercícios extras e substitutos têm identificador discreto no detalhe da sessão.

## Progresso

### Escopo inicial

- Frequência de treino: sessões concluídas por semana.
- Volume total: soma semanal de carga × repetições × séries.
- Evolução por exercício: gráfico de e1RM estimado.

### Filtros

- Períodos: 4 semanas, 8 semanas, 12 semanas e todo o histórico.
- Padrão: 8 semanas.
- O gráfico de e1RM permite escolher um exercício.

### e1RM ajustado por RIR

```text
repetições ajustadas = repetições realizadas + RIR
e1RM = carga ÷ (1,0278 − 0,0278 × repetições ajustadas)
```

- Fórmula de Brzycki.
- Para cada exercício e sessão, usar o maior e1RM válido.
- Só calcular quando houver carga numérica, RIR exato de 0 a 5 e repetições ajustadas entre 1 e 10.
- RIR `-` e `6+` não geram e1RM.
- PSE é armazenada, mas não entra no painel inicial de Progresso. Gamificação fica fora deste escopo.

## Dados e planilhas

### Fonte e réplicas

- `Catalogo_Exercicios` no Gerenciador é a fonte oficial.
- Cada instância tem uma réplica completa dos exercícios ativos em `DB_Catalogo_Exercicios`, sem dados de outros alunos.
- O catálogo fica em cache local do PWA por `versao_catalogo`; é carregado ou renovado apenas quando necessário, especialmente para exercício extra.

### Novas estruturas

| Local | Estrutura | Finalidade |
|---|---|---|
| Gerenciador | `Prescricao_Substitutos` | Fonte dos substitutos, vinculada a aluno, ficha e item prescrito. |
| Aluno | `DB_Prescricao_Substitutos` | Réplica publicada das opções autorizadas àquele aluno. |
| Aluno | `DB_Referencia_Exercicio` | Cache do último treino comparável e da última execução global por exercício. |

`DB_Execucao` guarda o exercício efetivamente executado, o item prescrito de origem, o tipo (`prescrito`, `substituto` ou `extra`) e o estado de execução. Assim, a demanda realizada usa o exercício real; a planejada continua usando o item original.

## Contrato de chamadas e desempenho

| Ação | Chamadas normais | Regra |
|---|---:|---|
| Abrir PWA | 1 | Boot essencial curto e cache por versão. |
| Iniciar treino | 1 | Prescrição, substitutos e referências em um pacote. |
| Preencher sessão | 0 | Rascunho local persistente. |
| Abrir substitutos | 0 | Dados pré-carregados no pacote da sessão. |
| Adicionar extra | 0 na situação normal | Pesquisa no catálogo local/cache. |
| Finalizar/sincronizar | 1 | Lote idempotente com toda a sessão. |

- Cada cliente mantém no máximo uma requisição em voo.
- Escritas usam bloqueio por instância e operações idempotentes.
- Cálculos de demanda, análises e correções de catálogo ficam em cache/fila e não bloqueiam o treino.
- `DB_Referencia_Exercicio` evita varrer `DB_Execucao` inteira a cada abertura de sessão.

## Fora do escopo desta entrega

- Gamificação e métricas adicionais.
- Configuração de parâmetros próprios por substituto.
- Relato manual de erro pelo aluno.
- Provisão/atualização automática de instâncias e publicação central: entregas posteriores do plano V2.

## Critérios de aceite

- Um aluno só pode registrar uma nova execução da ficha ativa.
- Uma sessão incompleta sobrevive a reload, fechamento e falha temporária de rede.
- Substituto, removido e extra não alteram a ficha original nem sua ordem.
- PSE é obrigatória; RIR é opcional com as opções aprovadas.
- O histórico preserva a essência da V1.
- O Progresso mostra apenas frequência, volume e e1RM com as regras de validade aprovadas.
- O fluxo normal de uma sessão exige apenas boot, início e finalização/sincronização; não há chamada por série ou por troca de exercício.
