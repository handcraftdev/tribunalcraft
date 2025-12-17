import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TribunalCraft | Decentralized Arbitration",
  description: "A sovereign court for the digital age. Decentralized arbitration protocol on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --font-display: ${cormorant.style.fontFamily};
            --font-body: ${dmSans.style.fontFamily};
            --font-mono: ${jetbrainsMono.style.fontFamily};
          }
        `}</style>
      </head>
      <body
        className={`${cormorant.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
