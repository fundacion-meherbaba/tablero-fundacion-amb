// API del tablero. No depende de Netlify: recibe un "almacén" con cinco funciones,
// así se puede probar en local (herramientas/servidor-local.mjs) igual que en Netlify.
//
//   GET  /api/datos          → { datos, version }   (datos es null si todavía no se guardó nada)
//   PUT  /api/datos          → guarda { datos, base }; 409 si otra persona guardó antes
//   POST /api/clave          → 200 si la clave del grupo es correcta
//   POST /api/imagen         → sube una foto (cuerpo binario) y devuelve { id }
//   GET  /api/imagen/:id     → devuelve la foto
//
// Para escribir hace falta la cabecera "x-clave" con la clave del grupo.

const MAX_DATOS = 2_000_000; // caracteres de JSON
const MAX_IMAGEN = 4 * 1024 * 1024; // bytes (las fotos se achican en el navegador antes de subir)
const TIPOS_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const COPIAS = 30; // se guardan las últimas 30 versiones como respaldo

function json(cuerpo, estado = 200, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function resumen(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return new Uint8Array(buf);
}

// Compara en tiempo constante para no dar pistas sobre la clave.
async function claveCorrecta(dada, real) {
  const [a, b] = await Promise.all([resumen(dada), resumen(real)]);
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

async function revisarClave(req, clave) {
  if (!clave) return json({ error: "falta-configurar-clave" }, 503);
  const dada = req.headers.get("x-clave") || "";
  if (dada && (await claveCorrecta(dada, clave))) return null;
  await espera(700); // frena los intentos repetidos
  return json({ error: "clave-incorrecta" }, 401);
}

function datosValidos(d) {
  return d && typeof d === "object" && !Array.isArray(d) && Array.isArray(d.proyectos) && Array.isArray(d.personas);
}

export async function manejar(req, { almacen, clave }) {
  const ruta = new URL(req.url).pathname.replace(/\/+$/, "");
  const metodo = req.method.toUpperCase();

  try {
    if (ruta === "/api/datos" && metodo === "GET") {
      const actual = await almacen.leer();
      if (!actual) return json({ datos: null, version: 0 });
      return json({ datos: actual.valor.datos, version: actual.valor.version });
    }

    if (ruta === "/api/datos" && metodo === "PUT") {
      const falla = await revisarClave(req, clave);
      if (falla) return falla;
      const texto = await req.text();
      if (texto.length > MAX_DATOS) return json({ error: "demasiado-grande" }, 413);
      let cuerpo;
      try { cuerpo = JSON.parse(texto); } catch { return json({ error: "formato" }, 400); }
      if (!cuerpo || !datosValidos(cuerpo.datos) || !Number.isInteger(cuerpo.base)) return json({ error: "formato" }, 400);

      const actual = await almacen.leer();
      const version = actual ? actual.valor.version : 0;
      if (cuerpo.base !== version) return json({ error: "conflicto", datos: actual.valor.datos, version }, 409);

      const nuevo = { datos: cuerpo.datos, version: version + 1, guardado: new Date().toISOString() };
      const ok = await almacen.escribir(nuevo, actual ? actual.etag : null);
      if (!ok) {
        // Otra persona guardó en el mismo instante: devolvemos lo último para que el navegador lo combine.
        const otra = await almacen.leer();
        return json({ error: "conflicto", datos: otra.valor.datos, version: otra.valor.version }, 409);
      }
      try { await almacen.guardarCopia(`copia-${nuevo.version % COPIAS}`, nuevo); } catch { /* el respaldo no frena el guardado */ }
      return json({ version: nuevo.version });
    }

    if (ruta === "/api/clave" && metodo === "POST") {
      const falla = await revisarClave(req, clave);
      return falla || json({ ok: true });
    }

    if (ruta === "/api/imagen" && metodo === "POST") {
      const falla = await revisarClave(req, clave);
      if (falla) return falla;
      const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!TIPOS_IMAGEN.has(tipo)) return json({ error: "tipo-no-admitido" }, 415);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength) return json({ error: "vacio" }, 400);
      if (buf.byteLength > MAX_IMAGEN) return json({ error: "demasiado-grande" }, 413);
      const id = crypto.randomUUID().replace(/-/g, "");
      await almacen.guardarImagen(id, buf, tipo);
      return json({ id });
    }

    const m = ruta.match(/^\/api\/imagen\/([a-f0-9]{32})$/);
    if (m && metodo === "GET") {
      const img = await almacen.leerImagen(m[1]);
      if (!img) return json({ error: "no-existe" }, 404);
      return new Response(img.datos, {
        headers: {
          "content-type": TIPOS_IMAGEN.has(img.tipo) ? img.tipo : "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return json({ error: "no-existe" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "error-interno" }, 500);
  }
}
