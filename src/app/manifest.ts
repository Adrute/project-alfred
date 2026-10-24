import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Alfred · Asistencia docente", short_name: "Alfred", description: "Tu espacio docente privado", lang: "es", start_url: "/", scope: "/", display: "standalone", background_color: "#f5f1eb", theme_color: "#781f3d", icons: [{ src: "/icons/alfred-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/alfred-512.png", sizes: "512x512", type: "image/png", purpose: "any" }] };
}
