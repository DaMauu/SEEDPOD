# Security Policy（Français）

> Cette page est la traduction française de [SECURITY.md](../../SECURITY.md). Les versions English et chinois simplifié font foi.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Signaler une vulnérabilité

Merci de **ne pas** signaler les problèmes de sécurité via les Issues publiques. Utilisez le canal privé du dépôt :

1. Ouvrez l'onglet [Security](../../security/advisories) et cliquez sur « Report a vulnerability » ;
2. Ou contactez directement la maintenance en indiquant les étapes de reproduction et l'impact.

Nous visons une première réponse sous 7 jours et conviendrons avec vous du calendrier de correction et de divulgation.

### Ce qu'il faut signaler

Les userscripts de SEEDPOD s'exécutent sur des pages de trackers privés authentifiées, peuvent lire le contenu des pages et envoyer des requêtes en votre nom. Tout ce qui suit constitue un problème de sécurité :

- Des identifiants (cookie, passkey, clés de tracker, mots de passe de compte) envoyés à une adresse tierce
- Des requêtes sortantes non documentées (vers des domaines autres que l'hébergeur d'images, le CDN ou les services décrits dans la documentation)
- Des chemins XSS permettant d'injecter du contenu contrôlé par l'attaquant dans le panneau ou les boîtes de dialogue
- Une élévation de privilèges ou une injection de paramètres lors de la détection de doublons inter-sites, du remplissage du formulaire d'upload ou de l'envoi vers le téléchargeur
- Des feuilles de style chargeant des ressources non fiables via un `@import` externe

### Hors périmètre

- Les vulnérabilités des trackers eux-mêmes (à signaler au site concerné)
- Les règles des sites, le contenu des torrents ou les bannissements de compte
- Les problèmes nécessitant un accès préalable à vos fichiers locaux ou au contexte de votre extension de navigateur

### Lors de la création d'une Issue ou d'une PR

Avant de publier des logs ou des captures d'écran, supprimez : cookie, passkey, clés de tracker, adresses et mots de passe des téléchargeurs, et noms d'utilisateur sur les sites. Conservez la stack trace ; ne collez pas les en-têtes de requête entiers.
