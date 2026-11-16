# Tablero de la Fundación

Tablero de proyectos y tareas de la Fundación para las Artes. Cualquiera con el enlace lo ve; para cambiar algo se usa la clave del grupo, que cada celular pide una sola vez.

- La página está en `public/` y usa el sistema de diseño de la Fundación (Lora, Inter, blanco y turquesa).
- Los datos y las fotos se guardan en Netlify Blobs, el almacenamiento incluido en Netlify. No hace falta ninguna base de datos aparte.
- Cada proyecto tiene un código corto (por ejemplo `#U47`) para usar en el grupo de WhatsApp: los archivos, audios y documentos se mandan ahí con el código, y después se encuentran buscándolo.

## Publicarlo en Netlify (una sola vez)

1. Entrá a [app.netlify.com](https://app.netlify.com) y elegí **Add new project → Import an existing project → GitHub**.
2. Elegí el repositorio `tablero-fundacion-amb`. Netlify lee la configuración de `netlify.toml`: no cambies nada de lo que propone.
3. Antes de publicar, o después en **Project configuration → Environment variables**, agregá la variable:
   - Nombre: `CLAVE_TABLERO`
   - Valor: la clave que va a usar el grupo para editar.
4. Tocá **Deploy**. Si agregaste la clave después del primer deploy, hacé uno nuevo desde **Deploys → Trigger deploy** para que la tome.
5. Opcional: en **Domain management** podés cambiarle el nombre al sitio, por ejemplo `tablero-amb.netlify.app`.

La primera vez que alguien guarda un cambio, el tablero copia al almacenamiento los datos de `public/datos-iniciales.json`. Desde ahí en adelante, ese archivo ya no se usa.

## Cambiar la clave del grupo

Cambiá `CLAVE_TABLERO` en Netlify y hacé un deploy nuevo. A quien tenga la clave vieja guardada, el tablero le pide la nueva la próxima vez que guarde algo, sin perder lo que hizo.

## Respaldos

Cada vez que se guarda, Netlify Blobs conserva una copia (las últimas 30, en las claves `copia-0` a `copia-29` del almacén `tablero`). Se ven en Netlify, en **Blobs**.

## Probarlo en la computadora

Hace falta Node 22 o más nuevo.

```bash
npm install
```

```bash
npm run local
```

Abre en <http://localhost:8888> con la clave `prueba`. Los datos quedan en memoria y se pierden al cerrarlo.

```bash
npm run prueba
```

Corre las pruebas de la API.

## Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `public/index.html` | La página completa: vista, edición y resumen de WhatsApp |
| `public/datos-iniciales.json` | Los proyectos con los que arranca el tablero |
| `nucleo/api.mjs` | La API: leer, guardar con clave, subir y servir fotos |
| `netlify/functions/api.mjs` | Conecta la API con Netlify Blobs |
| `herramientas/servidor-local.mjs` | Servidor para probar sin Netlify |

Si dos personas guardan a la vez, la segunda recibe los datos de la primera y el navegador vuelve a aplicar sus propios cambios encima, así no se pierde nada. Cada medio minuto la página trae los cambios de los demás.
