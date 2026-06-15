# Login Padrão — Proteção de Projetos por Senha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que artefatos hospedados fora do grupowe-painel exibam uma tela de login que valida a senha cadastrada no módulo Projetos, identificando o projeto pela URL.

**Architecture:** Uma função pública `projeto_verificar_senha(url, senha)` no Supabase do grupowe-painel (SECURITY DEFINER, retorna só boolean, com anti-força-bruta por IP) + um bloco de login autocontido (`gate-snippet.html`, HTML/CSS/JS inline) que se cola em qualquer artefato e valida via REST. O artefato fica inteiro na hospedagem do usuário; o login é uma camada por cima (bloqueio de acesso casual).

**Tech Stack:** PostgreSQL/Supabase (pgcrypto, PL/pgSQL, PostgREST), JavaScript puro (fetch), sessionStorage.

**Spec:** `docs/superpowers/specs/2026-06-15-login-padrao-protecao-projetos-design.md`

---

## Estrutura de arquivos

**Criar:**
- `grupowe-painel/supabase/migrations/20260615120000_projeto_verificar_senha.sql` — helper de normalização de URL, tabela de rate limit, função de verificação, grant para `anon`.
- `login_padrao/gate-snippet.html` — bloco autocontido de login (style + script inline) para colar nos artefatos.
- `login_padrao/exemplo.html` — página mínima de demonstração com o bloco já aplicado (para teste no navegador).
- `login_padrao/README.md` — como aplicar nos dois cenários e como cadastrar no painel.

**Alterar:** nada no código existente (migration aditiva; o módulo Projetos já cadastra link+senha).

**Decisões de normalização (idênticas no SQL e no JS):** minúsculo → remove `http(s)://` → remove `www.` → corta `#...` → corta `?...` → remove barra(s) final(is). Resultado: `host + caminho`.

---

## Task 1: Migration — helper de normalização, tabela de rate limit e função de verificação

**Files:**
- Create: `grupowe-painel/supabase/migrations/20260615120000_projeto_verificar_senha.sql`

- [ ] **Step 1: Escrever a migration completa**

Criar o arquivo com exatamente este conteúdo:

```sql
-- Login Padrão: endpoint público de verificação de senha de projeto.
-- Identifica o projeto pela URL (normalizada) e responde só true/false.
-- Nunca devolve a senha nem dados do projeto. RLS do painel intacto:
-- anon ganha EXECUTE apenas nesta função, sem acesso a tabela nenhuma.

-- 1) Normalização de URL — mesma regra usada no bloco de login (JS).
--    minúsculo -> tira esquema -> tira www. -> corta #/? -> tira barra final.
CREATE OR REPLACE FUNCTION public.projeto_normalizar_url(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT regexp_replace(
           split_part(
             split_part(
               regexp_replace(
                 regexp_replace(lower(coalesce(p_url, '')), '^https?://', ''),
                 '^www\.', ''
               ),
               '#', 1
             ),
             '?', 1
           ),
           '/+$', ''
         );
$$;

-- 2) Tabela de tentativas (rate limit + log de acessos).
CREATE TABLE IF NOT EXISTS public.projeto_login_tentativas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         text,
  link_norm  text,
  sucesso    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plt_ip_created
  ON public.projeto_login_tentativas (ip, created_at);

-- Sem policies para anon: a tabela só é tocada pela função SECURITY DEFINER.
ALTER TABLE public.projeto_login_tentativas ENABLE ROW LEVEL SECURITY;

-- 3) Função de verificação (pública via anon).
CREATE OR REPLACE FUNCTION public.projeto_verificar_senha(p_url text, p_senha text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_janela constant interval := interval '15 minutes';
  c_limite constant int := 10;
  v_ip text;
  v_norm text;
  v_tentativas int;
  v_ok boolean := false;
BEGIN
  -- IP do chamador (primeiro item do x-forwarded-for); fallback 'unknown'.
  BEGIN
    v_ip := split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;
  IF v_ip IS NULL OR btrim(v_ip) = '' THEN
    v_ip := 'unknown';
  END IF;

  -- Limpa registros com mais de 24h.
  DELETE FROM public.projeto_login_tentativas
   WHERE created_at < now() - interval '24 hours';

  v_norm := public.projeto_normalizar_url(p_url);

  -- Rate limit: conta tentativas desse IP na janela.
  SELECT count(*) INTO v_tentativas
    FROM public.projeto_login_tentativas
   WHERE ip = v_ip
     AND created_at > now() - c_janela;

  IF v_tentativas >= c_limite THEN
    INSERT INTO public.projeto_login_tentativas (ip, link_norm, sucesso)
    VALUES (v_ip, v_norm, false);
    RETURN false;
  END IF;

  -- Confere a senha do projeto ativo cujo link normalizado bate.
  SELECT (pgp_sym_decrypt(p.senha_encrypted, app_encrypt_key()) = p_senha)
    INTO v_ok
    FROM public.projetos p
   WHERE p.ativo = true
     AND p.senha_encrypted IS NOT NULL
     AND public.projeto_normalizar_url(p.link) = v_norm
   LIMIT 1;

  v_ok := coalesce(v_ok, false);

  INSERT INTO public.projeto_login_tentativas (ip, link_norm, sucesso)
  VALUES (v_ip, v_norm, v_ok);

  RETURN v_ok;
END;
$$;

-- 4) Permissões: anon e authenticated podem executar SÓ esta função.
REVOKE ALL ON FUNCTION public.projeto_verificar_senha(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.projeto_verificar_senha(text, text) TO anon, authenticated;
```

- [ ] **Step 2: Aplicar a migration no Supabase para testar**

No SQL Editor do projeto Supabase `gmmcfiajdtljdcpigrst`, colar e rodar o conteúdo do arquivo. (Na publicação normal, o Lovable aplica a migration pelo arquivo commitado.)
Expected: executa sem erro; cria 1 tabela e 2 funções.

- [ ] **Step 3: Verificar a normalização**

Rodar no SQL Editor:

```sql
SELECT public.projeto_normalizar_url('https://WWW.we.com.br/projetos/DashCopa2026/') AS a,
       public.projeto_normalizar_url('we.com.br/projetos/dashcopa2026')              AS b,
       public.projeto_normalizar_url('https://we.com.br/projetos/dashcopa2026?x=1#z') AS c;
```
Expected: `a`, `b` e `c` todos iguais a `we.com.br/projetos/dashcopa2026`.

- [ ] **Step 4: Verificar a função com um projeto real**

Pré-requisito: existir no painel um projeto **ativo** com link `…/dashcopa2026` e senha conhecida (ex.: cadastrar um de teste). Rodar:

```sql
-- senha correta -> true
SELECT public.projeto_verificar_senha('https://we.com.br/projetos/dashcopa2026', '<SENHA_CORRETA>');
-- senha errada -> false
SELECT public.projeto_verificar_senha('https://we.com.br/projetos/dashcopa2026', 'errada');
-- url inexistente -> false
SELECT public.projeto_verificar_senha('https://nao-existe.com/x', '<SENHA_CORRETA>');
```
Expected: `true`, depois `false`, depois `false`.

- [ ] **Step 5: Verificar que a senha nunca vaza**

Confirmar que a função retorna `boolean` (não texto/senha):

```sql
SELECT pg_typeof(public.projeto_verificar_senha('x','y'));
```
Expected: `boolean`.

- [ ] **Step 6: Commit**

```bash
cd grupowe-painel
git add supabase/migrations/20260615120000_projeto_verificar_senha.sql
git commit -m "feat(projetos): projeto_verificar_senha (login externo por URL+senha, anon, rate-limit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Bloco de login autocontido (`gate-snippet.html`)

**Files:**
- Create: `login_padrao/gate-snippet.html`

- [ ] **Step 1: Criar o bloco**

Criar o arquivo com exatamente este conteúdo. É um bloco único (style + script inline) para colar logo após `<body>` no artefato:

```html
<!-- ===== LOGIN PADRÃO GrupoWE — colar logo após <body> ===== -->
<style id="gwe-gate-style">
  #gwe-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;
    justify-content:center;background:#0b1020;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
  #gwe-gate .gwe-card{width:100%;max-width:360px;margin:20px;background:#13182b;
    border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px 28px;
    box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center;color:#e8ebf5;}
  #gwe-gate .gwe-logo{font-weight:800;letter-spacing:.18em;font-size:14px;color:#f5c518;margin-bottom:6px;}
  #gwe-gate h1{font-size:18px;font-weight:600;margin:0 0 20px;color:#fff;}
  #gwe-gate .gwe-field{position:relative;margin-bottom:14px;}
  #gwe-gate input{width:100%;box-sizing:border-box;padding:13px 44px 13px 14px;border-radius:10px;
    border:1px solid rgba(255,255,255,.14);background:#0b1020;color:#fff;font-size:15px;outline:none;}
  #gwe-gate input:focus{border-color:#f5c518;}
  #gwe-gate .gwe-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);
    background:none;border:none;color:#8b93ad;cursor:pointer;font-size:16px;padding:6px;}
  #gwe-gate button.gwe-submit{width:100%;padding:13px;border:none;border-radius:10px;background:#f5c518;
    color:#0b1020;font-weight:700;font-size:15px;cursor:pointer;}
  #gwe-gate button.gwe-submit:disabled{opacity:.6;cursor:default;}
  #gwe-gate .gwe-err{min-height:18px;margin-top:12px;color:#ff6b6b;font-size:13px;}
</style>
<div id="gwe-gate" role="dialog" aria-modal="true">
  <form class="gwe-card" id="gwe-form">
    <div class="gwe-logo">GRUPO WE</div>
    <h1>Acesso restrito</h1>
    <div class="gwe-field">
      <input id="gwe-pass" type="password" placeholder="Senha" autocomplete="current-password" autofocus>
      <button type="button" class="gwe-eye" id="gwe-eye" aria-label="Mostrar senha">👁</button>
    </div>
    <button type="submit" class="gwe-submit" id="gwe-submit">Entrar</button>
    <div class="gwe-err" id="gwe-err"></div>
  </form>
</div>
<script>
(function(){
  var SUPABASE_URL = "https://gmmcfiajdtljdcpigrst.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_aQ7ztI_2ZdS0QAjnm546Lw_uXHAKAZa";
  var STORAGE_KEY = "gwe_projeto_auth_ok";

  function normalizeUrl(u){
    return String(u).toLowerCase()
      .replace(/^https?:\/\//,'').replace(/^www\./,'')
      .split('#')[0].split('?')[0].replace(/\/+$/,'');
  }
  var urlKey = normalizeUrl(location.href);
  var gate = document.getElementById('gwe-gate');

  function liberar(){
    try{ sessionStorage.setItem(STORAGE_KEY, urlKey); }catch(e){}
    if(gate && gate.parentNode){ gate.parentNode.removeChild(gate); }
    document.documentElement.style.overflow = '';
  }

  // Já liberado nesta sessão?
  try{ if(sessionStorage.getItem(STORAGE_KEY) === urlKey){ liberar(); return; } }catch(e){}

  // Trava o scroll do conteúdo atrás do overlay.
  document.documentElement.style.overflow = 'hidden';

  var form = document.getElementById('gwe-form');
  var pass = document.getElementById('gwe-pass');
  var err  = document.getElementById('gwe-err');
  var btn  = document.getElementById('gwe-submit');
  var eye  = document.getElementById('gwe-eye');

  eye.addEventListener('click', function(){
    pass.type = (pass.type === 'password') ? 'text' : 'password';
    pass.focus();
  });

  form.addEventListener('submit', function(ev){
    ev.preventDefault();
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Verificando...';
    fetch(SUPABASE_URL + "/rest/v1/rpc/projeto_verificar_senha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_url: location.href, p_senha: pass.value })
    })
    .then(function(r){ return r.ok ? r.json() : false; })
    .then(function(ok){
      if(ok === true){ liberar(); }
      else { err.textContent = 'Senha incorreta.'; }
    })
    .catch(function(){ err.textContent = 'Erro de conexão. Tente de novo.'; })
    .finally(function(){ btn.disabled = false; btn.textContent = 'Entrar'; });
  });
})();
</script>
<!-- ===== FIM LOGIN PADRÃO ===== -->
```

- [ ] **Step 2: Verificar a normalização do JS (sanity check)**

Rodar no Node (a função é a mesma regra do SQL):

```bash
node -e "var n=u=>String(u).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('#')[0].split('?')[0].replace(/\/+\$/,''); console.log(n('https://WWW.we.com.br/projetos/DashCopa2026/'), '|', n('we.com.br/projetos/dashcopa2026?x=1#z'));"
```
Expected: `we.com.br/projetos/dashcopa2026 | we.com.br/projetos/dashcopa2026`

- [ ] **Step 3: Commit**

```bash
git add login_padrao/gate-snippet.html
git commit -m "feat(login_padrao): bloco de login autocontido (overlay + verify por URL)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Página de exemplo para teste no navegador

**Files:**
- Create: `login_padrao/exemplo.html`

- [ ] **Step 1: Criar a página de exemplo**

Página mínima com o bloco aplicado, para testar o fluxo de ponta a ponta sem precisar de um projeto real. Criar com este conteúdo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exemplo — Login Padrão</title>
</head>
<body>
  <!-- COLE AQUI O CONTEÚDO DE gate-snippet.html (logo após <body>) -->

  <main style="font-family:system-ui;padding:40px;">
    <h1>Conteúdo protegido 🎉</h1>
    <p>Se você está vendo isto, a senha foi validada e o overlay foi removido.</p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Aplicar o snippet no exemplo**

Copiar o conteúdo de `login_padrao/gate-snippet.html` e colar logo após a tag `<body>` de `login_padrao/exemplo.html` (substituindo a linha de comentário `<!-- COLE AQUI ... -->`).

- [ ] **Step 3: Teste manual no navegador**

Servir a pasta e abrir o exemplo:

```bash
cd login_padrao
python -m http.server 8000
```
Abrir `http://localhost:8000/exemplo.html`.
Expected: aparece o overlay de senha cobrindo o conteúdo; o `<main>` não fica visível/scrollável.

> Observação: `localhost:8000/exemplo.html` não bate com nenhum `link` cadastrado, então a verificação retorna `false` (senha incorreta) — isso é o esperado neste teste. Para validar o caminho de sucesso de ponta a ponta, usar Task 5.

- [ ] **Step 4: Verificar olho e erro**

No overlay: clicar no 👁 alterna mostrar/ocultar a senha; enviar uma senha qualquer mostra "Senha incorreta." e o botão volta a "Entrar".
Expected: ambos os comportamentos ocorrem.

- [ ] **Step 5: Commit**

```bash
git add login_padrao/exemplo.html
git commit -m "test(login_padrao): página de exemplo com o bloco aplicado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: README do login_padrao

**Files:**
- Create: `login_padrao/README.md`

- [ ] **Step 1: Criar o README**

```markdown
# login_padrao — Tela de login para projetos hospedados

Camada de login reaproveitável que protege artefatos hospedados fora do
grupowe-painel. Valida a senha cadastrada no módulo **Projetos**, identificando
o projeto pela **URL**.

## Como aplicar

### HTML único
1. Abra o arquivo `.html` do projeto.
2. Cole o conteúdo de `gate-snippet.html` logo após a tag `<body>`.
3. Suba o arquivo na hospedagem normalmente.

### Pasta / ZIP (vários arquivos)
1. Abra o `index.html` da pasta.
2. Cole o conteúdo de `gate-snippet.html` logo após a tag `<body>`.
3. Suba a pasta inteira na hospedagem.

> No fluxo com o Claude: basta dizer "pega o login_padrao e aplica no projeto X"
> que ele injeta o bloco no lugar certo e devolve o artefato pronto.

## Como cadastrar no painel
No grupowe-painel → módulo **Projetos** → novo projeto:
- **Link:** a URL final onde o artefato foi publicado (ex.: `https://we.com.br/projetos/dashcopa2026`).
- **Senha:** a senha que vai liberar o acesso.

Pronto: ao abrir a URL, aparece a tela de senha; ao acertar, o conteúdo é liberado
(fica liberado até fechar a aba — `sessionStorage`).

## Como funciona
O bloco chama a função pública `projeto_verificar_senha(url, senha)` no Supabase
do grupowe-painel, que normaliza a URL, acha o projeto ativo correspondente,
confere a senha cifrada e responde só `true`/`false`. Tem proteção contra força
bruta (10 tentativas / 15 min por IP).

## Limitação (importante)
É um **bloqueio de acesso casual**: o artefato fica inteiro na hospedagem, então
um usuário técnico pode contornar a tela (ver código-fonte / DevTools). Não use
para conteúdo de segredo crítico.

## Normalização de URL
minúsculo → remove `http(s)://` → remove `www.` → corta `?...`/`#...` → remove
barra final. Os dois lados (cadastro e tela) usam a mesma regra, então cadastrar
com ou sem `https://` funciona igual.
```

- [ ] **Step 2: Commit**

```bash
git add login_padrao/README.md
git commit -m "docs(login_padrao): README de uso e aplicação

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Teste de aceitação ponta a ponta (manual)

**Files:** nenhum (validação).

- [ ] **Step 1: Cadastrar projeto de teste no painel**

No grupowe-painel → Projetos → criar projeto **ativo**:
- Link: `http://localhost:8000/exemplo.html`
- Senha: `teste123`

- [ ] **Step 2: Validar pela função (backend)**

No SQL Editor do Supabase:

```sql
SELECT public.projeto_verificar_senha('http://localhost:8000/exemplo.html', 'teste123'); -- true
SELECT public.projeto_verificar_senha('http://localhost:8000/exemplo.html', 'xxx');      -- false
```
Expected: `true`, depois `false`.

- [ ] **Step 3: Validar no navegador**

Com `python -m http.server 8000` rodando em `login_padrao/`, abrir
`http://localhost:8000/exemplo.html`, digitar `teste123` e enviar.
Expected: overlay some, aparece "Conteúdo protegido 🎉".

- [ ] **Step 4: Validar persistência de sessão**

Recarregar a página (F5): conteúdo aparece direto, sem pedir senha.
Abrir em **nova aba anônima/sessão nova**: pede senha de novo.
Expected: ambos os comportamentos.

- [ ] **Step 5: Validar rate limit**

Enviar senha errada 10+ vezes seguidas; na 11ª, mesmo com a senha **correta**,
retorna "Senha incorreta." (bloqueado). Após 15 min, volta a funcionar.
Expected: bloqueio após o limite.

- [ ] **Step 6: Limpar o projeto de teste**

Remover/inativar o projeto de teste no painel (se desejado).

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** §5 backend → Task 1; §5.3 normalização → Task 1 (SQL) + Task 2 (JS); §6 login_padrao → Tasks 2–4; §7 fluxo → README (Task 4) + Task 5; §8 testes → Tasks 1,3,5; anti-força-bruta → Task 1 + Task 5/Step 5. ✔
- **Placeholders:** os únicos `<...>` são valores que o operador preenche (`<SENHA_CORRETA>`) — intencionais, não lacunas de código. ✔
- **Consistência de tipos/nomes:** `projeto_verificar_senha(text,text)→boolean`, `projeto_normalizar_url(text)→text`, `projeto_login_tentativas`, `STORAGE_KEY='gwe_projeto_auth_ok'`, id `#gwe-gate` — usados de forma idêntica entre tasks. ✔
```
