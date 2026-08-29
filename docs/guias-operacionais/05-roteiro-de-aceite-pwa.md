# Guia 05 — roteiro de aceite do PWA em staging

Use este roteiro somente depois de o [Guia 03](03-exportar-e-importar-dados.md) terminar com `"ok": true`. Faça tudo na URL de staging publicada; não teste na URL do Apps Script e não use o banco de produção.

## Resultado necessário

Todas as cinco telas funcionam com os dados importados; uma série registrada offline é sincronizada uma única vez; a alteração posterior de RPE também persiste; Histórico e Carga mostram os dados após recarregar a página.

## Preparação

1. Abra o PWA de staging e aguarde o loader desaparecer.
2. Abra `URL_DE_STAGING/api/status` em outra aba e confirme `"database":"ok"`.
3. Mantenha o navegador aberto. Se precisar interromper, não faça alterações manuais no D1: reinicie este roteiro desde o começo.

## Aceite das telas e da prescrição

1. Na tela **Treino**, escolha cada ficha e cada treino disponível nos dois seletores. Confirme que os exercícios mudam conforme a escolha.
2. Abra **Prescrição**. Troque os quatro ciclos e confira séries, repetições, descanso e observações.
3. Abra **Prescrever**. Escolha uma combinação de ficha e treino de staging e faça uma alteração pequena e reversível, por exemplo uma observação ou uma repetição. Salve.
4. Volte a **Treino** e confirme que a alteração salva aparece. Se não aparecer, pare: não continue para produção.

## Aceite offline e sincronização

1. Ainda em **Treino**, selecione uma ficha/treino com exercícios e informe uma carga, repetições e RIR para uma série.
2. Desligue a rede do computador ou use as ferramentas do navegador para ficar offline.
3. Registre a série. O indicador deve mostrar item pendente; não recarregue a página nesse momento.
4. Restaure a rede e clique no indicador de sincronização. Aguarde a confirmação de sincronização.
5. Finalize a sessão com RPE. Isso deve marcar novamente o registro como pendente.
6. Clique no indicador de sincronização outra vez e aguarde a confirmação.

## Conferência de persistência e indicadores

1. Abra **Histórico**. Confirme que existe uma única sessão correspondente à série que acabou de registrar — não duas cópias.
2. Abra essa sessão e confira carga, repetições, RIR e RPE.
3. Abra **Carga**. Confirme que volume, RPE e e1RM aparecem para a execução recém-criada.
4. Recarregue completamente a página do navegador.
5. Volte a **Histórico** e **Carga**. Os mesmos dados precisam continuar presentes.

## Critério de parada

Qualquer falha é uma parada obrigatória:

- Erro de API ou loader travado: voltar ao Worker/API.
- Dados faltando ou duplicados: voltar ao CSV/auditoria, sem editar D1 manualmente.
- Série offline perdida ou RPE não persistido: voltar ao fluxo de sincronização.
- Apenas instrução ambígua: corrigir este guia e repetir todo o roteiro.

Só considere staging aprovado quando todos os passos acima forem concluídos sem falha. Antes disso, não crie banco de produção, não conecte domínio e não desative o Apps Script.
