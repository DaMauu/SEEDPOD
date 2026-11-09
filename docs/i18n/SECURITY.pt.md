# Security Policy（Português）

> Esta página é a tradução para português de [SECURITY.md](../../SECURITY.md). As versões English e chinês simplificado são as de referência.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Relatar uma vulnerabilidade

Por favor, **não** relate problemas de segurança por Issues públicas. Use o canal privado do repositório:

1. Abra a aba [Security](../../security/advisories) e clique em "Report a vulnerability";
2. Ou entre em contato diretamente com o mantenedor, informando os passos de reprodução e o impacto.

Pretendemos responder em até 7 dias e, após a confirmação, combinaremos com você os prazos de correção e divulgação.

### O que relatar

Os userscripts do SEEDPOD rodam em páginas de trackers privados com sessão iniciada, podem ler o conteúdo da página e enviar requisições em seu nome. Tudo a seguir conta como problema de segurança:

- Credenciais (cookie, passkey, chaves de tracker, senhas de conta) enviadas para um endereço de terceiros
- Requisições de saída não documentadas (para domínios além do host de imagens, do CDN ou dos serviços descritos na documentação)
- Caminhos de XSS que injetam conteúdo controlado pelo atacante no painel ou nas caixas de diálogo
- Escalonamento de privilégios ou injeção de parâmetros na checagem de duplicatas entre sites, no preenchimento do formulário de upload ou no envio ao downloader
- Folhas de estilo carregando recursos não confiáveis via `@import` externo

### Fora do escopo

- Vulnerabilidades nos próprios trackers (relate-as ao site correspondente)
- Regras do site, conteúdo dos torrents ou banimentos de conta
- Problemas que exigem acesso prévio aos seus arquivos locais ou ao contexto da sua extensão de navegador

### Ao abrir uma Issue ou PR

Antes de publicar logs ou capturas de tela, remova: cookie, passkey, chaves de tracker, endereços e senhas dos downloaders e nomes de usuário do site. Mantenha o stack trace; não cole os cabeçalhos de requisição inteiros.
