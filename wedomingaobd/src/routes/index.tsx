import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BYD × Domingão com Huck · Relatório de Ação · WDI" },
      {
        name: "description",
        content:
          "Relatório de acompanhamento da ação de mídia BYD no Domingão com Huck (26/04/2026), com dados de Instar Analytics, Google Trends e Stilingue.",
      },
    ],
  }),
  component: Index,
});

const PASSWORD_HASH =
  "c3a7c4ed280b395eed9899b2d79627720c1131f88d0de0ca79e6f558df53edf1";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(false), 2000);
    return () => clearTimeout(t);
  }, [err]);

  async function check() {
    const hex = await sha256Hex(pw);
    if (hex === PASSWORD_HASH) {
      onUnlock();
    } else {
      setErr(true);
      setPw("");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "Inter, Manrope, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "#f0f0f0",
          borderRadius: 20,
          padding: "48px 36px",
          width: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          boxShadow: "0 4px 24px rgba(0,0,0,.08)",
        }}
      >
        <img
          src="/we-logo.png"
          alt="WE"
          style={{ width: 160, filter: "brightness(0)" }}
        />
        <p
          style={{
            fontSize: 14,
            color: "#444",
            fontWeight: 500,
            margin: 0,
          }}
        >
          Digite a senha para acessar:
        </p>
        <input
          ref={inputRef}
          type="password"
          autoComplete="off"
          placeholder="Senha"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") check();
          }}
          style={{
            width: "100%",
            padding: "14px 16px",
            border: "1.5px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            fontSize: 14,
            outline: "none",
            color: "#333",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            color: "#e53e3e",
            fontSize: 12,
            display: err ? "block" : "none",
          }}
        >
          Senha incorreta. Tente novamente.
        </div>
        <button
          onClick={check}
          style={{
            width: "100%",
            padding: 14,
            background: "#666",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: ".02em",
          }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

function Index() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <iframe
      src="/api/report"
      title="BYD × Domingão com Huck · Relatório de Ação"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
      }}
    />
  );
}
