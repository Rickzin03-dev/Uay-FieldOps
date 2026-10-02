# Uay FieldOps

Plataforma integrada para gerenciamento de estoque e operações técnicas em campo.

O sistema conecta o setor de almoxarifado à equipe técnica, permitindo controlar equipamentos, materiais, ordens de serviço, movimentações e atividades realizadas em campo.

## Principais módulos

- 📦 Gestão de estoque
- 🔧 Gestão de equipamentos
- 👨‍🔧 Aplicativo para técnicos
- 📋 Ordens de serviço
- 🔢 Controle de equipamentos por número de série
- 📸 Registro fotográfico das atividades
- 📏 Controle de materiais por metragem
- 🔄 Devolução e movimentação de equipamentos
- 📊 Histórico de operações
- 🔐 Controle de acesso e permissões
- 🌐 API para comunicação entre sistemas
- 📱 Aplicação mobile
- 💻 Painel web
- 🐳 Ambiente Docker

## Estrutura do projeto

```text
.
├── backend/              # API REST, autenticação, estoque, técnicos e relatórios
│   ├── prisma/            # Schema, seed e migrations do PostgreSQL
│   └── src/               # Código-fonte da API
├── database/              # Documentação e recursos do banco de dados
├── deploy/                # Configuração de deploy e proxy reverso
├── docs/                  # Documentação e materiais do projeto
├── frontend/              # Painel web HTML, CSS e JavaScript
├── mobile/                # Aplicativo dos técnicos com Expo / React Native
├── docker-compose.yml     # Ambiente local
└── docker-compose.production.yml
```

## Tecnologias

- Painel web: HTML, CSS e JavaScript
- Aplicativo mobile: Expo e React Native
- API: Node.js, TypeScript e Express
- Banco de dados: PostgreSQL
- ORM: Prisma
- Infraestrutura local e produção: Docker
