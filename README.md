# Gestão Agrícola para Fazenda de Café

Sistema web Next.js + Firebase para gestão de fazendas, com foco inicial em cafeicultura.

## Stack

- Next.js App Router
- React + TypeScript
- Firebase Authentication
- Firestore
- Vercel

## Funcionalidades do MVP

- Login e redefinição de senha via Firebase Authentication.
- RBAC com perfis `admin`, `operador` e `financeiro`.
- CRUD de funcionários, usuários, frota, manutenções, combustível, colheitas, adubações, financeiro, cheques, fornecedores e produtos.
- Busca local por campos relevantes em cada módulo.
- Importação de XML de NFe com extração de emitente, produtos, valor total e lançamento automático em contas a pagar.
- Regras Firestore por papel.

## Configuração

1. Crie um projeto no Firebase.
2. Ative Authentication com provedor e-mail/senha.
3. Crie um banco Firestore.
4. Copie `.env.example` para `.env.local` e preencha as variáveis `NEXT_PUBLIC_FIREBASE_*`.
5. Instale dependências e rode localmente:

```bash
npm install
npm run dev
```

## Primeiro administrador

Crie um usuário no Firebase Authentication e depois crie manualmente o documento:

```text
users/{uid}
nome: "Administrador"
email: "admin@fazenda.com"
role: "admin"
```

Depois disso, o próprio módulo `Usuários e permissões` consegue criar novos usuários do Firebase Auth usando uma senha temporária, além de alterar os papéis no documento `users/{uid}`.

## Deploy

No Vercel, conecte o repositório GitHub e configure as mesmas variáveis de ambiente. O CI/CD padrão da Vercel fará build a cada push.

## Segurança

Publique as regras com Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

As regras estão em `firestore.rules`.
