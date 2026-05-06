import type { Metadata } from "next";
import { Outfit, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainTwo Desktop",
  description: "Tu segundo cerebro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${bebasNeue.variable}`}>
      <body className={outfit.className}>
        <Navigation />
        <main className="main-content">
          {children}
        </main>
        <style>{`
          .main-content {
            padding-bottom: 80px; /* space for bottom nav */
            min-height: 100vh;
          }
          @media (min-width: 768px) {
            .main-content {
              padding-bottom: 0;
              margin-left: 80px; /* space for sidebar */
            }
          }
        `}</style>
      </body>
    </html>
  );
}

