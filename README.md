# Uay Estoque — App do Técnico (mobile)

Aplicativo React Native (Expo + TypeScript + Expo Router) para os técnicos da Uay Internet. Consome a **mesma API** e o **mesmo banco** do sistema web (`backend/`) — nenhum backend, banco ou sistema de autenticação novo foi criado.

## Pré-requisitos

- Node.js 18+ e o backend (`backend/`) rodando com PostgreSQL migrado (`npm run prisma:migrate` dentro de `backend/`).
- Um usuário com `role = TECNICO` e `status = ACTIVE` cadastrado no banco, **vinculado a um `Technician`** (ver seção "Vincular um técnico" abaixo).
- App **Expo Go** instalado no celular (ou Android Emulator configurado).

## Instalação

```bash
cd mobile
npm install
copy .env.example .env
```

Edite `mobile/.env` e configure `EXPO_PUBLIC_API_URL` com a URL da API:

- **Celular físico com Expo Go** (mesma rede Wi-Fi do PC): use o IP local da sua máquina, ex. `http://192.168.0.10:3333/api` (descubra com `ipconfig` no Windows).
- **Android Emulator**: `http://10.0.2.2:3333/api`.
- **iOS Simulator** (macOS): `http://localhost:3333/api`.

> Nunca deixe `localhost` fixo — no celular físico, `localhost` aponta para o próprio celular, não para o seu PC.

## Produção

O perfil `production` do EAS injeta automaticamente:

```text
EXPO_PUBLIC_API_URL=https://api.estoque.uayinternet.com.br/api
```

Assim, o aplicativo publicado não depende do Expo Go, Metro Bundler, VS Code, computador local ou Wi-Fi da empresa. O Expo Go continua usando `mobile/.env` somente durante o desenvolvimento local.

## Vincular um técnico a um usuário (necessário)

O schema já tinha o campo `Technician.userId`, mas nada no sistema o preenchia. Para o app saber "quem sou eu" foi criada a rota `GET /technicians/me`. Para um técnico já existente passar a logar no app, um admin precisa vincular o `userId` dele (uma vez só), por exemplo via Prisma Studio (`npm run prisma:studio` em `backend/`) ou chamando:

```
PATCH /api/technicians/:id
Authorization: Bearer <token de ADMIN/ALMOXARIFADO/DESENVOLVEDOR>
Content-Type: application/json

{ "userId": "<id do User com role TECNICO>" }
```

Sem esse vínculo, o login no app funciona, mas o app mostra "Nenhum técnico vinculado a este usuário".

## Executando

Com o backend já rodando (`npm run dev` em `backend/`):

```bash
cd mobile
npm run start
```

- Aponte a câmera do celular (app Expo Go) para o QR Code exibido no terminal.
- Ou pressione `a` no terminal do Expo para abrir no Android Emulator.

## Testando o fluxo

1. Login com usuário/senha de um usuário `TECNICO` vinculado (ex.: `kaique` / `Tecnico@12345`). O e-mail continua funcionando por compatibilidade.
2. Dashboard mostra nome, cargo, contadores e últimas movimentações.
3. **Meu Estoque**: lista os materiais/equipamentos sob responsabilidade do técnico (busca por nome/código/série/patrimônio).
4. **Bipar Equipamento**: abre a câmera, lê QR Code/código de barras, consulta `GET /inventory/items/lookup/:value` (mesma rota usada pelo scanner do sistema web) e mostra os detalhes.
5. **Devolução**: escolhe um material do próprio estoque, quantidade, motivo (chips) e observação; envia para `POST /inventory/returns`.
6. **Histórico**: `GET /technicians/me/service-orders`, com O.S. finalizadas, contadores Hoje/Semana/Mês/Total, filtros de período e busca por O.S./cliente/tipo de serviço.
7. **Equipamentos**: mesma fonte de "Meu Estoque", filtrando por tipo `EQUIPAMENTO`/`FERRAMENTA`.
8. **Minha Conta**: dados do usuário + sair (remove o token do `expo-secure-store`).

## Endpoints reutilizados (nenhuma rota de leitura nova foi criada)

| Ação | Rota | Observação |
|---|---|---|
| Login | `POST /auth/login` | já existente; agora aceita `login`/`username` ou `email` |
| Sessão atual | `GET /auth/me` | já existente |
| Meu técnico | `GET /technicians/me` | **nova**, resolve o `Technician` do usuário logado |
| Estoque do técnico | `GET /technicians/:id/stock` | já existente; agora bloqueada para outro técnico ver dados alheios |
| Buscar por código/QR/série | `GET /inventory/items/lookup/:value` | já existente, mesma usada no scanner do sistema web |
| Histórico | `GET /inventory/movements` | já existente; agora aceita `technicianId` e força o filtro quando o perfil é `TECNICO` |
| Devolução | `POST /inventory/returns` | já existente; agora aceita `TECNICO` fazendo a própria devolução |
| Vincular técnico a usuário | `PATCH /technicians/:id` | **nova** (só ADMIN/ALMOXARIFADO/DESENVOLVEDOR) |
| Histórico de atividades | `GET /technicians/me/service-orders` | **nova**, retorna só O.S. `FINALIZADA` do técnico logado + contadores |
| Finalizar/registrar O.S. | `POST /technicians/me/service-orders/finalize` | **nova**, preparada para a futura tela de finalização de O.S. |

## Logins técnicos criados pelo seed

Todos usam a senha `Tecnico@12345`:

| Técnico | Usuário |
|---|---|
| Kaique | `kaique` |
| Mateus | `mateus` |
| Walison | `walison` |
| Valdenilson | `valdenilson` |
| Gleidson Terceirizado | `gleidson.terceirizado` |
| Wanderson | `wanderson` |
| Bruno | `bruno` |
| Cleidson | `cleidson` |

## Alterações mínimas feitas no backend existente

Nenhuma tabela, migration ou sistema de autenticação novo foi criado. Só foram ajustadas **permissões** em `backend/src/inventory/inventory.routes.ts` e `backend/src/inventory/technician.routes.ts`, sempre de forma aditiva (nada foi removido do comportamento atual dos perfis ADMIN/ALMOXARIFADO/DESENVOLVEDOR/DONO/GESTOR):

1. `GET /technicians/:id/stock` agora barra um `TECNICO` de ver o estoque de **outro** técnico (antes, qualquer usuário autenticado podia ver qualquer técnico pelo id).
2. `POST /inventory/returns` agora aceita o perfil `TECNICO`, mas somente para o próprio `technicianId`.
3. `GET /inventory/movements` agora força o filtro por técnico quando quem chama é `TECNICO` (antes retornava o histórico inteiro da empresa para qualquer perfil).
4. Adicionado `GET /technicians/me` e `PATCH /technicians/:id` (faltavam rotas para o app "se identificar" e para o admin vincular a conta).

## Limitações conhecidas (não implementadas por não existirem no modelo atual)

- O modelo `Item` do Prisma não tem campo de **MAC** nem **cliente vinculado** — a tela de detalhe do item mostra esses dados apenas se um dia forem adicionados ao schema (não foi inventado nenhum dado). Se for necessário, o caminho correto é uma migration Prisma aditiva (`mac String?`, `customerId`/`customerName` opcional em `Item`), não uma gambiarra no app.
- Modo offline: a arquitetura já separa toda a comunicação em `src/services/*`, então dá para acrescentar uma fila local (ex. com `expo-sqlite` ou `AsyncStorage`) que guarda ações pendentes e reenvia quando a conexão voltar, sem mexer nas telas. Isso ainda não foi implementado (só a separação em camadas que permite fazer isso depois sem reescrever telas).
