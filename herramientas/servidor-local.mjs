// Servidor para probar el tablero en la computadora, sin Netlify:
//   npm run local            (clave: "prueba")
//   CLAVE_TABLERO=otra npm run local
// Guarda todo en memoria: al cerrarlo se pierde. Abre en http://localhost:8888
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { manejar } from "../nucleo/api.mjs";

const raiz = fileURLToPath(new URL("../public/", import.meta.url));
const puerto = Number(process.env.PORT) || 8888;
const clave = process.env.CLAVE_TABLERO ?? "prueba";
const TIPOS = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".js": "text/javascript", ".css": "text/css" };

let registro = null; // { valor, etag }
let contador = 0;
const copias = new Map();
const imagenes = new Map();
const almacen = {
  async leer() { return registro && { valor: structuredClone(registro.valor), etag: registro.etag }; },
  async escribir(valor, etag) {
    if ((registro ? registro.etag : null) !== etag) return false;
    registro = { valor: structuredClone(valor), etag: `e${++contador}` };
    return true;
  },
  async guardarCopia(k, v) { copias.set(k, structuredClone(v)); },
  async guardarImagen(id, buf, tipo) { imagenes.set(id, { datos: buf, tipo }); },
  async leerImagen(id) { return imagenes.get(id) || null; },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const trozos = [];
    for await (const t of req) trozos.push(t);
    const cuerpo = trozos.length ? Buffer.concat(trozos) : undefined;
    const r = await manejar(new Request(url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : cuerpo }), { almacen, clave });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const ruta = normalize(join(raiz, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
  if (!ruta.startsWith(raiz)) { res.writeHead(403).end(); return; }
  try {
    const contenido = await readFile(ruta);
    res.writeHead(200, { "content-type": TIPOS[extname(ruta)] || "application/octet-stream" });
    res.end(contenido);
  } catch {
    res.writeHead(404).end("No existe");
  }
}).listen(puerto, () => console.log(`Tablero local en http://localhost:${puerto} (clave: "${clave}")`));
