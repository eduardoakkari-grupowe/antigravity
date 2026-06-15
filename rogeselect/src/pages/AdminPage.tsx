import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import LoginGate from "../components/LoginGate";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabase";
import type { Participante } from "../lib/types";
import logoImage from "../assets/logoImage";

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function simNao(v: string) {
  if (v === "sim") return "Sim";
  if (v === "nao") return "Não";
  return "—";
}

function detail(v?: string, prefix = "") {
  if (!v) return "";
  return ` ${prefix}${v}`;
}

function AdminInner() {
  const [rows, setRows] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Participante | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("participantes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as Participante[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.nome_completo, r.empresa_rede, r.cidade, r.email, r.cpf, r.cargo]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    const tally = (key: keyof Participante) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const v = (String(r[key] ?? "").trim() || "—");
        m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      sexo: tally("sexo"),
      estado: tally("estado"),
      cidade: tally("cidade"),
      camiseta: tally("tamanho_camiseta"),
      calcado: tally("tamanho_calcado"),
    };
  }, [rows]);

  function exportExcel() {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]).filter((c) => c !== "foto_url");
    const data = rows.map((r) => {
      const obj: Record<string, string> = {};
      for (const c of cols) {
        obj[c] = String((r as any)[c] ?? "").replace(/[\r\n]+/g, " ");
      }
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(wb, "roge-select-2026-participantes.xlsx");
  }

  return (
    <div className="min-h-screen bg-roge-sand">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Roge Select" className="h-10 w-auto" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-roge-red">
                Administração
              </p>
              <p className="text-sm font-medium text-roge-navy">Roge Select 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-roge-navy/10 px-3 py-1 text-sm font-semibold text-roge-navy">
              {rows.length} cadastro{rows.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={load}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-roge-navy transition hover:border-roge-navy"
            >
              Atualizar
            </button>
            <button
              onClick={exportExcel}
              className="rounded-xl bg-roge-red px-3 py-2 text-sm font-semibold text-white transition hover:bg-roge-redDark"
            >
              Exportar Excel
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Blocos de gráficos */}
        {!loading && !error && rows.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartBlock title="Gênero" data={stats.sexo} barClass="bg-roge-red" />
            <ChartBlock title="Estado" data={stats.estado} barClass="bg-roge-navy" limit={10} />
            <ChartBlock title="Cidade" data={stats.cidade} barClass="bg-roge-navy" limit={10} />
            <ChartBlock title="Tamanho da Camiseta" data={stats.camiseta} barClass="bg-roge-red" />
            <ChartBlock title="Tamanho do Calçado" data={stats.calcado} barClass="bg-roge-red" limit={12} />
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, empresa, cidade, e-mail, CPF…"
          className="field-input mb-5 max-w-md"
        />

        {loading && <p className="py-16 text-center text-slate-500">Carregando cadastros…</p>}
        {error && (
          <div className="rounded-2xl border border-roge-red bg-roge-red/10 px-5 py-4 text-sm font-medium text-roge-redDark">
            Erro ao carregar: {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-16 text-center text-slate-500">Nenhum cadastro encontrado.</p>
        )}

        {/* MOBILE: cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft"
              >
                <img
                  src={r.foto_url}
                  alt={r.nome_completo}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-roge-navy">{r.nome_completo}</p>
                  <p className="truncate text-sm text-slate-500">{r.empresa_rede} · {r.cargo}</p>
                  <p className="truncate text-xs text-slate-400">
                    {r.cidade}/{r.estado} · {r.telefone}
                  </p>
                </div>
                <span className="text-roge-navy/40">›</span>
              </button>
            ))}
          </div>
        )}

        {/* DESKTOP: table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-soft md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-roge-navy text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Foto</th>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Empresa / Rede</th>
                  <th className="px-4 py-3 font-semibold">Cargo</th>
                  <th className="px-4 py-3 font-semibold">Cidade/UF</th>
                  <th className="px-4 py-3 font-semibold">Telefone</th>
                  <th className="px-4 py-3 font-semibold">Camiseta</th>
                  <th className="px-4 py-3 font-semibold">Enviado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={
                      "border-t border-slate-100 transition hover:bg-roge-sand " +
                      (i % 2 ? "bg-slate-50/50" : "")
                    }
                  >
                    <td className="px-4 py-2">
                      <img
                        src={r.foto_url}
                        alt={r.nome_completo}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    </td>
                    <td className="px-4 py-2 font-semibold text-roge-navy">{r.nome_completo}</td>
                    <td className="px-4 py-2 text-slate-600">{r.empresa_rede}</td>
                    <td className="px-4 py-2 text-slate-600">{r.cargo}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.cidade}/{r.estado}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.telefone}</td>
                    <td className="px-4 py-2 text-slate-600">{r.tamanho_camiseta}</td>
                    <td className="px-4 py-2 text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setSelected(r)}
                        className="rounded-lg bg-roge-navy/10 px-3 py-1.5 text-xs font-semibold text-roge-navy transition hover:bg-roge-navy hover:text-white"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selected && <DetailModal r={selected} onClose={() => setSelected(null)} />}

      <Footer />
    </div>
  );
}

function ChartBlock({
  title,
  data,
  barClass,
  limit,
}: {
  title: string;
  data: [string, number][];
  barClass: string;
  limit?: number;
}) {
  const total = data.reduce((s, [, c]) => s + c, 0);
  const max = Math.max(1, ...data.map(([, c]) => c));
  const shown = limit ? data.slice(0, limit) : data;
  const restCount = data.length - shown.length;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="section-title text-sm">{title}</p>
        <span className="rounded-full bg-roge-navy/10 px-2.5 py-0.5 text-xs font-semibold text-roge-navy">
          {total}
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {shown.length === 0 && <p className="text-sm text-slate-400">Sem dados</p>}
        {shown.map(([label, count]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
              <span className="truncate pr-2">{label}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {count} · {total ? Math.round((count / total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={"h-full rounded-full " + barClass}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {restCount > 0 && (
          <p className="pt-1 text-xs text-slate-400">+{restCount} outros</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-roge-navy">{value || "—"}</p>
    </div>
  );
}

function DetailModal({ r, onClose }: { r: Participante; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-xl font-bold text-roge-navy">{r.nome_completo}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Fechar ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[200px_1fr]">
          <div>
            <img
              src={r.foto_url}
              alt={r.nome_completo}
              className="aspect-square w-full rounded-2xl object-cover shadow-soft"
            />
            <a
              href={r.foto_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center text-xs font-medium text-roge-red underline"
            >
              Abrir foto em tamanho real
            </a>
          </div>

          <div>
            <p className="section-title text-base">Dados Pessoais</p>
            <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Row label="Nome no documento" value={r.nome_documento} />
              <Row label="Data de nascimento" value={fmtDate(r.data_nascimento)} />
              <Row label="CPF" value={r.cpf} />
              <Row label="RG" value={r.rg} />
              <Row label="Sexo" value={r.sexo} />
              <Row label="Empresa / Rede" value={r.empresa_rede} />
              <Row label="Cargo" value={r.cargo} />
              <Row label="Telefone / WhatsApp" value={r.telefone} />
              <Row label="E-mail" value={r.email} />
              <Row label="Cidade" value={r.cidade} />
              <Row label="Estado" value={r.estado} />
              <Row label="Documento de embarque" value={r.documento_embarque} />
              {r.documento_embarque === "CNH" && (
                <Row label="Número da CNH" value={r.numero_documento} />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-6 px-6 pb-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="section-title text-base">Saúde &amp; Hospedagem</p>
          </div>
          <Row label="Restrição alimentar" value={simNao(r.restricao_alimentar) + detail(r.restricao_alimentar_qual, "— ")} />
          <Row label="Alergia" value={simNao(r.alergia) + detail(r.alergia_qual, "— ")} />
          <Row label="Tratamento médico" value={simNao(r.tratamento_medico) + detail(r.tratamento_medico_qual, "— ")} />
          <Row label="Uso contínuo de medicamentos" value={simNao(r.uso_continuo_medicamentos) + detail(r.uso_continuo_medicamentos_quais, "— ")} />
          <Row label="Medicação p/ pressão" value={simNao(r.medicacao_pressao)} />
          <Row label="Medicação p/ colesterol" value={simNao(r.medicacao_colesterol)} />
          <Row label="Cirurgia (12 meses)" value={simNao(r.cirurgia_12_meses) + detail(r.cirurgia_12_meses_qual, "— ")} />
          <Row label="Condição médica relevante" value={simNao(r.condicao_medica) + detail(r.condicao_medica_qual, "— ")} />
        </div>

        <div className="grid grid-cols-1 gap-x-6 px-6 pb-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="section-title text-base">Kit &amp; Brindes</p>
          </div>
          <Row label="Tamanho camiseta / polo" value={r.tamanho_camiseta} />
          <Row label="Tamanho do calçado" value={r.tamanho_calcado} />
        </div>

        <div className="grid grid-cols-1 gap-x-6 px-6 pb-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="section-title text-base">Contato de Emergência</p>
          </div>
          <Row label="Nome" value={r.emergencia_nome} />
          <Row label="Parentesco" value={r.emergencia_parentesco} />
          <Row label="Telefone / WhatsApp" value={r.emergencia_telefone} />
          <Row label="Aceitou o termo" value={r.aceite_termo ? "Sim" : "Não"} />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <LoginGate
      password="rogeadmin2026!!"
      storageKey="roge_admin_auth"
      subtitle={
        <h1 className="font-display text-2xl font-bold tracking-wide text-roge-navy">
          ADMINISTRAÇÃO
        </h1>
      }
    >
      <AdminInner />
    </LoginGate>
  );
}
