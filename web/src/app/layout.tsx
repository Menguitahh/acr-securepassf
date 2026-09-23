import type { Metadata } from "next";
import { QueryProvider } from "@/common/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Securepass admin",
  description: "Dashboard de administracion del barrio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-bg-base font-sans text-text-primary">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
