# Login Padrão — Proteção de Projetos por Senha (modelo unificado)

**Data:** 2026-06-15
**Autor:** Eduardo (GrupoWE) + Claude
**Status:** Aprovação pendente

## 1. Contexto

O grupowe-painel já tem um módulo **Projetos** onde se cadastra um projeto com
**link** (texto puro) e **senha** (cifrada via pgcrypto — `pgp_sym_encrypt` com
`app_encrypt_key()`). A senha nunca é exposta em SELECT; só é revelada pela RPC
`projeto_get_senha`, que exige usuário autenticado no painel com permissão.

O Eduardo hospeda diversos artefatos (dashboards) **fora do grupowe-painel**, na
hospedagem dele. Hoje cada artefato é público. Ele quer colocar uma **tela de
login** na frente desses artefatos que valide a senha **cadastrada no painel**,
de forma centralizada e reaproveitável para muitos projetos.

## 2. Objetivo

Permitir que qualquer artefato hospedado externamente (HTML único ou pasta/ZIP)
exiba uma tela de login que valida a senha contra o cadastro do projeto no
grupowe-painel, identificando o projeto **pela própria URL**.

## 3. Decisões fechadas (brainstorming)

| Tema | Decisão |
|------|---------|
| Identificação do projeto | **Pela URL** — o artefato envia a própria URL; o backend acha o projeto cujo `link` bate (após normalização). |
| Persistência da sessão | **sessionStorage** — liberado até fechar a aba; reabriu, pede senha de novo. |
| Nível de proteção | **Bloqueio simples (unificado)** para todos os tipos. O artefato sobe inteiro na hospedagem do Eduardo; o login é uma camada por cima. |
| Tipos suportados | HTML único **e** pasta/ZIP, do mesmo jeito. |
| Onde valida | Central no grupowe-painel (Supabase), via endpoint público de verificação. |
| Anti-força-bruta | **Incluído** — limite de tentativas por IP em janela de tempo. |

### 3.1 Limitação aceita conscientemente

Como o artefato fica **fisicamente na hospedagem pública** do Eduardo, este é um
**bloqueio de acesso casual**, não um cofre. Um usuário técnico pode contornar a
camada de login (ver código-fonte, DevTools, baixar arquivos direto). O Eduardo
optou por isso em troca da simplicidade operacional, por se tratar de dados
internos sem segredo crítico. **Proteção real (conteúdo fora da hospedagem
pública) está fora do escopo** — registrada na seção 9.

## 4. Arquitetura

Três peças:

1. **Backend (grupowe-painel/Supabase):** função pública de verificação +
   tabela de rate limit.
2. **`login_padrao`:** projeto separado com a camada de login reaproveitável.
3. **Fluxo de aplicação:** injetar a camada de login num artefato e publicá-lo.

```
[Navegador do visitante]
   │  abre https://hospedagem-do-eduardo/projeto-y
   ▼
[Artefato Y na hospedagem do Eduardo]  ← contém a camada login_padrao por cima
   │  POST rpc/projeto_verificar_senha  { p_url: <URL normalizada>, p_senha }
   ▼
[Supabase grupowe-painel]
   - projeto_verificar_senha(url, senha) → boolean   (SECURITY DEFINER, anon)
   - normaliza URL, acha projeto ativo por link, compara pgp_sym_decrypt
   - checa rate limit por IP, registra tentativa + auditoria "acessou"
   │  true / false
   ▼
[Artefato Y]  → true: remove overlay e libera conteúdo (grava sessionStorage)
              → false: mostra erro
```

## 5. Backend — migration no grupowe-painel

Arquivo: `grupowe-painel/supabase/migrations/<timestamp>_projeto_verificar_senha.sql`

### 5.1 Tabela de rate limit

```
projeto_login_tentativas (
  id         bigint generated always as identity primary key,
  ip         text,            -- extraído de request.headers
  link_norm  text,            -- URL normalizada tentada
  sucesso    boolean not null,
  created_at timestamptz not null default now()
)
```
Índice em `(ip, created_at)` para a contagem da janela.
RLS: habilitado, **sem policies para anon** (a tabela só é tocada pela função
`SECURITY DEFINER`, que ignora RLS). Limpeza de registros antigos via prune
dentro da própria função (delete de linhas com `created_at < now() - interval`).

### 5.2 Função `projeto_verificar_senha`

```
projeto_verificar_senha(p_url text, p_senha text) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
```

Lógica:
1. Captura o IP do chamador via
   `current_setting('request.headers', true)::json ->> 'x-forwarded-for'`
   (fallback para outros headers; durante a implementação validar qual header o
   Supabase entrega). Se indisponível, usa `'unknown'`.
2. **Rate limit:** conta tentativas (qualquer resultado) desse IP nos últimos
   **15 minutos**. Se `>= 10`, registra a tentativa como falha e **retorna
   false** (sem nem comparar a senha). Faz prune de linhas com mais de 24h.
   (Valores 15 min / 10 são o default; ficam como constantes no topo da função
   para ajuste fácil.)
3. Normaliza `p_url` (ver 5.3).
4. Busca o projeto **ativo** cujo `link` normalizado == URL normalizada.
   - Se não achar, ou se o projeto não tiver senha cadastrada
     (`senha_encrypted IS NULL`), registra tentativa falha e retorna false.
5. Compara: `pgp_sym_decrypt(senha_encrypted, app_encrypt_key()) = p_senha`.
6. Registra a tentativa em `projeto_login_tentativas` (`sucesso = resultado`).
   Essa tabela já serve como log de acessos/tentativas — **não** mexemos em
   `projetos_auditoria` (cujo `usuario_id` exige um usuário, inexistente no
   acesso anônimo).
7. Retorna o boolean.

`GRANT EXECUTE ON FUNCTION public.projeto_verificar_senha(text, text) TO anon;`

**Garantias de segurança (obrigatórias):**
- Retorna **apenas boolean**. Nunca devolve a senha nem dados do projeto.
- `SET search_path` fixo (evita sequestro de search_path em SECURITY DEFINER).
- Sem SQL dinâmico — comparação parametrizada, sem risco de injeção.
- Toca somente `projetos` (leitura) e `projeto_login_tentativas`
  (insert/delete). **Não** encosta em `auth`, `users`, permissões, chat ou
  qualquer outra tabela. RLS do painel intacto.

### 5.3 Normalização de URL (mesma regra nos dois lados)

Dada uma URL, produzir uma chave canônica:
1. minúsculo;
2. remover esquema (`http://`, `https://`);
3. remover `www.` inicial;
4. remover query string (`?...`) e hash (`#...`);
5. remover barra final.

Resultado: `host + caminho` (ex.: `we.com.br/projetos/dashcopa2026`).
A função normaliza tanto `p_url` quanto `projetos.link` antes de comparar, então
projetos antigos cadastrados com/sem `https://` continuam batendo.

## 6. `login_padrao` — projeto separado

Pasta nova (sibling dos demais projetos): `login_padrao/`.

Conteúdo:
- `login-gate.js` — script autocontido (sem dependências/SDK; usa `fetch` no
  endpoint REST `…/rest/v1/rpc/projeto_verificar_senha` com a **chave anon
  pública** do grupowe-painel, que já é pública).
- `login-gate.css` — estilo da tela (visual GrupoWE: card centralizado, logo,
  campo senha, botão olho mostrar/ocultar, mensagem de erro).
- `gate-snippet.html` — o bloco pronto para colar (inclui CSS+JS inline ou
  referências), que é o que será injetado nos artefatos.
- `README.md` — como aplicar nos dois cenários e como cadastrar no painel.

Comportamento do `login-gate.js`:
1. No load: se `sessionStorage["projeto_auth_ok"]` para esta URL == true →
   não faz nada (conteúdo já liberado).
2. Senão, monta um **overlay full-screen** por cima do `body`, bloqueando a
   visualização/scroll do conteúdo.
3. Ao submeter: normaliza `location.href` (mesma regra da 5.3) e chama
   `projeto_verificar_senha`.
4. `true` → grava sessionStorage, remove o overlay, libera o conteúdo.
   `false` → mensagem de erro **genérica** ("Senha incorreta"). O backend
   retorna false tanto para senha errada quanto para bloqueio por rate limit, e
   a mensagem não distingue os casos (não vaza se a senha estava certa mas foi
   bloqueada).

Configuração embutida (constantes no topo do script):
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` do grupowe-painel (valores públicos de
  `grupowe-painel/src/integrations/supabase/client.ts`).

## 7. Fluxo de aplicação (operação)

1. Eduardo: *"pega o login_padrao e aplica no projeto Y"* (manda o HTML ou a
   pasta/ZIP).
2. Claude injeta a camada de login:
   - **HTML único:** insere o `gate-snippet` no `<body>` (idealmente logo após a
     abertura do body), mantendo o resto do arquivo intacto.
   - **Pasta/ZIP:** insere o `gate-snippet` no `index.html` da pasta.
3. Claude devolve o artefato pronto para hospedar.
4. Eduardo sobe o artefato inteiro na hospedagem dele, na URL desejada.
5. Eduardo cadastra no grupowe-painel (módulo Projetos, logado): **link final**
   (a URL onde publicou) + **senha**.
6. Visitante abre a URL → overlay → senha → validação → libera.

## 8. Testes

- **Backend (SQL):**
  - senha correta → true; senha errada → false.
  - URL com/sem `https://`, com/sem barra final, com query/hash → todas batem o
    mesmo projeto.
  - projeto inativo → false; projeto sem senha → false; URL inexistente → false.
  - rate limit: após `LIMITE` tentativas no IP em `JANELA`, retorna false mesmo
    com senha correta; após a janela, volta a funcionar.
  - a função não expõe a senha em nenhum retorno.
- **login-gate.js:** overlay aparece sem sessão; some após sucesso; persiste na
  sessão; reaparece em nova aba; mensagem de erro em falha.
- **Aplicação:** o artefato com o snippet renderiza normalmente após liberar
  (scripts internos do dashboard rodam).

## 9. Fora de escopo (registrado)

- **Proteção real** (conteúdo armazenado no Supabase e servido só após auth;
  função-porteiro para ZIP multi-arquivo). Avaliado e descartado em favor da
  simplicidade; pode ser retomado no futuro se o sigilo passar a ser crítico.
- Upload do artefato pelo painel / geração da casca pelo painel (a aplicação é
  feita via Claude no fluxo atual).
- Gestão de múltiplas senhas por projeto ou login por usuário (é uma senha única
  por projeto).

## 10. Componentes a criar/alterar

**Criar:**
- `grupowe-painel/supabase/migrations/<ts>_projeto_verificar_senha.sql`
- `login_padrao/login-gate.js`
- `login_padrao/login-gate.css`
- `login_padrao/gate-snippet.html`
- `login_padrao/README.md`

**Alterar:** nada no código existente do grupowe-painel (a migration é aditiva;
o módulo Projetos já cadastra link+senha).
