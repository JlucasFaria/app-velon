<div align="center">

# Velon

> Sistema web de gestão interna para comércios locais de prestação de serviços e venda de produtos.

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white)](https://hono.dev)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)](https://prisma.io)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)

</div>

---

## Sobre

Velon é um sistema web responsivo voltado à gestão interna de pequenos comércios, desenvolvido como trabalho final de curso e demonstrado em um comércio parceiro real. O foco é praticidade e velocidade de operação para equipes enxutas.

O sistema é **multi-tenant**: cada usuário pertence a uma **empresa** (`Company`) por meio de um **vínculo** (`Membership`) que carrega o seu papel (role). Todos os dados de negócio são isolados por empresa (`companyId`).

### Funcionalidades

- **Ordens de serviço** com histórico de status (Pendente → Em andamento → Aguardando cliente → Concluído / Cancelado), numeração sequencial por empresa (`OS-0001`) e responsável atribuído.
- **Cadastro de clientes** com distinção entre clientes de balcão (`COUNTER`) e parceiros (`PARTNER`), e histórico de serviços vinculados.
- **Geração de recibos em PDF** com impressão direta pelo navegador.
- **Relatório de faturamento mensal** calculado sobre a data real de conclusão da ordem (somatório em centavos inteiros).
- **Filtros e busca** por status, tipo de cliente e número/nome.
- **Autenticação JWT** com refresh tokens rotativos, logout com blacklist e onboarding de empresa.
- **Gestão de equipe**: convites por e-mail, papéis (`ADMIN` / `OPERATOR` / `VIEWER`) e proteção contra remoção do último administrador.
- **Personalização da empresa**: logo, dados de contato e nota de rodapé nos recibos.

---

## Stack

| Camada      | Tecnologia                                             |
| ----------- | ------------------------------------------------------ |
| Runtime     | [Bun](https://bun.sh)                                  |
| Backend     | [Hono](https://hono.dev) + `@hono/zod-openapi`         |
| ORM         | [Prisma 7](https://prisma.io) + `@prisma/adapter-pg`   |
| Validação   | [Zod 4](https://zod.dev)                               |
| Frontend    | [React 19](https://react.dev) + Vite 8 + shadcn/ui     |
| Estilização | [Tailwind CSS 4](https://tailwindcss.com)              |
| Banco       | PostgreSQL 16 (Docker)                                 |
| PDF         | [PDFKit](https://pdfkit.org)                           |
| Linguagem   | TypeScript (strict mode)                               |
| Deploy      | [Railway](https://railway.app) (Docker, serviço único) |

---

## Estrutura

Monorepo — backend na raiz (`src/`), frontend em `/client`. Cada lado tem seu próprio `package.json`, ambos gerenciados pelo Bun.

```
app-velon/
├── src/                # API (Hono + Prisma)
│   ├── api/{domain}/   # schema · service · routes · tests por domínio
│   ├── config/         # env, constants
│   ├── db/             # cliente Prisma (singleton, adapter-pg)
│   ├── middlewares/    # auth, permissions, error-handler, rate-limit...
│   ├── schemas/        # respostas e paginação compartilhadas
│   ├── utils/          # response, pagination, logger, email
│   └── index.ts        # composition root (serve a API + o build do frontend)
├── client/             # Frontend (React + Vite + shadcn/ui)
│   └── src/
│       ├── api/        # camada HTTP (um arquivo por domínio)
│       ├── contexts/   # AuthContext
│       ├── router/     # createBrowserRouter
│       ├── components/ # ui (shadcn) + componentes de domínio
│       └── pages/      # páginas por domínio
├── prisma/             # schema, migrations e seed
└── Dockerfile          # build multi-stage (API + frontend) para deploy
```

Domínios da API: `auth`, `user`, `company` (+ membros e convites), `invites`, `client`, `order`, `receipt`, `report`, `health`.

---

## Pré-requisitos

- [Bun](https://bun.sh) (>= 1.0)
- [Docker](https://www.docker.com/) (para o PostgreSQL local)

---

## Como rodar localmente

```bash
# 1. Instalar dependências (backend e frontend)
bun install
cd client && bun install && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env   # edite os valores conforme necessário

# 3. Subir o banco, aplicar migrations e popular dados de exemplo
bun run db:up
bun run db:migrate
bun run db:seed

# 4. Rodar backend e frontend (em terminais separados)
bun run dev            # API em http://localhost:3000
bun run client:dev     # Frontend em http://localhost:5173
```

Em desenvolvimento, o Vite faz proxy de `/api` → `http://localhost:3000`, então não há configuração de CORS necessária.

---

## Scripts

```bash
# Backend
bun run dev / dev:all        # watch do servidor / + container do banco
bun run start                # servidor de produção
bun run test / test:watch    # bun test
bun run lint / lint:fix
bun run format / format:check

# Banco de dados
bun run db:up / db:stop / db:down    # ciclo de vida do docker compose
bun run db:migrate                   # prisma migrate dev
bun run db:migrate:prod              # prisma migrate deploy
bun run db:generate                  # gera o client Prisma
bun run db:seed                      # empresa padrão + 3 admins
bun run db:studio
bun run db:reset                     # destrói volume → recria → migra → seed

# Frontend
bun run client:dev           # Vite dev server (http://localhost:5173)
bun run client:build         # build de produção → client/dist/
```

---

## Variáveis de ambiente

Validadas na inicialização por Zod (`src/config/env.ts`) — a aplicação não sobe com configuração inválida.

| Variável                                              | Descrição                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                                        | String de conexão do Postgres (validada como URL)                              |
| `JWT_SECRET`                                          | Mínimo de 32 caracteres                                                        |
| `PORT`                                                | Padrão 3000                                                                    |
| `NODE_ENV`                                            | `development` \| `test` \| `production`                                        |
| `CORS_ORIGIN`                                         | `"*"` ou URLs separadas por vírgula (não pode ser `"*"` em produção)           |
| `APP_URL`                                             | URL base do frontend para os links de convite (padrão `http://localhost:5173`) |
| `DATABASE_DB` / `DATABASE_USER` / `DATABASE_PASSWORD` | Usadas pelo Docker Compose                                                     |

---

## Dados de seed

`bun run db:seed` (idempotente) cria a empresa padrão **"Minha Empresa"** e 3 usuários, cada um **ADMIN ativo** dela:

| E-mail             | Senha     |
| ------------------ | --------- |
| admin@template.com | admin1234 |
| alice@template.com | alice1234 |
| bob@template.com   | bob12345  |

---

## Testes

Framework `bun:test`. Os testes rodam contra um **banco real**, então é necessário `bun run db:up` + `bun run db:migrate` antes.

```bash
bun run test
```

O isolamento é garantido por dados únicos por teste (valores baseados em `crypto.randomUUID()`) e limpeza apenas das próprias linhas — sem `deleteMany()` global, já que os arquivos rodam em paralelo contra o mesmo banco.

---

## Documentação da API

Com o servidor rodando:

- **Swagger UI** — `http://localhost:3000/ui`
- **OpenAPI JSON** — `http://localhost:3000/doc`
- **Health check** — `http://localhost:3000/health`

---

## Deploy

Implantado na **Railway** como um único serviço via Docker. O backend Hono serve tanto a API quanto o build estático do frontend (`client/dist`), com fallback SPA para `index.html` — mesma origem, sem CORS nem proxy.

- O `Dockerfile` faz build multi-stage: gera o client Prisma, builda o frontend (Vite) e monta a imagem final mantendo o Prisma CLI para rodar migrations.
- As migrations são aplicadas no deploy via comando de pré-deploy da Railway: `bunx prisma migrate deploy`.

---

<div align="center">

Trabalho final de faculdade · desenvolvido por João Lucas

</div>
