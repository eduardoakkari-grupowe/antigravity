import type { ReactNode } from "react";
import type { SimNao } from "../lib/types";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="section-title mt-10 mb-5">
      <span className="text-roge-red">●</span>
      <span>{children}</span>
      <span className="section-rule" />
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  hint?: string;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
  className = "",
  hint,
}: TextFieldProps) {
  return (
    <div className={className}>
      <label className="field-label">
        {label} {required && <span className="text-roge-red">*</span>}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required = true,
  className = "",
  disabled = false,
  placeholder = "Selecione…",
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="field-label">
        {label} {required && <span className="text-roge-red">*</span>}
      </label>
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ChipGroupProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}

export function ChipGroup({
  label,
  value,
  onChange,
  options,
  required = true,
  className = "",
}: ChipGroupProps) {
  return (
    <div className={className}>
      <label className="field-label">
        {label} {required && <span className="text-roge-red">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              className={
                "chip " +
                (active
                  ? "border-roge-navy bg-roge-navy text-white shadow-soft"
                  : "border-slate-300 bg-white text-slate-600 hover:border-roge-navy/50")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SimNaoFieldProps {
  label: string;
  value: SimNao;
  onChange: (v: SimNao) => void;
  detailValue?: string;
  onDetailChange?: (v: string) => void;
  detailLabel?: string; // e.g. "Qual?" / "Quais?"
  className?: string;
}

export function SimNaoField({
  label,
  value,
  onChange,
  detailValue,
  onDetailChange,
  detailLabel,
  className = "",
}: SimNaoFieldProps) {
  const opts: { value: SimNao; label: string }[] = [
    { value: "nao", label: "Não" },
    { value: "sim", label: "Sim" },
  ];
  return (
    <div className={"rounded-2xl border border-slate-200 bg-white/60 p-4 " + className}>
      <label className="field-label">
        {label} <span className="text-roge-red">*</span>
      </label>
      <div className="flex gap-2">
        {opts.map((o) => {
          const active = value === o.value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              className={
                "chip " +
                (active
                  ? o.value === "sim"
                    ? "border-roge-red bg-roge-red text-white"
                    : "border-roge-navy bg-roge-navy text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-roge-navy/50")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {value === "sim" && detailLabel && onDetailChange && (
        <div className="mt-3">
          <label className="field-label">{detailLabel}</label>
          <input
            type="text"
            value={detailValue}
            required
            onChange={(e) => onDetailChange(e.target.value)}
            className="field-input"
            placeholder="Descreva…"
          />
        </div>
      )}
    </div>
  );
}
