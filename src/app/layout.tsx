import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alfred · Asistencia docente local",
  description: "Plataforma multiagente local-first para docentes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
