import type { Metadata } from "next";

import "../styles/theme.css";
import "../index.css";
import "../App.css";
import { ThemeProvider } from "../contexts/ThemeContext";

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
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
