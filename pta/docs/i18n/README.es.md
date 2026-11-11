# SEEDPOD（Español）

> Esta página es la traducción al español de [README.md](../../README.md). Las versiones English y china simplificada son las de referencia.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Biblioteca de derivados del sembrador" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Biblioteca de derivados del sembrador</p>

<p align="center"><b>En toda cosa, haz lo que puedas.</b></p>

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

SEEDPOD reúne extensiones de un solo archivo que se enganchan directamente en el sitio: scripts de Tampermonkey y hojas de estilo externas. Basta con un archivo, sin pasos de compilación, sin dependencias y sin backend.

Los módulos no dependen entre sí: para decidir qué instalar, basta con leer la documentación de ese módulo.

## Módulos

| Módulo | Forma | Qué hace | Entrada |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Script de usuario | Panel de republicación de discos: filtrado masivo, comprobación de duplicados entre sitios, maquetación de BDInfo, traslado de capturas, rellenado del formulario y subida | [Instalación](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 scripts de usuario | Tareas diarias del sitio: ayuda a la subida, ocultación de datos propios, ocultación de insignias y avisos, regalos masivos, marcado de descargas | [Índice](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Tema claro Broomhilda Red, hoja de estilo externa para el sitio | [Montaje](../../styles/r/README.md) |

## Descripción

**bluray** es el script principal de esta biblioteca, unas 6300 líneas. Reúne el trabajo repetitivo de trasladar imágenes de discos en un panel siempre disponible: selecciona las imágenes válidas según reglas, comprueba duplicados en el sitio de destino, analiza la maquetación de la ficha, traslada las imágenes a otro alojamiento, rellena el formulario de subida y lo envía al descargador. Compatible con cuatro tipos de sitios: NexusPHP, UNIT3D, Gazelle y f3nix. Documentación: [inicio rápido](../../scripts/bluray/docs/QUICKSTART.md), [manual](../../scripts/bluray/docs/GUIDE.md), [arquitectura](../../scripts/bluray/docs/ARCHITECTURE.md), [desarrollo](../../scripts/bluray/docs/DEVELOPMENT.md), [contexto para IA](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** es una colección de scripts traída completa del repositorio upstream `DaMauu/Scripts`; los archivos se conservan tal cual y solo los enlaces de instalación apuntan a esta biblioteca, mientras que las actualizaciones siguen al upstream. El uso de cada script está en el [índice](../../scripts/PTScripts/README.md).

**styles/r** guarda los temas del sitio. La dirección de montaje usa un tag fijo, así que el contenido no cambia; tras modificar el estilo basta con crear un tag nuevo.

## Instalación

- Scripts: instala [Tampermonkey](https://www.tampermonkey.net/), abre el `.user.js` correspondiente y pulsa `Raw` para confirmar.
- Estilos: copia el enlace directo de jsDelivr en el campo de hoja de estilo externa del sitio, o pruébalo temporalmente según la [explicación](../../styles/r/README.md).

## Reglas de versión

| Módulo | Regla |
|---|---|
| bluray | `0.0.0.N`, cuatro tramos crecientes, una versión por archivo, las versiones antiguas nunca se sobrescriben ni se borran; se sincronizan `@version` de la cabecera, el título del panel y el registro de inyección |
| PTScripts | sigue al upstream; esta biblioteca solo garantiza que no se pierdan archivos |
| styles | un archivo por estilo, cada cambio incrementa el número de versión y crea un tag, y los tag antiguos se conservan para siempre y permiten volver atrás |

## Estructura

```
SEEDPOD/
├── docs/banner.png              imagen de portada
├── scripts/
│   ├── bluray/                  panel de republicación de discos (docs/ documentación, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 scripts de un solo archivo + índice
├── styles/r/                    tema Broomhilda Red
└── README.md
```

## Problemas conocidos

Los problemas recurrentes de bluray y los puntos sin resolver (K-01 ~ K-14), junto con los patrones de reaparición, están anotados en [`scripts/bluray/README.md`](../../scripts/bluray/README.md); lee esa sección antes de cambiar algo.

## Licencia y descargo de responsabilidad

El código se distribuye bajo [GPL-3.0](../../LICENSE): puedes usarlo, modificarlo y redistribuirlo libremente, pero al distribuir una versión modificada debes mantenerla también abierta y conservar el aviso de copyright; no se permite empaquetarla y venderla como software cerrado.

Solo para uso personal al trasladar material entre sitios privados para los que tengas autorización. Respeta las normas de cada sitio: antes de republicar, confirma que no está prohibido y que no hay duplicados.

<p align="center"><sub>Fruto de un desarrollo apasionado de madrugada por 大肥鱼 DeepSeek y 主任</sub></p>
