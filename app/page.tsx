import Link from "next/link";
import { listForms } from "@/lib/db";
import Hero from "@/components/Hero";
import DashboardCards from "@/components/DashboardCards";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const forms = listForms();
  return (
    <div style={{ minHeight: "100vh" }}>
      <Hero padding="28px 28px 34px">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "rgba(255,255,255,.92)",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#0b1430",
            }}
          >
            P
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.9)" }}>Party Forms</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 34,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Your forms</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.65)", marginTop: 5 }}>
              {forms.length === 1 ? "1 form" : `${forms.length} forms`}
            </div>
          </div>
          <Link
            href="/new"
            className="btn-white"
            style={{
              background: "#fff",
              color: "#0b1430",
              border: "none",
              borderRadius: 9,
              padding: "11px 18px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ＋ New form
          </Link>
        </div>
      </Hero>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 28px 60px" }}>
        {forms.length > 0 ? (
          <DashboardCards forms={forms} />
        ) : (
          <div style={{ textAlign: "center", padding: "70px 20px", color: "#5c6b82" }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#22304a" }}>No forms yet</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Create your first form to start collecting responses.</div>
          </div>
        )}
      </div>
    </div>
  );
}
