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
  title: "Nova | Greek Frozen Yogurt | West Loop, Chicago",
  description:
    "Nova is a Greek frozen yogurt shop inside Cone Chicago at 1047 W Madison St in the West Loop. Thick, tangy Greek froyo with fresh toppings. Open daily 5-10 PM.",
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
    title: "Nova | Greek Frozen Yogurt",
    description:
      "Now open inside Cone Chicago in the West Loop. Thick, tangy Greek frozen yogurt, daily 5-10 PM.",
    url: "https://www.novafroyo.com",
    siteName: "Nova Greek Frozen Yogurt",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nova | Greek Frozen Yogurt",
    description:
      "Now open inside Cone Chicago in the West Loop. Thick, tangy Greek frozen yogurt, daily 5-10 PM.",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "IceCreamShop",
  name: "Nova Greek Frozen Yogurt",
  alternateName: "Nova Froyo",
  description:
    "Greek frozen yogurt shop inside Cone Chicago in the West Loop. Thick, tangy Greek froyo with fresh toppings.",
  containedInPlace: {
    "@type": "Place",
    name: "Cone Chicago",
    address: {
      "@type": "PostalAddress",
      streetAddress: "1047 W Madison St",
      addressLocality: "Chicago",
      addressRegion: "IL",
      postalCode: "60607",
      addressCountry: "US",
    },
  },
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
    opens: "17:00",
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
