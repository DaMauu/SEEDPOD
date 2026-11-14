# Contributing（Español）

> Esta página es la traducción al español de [CONTRIBUTING.md](../../CONTRIBUTING.md). Las versiones English y china simplificada son las de referencia.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Gracias por mejorar SEEDPOD. Lee esta página primero: te ahorrarás la mayor parte de las idas y vueltas.

### Qué es este repositorio

Complementos de un solo archivo: userscripts de Tampermonkey y hojas de estilo externas. **Sin build, sin dependencias, sin backend**: sueltas un archivo y funciona. No introduzcas bundlers, dependencias de npm ni pasos de compilación en una PR.

### Estructura

| Ruta | Contenido |
|---|---|
| `scripts/bluray/legacy/` | Versiones publicadas del panel bluray, un archivo por versión |
| `scripts/bluray/docs/` | Inicio rápido, guía, arquitectura, notas de desarrollo |
| `scripts/PTScripts/` | Colección de utilidades para trackers, siguiendo el upstream `DaMauu/Scripts` |
| `styles/r/` | Estilos de tema para trackers |
| `pta/` | Página de notas sobre la arquitectura local de trackers |

### Versionado

- **bluray**: nombre de archivo `pt-bluray-assistant-v0.0.0.N.user.js`, cuatro segmentos que se incrementan. **Nunca sobrescribas ni borres una versión antigua**; añade un archivo nuevo. La cabecera `@version`, el título del panel y la línea del log de inyección deben coincidir.
- **styles**: un archivo por estilo, sube la versión y crea un tag en cada cambio; los tags antiguos se conservan para siempre para poder revertir.
- **PTScripts**: este repositorio solo garantiza que los archivos sigan disponibles; el upstream `DaMauu/Scripts` es la fuente de verdad. Envía los cambios primero al upstream y luego sincroniza.

### Antes de enviar

1. El script se instala en Tampermonkey y funciona de verdad en el sitio objetivo, no "debería funcionar".
2. Indica qué tipos de tracker has verificado (NexusPHP / UNIT3D / Gazelle / f3nix); los nombres de sitio ayudan.
3. Elimina los `console.log` de depuración, las rutas locales y las cuentas de prueba.
4. No hagas commit de datos locales de trackers: `data/site-defs/` y `pta/data/site-arch.local.csv` están en `.gitignore`; nunca uses `git add -f`.
5. **Nunca hagas commit** de cookies, passkeys, claves de tracker, claves de API ni capturas con datos personales.

### Mensajes de commit

Una descripción breve de qué cambió y qué módulo toca, por ejemplo:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chino o inglés, ambos valen.

### Pull requests

- Una sola cuestión por PR; deja fuera el formateo no relacionado.
- Describe: motivación, módulos afectados, cómo lo verificaste y el resultado, y si se tocan archivos de versiones antiguas.
- Incluye capturas para cambios de panel o de estilo, con cuentas y claves tapadas.

### Issues

Reporta fallos y peticiones con las plantillas. Para problemas de seguridad, no abras una Issue pública: consulta [SECURITY.md](../../SECURITY.md).
