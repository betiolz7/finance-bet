import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ícone da tela inicial do iPhone.
export default function AppleIcon() {
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
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: -5,
        }}
      >
        fb
      </div>
    ),
    size,
  );
}
