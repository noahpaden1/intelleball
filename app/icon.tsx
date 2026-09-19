import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** A tri-accent ring — the ball, seen as its gimbal. */
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
          backgroundColor: "#000000",
          borderRadius: 14,
          border: "1.5px solid rgba(255, 255, 255, 0.14)",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundImage:
              "linear-gradient(120deg, #2997ff 0%, #bf5af2 55%, #ff375f 100%)",
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              display: "flex",
              borderRadius: 999,
              backgroundColor: "#000000",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
