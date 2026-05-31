import { useState, type ReactNode } from "react";

interface LoginGateProps {
  password: string;
  storageKey: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

export default function LoginGate({ password, storageKey, subtitle, children }: LoginGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(storageKey) === "1"
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === password) {
      sessionStorage.setItem(storageKey, "1");
      setUnlocked(true);
    } else {
      setError(true);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-roge-navy px-4">
      {/* Decorative brand shapes */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-roge-red/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-3xl bg-white p-8 shadow-soft sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Roge Select" className="mb-6 h-20 w-auto object-contain" />
          {subtitle}
          <p className="mt-2 text-sm text-slate-500">
            Informe a senha de acesso para continuar.
          </p>
        </div>

        <div className="mt-7">
          <label htmlFor="senha" className="field-label">
            Senha de acesso
          </label>
          <input
            id="senha"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            className="field-input text-center tracking-widest"
            placeholder="••••••••"
          />
          {error && (
            <p className="mt-2 text-sm font-medium text-roge-red">
              Senha incorreta. Tente novamente.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-roge-red px-4 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-roge-redDark active:scale-[0.99]"
        >
          Entrar
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          ROGE SELECT 2026 · Experiência Premium de Premiação
        </p>
      </form>
    </div>
  );
}
