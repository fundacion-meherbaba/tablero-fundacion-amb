// Prueba la API con un almacén en memoria: npm run prueba
import assert from "node:assert/strict";
import { manejar } from "../nucleo/api.mjs";

let registro = null, n = 0;
const imagenes = new Map();
const almacen = {
  async leer() { return registro && { valor: structuredClone(registro.valor), etag: registro.etag }; },
  async escribir(v, etag) { if ((registro ? registro.etag : null) !== etag) return false; registro = { valor: structuredClone(v), etag: "e" + ++n }; return true; },
  async guardarCopia() {},
  async guardarImagen(id, datos, tipo) { imagenes.set(id, { datos, tipo }); },
  async leerImagen(id) { return imagenes.get(id) || null; },
};
const api = (metodo, ruta, { cuerpo, clave, tipo } = {}) => manejar(new Request("http://x" + ruta, {
  method: metodo, body: cuerpo, headers: { ...(clave ? { "x-clave": clave } : {}), ...(tipo ? { "content-type": tipo } : {}) },
}), { almacen, clave: "secreta" });

let r = await api("GET", "/api/datos");
assert.deepEqual(await r.json(), { datos: null, version: 0 });

r = await api("PUT", "/api/datos", { cuerpo: JSON.stringify({ datos: { personas: [], proyectos: [] }, base: 0 }) });
assert.equal(r.status, 401, "sin clave no se guarda");
r = await api("PUT", "/api/datos", { clave: "otra", cuerpo: "{}" });
assert.equal(r.status, 401, "clave incorrecta");

r = await api("PUT", "/api/datos", { clave: "secreta", cuerpo: JSON.stringify({ datos: { personas: ["A"], proyectos: [] }, base: 0 }) });
assert.equal(r.status, 200); assert.equal((await r.json()).version, 1);

r = await api("PUT", "/api/datos", { clave: "secreta", cuerpo: JSON.stringify({ datos: { personas: ["B"], proyectos: [] }, base: 0 }) });
assert.equal(r.status, 409, "versión vieja da conflicto");
const c = await r.json(); assert.equal(c.version, 1); assert.deepEqual(c.datos.personas, ["A"]);

r = await api("PUT", "/api/datos", { clave: "secreta", cuerpo: JSON.stringify({ datos: { nada: 1 }, base: 1 }) });
assert.equal(r.status, 400, "formato inválido");

r = await api("POST", "/api/clave", { clave: "secreta" }); assert.equal(r.status, 200);

r = await api("POST", "/api/imagen", { clave: "secreta", tipo: "text/html", cuerpo: "<b>" }); assert.equal(r.status, 415);
r = await api("POST", "/api/imagen", { clave: "secreta", tipo: "image/jpeg", cuerpo: new Uint8Array([255, 216, 255]) });
assert.equal(r.status, 200); const { id } = await r.json();
r = await api("GET", "/api/imagen/" + id); assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "image/jpeg");
r = await api("GET", "/api/imagen/no-es-un-id"); assert.equal(r.status, 404);

r = await manejar(new Request("http://x/api/datos", { method: "PUT", headers: { "x-clave": "x" } }), { almacen, clave: "" });
assert.equal(r.status, 503, "sin clave configurada");

console.log("API: todas las pruebas pasaron.");
