export default function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer
      className={
        "flex flex-col items-center gap-3 px-4 py-8 text-center " +
        (dark ? "text-white/70" : "text-slate-500")
      }
    >
      <p className="text-xs font-medium tracking-wide">
        Desenvolvido por Akkari Tecnologia | Front 360
      </p>
    </footer>
  );
}
