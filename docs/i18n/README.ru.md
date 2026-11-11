# SEEDPOD（Русский）

> Это перевод файла [README.md](../../README.md) на русский язык. Основными считаются English и упрощённый китайский.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Библиотека производных Сеятеля" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Библиотека производных Сеятеля</p>

<p align="center"><b>Во всяком деле делай всё, что можешь.</b></p>

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

SEEDPOD собирает однофайловые расширения, которые вставляются прямо в сайт: скрипты Tampermonkey и внешние таблицы стилей. Достаточно одного файла — без сборки, зависимостей и серверной части.

Модули не зависят друг от друга: чтобы выбрать, что ставить, читайте документацию только этого модуля.

## Модули

| Модуль | Форма | Что делает | Вход |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Пользовательский скрипт | Панель переноса образов дисков: массовый отбор, проверка дублей между сайтами, оформление BDInfo, перенос скриншотов, заполнение формы и загрузка | [Установка](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 пользовательских скриптов | Повседневные действия на сайте: помощь при загрузке, самостоятельное скрытие данных, скрытие значков и объявлений, массовые подарки, пометка загрузок | [Список](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Светлая тема Broomhilda Red, внешние стили для сайта | [Подключение](../../styles/r/README.md) |

## Описание

**bluray** — основной скрипт этой библиотеки, около 6300 строк. Он собирает рутинную работу по переносу образов дисков в одну постоянную панель: отбирает образы по правилам, проверяет дубли на целевом сайте, разбирает вёрстку страницы сведений, переносит изображения на другой хостинг, заполняет форму загрузки и отправляет её в загрузчик. Поддерживает четыре типа сайтов: NexusPHP, UNIT3D, Gazelle и f3nix. Документация: [быстрый старт](../../scripts/bluray/docs/QUICKSTART.md), [руководство](../../scripts/bluray/docs/GUIDE.md), [архитектура](../../scripts/bluray/docs/ARCHITECTURE.md), [разработка](../../scripts/bluray/docs/DEVELOPMENT.md), [контекст для ИИ](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** — набор скриптов, целиком перенесённый из вышестоящего `DaMauu/Scripts`: файлы сохранены как есть, изменены только ссылки установки — они указывают на эту библиотеку, а обновления следуют за вышестоящим репозиторием. Назначение каждого скрипта — в [списке](../../scripts/PTScripts/README.md).

**styles/r** хранит темы для сайтов. Адрес подключения использует фиксированный tag, поэтому содержимое не меняется; после правки стилей достаточно поставить новый tag.

## Установка

- Скрипты: установите [Tampermonkey](https://www.tampermonkey.net/), откройте нужный `.user.js` и нажмите `Raw` для подтверждения.
- Стили: скопируйте прямую ссылку jsDelivr в поле внешней таблицы стилей на сайте или временно проверьте по [инструкции](../../styles/r/README.md).

## Правила версий

| Модуль | Правило |
|---|---|
| bluray | `0.0.0.N`, четыре части по возрастанию, одна версия — один файл, старые версии никогда не перезаписываются и не удаляются; синхронизируются три места: `@version` в заголовке, название панели и лог внедрения |
| PTScripts | следуем за вышестоящим репозиторием; библиотека гарантирует только сохранность файлов |
| styles | один файл на стиль, при изменении номер версии увеличивается и ставится tag, старые tag хранятся вечно и позволяют откатиться |

## Структура

```
SEEDPOD/
├── docs/banner.png              обложка
├── scripts/
│   ├── bluray/                  панель переноса образов (docs/ — документация, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 однофайловых скриптов + список
├── styles/r/                    тема Broomhilda Red
└── README.md
```

## Известные проблемы

Повторяющиеся проблемы bluray и нерешённые пункты (K-01 ~ K-14) вместе с закономерностями повторения записаны в [`scripts/bluray/README.md`](../../scripts/bluray/README.md); перед изменениями прочитайте этот раздел.

## Лицензия и отказ от ответственности

Код распространяется по [GPL-3.0](../../LICENSE): его можно свободно использовать, изменять и распространять, но при распространении изменённой версии нужно так же открыть исходный код и сохранить уведомление об авторских правах; распространять и продавать её в закрытом виде нельзя.

Только для личного переноса материалов между частными сайтами, на которые у вас есть разрешение. Соблюдайте правила сайтов: перед переносом убедитесь, что перенос не запрещён и дублей нет.

<p align="center"><sub>Плод ночной страстной разработки 大肥鱼 DeepSeek и 主任</sub></p>
