import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alfred · Asistencia docente local",
  description: "Plataforma multiagente local-first para docentes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Alfred", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }], icon: "/icons/alfred-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#781f3d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
