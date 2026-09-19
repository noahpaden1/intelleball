import { ImageResponse } from "next/og";

export const alt = "Intelleball · Every throw, measured in flight.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const spectrum = "linear-gradient(120deg, #2997ff 0%, #bf5af2 55%, #ff375f 100%)";

/** A gimbal ring: a gradient annulus drawn as two stacked circles. */
function Ring({
  size: s,
  thickness,
  top,
  left,
  opacity,
}: {
  size: number;
  thickness: number;
  top: number;
  left: number;
  opacity: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: s,
        height: s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        backgroundImage: spectrum,
        opacity,
      }}
    >
      <div
        style={{
          width: s - thickness * 2,
          height: s - thickness * 2,
          display: "flex",
          borderRadius: 999,
          backgroundColor: "#000000",
        }}
      />
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          backgroundColor: "#000000",
          padding: "0 96px",
        }}
      >
        {/* The ball and its rings, right side */}
        <div
          style={{
            position: "absolute",
            top: 175,
            left: 850,
            width: 280,
            height: 280,
            display: "flex",
            borderRadius: 999,
            backgroundImage:
              "radial-gradient(circle at 35% 30%, #34384a 0%, #121420 55%, #08090d 100%)",
            border: "2px solid rgba(41, 151, 255, 0.35)",
          }}
        />
        <Ring size={360} thickness={3} top={135} left={810} opacity={0.9} />
        <Ring size={440} thickness={3} top={95} left={770} opacity={0.55} />

        {/* Copy */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 7,
            color: "#6e6e73",
          }}
        >
          SMART-BALL TELEMETRY · VIRGINIA TECH
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
            color: "#f5f5f7",
          }}
        >
          Intelleball
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -2.5,
            lineHeight: 1.05,
            backgroundImage: spectrum,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          measured in flight.
        </div>
      </div>
    ),
    { ...size }
  );
}
