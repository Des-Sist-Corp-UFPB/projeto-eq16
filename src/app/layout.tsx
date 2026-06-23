import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { DiscordLinkBanner } from "@/components/DiscordLinkBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Rinha Team Finder — Rinha do Campus IV",
  description: "Encontre jogadores e monte seu time para a Rinha do Campus IV - Edição II",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans min-h-screen flex flex-col bg-navy text-text-main antialiased`}>
        <Providers>
          <Navbar />
          {children}
          <DiscordLinkBanner />
        </Providers>
      </body>
    </html>
  );
}
