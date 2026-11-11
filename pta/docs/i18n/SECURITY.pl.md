# Security Policy（Polski）

> Ta strona jest polskim tłumaczeniem pliku [SECURITY.md](../../SECURITY.md). Wiążące są wersje English i chińska uproszczona.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Zgłaszanie podatności

**Nie** zgłaszaj problemów bezpieczeństwa przez publiczne Issue. Skorzystaj z prywatnego kanału repozytorium:

1. Otwórz zakładkę [Security](../../security/advisories) i kliknij "Report a vulnerability";
2. Albo skontaktuj się bezpośrednio z opiekunami, podając kroki reprodukcji i wpływ.

Staramy się odpowiedzieć w ciągu 7 dni, a po potwierdzeniu ustalimy z Tobą poprawkę i termin ujawnienia.

### Co zgłaszać

Userscripty SEEDPOD działają na zalogowanych stronach prywatnych trackerów, mogą czytać zawartość strony i wysyłać żądania w Twoim imieniu. Wszystkie poniższe przypadki uznajemy za problem bezpieczeństwa:

- Dane uwierzytelniające (cookie, passkey, klucze trackera, hasła do kont) wysyłane na adres strony trzeciej
- Nieudokumentowane żądania wychodzące (do domen innych niż hosting obrazów, CDN lub usługi opisane w dokumentacji)
- Ścieżki XSS wstrzykujące treści kontrolowane przez atakującego do panelu lub okien dialogowych
- Wstrzyknięcie uprawnień lub parametrów w deduplikacji między witrynami, wypełnianiu formularza wysyłki lub przekazywaniu do downloadera
- Arkusze stylów ładujące niezaufane zasoby przez zewnętrzny `@import`

### Poza zakresem

- Podatności w samych trackerach (zgłoś je odpowiedniej witrynie)
- Zasady witryny, zawartość torrentów lub blokady kont
- Problemy wymagające wcześniejszego dostępu do lokalnych plików lub kontekstu rozszerzenia przeglądarki

### Przy zgłaszaniu Issue lub PR

Przed opublikowaniem logów lub zrzutów ekranu usuń: cookie, passkey, klucze trackera, adresy i hasła downloaderów oraz nazwy użytkownika w witrynie. Zachowaj stack trace; nie wklejaj całych nagłówków żądań.
