# SEEDPOD（Polski）

> Ta strona jest polskim tłumaczeniem pliku [README.md](../../README.md). Wiążące są wersje English i chińska uproszczona.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Biblioteka pochodnych siewcy" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Biblioteka pochodnych siewcy</p>

<p align="center"><b>We wszystkim dawaj z siebie wszystko.</b></p>

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

SEEDPOD gromadzi jednoplikowe rozszerzenia podpinane bezpośrednio do stron: skrypty Tampermonkey i zewnętrzne arkusze stylów. Wystarczy wgrać jeden plik i działa — bez etapu budowania, bez zależności, bez backendu.

Moduły nie zależą od siebie; o tym, co zainstalować, decyduje wyłącznie dokumentacja danego modułu.

## Moduły

| Moduł | Postać | Co robi | Wejście |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Skrypt użytkownika | Panel przenoszenia oryginalnych płyt: filtrowanie zbiorcze, sprawdzanie duplikatów między stronami, formatowanie BDInfo, przenoszenie zrzutów ekranu, wypełnianie formularza i wysyłanie torrenta | [Instalacja](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 skryptów użytkownika | Codzienne czynności na stronie: pomoc przy wysyłaniu, ukrywanie własnych danych, ukrywanie odznak i ogłoszeń, zbiorowe prezenty, oznaczanie pobrań | [Indeks](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Jasny motyw Broomhilda Red, zewnętrzny styl strony | [Zastosuj](../../styles/r/README.md) |

## Opis

**bluray** to główny skrypt tego zbioru, około 6300 linii; zamyka powtarzalną pracę przy przenoszeniu oryginalnych płyt w jednym panelu, który pozostaje pod ręką: według reguł wybiera kwalifikujące się płyty, sprawdza duplikaty na stronie docelowej, odczytuje układ strony szczegółów, przenosi obrazy na inny hosting, wypełnia formularz wysyłki i przekazuje do downloadera. Obsługuje cztery rodzaje stron: NexusPHP, UNIT3D, Gazelle i f3nix. Dokumentacja: [szybki start](../../scripts/bluray/docs/QUICKSTART.md), [instrukcja](../../scripts/bluray/docs/GUIDE.md), [architektura](../../scripts/bluray/docs/ARCHITECTURE.md), [rozwój](../../scripts/bluray/docs/DEVELOPMENT.md), [kontekst AI](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** to zbiór skryptów przeniesiony w całości z projektu upstream `DaMauu/Scripts`; pliki zachowano bez zmian, a jedynie linki instalacyjne wskazują na ten zbiór, aktualizacje idą za upstreamem. Przeznaczenie każdego skryptu opisuje [indeks](../../scripts/PTScripts/README.md).

**styles/r** zawiera motywy dla stron. Adres podpięcia używa stałych tagów, więc treść się nie zmienia; po zmianie stylu wystarczy utworzyć nowy tag.

## Instalacja

- Skrypty: zainstaluj [Tampermonkey](https://www.tampermonkey.net/), otwórz odpowiedni plik `.user.js` i kliknij `Raw`, aby potwierdzić.
- Style: skopiuj bezpośredni link jsDelivr do pola zewnętrznego arkusza stylów na stronie albo przetestuj tymczasowo według [opisu](../../styles/r/README.md).

## Zasady wersjonowania

| Moduł | Zasada |
|---|---|
| bluray | `0.0.0.N` z czterema rosnącymi segmentami, jedna wersja na plik, starsze wersje nigdy nie są nadpisywane ani usuwane; `@version` w nagłówku, tytuł panelu i log wstrzyknięcia pozostają zsynchronizowane |
| PTScripts | Podąża za upstreamem; ten zbiór gwarantuje tylko, że pliki nie zginą |
| styles | Jeden plik na styl, przy zmianie numer wersji rośnie i powstaje tag, stare tagi pozostają na zawsze, umożliwiając powrót |

## Struktura

```
SEEDPOD/
├── docs/banner.png              obraz okładki
├── scripts/
│   ├── bluray/                  panel przenoszenia oryginalnych płyt (dokumentacja w docs/, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 skryptów jednoplikowych + indeks
├── styles/r/                    motyw Broomhilda Red
└── README.md
```

## Znane problemy

Powracające problemy i nierozwiązane punkty bluraya (K-01 ~ K-14) wraz z prawidłowościami ich nawrotów są zapisane w [`scripts/bluray/README.md`](../../scripts/bluray/README.md). Przed zmianami przeczytaj ten rozdział.

## Licencja i wyłączenie odpowiedzialności

Kod jest udostępniany na licencji [GPL-3.0](../../LICENSE): można go swobodnie używać, zmieniać i redystrybuować, ale rozpowszechniając zmodyfikowaną wersję, trzeba ją również udostępnić jako open source i zachować informację o prawach autorskich; nie wolno pakować jej zamkniętej i sprzedawać.

Wyłącznie do użytku osobistego, do przenoszenia zasobów między prywatnymi stronami, do których masz uprawnienia. Przestrzegaj reguł każdej strony: przed przeniesieniem upewnij się, że nie ma zakazu przenoszenia i że nie ma duplikatów.

<p align="center"><sub>Owoc nocnej, pełnej pasji pracy 大肥鱼 DeepSeek i 主任</sub></p>
