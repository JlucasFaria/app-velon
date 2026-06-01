<div align="center">

# Velon

> Sistema web de gestão interna para comércios locais de prestação de serviços e venda de produtos.

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)](https://hono.dev)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)](https://prisma.io)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)

> [!NOTE]
> Projeto em desenvolvimento — trabalho final de faculdade.

</div>

---

## Sobre

Velon é um sistema web responsivo voltado à gestão interna de pequenos comércios do interior de São Paulo. Desenvolvido como trabalho final de curso, com foco em praticidade e velocidade de operação para equipes enxutas.

**Funcionalidades planejadas:**

- Controle de ordens de serviço com histórico de status (Pendente, Em andamento, Aguardando cliente, Concluído, Cancelado)
- Cadastro de clientes com diferenciação entre clientes de balcão e clientes parceiros
- Histórico completo de serviços vinculados a cada cliente
- Geração de recibos em PDF com impressão direta pelo navegador
- Filtros por status, tipo de cliente e busca por nome ou número da ordem
- Relatório de faturamento mensal

---

## Stack

| Camada     | Tecnologia                                           |
| ---------- | ---------------------------------------------------- |
| Runtime    | [Bun](https://bun.sh)                                |
| Backend    | [Hono](https://hono.dev) + `@hono/zod-openapi`       |
| ORM        | [Prisma 7](https://prisma.io) + `@prisma/adapter-pg` |
| Validação  | [Zod 4](https://zod.dev)                             |
| Frontend   | [React](https://react.dev) + Vite + shadcn/ui        |
| Estilização | [Tailwind CSS](https://tailwindcss.com)             |
| Banco      | PostgreSQL 16 (Docker)                               |
| Linguagem  | TypeScript (strict mode)                             |

---

## Estrutura

Monorepo — backend na raiz (`src/`), frontend em `/client`.

```
app-velon/
├── src/        # API (Hono + Prisma)
├── client/     # Frontend (React + Vite)
└── prisma/     # Schema e migrations
```

---

*Documentação completa será adicionada ao final do desenvolvimento.*
