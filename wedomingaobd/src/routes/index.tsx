import { createFileRoute } from "@tanstack/react-router";

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

function Index() {
  return (
    <iframe
      src="/byd-domingao.html"
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
