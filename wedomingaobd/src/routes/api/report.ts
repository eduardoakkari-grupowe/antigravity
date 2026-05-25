import { createFileRoute } from "@tanstack/react-router";
import html from "../../byd-domingao.html?raw";

export const Route = createFileRoute("/api/report")({
  server: {
    handlers: {
      GET: () =>
        new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
