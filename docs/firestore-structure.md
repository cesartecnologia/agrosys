# Estrutura Firestore

O MVP usa coleções de primeiro nível para manter consultas simples e baratas.

## Coleções

- `users`: perfis de acesso vinculados ao UID do Firebase Auth.
- `empresas`: dados básicos da fazenda ou empresa.
- `funcionarios`: cadastro administrativo de funcionários.
- `veiculos`: veículos e máquinas.
- `manutencoes`: histórico e próximas manutenções por `veiculo_id`.
- `combustivel`: abastecimentos de veículos por tanque da fazenda ou por posto externo.
- `tanques_combustivel`: cadastro dos tanques, tipo de combustível, capacidade e saldo.
- `reabastecimentos_tanque`: entradas de combustível nos tanques da fazenda.
- `postos_combustiveis`: cadastro dos postos usados em abastecimentos externos.
- `colheitas`: produção de café por talhão e safra.
- `adubacoes`: aplicações por talhão.
- `movimentacoes_financeiras`: contas a pagar, receber e lançamentos gerais.
- `cheques`: cheques emitidos e recebidos.
- `fornecedores`: fornecedores manuais ou importados por NFe.
- `produtos`: produtos manuais ou importados por NFe.
- `nfes_importadas`: registro da importação XML e itens extraídos.

## Permissões

As regras em `firestore.rules` implementam RBAC com `users/{uid}.role`.

- `admin`: acesso total.
- `operador`: produção, frota e manutenção.
- `financeiro`: financeiro, fornecedores, produtos e NFe.

Para o primeiro acesso, crie manualmente um usuário no Firebase Authentication e um documento `users/{uid}` com `role: "admin"`.
