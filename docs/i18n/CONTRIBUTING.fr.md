# Contributing（Français）

> Cette page est la traduction française de [CONTRIBUTING.md](../../CONTRIBUTING.md). Les versions English et chinois simplifié font foi.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Merci de vouloir améliorer SEEDPOD. Parcourez d'abord cette page — cela évite la plupart des allers-retours.

### Nature de ce dépôt

Des modules complémentaires en fichier unique : userscripts Tampermonkey et feuilles de style externes. **Pas de build, pas de dépendances, pas de backend** — un fichier suffit et ça fonctionne. N'introduisez pas de bundler, de dépendance npm ni d'étape de compilation dans une PR.

### Arborescence

| Chemin | Contenu |
|---|---|
| `scripts/bluray/legacy/` | Versions publiées du panneau bluray, un fichier par version |
| `scripts/bluray/docs/` | Démarrage rapide, guide, architecture, notes de développement |
| `scripts/PTScripts/` | Collection d'utilitaires pour trackers, suit l'amont `DaMauu/Scripts` |
| `styles/r/` | Styles de thème pour trackers |
| `pta/` | Page de notes sur l'architecture locale des trackers |

### Versionnage

- **bluray** : nom de fichier `pt-bluray-assistant-v0.0.0.N.user.js`, quatre segments qui s'incrémentent. **Ne jamais écraser ni supprimer une ancienne version** — ajoutez un nouveau fichier. L'en-tête `@version`, le titre du panneau et la ligne de journal d'injection doivent tous correspondre.
- **styles** : un fichier par style, incrémentez la version et posez un tag à chaque changement ; les anciens tags restent définitivement pour permettre le retour arrière.
- **PTScripts** : ce dépôt garantit seulement que les fichiers restent en ligne ; l'amont `DaMauu/Scripts` fait référence. Proposez les changements en amont d'abord, puis resynchronisez.

### Avant de soumettre

1. Le script s'installe dans Tampermonkey et fonctionne réellement sur le site cible — pas « devrait fonctionner ».
2. Indiquez les types de trackers vérifiés (NexusPHP / UNIT3D / Gazelle / f3nix) ; les noms de sites aident.
3. Supprimez les `console.log` de débogage, les chemins locaux et les comptes de test.
4. Ne commitez pas de données locales de trackers : `pta/web/assets/sites-data.local.js` et `pta/data/site-arch.local.csv` sont gitignorés — jamais de `git add -f`.
5. **Ne jamais commiter** de cookies, passkeys, clés de tracker, clés d'API ni captures d'écran contenant des données personnelles.

### Messages de commit

Une courte description de ce qui a changé et du module concerné, par exemple :

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Le chinois ou l'anglais, les deux conviennent.

### Pull requests

- Un seul sujet par PR ; laissez dehors les changements de formatage sans rapport.
- Décrivez : la motivation, les modules concernés, comment vous l'avez vérifié et le résultat, et si des fichiers d'anciennes versions sont touchés.
- Joignez des captures d'écran pour les changements de panneau ou de style — avec comptes et clés masqués.

### Issues

Signalez bugs et demandes via les modèles. Pour un problème de sécurité, n'ouvrez pas d'Issue publique — voir [SECURITY.md](../../SECURITY.md).
