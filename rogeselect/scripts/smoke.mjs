// Testa o fluxo anon: upload de foto + insert + select + limpeza.
import { createClient } from "@supabase/supabase-js";

const URL = "https://fpgcvekbkkotrweelbrc.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZ2N2ZWtia2tvdHJ3ZWVsYnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNTQ2MzYsImV4cCI6MjA5NTgzMDYzNn0.Ww9m6VwHwwOra3ge0tASho-ZBvCw0N67jFR5gurZJtA";

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

const path = `smoke-${Date.now()}.txt`;
const up = await sb.storage.from("fotos").upload(path, new Blob(["teste"]), { upsert: false });
console.log("upload:", up.error ? "ERRO " + up.error.message : "ok");

const { data: pub } = sb.storage.from("fotos").getPublicUrl(path);

const ins = await sb
  .from("participantes")
  .insert({ nome_completo: "SMOKE TEST", foto_url: pub.publicUrl })
  .select()
  .single();
console.log("insert:", ins.error ? "ERRO " + ins.error.message : "ok id=" + ins.data.id);

const sel = await sb.from("participantes").select("id,nome_completo").order("created_at", { ascending: false });
console.log("select:", sel.error ? "ERRO " + sel.error.message : `ok (${sel.data.length} linhas)`);

// limpeza
if (ins.data?.id) await sb.from("participantes").delete().eq("id", ins.data.id);
await sb.storage.from("fotos").remove([path]);
console.log("limpeza: ok");
