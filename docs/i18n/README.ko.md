# SEEDPOD（한국어）

> 이 문서는 [README.md](../../README.md) 의 한국어 번역본입니다. English 원문과 간체 중국어판이 기준입니다.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · 파종자의 파생 라이브러리" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · 파종자의 파생 라이브러리</p>

<p align="center"><b>모든 일에 최선을 다하라.</b></p>

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
  <a href="README.pt.md">Português</a>
</p>

---

SEEDPOD는 사이트에 바로 붙여 넣는 단일 파일 확장을 모아 둡니다. Tampermonkey 스크립트와 외부 스타일시트입니다. 파일 하나만 넣으면 바로 동작하며, 빌드 단계도 의존성도 백엔드도 없습니다.

모듈끼리 서로 의존하지 않으므로, 무엇을 설치할지는 해당 모듈의 문서만 보고 정하면 됩니다.

## 모듈

| 모듈 | 형태 | 하는 일 | 진입점 |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | 사용자 스크립트 | 원본 디스크 전송 패널: 일괄 필터링, 사이트 간 중복 검사, BDInfo 정리, 스크린샷 전송, 양식 작성과 업로드 | [설치](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 사용자 스크립트 37개 | 사이트 일상 작업: 업로드 보조, 데이터 자체 숨김, 배지와 공지 숨김, 일괄 선물, 다운로드 표시 | [색인](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Broomhilda Red 라이트 테마, 사이트용 외부 스타일 | [적용](../../styles/r/README.md) |

## 설명

**bluray**는 이 라이브러리의 주력 스크립트로 약 6300줄입니다. 원본 디스크를 옮기는 반복 작업을 하나의 상주 패널로 모읍니다. 규칙에 따라 조건을 갖춘 원본을 골라내고, 대상 사이트에서 중복을 확인하고, 상세 페이지 구성을 해석하고, 이미지를 다른 호스트로 옮기고, 업로드 양식을 채워 다운로더로 보냅니다. NexusPHP, UNIT3D, Gazelle, f3nix 네 종류 사이트를 지원합니다. 문서는 [빠른 시작](../../scripts/bluray/docs/QUICKSTART.md), [사용 안내](../../scripts/bluray/docs/GUIDE.md), [구조](../../scripts/bluray/docs/ARCHITECTURE.md), [개발](../../scripts/bluray/docs/DEVELOPMENT.md), [AI 컨텍스트](../../scripts/bluray/docs/AI-CONTEXT.md)를 보세요.

**PTScripts**는 상위 `DaMauu/Scripts`에서 통째로 가져온 스크립트 모음입니다. 파일은 그대로 두고 설치 링크만 이 라이브러리를 가리키게 했으며, 업그레이드는 상위를 따릅니다. 스크립트별 용도는 [색인](../../scripts/PTScripts/README.md)을 보세요.

**styles/r**은 사이트 테마를 둡니다. 적용 주소는 고정 tag를 쓰므로 내용이 바뀌지 않습니다. 스타일을 고친 뒤 새 tag를 붙이면 됩니다.

## 설치

- 스크립트: [Tampermonkey](https://www.tampermonkey.net/)를 설치하고 해당 `.user.js`를 열어 `Raw`를 눌러 확인합니다.
- 스타일: jsDelivr 직접 링크를 복사해 사이트의 외부 스타일시트 항목에 넣거나, [설명](../../styles/r/README.md)에 따라 임시로 시험합니다.

## 버전 규칙

| 모듈 | 규칙 |
|---|---|
| bluray | `0.0.0.N` 네 자리로 증가, 버전마다 파일 하나, 이전 버전은 절대 덮어쓰지도 삭제하지도 않음; 헤더의 `@version`, 패널 제목, 주입 로그 세 곳을 함께 맞춤 |
| PTScripts | 상위를 따르며, 이 라이브러리는 파일이 사라지지 않는다는 것만 보장 |
| styles | 스타일마다 파일 하나, 변경 시 버전 번호를 올리고 tag를 붙이며 이전 tag는 영구 보존해 되돌릴 수 있음 |

## 구조

```
SEEDPOD/
├── docs/banner.png              표지 이미지
├── scripts/
│   ├── bluray/                  원본 디스크 전송 패널 (docs/ 문서, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               단일 파일 스크립트 37개 + 색인
├── styles/r/                    Broomhilda Red 테마
└── README.md
```

## 알려진 문제

bluray의 재발 문제와 미해결 항목(K-01 ~ K-14), 그리고 재발 경향은 [`scripts/bluray/README.md`](../../scripts/bluray/README.md)에 적혀 있습니다. 수정하기 전에 그 절을 먼저 읽으세요.

## 라이선스와 면책

코드는 [GPL-3.0](../../LICENSE)으로 배포됩니다. 자유롭게 사용, 수정, 재배포할 수 있지만 수정본을 배포할 때는 같은 방식으로 소스를 공개하고 저작권 표시를 유지해야 하며, 폐쇄 소스로 묶어 판매할 수 없습니다.

개인이 권한을 얻은 비공개 사이트 사이에서 자료를 옮기는 용도로만 사용합니다. 각 사이트의 규칙을 지키세요. 전송 전에 전송 금지 여부와 중복 여부를 확인하세요.

<p align="center"><sub>大肥鱼 DeepSeek와 主任이 심야에 열정을 쏟아 개발한 결정체</sub></p>
