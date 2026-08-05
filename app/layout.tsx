import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { QueryProvider } from "@/lib/providers/query-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Borb Financial OS",
  description: "Centro de control financiero para el hogar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} dark h-full antialiased`}>
      <head>
        {/* Material Symbols Outlined — refresh de UI, ver globals.css.
            next/font no cubre esta fuente de íconos variable; se carga acá
            (root layout, un solo lugar para toda la app, no por página) —
            la regla no-page-custom-font apunta al patrón de Pages Router,
            no aplica igual en App Router. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-background font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
