import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/components/theme-toggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "finance-bet",
  description: "Controle financeiro pessoal",
  appleWebApp: { capable: true, title: "finance-bet", statusBarStyle: "default" },
};

// Cor da barra do sistema quando o app está instalado, nos dois temas.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
  viewportFit: "cover",
};

// Aplica o tema salvo antes de a página aparecer, para não piscar no tema errado.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
