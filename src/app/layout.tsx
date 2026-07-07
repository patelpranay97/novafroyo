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
  metadataBase: new URL("https://www.novafroyo.com"),
  title: "Nova — Greek Frozen Yogurt | Opening July 12 in Chicago's West Loop",
  description:
    "Nova is a Greek frozen yogurt shop opening July 12 at 1047 W Madison St in Chicago's West Loop. Thick, tangy Greek froyo with fresh toppings — part of Cone. Open daily 12–10 PM.",
  keywords: [
    "Greek frozen yogurt",
    "froyo",
    "frozen yogurt Chicago",
    "West Loop froyo",
    "Nova froyo",
    "Greek froyo West Loop",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nova — Greek Frozen Yogurt",
    description:
      "Opening July 12 in Chicago's West Loop. Thick, tangy Greek frozen yogurt — part of Cone.",
    url: "https://www.novafroyo.com",
    siteName: "Nova Greek Frozen Yogurt",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nova — Greek Frozen Yogurt",
    description:
      "Opening July 12 in Chicago's West Loop. Thick, tangy Greek frozen yogurt — part of Cone.",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "IceCreamShop",
  name: "Nova Greek Frozen Yogurt",
  alternateName: "Nova Froyo",
  description:
    "Greek frozen yogurt shop in Chicago's West Loop. Thick, tangy Greek froyo with fresh toppings — part of Cone.",
  url: "https://www.novafroyo.com",
  logo: "https://www.novafroyo.com/logo.png",
  image: "https://www.novafroyo.com/logo.png",
  foundingDate: "2026-07-12",
  servesCuisine: ["Frozen Yogurt", "Greek"],
  priceRange: "$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1047 W Madison St",
    addressLocality: "Chicago",
    addressRegion: "IL",
    postalCode: "60607",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 41.8817,
    longitude: -87.6528,
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "12:00",
    closes: "22:00",
  },
  hasMenu: "https://www.novafroyo.com/nova-menu.pdf",
  sameAs: [
    "https://www.instagram.com/novafroyo/",
    "https://www.tiktok.com/@novafroyo",
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd),
          }}
        />
        {children}
        <script data-goatcounter="https://novafroyo.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
      </body>
    </html>
  );
}
