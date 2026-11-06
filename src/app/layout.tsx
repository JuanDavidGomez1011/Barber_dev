import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda, Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

// Paneles internos (barbero y admin)
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Playfair_Display({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
// Sitio público: serif editorial + grotesca con eje de ancho (para rótulos condensados)
const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], style: ["normal", "italic"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: { default: "Reserva tu cita", template: "%s · Reservas" },
  description: "Reserva tu corte o arreglo de barba en línea, en segundos.",
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${bodoni.variable} ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
