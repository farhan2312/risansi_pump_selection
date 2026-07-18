import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

import "../styles/theme.css";
import "../index.css";
import "../App.css";
import { ThemeProvider } from "../contexts/ThemeContext";

// Match the Risansi Intelligence Platform (sales.risansi.com) typeface exactly.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Instrument Serif — sparse display accent per the Risansi guide.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-plex-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pump Selection & Testing Portal",
  description:
    "Intelligent pump recommendation platform for sales engineers with integrated testing reports and project management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        {/* Sets data-theme before first paint so themed CSS variables are
            correct immediately — without this, the page paints once with no
            data-theme (ThemeProvider only applies it in a post-paint effect),
            then snaps to the right look a moment later. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
