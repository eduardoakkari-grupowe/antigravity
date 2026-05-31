# Roge Select 2026 — Formulário de Confirmação de Participação

App web (Vite + React + Tailwind) com backend Supabase para coletar e administrar os
cadastros da **Experiência Roge Select 2026** (Kuara Hotel · Arraial d'Ajuda · Porto Seguro).

## Páginas

| Rota      | Descrição                                    | Senha de acesso     |
| --------- | -------------------------------------------- | ------------------- |
| `/`       | Login → formulário de confirmação            | `roge2026select`    |
| `/admin`  | Login → painel "ADMINISTRAÇÃO" com cadastros | `rogeadmin2026!!`   |

- **Formulário**: imagem da experiência no topo, todos os campos do briefing (dados pessoais,
  saúde/hospedagem, kit, foto obrigatória, contato de emergência e termo).
- **Admin**: tabela com foto + dados no desktop; **cards** no mobile para boa leitura; busca,
  modal de detalhes completos e exportação CSV.
- As senhas são verificadas no front-end (gate por sessão) — adequado a um controle simples
  de acesso, não a um login seguro de servidor.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:8080
```

As credenciais do Supabase ficam em `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Banco de dados

A estrutura está em [`supabase/migration.sql`](supabase/migration.sql): tabela
`participantes`, bucket público `fotos` e políticas RLS (insert/select para `anon`).

```bash
npm run migrate    # aplica a migração (já executada neste projeto)
```

Se a conexão automática falhar, cole o conteúdo de `supabase/migration.sql` no
**SQL Editor** do Supabase.

## Build / deploy

```bash
npm run build      # gera dist/
```

`public/_redirects` e `vercel.json` garantem o fallback de SPA para que `/admin`
funcione ao recarregar a página em hosts estáticos.

---

Desenvolvido por **Akkari Tecnologia | Front 360**.
