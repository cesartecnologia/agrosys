"use client";

import { Download, Filter, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listRecords } from "@/lib/firestore-service";
import {
  formatChoiceLabel,
  formatDateValue,
  formatPhoneValue,
  formatValue,
  normalizeSearch,
  parseDateValue,
  toCurrency
} from "@/lib/format";
import { exportReportPdf } from "@/lib/report-pdf";
import type { AppRecord, ModuleConfig } from "@/types/domain";

type Props = {
  allowedModules: ModuleConfig[];
};

type Metric = {
  label: string;
  value: string;
  detail: string;
};

const REPORT_MAX_RECORDS = 1000;
const REPORT_FIELD_LABELS: Record<string, string> = {
  local_abastecimento: "Local",
  origem_abastecimento: "Origem",
  posto_id: "Posto",
  tanque_id: "Tanque",
  valor_litro: "Valor por litro",
  valor_total: "Valor total"
};
const GROUPABLE_FIELDS = new Set([
  "categoria",
  "fazenda",
  "origem_abastecimento",
  "safra",
  "status",
  "tipo",
  "tipo_adubo",
  "tipo_cafe",
  "tipo_combustivel"
]);

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asDate(value: unknown) {
  return parseDateValue(value);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function monthStartInputValue() {
  const date = new Date();
  date.setDate(1);
  return dateInputValue(date);
}

function isWithinRange(value: unknown, start: string, end: string) {
  if (!start && !end) return true;
  const date = asDate(value);
  if (!date) return false;

  const startDate = start ? new Date(`${start}T00:00:00`) : null;
  const endDate = end ? new Date(`${end}T23:59:59`) : null;

  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function sum(records: AppRecord[], field: string) {
  return records.reduce((total, record) => total + asNumber(record[field]), 0);
}

function countUnique(records: AppRecord[], field: string) {
  return new Set(records.map((record) => String(record[field] ?? "").trim()).filter(Boolean)).size;
}

function fieldLabel(module: ModuleConfig, field: string) {
  return module.fields.find((item) => item.name === field)?.label ?? REPORT_FIELD_LABELS[field] ?? field;
}

function isCurrencyField(field: string) {
  return ["valor", "valor_litro", "valor_total", "custo_total", "salario"].includes(field);
}

function fuelRecordTotal(record: AppRecord) {
  const storedTotal = asNumber(record.valor_total);
  if (storedTotal) return storedTotal;

  const liters = asNumber(record.litros);
  const price = asNumber(record.valor_litro);
  return liters && price ? liters * price : 0;
}

function fuelOrigin(record: AppRecord) {
  return String(record.origem_abastecimento ?? (record.posto_id ? "posto" : "tanque")).trim();
}

function fuelLocation(record: AppRecord, tankLabels: Record<string, string>, stationLabels: Record<string, string>) {
  if (fuelOrigin(record) === "posto") {
    const stationKey = String(record.posto_id ?? "").trim();
    return stationLabels[stationKey] ?? stationKey;
  }

  const tankKey = String(record.tanque_id ?? "").trim();
  return tankLabels[tankKey] ?? tankKey;
}

function tankDisplay(record: AppRecord) {
  const id = String(record.id ?? "").trim();
  const name = String(record.nome ?? id).trim();
  const detail = [record.tipo_combustivel, record.localizacao]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(" - ");
  return detail ? `${name} · ${detail}` : name;
}

function stationDisplay(record: AppRecord) {
  const id = String(record.id ?? "").trim();
  const name = String(record.nome ?? id).trim();
  const detail = [record.cidade, record.cnpj]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(" - ");
  return detail ? `${name} · ${detail}` : name;
}

function displayReportValue(
  module: ModuleConfig,
  field: string,
  value: unknown,
  tankLabels: Record<string, string> = {},
  stationLabels: Record<string, string> = {}
) {
  if (field === "tanque_id") {
    const key = String(value ?? "").trim();
    return tankLabels[key] ?? key;
  }

  if (field === "posto_id") {
    const key = String(value ?? "").trim();
    return stationLabels[key] ?? key;
  }

  if (field === "telefone") {
    return formatPhoneValue(value);
  }

  if (isCurrencyField(field)) {
    return toCurrency(asNumber(value));
  }

  return module.fields.find((item) => item.name === field)?.type === "select" ||
    field.startsWith("tipo_") ||
    ["origem_abastecimento", "role", "status"].includes(field)
    ? formatChoiceLabel(value)
    : formatValue(value);
}

function displayReportCell(
  module: ModuleConfig,
  field: string,
  record: AppRecord,
  tankLabels: Record<string, string> = {},
  stationLabels: Record<string, string> = {}
) {
  if (field === "local_abastecimento") {
    return fuelLocation(record, tankLabels, stationLabels) || "-";
  }

  if (field === "valor_total" && module.key === "combustivel") {
    return toCurrency(fuelRecordTotal(record));
  }

  return displayReportValue(module, field, record[field], tankLabels, stationLabels);
}

function textValue(record: AppRecord | null, field: string) {
  const value = record?.[field];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function joinFilled(values: string[]) {
  return values.filter(Boolean).join(" | ");
}

function getDateFields(module: ModuleConfig) {
  return module.fields.filter((field) => field.type === "date");
}

function getGroupFields(module: ModuleConfig) {
  return module.fields.filter(
    (field) =>
      field.type === "select" ||
      GROUPABLE_FIELDS.has(field.name) ||
      ["fazenda", "talhao", "safra", "tanque_id", "posto_id"].includes(field.name)
  );
}

function getCategoryOptions(records: AppRecord[], field: string) {
  return Array.from(new Set(records.map((record) => String(record[field] ?? "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function getTableFields(module: ModuleConfig) {
  if (module.key === "combustivel") {
    return [
      "data_abastecimento",
      "veiculo_id",
      "origem_abastecimento",
      "local_abastecimento",
      "funcionario",
      "tipo_combustivel",
      "litros",
      "valor_litro",
      "valor_total"
    ];
  }

  return module.listFields.slice(0, 8);
}

function buildMetrics(moduleKey: string, records: AppRecord[]): Metric[] {
  const total = records.length.toLocaleString("pt-BR");

  if (moduleKey === "entradas") {
    const recebidas = records.filter((record) => record.status === "recebido");
    const pendentes = records.filter((record) => record.status === "pendente");

    return [
      { label: "Entradas", value: total, detail: "lançamentos no filtro" },
      { label: "Valor", value: toCurrency(sum(records, "valor")), detail: "total das entradas" },
      { label: "Recebidas", value: toCurrency(sum(recebidas, "valor")), detail: `${recebidas.length} recebimentos` },
      { label: "Pendentes", value: toCurrency(sum(pendentes, "valor")), detail: `${pendentes.length} pendências` }
    ];
  }

  if (moduleKey === "saidas") {
    const pagas = records.filter((record) => record.status === "pago");
    const pendentes = records.filter((record) => record.status === "pendente");

    return [
      { label: "Saídas", value: total, detail: "contas no filtro" },
      { label: "Valor", value: toCurrency(sum(records, "valor")), detail: "total das despesas" },
      { label: "Pagas", value: toCurrency(sum(pagas, "valor")), detail: `${pagas.length} pagamentos` },
      { label: "Pendentes", value: toCurrency(sum(pendentes, "valor")), detail: `${pendentes.length} contas` }
    ];
  }

  if (moduleKey === "colheitas") {
    return [
      { label: "Registros", value: total, detail: "colheitas no filtro" },
      { label: "Sacas", value: `${sum(records, "quantidade_sacas").toLocaleString("pt-BR")} sc`, detail: "sacas de 60kg" },
      { label: "Litros", value: `${sum(records, "quantidade_litros").toLocaleString("pt-BR")} L`, detail: "volume informado" },
      { label: "Fazendas", value: countUnique(records, "fazenda").toLocaleString("pt-BR"), detail: "unidades com produção" }
    ];
  }

  if (moduleKey === "combustivel") {
    const litros = sum(records, "litros");
    const postoRecords = records.filter((record) => fuelOrigin(record) === "posto");
    const tanqueRecords = records.filter((record) => fuelOrigin(record) !== "posto");
    const valorPosto = postoRecords.reduce((totalValue, record) => totalValue + fuelRecordTotal(record), 0);

    return [
      { label: "Abastecimentos", value: total, detail: "lançamentos no filtro" },
      { label: "Litros", value: `${litros.toLocaleString("pt-BR")} L`, detail: "volume abastecido" },
      { label: "Via tanque", value: tanqueRecords.length.toLocaleString("pt-BR"), detail: "saídas da fazenda" },
      { label: "Via posto", value: toCurrency(valorPosto), detail: `${postoRecords.length.toLocaleString("pt-BR")} abastecimentos` }
    ];
  }

  if (moduleKey === "reabastecimentos_tanque") {
    const litros = sum(records, "litros");
    const totalValue = sum(records, "valor_total");

    return [
      { label: "Registros", value: total, detail: "movimentos no filtro" },
      { label: "Litros", value: `${litros.toLocaleString("pt-BR")} L`, detail: "volume movimentado" },
      { label: "Valor", value: toCurrency(totalValue), detail: "total informado" },
      { label: "Média", value: litros ? toCurrency(totalValue / litros) : toCurrency(0), detail: "valor por litro" }
    ];
  }

  if (moduleKey === "tanques_combustivel") {
    const capacidade = sum(records, "capacidade_litros");
    const saldo = sum(records, "saldo_atual_litros");

    return [
      { label: "Tanques", value: total, detail: "cadastros no filtro" },
      { label: "Capacidade", value: `${capacidade.toLocaleString("pt-BR")} L`, detail: "volume máximo" },
      { label: "Saldo", value: `${saldo.toLocaleString("pt-BR")} L`, detail: "disponível na fazenda" },
      { label: "Uso", value: capacidade ? `${((saldo / capacidade) * 100).toFixed(1)}%` : "0%", detail: "ocupação dos tanques" }
    ];
  }

  if (moduleKey === "postos_combustiveis") {
    return [
      { label: "Postos", value: total, detail: "cadastros no filtro" },
      { label: "Ativos", value: records.filter((record) => record.status === "ativo").length.toLocaleString("pt-BR"), detail: "disponíveis para abastecimento" },
      { label: "Cidades", value: countUnique(records, "cidade").toLocaleString("pt-BR"), detail: "locais atendidos" },
      { label: "Com telefone", value: records.filter((record) => record.telefone).length.toLocaleString("pt-BR"), detail: "contatos cadastrados" }
    ];
  }

  if (moduleKey === "manutencoes") {
    return [
      { label: "Registros", value: total, detail: "serviços no filtro" },
      { label: "Custo", value: toCurrency(sum(records, "custo_total")), detail: "total em manutenção" },
      { label: "Oficinas", value: countUnique(records, "oficina").toLocaleString("pt-BR"), detail: "prestadores envolvidos" },
      { label: "Veículos", value: countUnique(records, "veiculo_id").toLocaleString("pt-BR"), detail: "máquinas atendidas" }
    ];
  }

  if (moduleKey === "adubacoes") {
    return [
      { label: "Registros", value: total, detail: "aplicações no filtro" },
      { label: "Quantidade", value: sum(records, "quantidade_aplicada").toLocaleString("pt-BR"), detail: "soma aplicada" },
      { label: "Fazendas", value: countUnique(records, "fazenda").toLocaleString("pt-BR"), detail: "unidades atendidas" },
      { label: "Talhões", value: countUnique(records, "talhao").toLocaleString("pt-BR"), detail: "áreas tratadas" }
    ];
  }

  if (moduleKey === "cheques") {
    return [
      { label: "Cheques", value: total, detail: "registros no filtro" },
      { label: "Valor", value: toCurrency(sum(records, "valor")), detail: "total em cheques" },
      { label: "A compensar", value: records.filter((record) => record.status === "a_compensar").length.toLocaleString("pt-BR"), detail: "aguardando baixa" },
      { label: "Bancos", value: countUnique(records, "banco").toLocaleString("pt-BR"), detail: "instituições envolvidas" }
    ];
  }

  if (moduleKey === "funcionarios") {
    return [
      { label: "Funcionários", value: total, detail: "cadastros no filtro" },
      { label: "Salários", value: toCurrency(sum(records, "salario")), detail: "soma dos salários" },
      { label: "Cargos", value: countUnique(records, "cargo").toLocaleString("pt-BR"), detail: "funções cadastradas" },
      { label: "Com e-mail", value: records.filter((record) => record.email).length.toLocaleString("pt-BR"), detail: "contatos completos" }
    ];
  }

  return [
    { label: "Registros", value: total, detail: "itens no filtro" },
    { label: "Campos", value: records.length ? Object.keys(records[0]).length.toLocaleString("pt-BR") : "0", detail: "estrutura do relatório" },
    { label: "Atualizados", value: records.filter((record) => record.updatedAt).length.toLocaleString("pt-BR"), detail: "com data de atualização" },
    { label: "Criados", value: records.filter((record) => record.createdAt).length.toLocaleString("pt-BR"), detail: "com data de cadastro" }
  ];
}

export function Reports({ allowedModules }: Props) {
  const reportModules = useMemo(
    () => allowedModules.filter((module) => module.collection && module.key !== "empresa"),
    [allowedModules]
  );
  const firstModule = reportModules[0];
  const [selectedKey, setSelectedKey] = useState<ModuleConfig["key"]>(firstModule?.key ?? "funcionarios");
  const selectedModule = useMemo(
    () => reportModules.find((module) => module.key === selectedKey) ?? reportModules[0],
    [reportModules, selectedKey]
  );
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(monthStartInputValue);
  const [endDate, setEndDate] = useState(todayInputValue);
  const [dateField, setDateField] = useState(firstModule ? getDateFields(firstModule)[0]?.name ?? "" : "");
  const [categoryField, setCategoryField] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [company, setCompany] = useState<AppRecord | null>(null);
  const [printIssuedAt, setPrintIssuedAt] = useState("");
  const [tankLabels, setTankLabels] = useState<Record<string, string>>({});
  const [stationLabels, setStationLabels] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!showFilters) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowFilters(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFilters]);

  const dateFields = useMemo(() => (selectedModule ? getDateFields(selectedModule) : []), [selectedModule]);
  const groupFields = useMemo(() => (selectedModule ? getGroupFields(selectedModule) : []), [selectedModule]);
  const selectedModuleHasTanks = useMemo(
    () =>
      Boolean(
        selectedModule &&
          (selectedModule.fields.some((field) => field.type === "tank") ||
            selectedModule.listFields.includes("tanque_id") ||
            selectedModule.searchFields.includes("tanque_id"))
      ),
    [selectedModule]
  );
  const selectedModuleHasStations = useMemo(
    () =>
      Boolean(
        selectedModule &&
          (selectedModule.fields.some((field) => field.type === "station") ||
            selectedModule.listFields.includes("posto_id") ||
            selectedModule.searchFields.includes("posto_id"))
      ),
    [selectedModule]
  );

  useEffect(() => {
    let active = true;

    async function loadCompany(force = false) {
      try {
        const [companyRecord] = await listRecords("empresas", 1, force ? { force: true } : undefined);
        if (active) setCompany(companyRecord ?? null);
      } catch {
        if (active) setCompany(null);
      }
    }

    const handleCompanyUpdate = () => {
      void loadCompany(true);
    };

    void loadCompany();
    window.addEventListener("empresa-updated", handleCompanyUpdate);

    return () => {
      active = false;
      window.removeEventListener("empresa-updated", handleCompanyUpdate);
    };
  }, []);

  useEffect(() => {
    if (!selectedModuleHasTanks) {
      return;
    }

    let active = true;

    async function loadTankLabels() {
      try {
        const tanks = await listRecords("tanques_combustivel", 300);
        const labels: Record<string, string> = {};

        for (const tank of tanks) {
          const display = tankDisplay(tank);
          const id = String(tank.id ?? "").trim();
          const name = String(tank.nome ?? "").trim();
          if (id) labels[id] = display;
          if (name) labels[name] = display;
        }

        if (active) setTankLabels(labels);
      } catch {
        if (active) setTankLabels({});
      }
    }

    void loadTankLabels();

    return () => {
      active = false;
    };
  }, [selectedModuleHasTanks]);

  useEffect(() => {
    if (!selectedModuleHasStations) {
      return;
    }

    let active = true;

    async function loadStationLabels() {
      try {
        const stations = await listRecords("postos_combustiveis", 300);
        const labels: Record<string, string> = {};

        for (const station of stations) {
          const display = stationDisplay(station);
          const id = String(station.id ?? "").trim();
          const name = String(station.nome ?? "").trim();
          if (id) labels[id] = display;
          if (name) labels[name] = display;
        }

        if (active) setStationLabels(labels);
      } catch {
        if (active) setStationLabels({});
      }
    }

    void loadStationLabels();

    return () => {
      active = false;
    };
  }, [selectedModuleHasStations]);

  useEffect(() => {
    if (!selectedModule?.collection) return;
    let active = true;

    async function load() {
      if (!selectedModule?.collection) return;
      setLoading(true);
      setError("");

      try {
        const nextRecords = await listRecords(selectedModule.collection, REPORT_MAX_RECORDS);
        if (active) setRecords(nextRecords);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o relatório.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [selectedModule]);

  const categoryOptions = useMemo(
    () => {
      if (!categoryField) return [];
      const scopedRecords = selectedModule?.fixedValues
        ? records.filter((record) =>
            Object.entries(selectedModule.fixedValues ?? {}).every(
              ([field, value]) => String(record[field] ?? "") === value
            )
          )
        : records;
      return getCategoryOptions(scopedRecords, categoryField);
    },
    [categoryField, records, selectedModule]
  );

  const filteredRecords = useMemo(() => {
    if (!selectedModule) return [];
    const normalized = normalizeSearch(search);

    return records.filter((record) => {
      if (
        selectedModule.fixedValues &&
        !Object.entries(selectedModule.fixedValues).every(([field, value]) => String(record[field] ?? "") === value)
      ) {
        return false;
      }
      if (dateField && !isWithinRange(record[dateField], startDate, endDate)) return false;
      if (categoryField && categoryValue && String(record[categoryField] ?? "") !== categoryValue) return false;
      if (!normalized) return true;

      const searchableFields = new Set([...selectedModule.searchFields, ...selectedModule.listFields]);
      return Array.from(searchableFields).some((field) =>
        normalizeSearch(displayReportValue(selectedModule, field, record[field], tankLabels, stationLabels)).includes(normalized)
      );
    });
  }, [categoryField, categoryValue, dateField, endDate, records, search, selectedModule, startDate, stationLabels, tankLabels]);

  const metrics = useMemo(
    () => (selectedModule ? buildMetrics(selectedModule.key, filteredRecords) : []),
    [filteredRecords, selectedModule]
  );

  const tableFields = useMemo(() => (selectedModule ? getTableFields(selectedModule) : []), [selectedModule]);
  const reportPeriodLabel = selectedModule
    ? dateField
      ? `${fieldLabel(selectedModule, dateField)}: ${formatDateValue(startDate) || "início"} até ${formatDateValue(endDate) || "hoje"}`
      : "Sem filtro de período"
    : "";
  const reportFilterLabel =
    selectedModule && categoryField && categoryValue
      ? `${fieldLabel(selectedModule, categoryField)}: ${displayReportValue(selectedModule, categoryField, categoryValue, tankLabels, stationLabels)}`
      : "Todos os registros";
  const companyName = textValue(company, "nome") || textValue(company, "razao_social") || "Dados da empresa não cadastrados";
  const companyLegalName = textValue(company, "razao_social");
  const companyHeaderDetails = joinFilled([
    textValue(company, "documento") ? `Documento: ${textValue(company, "documento")}` : "",
    textValue(company, "inscricao_estadual") ? `IE: ${textValue(company, "inscricao_estadual")}` : "",
    textValue(company, "telefone") ? `Telefone: ${formatPhoneValue(textValue(company, "telefone"))}` : "",
    textValue(company, "email") ? `E-mail: ${textValue(company, "email")}` : ""
  ]);
  const companySecondaryDetails = joinFilled([
    textValue(company, "responsavel") ? `Responsável: ${textValue(company, "responsavel")}` : "",
    textValue(company, "endereco") ? `Endereço: ${textValue(company, "endereco")}` : ""
  ]);

  async function refresh() {
    if (!selectedModule?.collection) return;
    setLoading(true);
    setError("");

    try {
      setRecords(await listRecords(selectedModule.collection, REPORT_MAX_RECORDS, { force: true }));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Não foi possível atualizar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  function changeModule(key: ModuleConfig["key"]) {
    const nextModule = reportModules.find((module) => module.key === key);
    setSelectedKey(key);
    setDateField(nextModule ? getDateFields(nextModule)[0]?.name ?? "" : "");
    setCategoryField("");
    setCategoryValue("");
    setSearch("");
  }

  function clearFilters() {
    setDateField("");
    setStartDate("");
    setEndDate("");
    setCategoryField("");
    setCategoryValue("");
    setSearch("");
  }

  async function exportPdf() {
    if (!selectedModule) return;
    const issuedAt = new Date().toLocaleString("pt-BR");
    setPrintIssuedAt(issuedAt);

    try {
      await exportReportPdf({
        company: {
          details: companyHeaderDetails,
          legalName: companyLegalName,
          name: companyName,
          secondaryDetails: companySecondaryDetails
        },
        filterLabel: reportFilterLabel,
        issuedAt,
        metrics,
        moduleTitle: selectedModule.title,
        periodLabel: reportPeriodLabel,
        tableHeaders: tableFields.map((field) => fieldLabel(selectedModule, field)),
        tableRows: filteredRecords.map((record) =>
          tableFields.map((field) => displayReportCell(selectedModule, field, record, tankLabels, stationLabels))
        )
      });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Não foi possível gerar o PDF.");
    }
  }

  if (!selectedModule) {
    return <section className="module-content">Nenhum relatório disponível para este perfil.</section>;
  }

  return (
    <section className="module-content report-page">
      <section className="report-print-header" aria-label="Cabeçalho do relatório exportado">
        <div className="report-print-company">
          <strong>{companyName}</strong>
          {companyLegalName && companyLegalName !== companyName ? <span>{companyLegalName}</span> : null}
          <small>{companyHeaderDetails || "Complete os dados da empresa no cadastro."}</small>
          {companySecondaryDetails ? <small>{companySecondaryDetails}</small> : null}
        </div>
        <div className="report-print-document">
          <span>Relatório</span>
          <strong>{selectedModule.title}</strong>
          <small>{reportPeriodLabel}</small>
          <small>{reportFilterLabel}</small>
          <small>Emitido em {printIssuedAt || new Date().toLocaleString("pt-BR")}</small>
        </div>
      </section>

      <div className="report-actions report-actions-top">
        <button className="ghost-button" onClick={() => setShowFilters(true)}>
          <Filter size={18} />
          Filtros
        </button>
        <button className="ghost-button" onClick={refresh} disabled={loading}>
          <RefreshCw size={18} />
          Atualizar
        </button>
        <button onClick={exportPdf}>
          <Download size={18} />
          Exportar PDF
        </button>
      </div>

      <section className="report-filter-summary" aria-label="Filtros ativos">
        <strong>{selectedModule.title}</strong>
        <span>{reportPeriodLabel}</span>
        <span>{reportFilterLabel}</span>
        {search ? <span>Busca: {search}</span> : null}
      </section>

      {showFilters ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowFilters(false);
          }}
        >
          <section className="modal-panel report-filter-panel" role="dialog" aria-modal="true" aria-labelledby="report-filter-title">
            <header className="modal-header">
              <div>
                <h3 id="report-filter-title">Filtros</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowFilters(false)} title="Fechar">
                <X size={18} />
              </button>
            </header>

            <section className="report-filters report-filters-modal" aria-label="Filtros do relatório">
              <label>
                Módulo
                <select value={selectedModule.key} onChange={(event) => changeModule(event.target.value as ModuleConfig["key"])}>
                  {reportModules.map((module) => (
                    <option key={module.key} value={module.key}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Campo de data
                <select value={dateField} onChange={(event) => setDateField(event.target.value)}>
                  <option value="">Sem período</option>
                  {dateFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Data inicial
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!dateField} />
              </label>

              <label>
                Data final
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={!dateField} />
              </label>

              <label>
                Filtro
                <select
                  value={categoryField}
                  onChange={(event) => {
                    setCategoryField(event.target.value);
                    setCategoryValue("");
                  }}
                >
                  <option value="">Todos</option>
                  {groupFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Valor
                <select value={categoryValue} onChange={(event) => setCategoryValue(event.target.value)} disabled={!categoryField}>
                  <option value="">Todos</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {categoryField === "tanque_id"
                        ? tankLabels[option] ?? option
                        : categoryField === "posto_id"
                          ? stationLabels[option] ?? option
                          : formatChoiceLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="report-search span-2">
                Busca
                <span className="search-box">
                  <Search size={18} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar no relatório" />
                </span>
              </label>
            </section>

            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={clearFilters}>
                Limpar
              </button>
              <button type="button" onClick={() => setShowFilters(false)}>
                Aplicar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {error && <div className="alert">{error}</div>}

      <section className="report-summary" aria-label="Resumo do relatório">
        {metrics.map((metric) => (
          <article className="report-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="report-result-heading">
        <div>
          <Filter size={18} />
          <strong>{filteredRecords.length.toLocaleString("pt-BR")} registros</strong>
        </div>
        <span>{reportPeriodLabel}</span>
      </section>

      <div className="table-wrap report-table">
        <table>
          <thead>
            <tr>
              {tableFields.map((field) => (
                <th key={field}>{fieldLabel(selectedModule, field)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={tableFields.length}>Carregando...</td>
              </tr>
            ) : filteredRecords.length ? (
              filteredRecords.map((record) => (
                <tr key={record.id}>
                  {tableFields.map((field) => (
                    <td key={field}>{displayReportCell(selectedModule, field, record, tankLabels, stationLabels)}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tableFields.length}>Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
