# Security Policy（Español）

> Esta página es la traducción al español de [SECURITY.md](../../SECURITY.md). Las versiones English y china simplificada son las de referencia.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Informar de una vulnerabilidad

Por favor, **no** informes de problemas de seguridad mediante Issues públicos. Usa el canal privado del repositorio:

1. Abre la pestaña [Security](../../security/advisories) y haz clic en «Report a vulnerability»;
2. O contacta directamente con el mantenedor indicando los pasos de reproducción y el impacto.

Intentamos responder en un plazo de 7 días y, tras la confirmación, acordaremos contigo los plazos de corrección y divulgación.

### Qué informar

Los userscripts de SEEDPOD se ejecutan en páginas de trackers privados con sesión iniciada, pueden leer el contenido de la página y enviar peticiones en tu nombre. Todo lo siguiente cuenta como problema de seguridad:

- Credenciales (cookie, passkey, claves de tracker, contraseñas de cuenta) enviadas a una dirección de terceros
- Peticiones salientes no documentadas (a dominios distintos del alojamiento de imágenes, la CDN o los servicios que describe la documentación)
- Rutas XSS que inyectan contenido controlado por el atacante en el panel o en los diálogos
- Escalada de privilegios o inyección de parámetros en la búsqueda de duplicados entre sitios, el rellenado del formulario de subida o el envío al descargador
- Hojas de estilo que cargan recursos no confiables mediante un `@import` externo

### Fuera de alcance

- Vulnerabilidades de los propios trackers (informa de ellas al sitio correspondiente)
- Reglas del sitio, contenido de los torrents o bloqueos de cuenta
- Problemas que requieran acceso previo a tus archivos locales o al contexto de tu extensión del navegador

### Al abrir un Issue o PR

Antes de publicar registros o capturas de pantalla, elimina: cookie, passkey, claves de tracker, direcciones y contraseñas de los descargadores, y nombres de usuario del sitio. Conserva la traza de la pila; no pegues las cabeceras de petición completas.
