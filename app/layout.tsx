import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComuniDados | Planner 2027",
  description: "Teu espaço privado para organizar a rotina e acompanhar o que importa.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
