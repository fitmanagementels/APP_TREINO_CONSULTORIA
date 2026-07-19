# XSTeam V2 — Plano Consolidado de Implementação

> **Para execução:** implementar em linha, por etapas testáveis, sem acesso do agente ao Google Drive. Cada etapa termina com testes locais verdes e um commit próprio.

**Objetivo:** concluir localmente o Gerenciador, o pacote-modelo do PWA do aluno e a automação de ciclo de vida para que o treinador apenas copie códigos, configure propriedades e autorize o Apps Script.

**Arquitetura:** uma planilha/Apps Script central do Gerenciador é a fonte de verdade para aluno, catálogo, fichas, publicação, operações e saúde. Cada aluno recebe uma cópia isolada do modelo, com planilha e script próprios. A comunicação central ocorre somente por operações explícitas, registradas e repetíveis.

**Tecnologias:** Google Apps Script V8, Google Sheets, Google Drive, Apps Script API para versões/deployments, HTML/CSS/JavaScript compatível com HtmlService e testes estáticos Node.

## Limites obrigatórios

- A V1 permanece intacta em `V1_BACKUP/`.
- O agente nunca acessa, cria, move ou publica itens no Drive do treinador.
- O aluno não edita catálogo, prescrição, visibilidade ou ficha ativa.
- A URL normal de cada aluno deve permanecer estável nas atualizações.
- Nenhuma interação de série cria chamada remota: boot curto, início de sessão e finalização em lote.
- Operações com Drive, publicação e atualização são idempotentes e registradas em `Fila_Operacoes`.
- Dados de treino ficam isolados na planilha do aluno; observabilidade não recebe dados sensíveis.

## Estado atual confirmado

- Modelo do aluno criado pelo treinador em `00_MODELOS`, com `SPREADSHEET_ID` configurado e abas técnicas corrigidas.
- Gerenciador local já tem base de alunos, catálogo, rascunhos e os estados centrais iniciais de publicação.
- O código local ainda não foi copiado para a planilha/Apps Script do Gerenciador.
- Não existe instância de aluno provisionada nem implantação pública de aluno.

---

## Etapa 0 — Congelar e validar a base local

**Arquivos:** testes de `V2/manager` e `V2/app`.

1. Remover testes experimentais que não tenham implementação correspondente.
2. Executar as três suítes locais.
3. Confirmar que apenas mudanças intencionais existem antes de cada commit.

**Aceite:** testes do Gerenciador, do aluno e de estilo passam; nenhuma operação toca o Drive.

## Etapa 1 — Contrato completo de ficha no Gerenciador

**Arquivos:** `V2/manager/app/Codigo.gs`, `script.html`, `style.html`, `manager-regression.test.js`.

1. Completar o ciclo `rascunho → em_revisao → publicada`.
2. Separar publicação, visibilidade e ativação:
   - publicar cria `publicacao_id` e fila;
   - publicar torna a ficha visível;
   - ocultar falha se a ficha estiver ativa;
   - ativar exige ficha visível e torna qualquer anterior inativa.
3. Exibir no Gerenciador botões de revisar, publicar, ocultar/restaurar e ativar, sempre com confirmação e retorno de estado.
4. Registrar a versão da prescrição usada em cada publicação.

**Testes obrigatórios:** não há duas fichas ativas; ficha oculta não ativa; repetir publicação não duplica estado; ações desconhecidas são rejeitadas.

**Aceite:** o treinador administra o ciclo inteiro no Gerenciador, ainda sem depender de uma instância existente.

## Etapa 2 — Réplica de publicação para a instância do aluno

**Arquivos:** `V2/manager/app/Codigo.gs`, `V2/app/Código.gs`, ambos os testes.

1. Definir o contrato compartilhado de:
   - `DB_Fichas`;
   - `DB_Prescricao`;
   - `DB_Prescricao_Substitutos`;
   - `DB_Catalogo_Exercicios`.
2. Criar o trabalhador `replicatePublishedFichaToTenant(publicacaoId)`.
3. Quando a instância existir, gravar em lote ficha e itens na planilha individual.
4. Quando a instância ainda não existir, manter a publicação central válida e deixar a réplica pendente para o provisionamento.
5. Garantir que a réplica não apaga execução, histórico ou outra ficha visível.

**Testes obrigatórios:** usa apenas o `spreadsheet_id` do aluno correto; grava apenas abas técnicas aprovadas; segunda execução não duplica a publicação.

**Aceite:** uma ficha publicada chega ao PWA do aluno e somente a ativa permite iniciar sessão.

## Etapa 3 — Conclusão do PWA do aluno

**Arquivos:** `V2/app/Código.gs`, `index.html`, `script.html`, `style.html`, testes.

1. Finalizar as quatro áreas: Treino, Fichas, Histórico e Progresso.
2. Fichas: todas as fichas visíveis em leitura, com detalhe completo de exercícios/ciclos.
3. Treino: seleção só da ficha ativa; iniciar carrega pacote único; salvar rascunho local; retomar ou descartar.
4. Execução: carga, repetições, RIR opcional, PSE obrigatória, substitutos, omitidos e extras.
5. Histórico: manter visual V1 e modal de detalhes, usando PSE.
6. Progresso: frequência, volume total e melhor e1RM da sessão por exercício, usando Brzycki com RIR numérico entre 0 e 5.

**Testes obrigatórios:** recarregar preserva rascunho; `-` e `6+` não calculam e1RM; substituição não altera ficha; uma sessão sincroniza em lote.

**Aceite:** o aluno consegue concluir um treino sem chamadas por série, mesmo com recarga acidental da página.

## Etapa 4 — Catálogo, demanda e acompanhamento

**Arquivos:** gerenciador, pacote do aluno e testes.

1. Importador controlado do catálogo bruto `IMPORT_CATALOGO_V1__NAO_EDITAR` para `Catalogo_Exercicios`.
2. Replicar catálogo ativo completo em cada instância.
3. Calcular demanda planejada e realizada com `coeficiente × séries`.
4. Manter caches de ficha, sessão e período sem bloquear treino.
5. Correção de coeficiente incrementa `versao_catalogo` e enfileira recálculo das instâncias.
6. Enviar resumos de sessão para `Sessoes_Monitoradas`, incluindo exercícios planejados/concluídos.

**Aceite:** o Gerenciador acompanha aderência, volume e demanda sem consultar planilhas de alunos em massa durante a navegação.

## Etapa 5 — Saúde e observabilidade

**Arquivos:** backend e telas de Saúde/Acompanhamento do Gerenciador.

1. Registrar abertura, recebimento de publicação, sincronização iniciada/concluída/falha e erro controlado.
2. Sanitizar eventos: sem telefone, nome, carga, exercício ou texto livre.
3. Enviar eventos em lote e armazenar agregados diários.
4. Mostrar erros de PWAs por período, aluno, versão e código técnico.
5. Criar retenção de 90 dias somente para eventos brutos.

**Aceite:** problemas dos apps dos alunos aparecem no Gerenciador sem polling contínuo.

## Etapa 6 — Provisionamento automático

**Arquivos:** `V2/manager/app/Codigo.gs`, interface e manifest do Gerenciador.

1. Validar propriedades do Gerenciador:
   - `MODELS_FOLDER_ID`;
   - `STUDENTS_FOLDER_ID`;
   - `ARCHIVED_STUDENTS_FOLDER_ID`;
   - `TENANT_TEMPLATE_SPREADSHEET_ID`;
   - `TENANT_TEMPLATE_SCRIPT_ID`.
2. Botão `Criar instância` cria operação em `Fila_Operacoes`.
3. Trabalhador retoma etapas idempotentes:
   - criar pasta do aluno;
   - copiar modelo;
   - mover cópia para a pasta;
   - obter/criar projeto Apps Script da instância;
   - inicializar propriedades exclusivas;
   - criar abas e copiar catálogo/fichas já publicadas;
   - registrar IDs, versão, deployment e URL.
4. Falhas guardam etapa, tentativa e resumo; repetir não duplica arquivos.
5. Pausar, arquivar e reativar movem/alteram estado sem apagar dados.

**Aceite:** uma instância de teste é criada por uma ação no Gerenciador e fica pronta para receber ficha.

## Etapa 7 — Releases e URL estável

**Arquivos:** backend de Gerenciador, manifest e testes.

1. Ler o pacote mestre do modelo.
2. Criar release imutável, com hash e versão.
3. Aplicar código/migrações a cada script de aluno em fila pequena.
4. Criar uma nova versão do Apps Script e apontar o deployment existente para ela.
5. Guardar resultado por instância; permitir rollback para a versão anterior.

**Aceite:** uma atualização normal do app do aluno preserva a URL já enviada ao aluno.

## Etapa 8 — Validação integrada e guia manual

**Arquivos:** `V2/docs/GUIA_CONFIGURACAO_GOOGLE.md`, resumo e Knowledge Hub.

1. Documentar a cópia dos arquivos para o Apps Script do Gerenciador.
2. Orientar habilitação/autorização das APIs Google necessárias.
3. Criar um aluno de teste, provisionar, publicar duas fichas e ativar uma.
4. Executar treino, validar histórico, demanda, observabilidade e URL.
5. Atualizar uma release, confirmar mesma URL e testar rollback.
6. Arquivar e reativar a instância de teste.
7. Atualizar o Knowledge Hub e registrar resultado.

## Divisão de responsabilidades

| Quem | Faz |
|---|---|
| Eu, localmente | Código, testes, documentação e commits. |
| Você, uma vez | Copiar código do Gerenciador, configurar propriedades, habilitar/autorizar APIs e executar funções indicadas. |
| Backend autorizado do Gerenciador | Criar/copiar/mover instâncias, replicar dados e atualizar apps. |
| Aluno | Usa apenas a URL recebida; não gerencia planilha ou prescrição. |

## Ordem de entrega

1. Etapas 0–3: contrato funcional treinador → aluno.
2. Etapas 4–5: indicadores e saúde.
3. Etapas 6–7: automação de instâncias e releases.
4. Etapa 8: validação real com uma instância de teste.

## Critério de conclusão

Só consideraremos a V2 pronta quando uma instância de teste tiver sido criada pelo Gerenciador, receber uma ficha publicada, registrar um treino, aparecer no acompanhamento/saúde e permanecer no mesmo link após uma atualização de versão.
