import type { MetadataRoute } from "next";

// Permite instalar o site como app no celular, com ícone e tela cheia.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "finance-bet",
    short_name: "finance-bet",
    description: "Controle financeiro pessoal",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f2",
    theme_color: "#141414",
    lang: "pt-BR",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Novo lançamento", url: "/lancamentos/novo" },
      { name: "Revisar banco", url: "/open-finance/revisar" },
    ],
  };
}
