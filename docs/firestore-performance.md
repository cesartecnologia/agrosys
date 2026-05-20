# Otimização de leituras Firestore

## Estratégia atual

- Leituras de listagem passam por cache em memória por coleção e limite.
- TTL padrão do cache: 60 segundos.
- Trocar de módulo ou voltar ao painel reaproveita dados recentes sem nova leitura no banco.
- O botão de atualizar força nova leitura no Firestore.
- Criação, edição e exclusão invalidam automaticamente o cache da coleção afetada.
- Lançamentos que alteram saldo de tanque invalidam também `tanques_combustivel`.
- O painel lê apenas as coleções usadas nos indicadores.

## Próximos passos para alto volume

- Criar documentos agregados para indicadores do painel, como `resumos/painel`.
- Atualizar agregados por Cloud Functions ao criar/editar/remover lançamentos.
- Adicionar paginação real nas listagens com `startAfter`.
- Usar índices compostos para consultas por fazenda, safra, status e datas.
