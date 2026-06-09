import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

export const runtime = "edge";
export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const font = await fetch(
    "https://fonts.gstatic.com/ea/notoseriftc/v1/NotoSerifTC-Bold.otf",
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #fdf6ec 0%, #f5e6d3 50%, #e8d5c0 100%)",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            border: "3px solid #7c3a2e",
            borderRadius: "16px",
            padding: "60px 80px",
            background: "rgba(255,255,255,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontFamily: "Noto Serif TC",
              color: "#7c3a2e",
              letterSpacing: "0.1em",
            }}
          >
            {SITE.name}
          </div>
          <div
            style={{
              fontSize: 32,
              fontFamily: "Noto Serif TC",
              color: "#5c4033",
              letterSpacing: "0.05em",
            }}
          >
            {SITE.tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Serif TC", data: font, style: "normal", weight: 700 }],
    },
  );
}
