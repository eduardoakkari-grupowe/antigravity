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

## Arquivos
- `gate-snippet.html` — o bloco de login para colar nos artefatos.
- `exemplo.html` — página de demonstração com o bloco já aplicado (para testar no navegador).
