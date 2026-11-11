# Contributing（Português）

> Esta página é a tradução para português de [CONTRIBUTING.md](../../CONTRIBUTING.md). As versões English e chinês simplificado são as de referência.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Obrigado por melhorar o SEEDPOD. Leia esta página primeiro — isso evita a maior parte do vai e vem.

### O que este repositório é

Complementos em arquivo único: userscripts do Tampermonkey e folhas de estilo externas. **Sem build, sem dependências, sem backend** — basta colocar um arquivo e funciona. Não introduza bundlers, dependências npm ou etapas de compilação em um PR.

### Estrutura

| Caminho | Conteúdo |
|---|---|
| `scripts/bluray/legacy/` | Versões publicadas do painel bluray, um arquivo por versão |
| `scripts/bluray/docs/` | Início rápido, guia, arquitetura, notas de desenvolvimento |
| `scripts/PTScripts/` | Coleção de utilitários para trackers, seguindo o upstream `DaMauu/Scripts` |
| `styles/r/` | Estilos de tema para trackers |
| `pta/` | Página de notas sobre a arquitetura local de trackers |

### Versionamento

- **bluray**: nome de arquivo `pt-bluray-assistant-v0.0.0.N.user.js`, quatro segmentos incrementando. **Nunca sobrescreva nem apague uma versão antiga** — adicione um arquivo novo. O cabeçalho `@version`, o título do painel e a linha do log de injeção devem coincidir.
- **styles**: um arquivo por estilo, suba a versão e crie uma tag a cada mudança; tags antigas ficam para sempre, para permitir rollback.
- **PTScripts**: este repositório só garante que os arquivos continuem online; o upstream `DaMauu/Scripts` é a fonte da verdade. Envie as mudanças primeiro ao upstream, depois sincronize de volta.

### Antes de enviar

1. O script instala no Tampermonkey e funciona de fato no site alvo — não "deveria funcionar".
2. Diga quais tipos de tracker você verificou (NexusPHP / UNIT3D / Gazelle / f3nix); nomes de sites ajudam.
3. Remova `console.log` de depuração, caminhos locais e contas de teste.
4. Não faça commit de dados locais de trackers: `pta/web/assets/sites-data.local.js` e `pta/data/site-arch.local.csv` estão no `.gitignore` — nunca use `git add -f`.
5. **Nunca faça commit** de cookies, passkeys, chaves de tracker, chaves de API ou capturas com dados pessoais.

### Mensagens de commit

Uma descrição curta do que mudou e qual módulo é afetado, por exemplo:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chinês ou inglês, ambos servem.

### Pull requests

- Um assunto por PR; deixe de fora formatação não relacionada.
- Descreva: motivação, módulos afetados, como você verificou e o resultado, e se arquivos de versões antigas são tocados.
- Inclua capturas para mudanças de painel ou estilo — com contas e chaves mascaradas.

### Issues

Relate bugs e pedidos usando os templates. Para questões de segurança, não abra uma Issue pública — veja [SECURITY.md](../../SECURITY.md).
