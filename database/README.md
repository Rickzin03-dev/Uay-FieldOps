# Banco de dados

O schema principal está em `backend/prisma/schema.prisma` e usa PostgreSQL via Prisma.

Para configurar localmente:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name initial
```

A aplicação não usa Python.