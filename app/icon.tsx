import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

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
          background: "#6C5CE7",
          borderRadius: 96,
        }}
      >
        <svg width="280" height="280" viewBox="0 0 24 24" fill="none" stroke="#F3F0FF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l5 5L20 6" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
