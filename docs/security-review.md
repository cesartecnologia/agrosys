# Revisão de segurança

## Corrigido

- Usuário autenticado sem documento válido em `users/{uid}` não recebe mais perfil administrativo no cliente.
- Entradas de formulário agora removem caracteres de controle, limitam tamanho de textos, validam números finitos e bloqueiam números negativos.
- Importação de NFe bloqueia XML acima de 5 MB e recusa `DOCTYPE`/`ENTITY`.
- Atualização de saldo dos tanques é feita junto com o lançamento em batch atômico.
- Painel passou a ler apenas as coleções usadas nos indicadores.
- Dependências atualizadas e `npm audit --audit-level=moderate` sem vulnerabilidades.
- Regras do Firestore foram endurecidas para usuários, tanques, saídas de combustível e reabastecimentos.

## Pontos de atenção para produção

- Criação de usuários ainda usa Firebase Auth pelo cliente. Para produção, o ideal é mover esse fluxo para uma Cloud Function/Admin SDK, evitando criação de contas órfãs ou abuso do endpoint público de cadastro.
- Regras de algumas coleções operacionais ainda validam principalmente papel de acesso. O próximo endurecimento deve adicionar schema completo para funcionários, veículos, manutenção, colheita, adubação e financeiro.
- Ative App Check no Firebase para reduzir chamadas automatizadas fora do app.
- Publique sempre as regras do Firestore após alterações:

```bash
firebase deploy --only firestore:rules
```
