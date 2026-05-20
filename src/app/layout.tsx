import type { Metadata } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Gestão Agrícola",
  description: "Sistema web para gestão de fazendas com foco em cafeicultura."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
