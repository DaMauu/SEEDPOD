# Contributing（Polski）

> Ta strona jest polskim tłumaczeniem pliku [CONTRIBUTING.md](../../CONTRIBUTING.md). Wiążące są wersje English i chińska uproszczona.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Dziękujemy za chęć ulepszenia SEEDPOD. Najpierw przejrzyj tę stronę — oszczędza to większość zbędnej wymiany wiadomości.

### Czym jest to repozytorium

Dodatki w jednym pliku: skrypty użytkownika Tampermonkey i zewnętrzne arkusze stylów. **Bez budowania, bez zależności, bez backendu** — wrzucasz jeden plik i działa. W PR nie wprowadzaj bundlerów, zależności npm ani kroków kompilacji.

### Układ

| Ścieżka | Zawartość |
|---|---|
| `scripts/bluray/legacy/` | Wydane wersje panelu bluray, jeden plik na wersję |
| `scripts/bluray/docs/` | Szybki start, przewodnik, architektura, notatki deweloperskie |
| `scripts/PTScripts/` | Zbiór narzędzi dla trackerów, śledzi upstream `DaMauu/Scripts` |
| `styles/r/` | Style motywów dla trackerów |
| `pta/` | Lokalna strona z notatkami o architekturze trackerów |

### Wersjonowanie

- **bluray**: nazwa pliku `pt-bluray-assistant-v0.0.0.N.user.js`, cztery segmenty rosnąco. **Nigdy nie nadpisuj ani nie usuwaj starej wersji** — dodaj nowy plik. Nagłówek `@version`, tytuł panelu i wiersz w logu wstrzykiwania muszą być zgodne.
- **styles**: jeden plik na styl, przy zmianie podnieś wersję i dodaj tag; stare tagi zostają na zawsze, aby użytkownicy mogli wrócić do poprzedniej wersji.
- **PTScripts**: to repozytorium gwarantuje tylko, że pliki pozostaną online; źródłem prawdy jest upstream `DaMauu/Scripts`. Najpierw zgłoś zmiany upstream, potem zsynchronizuj je z powrotem.

### Przed wysłaniem

1. Skrypt instaluje się w Tampermonkey i naprawdę działa na docelowej stronie — nie „powinien działać”.
2. Napisz, na jakich typach trackerów weryfikowałeś (NexusPHP / UNIT3D / Gazelle / f3nix); nazwy stron pomagają.
3. Usuń debugowe `console.log`i, lokalne ścieżki i konta testowe.
4. Nie commituj lokalnych danych trackerów: `pta/web/assets/sites-data.local.js` i `pta/data/site-arch.local.csv` są w `.gitignore` — nigdy nie wymuszaj ich przez `git add -f`.
5. **Nigdy nie commituj** plików cookie, passkeyów, kluczy trackerów, kluczy API ani zrzutów ekranu z danymi osobowymi.

### Komunikaty commitów

Krótki opis tego, co się zmieniło i którego modułu dotyczy, na przykład:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chiński lub angielski — oba są w porządku.

### Pull requesty

- Jedna sprawa na PR; nie mieszaj niepowiązanych zmian formatowania.
- Opisz: motywację, dotknięte moduły, sposób weryfikacji i wynik oraz czy pliki starych wersji są zmieniane.
- Przy zmianach panelu lub stylów dołącz zrzuty ekranu — z zamaskowanymi kontami i kluczami.

### Issues

Błędy i propozycje zgłaszaj przez szablony. W sprawach bezpieczeństwa nie otwieraj publicznego zgłoszenia — zobacz [SECURITY.md](../../SECURITY.md).
