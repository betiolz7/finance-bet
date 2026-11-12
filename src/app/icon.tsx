import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Ícone do app: "fb" em fundo verde, com margem para o recorte do Android.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#9bcf53",
          color: "#141414",
          fontSize: 230,
          fontWeight: 800,
          letterSpacing: -14,
        }}
      >
        fb
      </div>
    ),
    size,
  );
}
