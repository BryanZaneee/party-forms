"use client";

import { useEffect } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- JSX intrinsics can only be augmented via a namespace
  namespace JSX {
    interface IntrinsicElements {
      "paper-shader": { style?: React.CSSProperties } & Record<string, unknown>;
    }
  }
}

/** Paper-shader overlay shown while extracted answers stagger into the form. */
export default function ExtractReveal({ active, label }: { active: boolean; label?: string }) {
  useEffect(() => {
    if (active) void import("./paper-shader.js");
  }, [active]);

  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "hidden",
        animation: "overlay-in .3s ease both",
      }}
      data-testid="extract-reveal"
    >
      <paper-shader
        style={{ position: "absolute", inset: 0, opacity: 0.92 }}
        color-back="#070d1a"
        color-front="#e11d74"
        shape="ripple"
        type="8x8"
        px-size="2.2"
        speed="1.1"
      />
      {/* Subtle scrim so the label stays readable over the busiest shader frames. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(7,13,26,.35) 0%, rgba(7,13,26,0) 65%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          textAlign: "center",
          padding: "13px 20px",
          background: "rgba(7,13,26,.62)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.22)",
          boxShadow: "0 10px 34px rgba(7,13,26,.45)",
          maxWidth: "85%",
          animation: "chip-rise .35s ease both",
        }}
      >
        <span style={{ display: "inline-flex", gap: 4 }} aria-hidden>
          <span style={{ animation: "blink 1.2s infinite" }}>●</span>
          <span style={{ animation: "blink 1.2s .2s infinite" }}>●</span>
          <span style={{ animation: "blink 1.2s .4s infinite" }}>●</span>
        </span>
        <span>{label ?? "Placing answers from your document…"}</span>
      </div>
    </div>
  );
}
