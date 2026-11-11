# Contributing（한국어）

> 이 문서는 [CONTRIBUTING.md](../../CONTRIBUTING.md) 의 한국어 번역본입니다. English 원문과 간체 중국어판이 기준입니다.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

SEEDPOD 개선에 참여해 주셔서 감사합니다. 먼저 이 페이지를 읽어 주세요. 대부분의 왕복을 줄일 수 있습니다.

### 이 저장소의 형태

단일 파일 애드온: Tampermonkey 유저스크립트와 외부 스타일시트. **빌드 없음, 의존성 없음, 백엔드 없음** — 파일 하나만 넣으면 동작합니다. PR에서 번들러, npm 의존성, 컴파일 단계를 도입하지 마세요.

### 디렉터리 구성

| 경로 | 내용 |
|---|---|
| `scripts/bluray/legacy/` | bluray 패널 릴리스 버전, 버전당 파일 하나 |
| `scripts/bluray/docs/` | 빠른 시작, 가이드, 아키텍처, 개발 노트 |
| `scripts/PTScripts/` | 트래커 유틸리티 모음, 업스트림 `DaMauu/Scripts` 를 따름 |
| `styles/r/` | 트래커 테마 스타일 |
| `pta/` | 로컬 트래커 구조 정리 페이지 |

### 버전 규칙

- **bluray**: 파일명 `pt-bluray-assistant-v0.0.0.N.user.js`, 네 세그먼트가 증가합니다. **이전 버전은 절대 덮어쓰거나 삭제하지 않습니다** — 대신 새 파일을 추가합니다. `@version` 헤더, 패널 제목, 주입 로그 줄 세 곳이 모두 일치해야 합니다.
- **styles**: 스타일당 파일 하나, 변경 시 버전을 올리고 tag를 답니다. 이전 tag는 영구히 유지되어 사용자가 되돌릴 수 있습니다.
- **PTScripts**: 이 저장소는 파일이 남아 있음만 보장합니다. 업스트림 `DaMauu/Scripts` 가 기준입니다. 변경은 먼저 업스트림에 제출한 뒤 다시 동기화하세요.

### 제출 전 점검

1. 스크립트가 Tampermonkey에 설치되고 대상 사이트에서 실제로 동작해야 합니다. "이론상 된다"는 안 됩니다.
2. 어떤 트래커 유형에서 검증했는지(NexusPHP / UNIT3D / Gazelle / f3nix) 적으세요. 사이트 이름이 있으면 더 좋습니다.
3. 디버그용 `console.log`, 로컬 경로, 테스트 계정을 제거하세요.
4. 로컬 실제 데이터를 커밋하지 마세요: `pta/web/assets/sites-data.local.js` 와 `pta/data/site-arch.local.csv` 는 .gitignore에 있습니다. `git add -f` 로 강제 추가하지 마세요.
5. **절대 커밋하지 마세요**: Cookie, passkey, Tracker 키, API key, 개인정보가 담긴 스크린샷.

### 커밋 메시지

무엇이 바뀌었고 어떤 모듈에 영향을 주는지 짧게 적습니다. 예:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

중국어나 영어 모두 괜찮습니다.

### Pull Request

- PR 하나에는 한 가지 일만. 무관한 포매팅을 섞지 마세요.
- 설명에 적으세요: 동기, 영향받는 모듈, 검증 방법과 결과, 이전 버전 파일을 건드리는지 여부.
- 패널이나 스타일 변경에는 스크린샷을 첨부하되 계정과 키는 가리세요.

### Issue

버그와 요청은 템플릿으로 Issue를 열어 주세요. 보안 문제는 공개 Issue로 열지 말고 [SECURITY.md](../../SECURITY.md) 를 보세요.
