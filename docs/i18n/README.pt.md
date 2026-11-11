# SEEDPOD（Português）

> Esta página é a tradução para português de [README.md](../../README.md). As versões English e chinês simplificado são as de referência.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Biblioteca de derivados do semeador" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Biblioteca de derivados do semeador</p>

<p align="center"><b>Em tudo, faça o seu melhor.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/userscripts-37-000000?style=flat-square&logo=tampermonkey" />
  <img src="https://img.shields.io/badge/JavaScript-ES2017-f7df1e?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/dependencies-none-2ea44f?style=flat-square" />
  <img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
  <img src="https://img.shields.io/badge/build-none%20%C2%B7%20single--file-success?style=flat-square" />
  <img src="https://img.shields.io/badge/branch-main-8957e5?style=flat-square" />
</p>

<p align="center">
  <a href="../../README.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

O SEEDPOD reúne extensões de um único arquivo que se encaixam diretamente no site: scripts do Tampermonkey e folhas de estilo externas. Basta colocar um arquivo, sem etapa de build, sem dependências e sem backend.

Os módulos não dependem uns dos outros: para escolher o que instalar, basta ler a documentação desse módulo.

## Módulos

| Módulo | Forma | O que faz | Entrada |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Script de usuário | Painel de repost de discos: filtragem em massa, verificação de duplicados entre sites, formatação de BDInfo, transferência de capturas, preenchimento do formulário e envio | [Instalação](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 scripts de usuário | Rotinas do site: auxílio ao upload, ocultação dos próprios dados, ocultação de badges e avisos, presentes em massa, marcação de downloads | [Índice](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Tema claro Broomhilda Red, folha de estilo externa para o site | [Montagem](../../styles/r/README.md) |

## Descrição

**bluray** é o script principal desta biblioteca, com cerca de 6300 linhas. Ele reúne o trabalho repetitivo de transferir imagens de discos num painel sempre disponível: seleciona as imagens válidas por regras, verifica duplicados no site de destino, interpreta o layout da página de detalhes, transfere as imagens para outro serviço, preenche o formulário de upload e o envia ao gerenciador de downloads. Compatível com quatro tipos de sites: NexusPHP, UNIT3D, Gazelle e f3nix. Documentação: [início rápido](../../scripts/bluray/docs/QUICKSTART.md), [manual](../../scripts/bluray/docs/GUIDE.md), [arquitetura](../../scripts/bluray/docs/ARCHITECTURE.md), [desenvolvimento](../../scripts/bluray/docs/DEVELOPMENT.md), [contexto de IA](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** é uma coleção de scripts trazida integralmente do upstream `DaMauu/Scripts`; os arquivos permanecem como estão e apenas os links de instalação apontam para esta biblioteca, com as atualizações seguindo o upstream. A finalidade de cada script está no [índice](../../scripts/PTScripts/README.md).

**styles/r** guarda os temas do site. O endereço de montagem usa um tag fixo, então o conteúdo não muda; depois de alterar o estilo, basta criar um novo tag.

## Instalação

- Scripts: instale o [Tampermonkey](https://www.tampermonkey.net/), abra o `.user.js` correspondente e clique em `Raw` para confirmar.
- Estilos: copie o link direto do jsDelivr para o campo de folha de estilo externa do site, ou teste temporariamente conforme a [explicação](../../styles/r/README.md).

## Regras de versão

| Módulo | Regra |
|---|---|
| bluray | `0.0.0.N`, quatro segmentos crescentes, uma versão por arquivo, as versões antigas nunca são sobrescritas nem apagadas; `@version` no cabeçalho, título do painel e log de injeção são sincronizados |
| PTScripts | segue o upstream; esta biblioteca só garante que os arquivos não se percam |
| styles | um arquivo por estilo, cada alteração incrementa o número da versão e cria um tag, e os tags antigos são mantidos para sempre e permitem voltar atrás |

## Estrutura

```
SEEDPOD/
├── docs/banner.png              imagem de capa
├── scripts/
│   ├── bluray/                  painel de repost de discos (docs/ documentação, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 scripts de arquivo único + índice
├── styles/r/                    tema Broomhilda Red
└── README.md
```

## Problemas conhecidos

Os problemas recorrentes do bluray e os pontos não resolvidos (K-01 ~ K-14), junto com os padrões de reaparição, estão registrados em [`scripts/bluray/README.md`](../../scripts/bluray/README.md); leia essa seção antes de alterar.

## Licença e isenção de responsabilidade

O código é distribuído sob a [GPL-3.0](../../LICENSE): você pode usar, modificar e redistribuir livremente, mas ao distribuir uma versão modificada ela deve continuar aberta e manter o aviso de copyright; não é permitido empacotá-la e vendê-la como software fechado.

Apenas para uso pessoal na transferência de material entre sites privados para os quais você tenha autorização. Respeite as regras de cada site: antes de repostar, confirme que não há proibição e que não há duplicados.

<p align="center"><sub>Fruto do desenvolvimento apaixonado de madrugada por 大肥鱼 DeepSeek e 主任</sub></p>
