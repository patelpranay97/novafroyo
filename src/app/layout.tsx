import type { Metadata } from "next";
import { Cinzel, Montserrat, Dancing_Script } from "next/font/google";
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

const dancingScript = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={`${cinzel.variable} ${montserrat.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
