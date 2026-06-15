import { useEffect, useState } from "react";
import LoginGate from "../components/LoginGate";
import Footer from "../components/Footer";
import {
  SectionHeader,
  TextField,
  SelectField,
  ChipGroup,
  SimNaoField,
} from "../components/FormFields";
import { supabase, FOTOS_BUCKET } from "../lib/supabase";
import { emptyParticipante, ESTADOS, type Participante } from "../lib/types";

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  let out = d;
  if (d.length > 9) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  else if (d.length > 6) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  else if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`;
  return out;
}

function formatRg(v: string) {
  // Aceita números e letras (ex.: dígito "X"). Padrão 30.853.535-9
  const c = v.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 9);
  let out = c;
  if (c.length > 8) out = `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}-${c.slice(8)}`;
  else if (c.length > 5) out = `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
  else if (c.length > 2) out = `${c.slice(0, 2)}.${c.slice(2)}`;
  return out;
}

function formatTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const head = rest.slice(0, rest.length - 4);
  const tail = rest.slice(rest.length - 4);
  return `(${ddd}) ${head}-${tail}`;
}

function FormInner() {
  const [data, setData] = useState<Participante>(emptyParticipante);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  function set<K extends keyof Participante>(key: K, value: Participante[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  // Carrega os municípios do estado selecionado (API do IBGE).
  useEffect(() => {
    if (!data.estado) {
      setCidades([]);
      return;
    }
    let active = true;
    setLoadingCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.estado}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((arr: { nome: string }[]) => {
        if (active) setCidades(arr.map((m) => m.nome));
      })
      .catch(() => {
        if (active) setCidades([]);
      })
      .finally(() => {
        if (active) setLoadingCidades(false);
      });
    return () => {
      active = false;
    };
  }, [data.estado]);

  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFoto(f);
    setFotoPreview(f ? URL.createObjectURL(f) : "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!foto) {
      setError("A foto do participante é obrigatória.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!data.aceite_termo) {
      setError("É necessário ler e concordar com o termo de confirmação.");
      return;
    }
    if (!data.documento_embarque) {
      setError("Selecione o documento que será utilizado para embarque (RG ou CNH).");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upload da foto
      const ext = foto.name.split(".").pop() || "jpg";
      const safe = data.nome_completo.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const path = `${Date.now()}-${safe || "participante"}.${ext}`;
      const up = await supabase.storage
        .from(FOTOS_BUCKET)
        .upload(path, foto, { cacheControl: "3600", upsert: false });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path);

      // 2) Inserir cadastro
      const payload = { ...data, foto_url: pub.publicUrl };
      const ins = await supabase.from("participantes").insert(payload);
      if (ins.error) throw ins.error;

      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(
        "Não foi possível enviar o cadastro. " +
          (err?.message ? `(${err.message})` : "Tente novamente em instantes.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-roge-sand">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
          <img src="/logo.png" alt="Roge Select" className="h-20 w-auto" />
          <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-roge-red/10">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-roge-red" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-roge-navy">
            Cadastro confirmado!
          </h1>
          <p className="mt-3 max-w-md text-slate-600">
            Recebemos sua confirmação de participação na{" "}
            <strong>Experiência Roge Select 2026</strong>. Nossa equipe entrará em contato com os
            próximos detalhes. Nos vemos no Kuara Hotel! 🌴
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roge-sand">
      <div className="mx-auto max-w-3xl px-4 pb-4 pt-8 sm:px-6">
        {/* Header image — mesma largura do box do formulário */}
        <div className="overflow-hidden rounded-3xl shadow-soft">
          <img
            src="/header-experiencia.png"
            alt="Experiência Roge Select 2026 — Kuara Hotel, Arraial d'Ajuda, Porto Seguro"
            className="block w-full"
          />
        </div>

        {/* Intro */}
        <div className="mt-5 rounded-3xl bg-white p-6 shadow-soft sm:p-9">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-roge-red">
            Formulário de Confirmação de Participação
          </p>
          <h1 className="mt-3 text-center font-display text-3xl font-extrabold text-roge-navy sm:text-4xl">
            ROGE SELECT 2026
          </h1>
          <p className="mt-1 text-center text-base font-medium text-slate-500">
            Experiência Premium de Premiação
          </p>
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-roge-navy/70">
            Kuara Hotel • Arraial d'Ajuda • Porto Seguro
          </p>

          <div className="mt-7 rounded-2xl bg-roge-navy px-6 py-5 text-white">
            <p className="font-display text-xl font-bold text-white">Parabéns!</p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              Você foi selecionado(a) para participar da Experiência Roge Select 2026, uma viagem
              exclusiva criada para reconhecer e premiar os principais parceiros e redes que se
              destacaram na comercialização dos produtos Procter &amp; Gamble.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Para garantir uma experiência confortável, segura e personalizada, solicitamos o
              preenchimento completo deste cadastro.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-roge-red/30 bg-roge-red/5 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-roge-red">Importante</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>• Todas as informações serão tratadas de forma confidencial e utilizadas exclusivamente para fins operacionais da viagem.</li>
              <li>• O preenchimento completo do formulário é obrigatório. Todos os campos deverão ser respondidos.</li>
              <li>• A foto do participante é obrigatória para credenciamento, identificação e organização da experiência.</li>
              <li>• As informações de saúde serão utilizadas exclusivamente para garantir o bem-estar e a segurança dos participantes.</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-roge-red bg-roge-red/10 px-5 py-4 text-sm font-medium text-roge-redDark">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 rounded-3xl bg-white p-6 shadow-soft sm:p-9">
          {/* DADOS PESSOAIS */}
          <SectionHeader>Dados Pessoais</SectionHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label="Nome Completo" value={data.nome_completo} onChange={(v) => set("nome_completo", v)} />
            <TextField className="sm:col-span-2" label="Nome exatamente como consta no documento de identificação" value={data.nome_documento} onChange={(v) => set("nome_documento", v)} />
            <TextField label="Data de Nascimento" type="date" value={data.data_nascimento} onChange={(v) => set("data_nascimento", v)} />
            <SelectField
              label="Sexo"
              value={data.sexo}
              onChange={(v) => set("sexo", v as Participante["sexo"])}
              options={["Masculino", "Feminino"]}
            />
            <TextField label="CPF" value={data.cpf} onChange={(v) => set("cpf", formatCpf(v))} placeholder="285.353.058-23" />
            <TextField label="RG" value={data.rg} onChange={(v) => set("rg", formatRg(v))} placeholder="30.853.535-9" />
            <TextField className="sm:col-span-2" label="Empresa / Rede" value={data.empresa_rede} onChange={(v) => set("empresa_rede", v)} />
            <TextField label="Cargo" value={data.cargo} onChange={(v) => set("cargo", v)} />
            <TextField label="Telefone Celular / WhatsApp" value={data.telefone} onChange={(v) => set("telefone", formatTelefone(v))} placeholder="(11) 98108-2020" />
            <TextField label="E-mail" type="email" value={data.email} onChange={(v) => set("email", v)} className="sm:col-span-2" />
            <SelectField
              label="Estado"
              value={data.estado}
              onChange={(v) => {
                set("estado", v);
                set("cidade", "");
              }}
              options={ESTADOS}
            />
            <SelectField
              label="Cidade"
              value={data.cidade}
              onChange={(v) => set("cidade", v)}
              options={cidades}
              disabled={!data.estado || loadingCidades}
              placeholder={
                !data.estado
                  ? "Selecione o estado primeiro"
                  : loadingCidades
                  ? "Carregando cidades…"
                  : "Selecione…"
              }
            />
            <ChipGroup
              className="sm:col-span-2"
              label="Documento que será utilizado para embarque"
              value={data.documento_embarque}
              onChange={(v) => set("documento_embarque", v as Participante["documento_embarque"])}
              options={[
                { value: "RG", label: "RG" },
                { value: "CNH", label: "CNH" },
              ]}
            />
            {data.documento_embarque === "CNH" && (
              <TextField
                className="sm:col-span-2"
                label="Número da CNH"
                value={data.numero_documento}
                onChange={(v) => set("numero_documento", v)}
              />
            )}
          </div>

          {/* HOSPEDAGEM E SAÚDE */}
          <SectionHeader>Informações para Hospedagem e Experiência</SectionHeader>
          <div className="grid grid-cols-1 gap-4">
            <SimNaoField label="Possui alguma restrição alimentar?" value={data.restricao_alimentar} onChange={(v) => set("restricao_alimentar", v)} detailValue={data.restricao_alimentar_qual} onDetailChange={(v) => set("restricao_alimentar_qual", v)} detailLabel="Qual?" />
            <SimNaoField label="Possui alguma alergia?" value={data.alergia} onChange={(v) => set("alergia", v)} detailValue={data.alergia_qual} onDetailChange={(v) => set("alergia_qual", v)} detailLabel="Qual?" />
            <SimNaoField label="Está realizando algum tratamento médico atualmente?" value={data.tratamento_medico} onChange={(v) => set("tratamento_medico", v)} detailValue={data.tratamento_medico_qual} onDetailChange={(v) => set("tratamento_medico_qual", v)} detailLabel="Qual?" />
            <SimNaoField label="Faz uso contínuo de medicamentos?" value={data.uso_continuo_medicamentos} onChange={(v) => set("uso_continuo_medicamentos", v)} detailValue={data.uso_continuo_medicamentos_quais} onDetailChange={(v) => set("uso_continuo_medicamentos_quais", v)} detailLabel="Quais?" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SimNaoField label="Utiliza medicação para pressão arterial?" value={data.medicacao_pressao} onChange={(v) => set("medicacao_pressao", v)} />
              <SimNaoField label="Utiliza medicação para colesterol?" value={data.medicacao_colesterol} onChange={(v) => set("medicacao_colesterol", v)} />
            </div>
            <SimNaoField label="Realizou alguma cirurgia nos últimos 12 meses?" value={data.cirurgia_12_meses} onChange={(v) => set("cirurgia_12_meses", v)} detailValue={data.cirurgia_12_meses_qual} onDetailChange={(v) => set("cirurgia_12_meses_qual", v)} detailLabel="Qual?" />
            <SimNaoField label="Possui alguma condição médica que nossa equipe deva conhecer para sua segurança e conforto durante a viagem?" value={data.condicao_medica} onChange={(v) => set("condicao_medica", v)} detailValue={data.condicao_medica_qual} onDetailChange={(v) => set("condicao_medica_qual", v)} detailLabel="Qual?" />
          </div>

          {/* KIT E BRINDES */}
          <SectionHeader>Kit e Brindes</SectionHeader>
          <div className="grid grid-cols-1 gap-5">
            <ChipGroup
              label="Tamanho da Camiseta / Polo"
              value={data.tamanho_camiseta}
              onChange={(v) => set("tamanho_camiseta", v as Participante["tamanho_camiseta"])}
              options={["P", "M", "G", "GG", "XGG"].map((s) => ({ value: s, label: s }))}
            />
            <TextField
              label="Tamanho do Calçado (Número)"
              value={data.tamanho_calcado}
              onChange={(v) => set("tamanho_calcado", v)}
              placeholder="Ex.: 40"
              hint="Informação necessária caso seja disponibilizado chinelo personalizado como brinde."
            />
          </div>

          {/* FOTO */}
          <SectionHeader>Foto do Participante</SectionHeader>
          <p className="mb-4 text-sm text-slate-600">
            Favor anexar uma foto recente e nítida para identificação, credenciamento e materiais da
            experiência. <span className="font-semibold text-roge-red">Upload obrigatório.</span>
          </p>
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-roge-navy/30 bg-roge-navy/5 p-6 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Pré-visualização" className="h-full w-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.82-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-roge-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-roge-navyDark">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
                </svg>
                {foto ? "Trocar foto" : "Selecionar foto"}
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFoto} />
              </label>
              {foto && <p className="mt-2 break-all text-xs text-slate-500">{foto.name}</p>}
            </div>
          </div>

          {/* CONTATO DE EMERGÊNCIA */}
          <SectionHeader>Contato de Emergência</SectionHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label="Nome Completo" value={data.emergencia_nome} onChange={(v) => set("emergencia_nome", v)} />
            <TextField label="Parentesco" value={data.emergencia_parentesco} onChange={(v) => set("emergencia_parentesco", v)} />
            <TextField label="Telefone Celular / WhatsApp" value={data.emergencia_telefone} onChange={(v) => set("emergencia_telefone", formatTelefone(v))} placeholder="(11) 98108-2020" />
          </div>

          {/* TERMO */}
          <SectionHeader>Termo de Confirmação</SectionHeader>
          <div className="rounded-2xl bg-roge-sand p-5 text-sm leading-relaxed text-slate-700">
            Declaro que as informações fornecidas são verdadeiras e autorizo sua utilização
            exclusivamente para fins operacionais, logísticos, de hospedagem, transporte, segurança,
            credenciamento e personalização da Experiência Roge Select 2026.
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={data.aceite_termo}
              onChange={(e) => set("aceite_termo", e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-roge-red"
            />
            <span className="text-sm font-medium text-roge-navy">
              Li e concordo com os termos acima.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-xl bg-roge-red px-4 py-4 text-base font-bold text-white shadow-soft transition hover:bg-roge-redDark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Confirmar participação"}
          </button>

          <p className="mt-6 text-center text-sm font-semibold text-roge-navy">
            ROGE SELECT 2026
          </p>
          <p className="text-center text-xs text-slate-500">
            Uma experiência exclusiva para quem faz a diferença. · Realização: Roge
          </p>
        </form>
      </div>

      <Footer />
    </div>
  );
}

export default function FormPage() {
  return (
    <LoginGate
      password="roge2026select"
      storageKey="roge_form_auth"
      subtitle={
        <h1 className="font-display text-2xl font-bold text-roge-navy">
          Confirmação de Participação
        </h1>
      }
    >
      <FormInner />
    </LoginGate>
  );
}
