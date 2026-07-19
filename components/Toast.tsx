/** Fixed bottom-center dark pill; render only while text is non-empty. */
export default function Toast({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0e1524",
        color: "#fff",
        fontSize: 13.5,
        padding: "11px 20px",
        borderRadius: 99,
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        zIndex: 50,
      }}
    >
      {text}
    </div>
  );
}
