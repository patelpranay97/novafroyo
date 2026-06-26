import type { Metadata } from "next";
import { Cinzel, Montserrat, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "Nova — Greek Frozen Yogurt | Swirling soon in Chicago's West Loop",
  description:
    "Nova is bringing thick, tangy Greek frozen yogurt to Chicago's West Loop. Swirling soon.",
  openGraph: {
    title: "Nova — Greek Frozen Yogurt",
    description: "Swirling soon in Chicago's West Loop.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${montserrat.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script data-goatcounter="https://novafroyo.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
      </body>
    </html>
  );
}
