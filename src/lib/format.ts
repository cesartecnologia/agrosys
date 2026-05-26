import { Timestamp } from "firebase/firestore";

export function formatChoiceLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  const labels: Record<string, string> = {
    combustivel: "Combustível",
    despesas_indiretas: "Despesas indiretas",
    despesas_publicas: "Despesas públicas",
    escritorio: "Escritório",
    insumos: "Insumos",
    manutencao: "Manutenção",
    materiais_construcao: "Materiais de construção",
    outros: "Outros",
    salarios: "Salários",
    vendas_cafe: "Vendas de café"
  };
  const normalized = labels[raw] ?? raw.replace(/_/g, " ").trim();
  if (!normalized) return "-";
  return normalized.charAt(0).toLocaleUpperCase("pt-BR") + normalized.slice(1);
}

export function parseDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate as () => Date)();
  }

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateValue(value: unknown) {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString("pt-BR") : "";
}

export function formatValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (value instanceof Timestamp) return formatDateValue(value);
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const nome = String(record.nome ?? record.peca ?? "").trim();
          const valor = Number(record.valor ?? 0);
          if (nome && Number.isFinite(valor) && valor > 0) return `${nome} (${toCurrency(valor)})`;
          return nome || JSON.stringify(record);
        }

        return String(item);
      })
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value.trim())) {
    return formatDateValue(value) || value;
  }
  return String(value);
}

export function formatPhoneValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return raw;
}

export function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
