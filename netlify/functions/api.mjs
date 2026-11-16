// Función de Netlify: conecta la API del tablero con Netlify Blobs (el almacenamiento incluido en Netlify).
import { getStore } from "@netlify/blobs";
import { manejar } from "../../nucleo/api.mjs";

export default async (req) => {
  const datos = getStore({ name: "tablero", consistency: "strong" });
  const imagenes = getStore({ name: "tablero-imagenes" });

  const almacen = {
    async leer() {
      const r = await datos.getWithMetadata("datos", { type: "json" });
      return r && r.data ? { valor: r.data, etag: r.etag } : null;
    },
    async escribir(valor, etag) {
      const r = await datos.setJSON("datos", valor, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      return r.modified;
    },
    guardarCopia: (clave, valor) => datos.setJSON(clave, valor),
    guardarImagen: (id, buf, tipo) => imagenes.set(id, buf, { metadata: { tipo } }),
    async leerImagen(id) {
      const r = await imagenes.getWithMetadata(id, { type: "arrayBuffer" });
      return r && r.data ? { datos: r.data, tipo: r.metadata && r.metadata.tipo } : null;
    },
  };

  const clave = (globalThis.Netlify && Netlify.env.get("CLAVE_TABLERO")) || process.env.CLAVE_TABLERO || "";
  return manejar(req, { almacen, clave });
};

export const config = { path: "/api/*" };
