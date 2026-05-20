"use client";

import {
  BriefcaseBusiness,
  Car,
  Combine,
  Construction,
  Edit3,
  IdCard,
  Plus,
  Phone,
  RefreshCw,
  Search,
  SprayCan,
  Tractor,
  Trash2,
  Truck,
  UserRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRecord,
  createRecordWithTankDeltas,
  invalidateCollection,
  listRecords,
  removeRecord,
  removeRecordWithTankDeltas,
  updateRecord,
  updateRecordWithTankDeltas,
  type TankBalanceDelta
} from "@/lib/firestore-service";
import { formatChoiceLabel, formatPhoneValue, formatValue, normalizeSearch } from "@/lib/format";
import type { AppRecord, ModuleConfig, ModuleKey } from "@/types/domain";
import { RecordForm } from "@/components/RecordForm";
import { useAuth } from "@/components/AuthProvider";

type Props = {
  activeKey?: ModuleKey;
  module: ModuleConfig;
  onNavigate?: (key: ModuleKey) => void;
  relatedModules?: ModuleConfig[];
};

function numericValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function tankIdFrom(record: AppRecord | null | undefined) {
  return String(record?.tanque_id ?? "").trim();
}

function vehiclePlate(record: AppRecord) {
  return String(record.placa ?? record.id ?? "").trim();
}

function vehicleDisplay(record: AppRecord) {
  const plate = vehiclePlate(record);
  const detail = [record.modelo, record.marca].map((item) => String(item ?? "").trim()).filter(Boolean).join(" - ");
  return detail ? `${plate} · ${detail}` : plate;
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

function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function vehicleIconFor(type: unknown): LucideIcon {
  const normalized = normalizedText(type);
  if (normalized.includes("trator")) return Tractor;
  if (normalized.includes("caminhao") || normalized.includes("caminhonete")) return Truck;
  if (normalized.includes("colheitadeira")) return Combine;
  if (normalized.includes("carro") || normalized.includes("veiculo")) return Car;
  if (normalized.includes("pulverizador")) return SprayCan;
  return Construction;
}

function displayableFields(module: ModuleConfig) {
  return module.fields.filter((field) => field.name !== "password");
}

function splitVehicleDisplay(value: string) {
  const [plate, detail] = value.split(" · ");
  return {
    detail: String(detail ?? "").trim(),
    plate: String(plate ?? value).trim()
  };
}

function recordTitle(record: AppRecord, module: ModuleConfig, displayValue: (field: string, value: unknown) => string) {
  if (module.key === "veiculos") {
    const name = [record.modelo, record.marca].map((item) => String(item ?? "").trim()).filter(Boolean).join(" - ");
    return name || formatChoiceLabel(record.tipo) || "Veículo";
  }

  if (module.key === "combustivel") {
    const vehicle = splitVehicleDisplay(displayValue("veiculo_id", record.veiculo_id));
    return vehicle.detail || vehicle.plate || "Abastecimento";
  }

  const preferred = ["nome", "nome_completo", "razao_social", "descricao", "placa", "numero", "talhao", "fazenda"];
  const field = preferred.find((item) => String(record[item] ?? "").trim()) ?? module.listFields[0] ?? module.fields[0]?.name;
  return field ? displayValue(field, record[field]) : "Registro";
}

function recordTitleField(record: AppRecord, module: ModuleConfig) {
  if (module.key === "veiculos") return "modelo";
  if (module.key === "combustivel") return "veiculo_id";

  const preferred = ["nome", "nome_completo", "razao_social", "descricao", "placa", "numero", "talhao", "fazenda"];
  return preferred.find((item) => String(record[item] ?? "").trim()) ?? module.listFields[0] ?? module.fields[0]?.name ?? "";
}

function recordSubtitle(record: AppRecord, module: ModuleConfig, displayValue: (field: string, value: unknown) => string) {
  if (module.key === "veiculos") {
    const plate = vehiclePlate(record);
    return plate ? `Placa: ${plate}` : "";
  }

  if (module.key === "combustivel") {
    const vehicle = splitVehicleDisplay(displayValue("veiculo_id", record.veiculo_id));
    return vehicle.plate ? `Placa: ${vehicle.plate}` : "";
  }

  const alreadyShown = new Set([recordTitleField(record, module), recordKickerField(module), recordStatusField(record)]);
  const fields = module.listFields
    .filter((field) => !alreadyShown.has(field) && String(record[field] ?? "").trim())
    .slice(0, 2);
  return fields.map((field) => displayValue(field, record[field])).filter((value) => value && value !== "-").join(" · ");
}

function recordSubtitleFields(record: AppRecord, module: ModuleConfig) {
  if (module.key === "veiculos") return ["placa"];
  if (module.key === "combustivel") return ["veiculo_id"];
  const alreadyShown = new Set([recordTitleField(record, module), recordKickerField(module), recordStatusField(record)]);
  return module.listFields.filter((field) => !alreadyShown.has(field) && String(record[field] ?? "").trim()).slice(0, 2);
}

function recordStatus(record: AppRecord, displayValue: (field: string, value: unknown) => string) {
  if (record.status === undefined && record.role === undefined) return "";
  return record.status !== undefined ? displayValue("status", record.status) : displayValue("role", record.role);
}

function recordStatusField(record: AppRecord) {
  if (record.status !== undefined) return "status";
  if (record.role !== undefined) return "role";
  return "";
}

function recordKicker(record: AppRecord, module: ModuleConfig, displayValue: (field: string, value: unknown) => string) {
  const fieldByModule: Partial<Record<ModuleKey, string>> = {
    adubacoes: "tipo_adubo",
    cheques: "banco",
    colheitas: "fazenda",
    combustivel: String(record.origem_abastecimento ?? "tanque") === "posto" ? "posto_id" : "tanque_id",
    fornecedores: "cnpj",
    funcionarios: "cargo",
    manutencoes: "tipo",
    movimentacoes_financeiras: "categoria",
    produtos: "unidade_medida",
    reabastecimentos_tanque: "tanque_id",
    tanques_combustivel: "tipo_combustivel",
    users: "email",
    veiculos: "tipo"
  };
  const field = fieldByModule[module.key];
  const value = field ? displayValue(field, record[field]) : "";
  return value && value !== "-" && value !== module.title ? value : "";
}

function recordKickerField(module: ModuleConfig) {
  const fieldByModule: Partial<Record<ModuleKey, string>> = {
    adubacoes: "tipo_adubo",
    cheques: "banco",
    colheitas: "fazenda",
    combustivel: "origem_abastecimento",
    fornecedores: "cnpj",
    funcionarios: "cargo",
    manutencoes: "tipo",
    movimentacoes_financeiras: "categoria",
    produtos: "unidade_medida",
    reabastecimentos_tanque: "tanque_id",
    tanques_combustivel: "tipo_combustivel",
    users: "email",
    veiculos: "tipo"
  };
  return fieldByModule[module.key] ?? "";
}

function getTankBalanceDeltas(moduleKey: string, next: AppRecord | null, previous?: AppRecord | null) {
  const deltas: TankBalanceDelta[] = [];
  if (moduleKey !== "combustivel" && moduleKey !== "reabastecimentos_tanque") return deltas;
  if (moduleKey === "combustivel") {
    const previousOrigin = String(previous?.origem_abastecimento ?? (previous?.tanque_id ? "tanque" : "")).trim();
    const nextOrigin = String(next?.origem_abastecimento ?? (next?.tanque_id ? "tanque" : "")).trim();
    const previousUsesTank = Boolean(previous) && previousOrigin !== "posto";
    const nextUsesTank = Boolean(next) && nextOrigin !== "posto";
    if (!previousUsesTank && !nextUsesTank) return deltas;
  }

  const direction = moduleKey === "combustivel" ? -1 : 1;
  const previousTankId =
    moduleKey === "combustivel" && String(previous?.origem_abastecimento ?? (previous?.tanque_id ? "tanque" : "")) === "posto"
      ? ""
      : tankIdFrom(previous);
  const nextTankId =
    moduleKey === "combustivel" && String(next?.origem_abastecimento ?? (next?.tanque_id ? "tanque" : "")) === "posto"
      ? ""
      : tankIdFrom(next);
  const previousLiters = numericValue(previous?.litros);
  const nextLiters = numericValue(next?.litros);

  if (previousTankId) {
    deltas.push({ tankId: previousTankId, deltaLiters: previousLiters * -direction });
  }

  if (nextTankId) {
    deltas.push({ tankId: nextTankId, deltaLiters: nextLiters * direction });
  }

  return deltas;
}

export function CrudModule({ activeKey, module, onNavigate, relatedModules = [] }: Props) {
  const { createUser } = useAuth();
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [viewing, setViewing] = useState<AppRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});
  const [tankLabels, setTankLabels] = useState<Record<string, string>>({});
  const [tankFuelTypes, setTankFuelTypes] = useState<Record<string, string>>({});
  const [stationLabels, setStationLabels] = useState<Record<string, string>>({});
  const hasVehicleReferences = useMemo(
    () =>
      module.fields.some((field) => field.type === "vehicle") ||
      module.listFields.includes("veiculo_id") ||
      module.searchFields.includes("veiculo_id"),
    [module.fields, module.listFields, module.searchFields]
  );
  const hasTankReferences = useMemo(
    () =>
      module.fields.some((field) => field.type === "tank") ||
      module.listFields.includes("tanque_id") ||
      module.searchFields.includes("tanque_id"),
    [module.fields, module.listFields, module.searchFields]
  );
  const hasStationReferences = useMemo(
    () =>
      module.fields.some((field) => field.type === "station") ||
      module.listFields.includes("posto_id") ||
      module.searchFields.includes("posto_id"),
    [module.fields, module.listFields, module.searchFields]
  );

  async function refresh(force = false) {
    if (!module.collection) return;
    setLoading(true);
    setError("");
    try {
      setRecords(await listRecords(module.collection, 100, { force }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.key]);

  useEffect(() => {
    if (!hasVehicleReferences) return;
    let active = true;

    async function loadVehicleLabels() {
      try {
        const vehicles = await listRecords("veiculos", 300);
        const labels: Record<string, string> = {};

        for (const vehicle of vehicles) {
          const display = vehicleDisplay(vehicle);
          const plate = vehiclePlate(vehicle);
          const id = String(vehicle.id ?? "").trim();
          if (plate) labels[plate] = display;
          if (id) labels[id] = display;
        }

        if (active) setVehicleLabels(labels);
      } catch {
        if (active) setVehicleLabels({});
      }
    }

    void loadVehicleLabels();

    return () => {
      active = false;
    };
  }, [hasVehicleReferences]);

  useEffect(() => {
    if (!hasTankReferences) return;
    let active = true;

    async function loadTankLabels() {
      try {
        const tanks = await listRecords("tanques_combustivel", 300);
        const labels: Record<string, string> = {};
        const fuelTypes: Record<string, string> = {};

        for (const tank of tanks) {
          const display = tankDisplay(tank);
          const id = String(tank.id ?? "").trim();
          const name = String(tank.nome ?? "").trim();
          const fuelType = String(tank.tipo_combustivel ?? "").trim();
          if (id) {
            labels[id] = display;
            if (fuelType) fuelTypes[id] = fuelType;
          }
          if (name) {
            labels[name] = display;
            if (fuelType) fuelTypes[name] = fuelType;
          }
        }

        if (active) {
          setTankLabels(labels);
          setTankFuelTypes(fuelTypes);
        }
      } catch {
        if (active) {
          setTankLabels({});
          setTankFuelTypes({});
        }
      }
    }

    void loadTankLabels();

    return () => {
      active = false;
    };
  }, [hasTankReferences]);

  useEffect(() => {
    if (!hasStationReferences) return;
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
  }, [hasStationReferences]);

  const displayValue = useCallback(
    (field: string, value: unknown) => {
      if (field === "veiculo_id") {
        const key = String(value ?? "").trim();
        return vehicleLabels[key] ?? key;
      }

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

      if (
        module.fields.find((item) => item.name === field)?.type === "select" ||
        field.startsWith("tipo_") ||
        ["role", "status"].includes(field)
      ) {
        return formatChoiceLabel(value);
      }

      return formatValue(value);
    },
    [module.fields, stationLabels, tankLabels, vehicleLabels]
  );

  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return records;
    return records.filter((record) =>
      module.searchFields.some((field) => normalizeSearch(displayValue(field, record[field])).includes(normalized))
    );
  }, [displayValue, module.searchFields, query, records]);

  async function handleSubmit(payload: AppRecord, forcedId?: string) {
    if (!module.collection) return;
    if (module.key === "users" && !editing?.id && payload.password) {
      await createUser({
        nome: String(payload.nome ?? ""),
        email: String(payload.email ?? ""),
        password: String(payload.password),
        role: String(payload.role ?? "operador") as "admin" | "operador" | "financeiro",
        fazenda_id: String(payload.fazenda_id ?? "")
      });
      invalidateCollection("users");
    } else if (module.key === "users" && !editing?.id) {
      throw new Error("Informe uma senha temporária para criar o usuário.");
    } else {
      delete payload.password;
      const isFuelStationFill = module.key === "combustivel" && payload.origem_abastecimento === "posto";
      const liters = numericValue(payload.litros);
      const literValue = numericValue(payload.valor_litro);
      const fuelStationPayload =
        isFuelStationFill && liters > 0 && literValue > 0
          ? { ...payload, valor_total: Number((liters * literValue).toFixed(2)) }
          : payload;
      const tankFuelType = !isFuelStationFill ? tankFuelTypes[tankIdFrom(fuelStationPayload)] : "";
      const nextPayload =
        (module.key === "combustivel" || module.key === "reabastecimentos_tanque") && tankFuelType
          ? { ...fuelStationPayload, tipo_combustivel: tankFuelType }
          : fuelStationPayload;

      if (editing?.id) {
        const tankDeltas = getTankBalanceDeltas(module.key, nextPayload, editing);
        if (tankDeltas.length) await updateRecordWithTankDeltas(module.collection, editing.id, nextPayload, tankDeltas);
        else await updateRecord(module.collection, editing.id, nextPayload);
      } else {
        const tankDeltas = getTankBalanceDeltas(module.key, nextPayload);
        if (tankDeltas.length) await createRecordWithTankDeltas(module.collection, nextPayload, tankDeltas, forcedId);
        else await createRecord(module.collection, nextPayload, forcedId);
      }
    }
    setEditing(null);
    setViewing(null);
    setIsCreating(false);
    if (module.collection === "empresas") window.dispatchEvent(new Event("empresa-updated"));
    await refresh(true);
  }

  async function handleRemove(record: AppRecord) {
    if (!module.collection || !record.id) return;
    const confirmed = window.confirm("Remover este registro?");
    if (!confirmed) return;
    const tankDeltas = getTankBalanceDeltas(module.key, null, record);
    if (tankDeltas.length) await removeRecordWithTankDeltas(module.collection, record.id, tankDeltas);
    else await removeRecord(module.collection, record.id);
    setViewing(null);
    if (module.collection === "empresas") window.dispatchEvent(new Event("empresa-updated"));
    await refresh(true);
  }

  const showForm = isCreating || editing;
  const moduleTitle = module.title || "cadastro";
  const fieldLabels = useMemo(
    () => Object.fromEntries(module.fields.map((field) => [field.name, field.label])),
    [module.fields]
  );
  const detailFields = useMemo(() => displayableFields(module), [module]);

  function closeForm() {
    setEditing(null);
    setIsCreating(false);
  }

  function closeDetail() {
    setViewing(null);
  }

  useEffect(() => {
    if (!showForm && !viewing) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (showForm) closeForm();
      else closeDetail();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForm, viewing]);

  return (
    <section className="module-content">
      {showForm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
            <header className="modal-header">
              <div>
                <h3 id="record-form-title">{moduleTitle}</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={closeForm}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </header>
            <RecordForm
              module={module}
              initial={editing}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </section>
        </div>
      )}

      {viewing ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <section className="modal-panel detail-panel" role="dialog" aria-modal="true" aria-labelledby="record-detail-title">
            <header className="modal-header">
              <div>
                <h3 id="record-detail-title">{recordTitle(viewing, module, displayValue)}</h3>
                {recordSubtitle(viewing, module, displayValue) ? <span>{recordSubtitle(viewing, module, displayValue)}</span> : null}
              </div>
              <button type="button" className="icon-button" onClick={closeDetail} title="Fechar">
                <X size={18} />
              </button>
            </header>

            <div className="detail-grid">
              {detailFields.map((field) => (
                <div className={field.type === "textarea" || field.type === "parts" || field.type === "tags" ? "span-2" : ""} key={field.name}>
                  <span>{field.label}</span>
                  <strong>{displayValue(field.name, viewing[field.name])}</strong>
                </div>
              ))}
            </div>

            <div className="detail-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                }}
              >
                <Edit3 size={16} />
                Editar
              </button>
              <button type="button" className="ghost-button danger" onClick={() => handleRemove(viewing)}>
                <Trash2 size={16} />
                Remover
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {relatedModules.length > 1 && onNavigate ? (
        <div className="module-subnav" aria-label="Áreas de combustível">
          {relatedModules.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeKey === item.key ? "active" : ""}
              onClick={() => onNavigate(item.key)}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar" />
        </label>
        <div className="row-actions">
          <button onClick={() => setIsCreating(true)}>
            <Plus size={18} />
            Novo
          </button>
          <button className="icon-button" onClick={() => refresh(true)} title="Atualizar">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : filtered.length ? (
        <div className="record-card-grid">
          {filtered.map((record) => {
            const VehicleIcon = module.key === "veiculos" ? vehicleIconFor(record.tipo) : null;
            const status = recordStatus(record, displayValue);
            const isInactive = normalizedText(record.status) === "inativo";
            const title = recordTitle(record, module, displayValue);
            const subtitle = recordSubtitle(record, module, displayValue);
            const kicker = recordKicker(record, module, displayValue);
            const isEmployeeCard = module.key === "funcionarios";
            const employeeRole = isEmployeeCard ? displayValue("cargo", record.cargo) : "";
            const employeeCpf = isEmployeeCard ? displayValue("cpf", record.cpf) : "";
            const employeePhone = isEmployeeCard ? displayValue("telefone", record.telefone) : "";
            const employeeHiddenFields = isEmployeeCard ? ["cpf", "cargo", "telefone", "data_admissao", "salario"] : [];
            const hiddenCardFields = new Set([
              "placa",
              recordTitleField(record, module),
              recordStatusField(record),
              recordKickerField(module),
              ...recordSubtitleFields(record, module),
              ...employeeHiddenFields,
              module.key === "combustivel" ? "veiculo_id" : ""
            ]);
            const cardFields = module.listFields
              .filter((field) => !hiddenCardFields.has(field) && displayValue(field, record[field]) !== "-")
              .slice(0, 4);

            return (
              <article
                className={`record-card${isEmployeeCard ? " employee-card" : ""}`}
                key={record.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewing(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setViewing(record);
                  }
                }}
              >
                {isEmployeeCard ? (
                  <div className="record-card-top employee-card-top">
                    <div className="record-card-icon employee-card-icon" aria-hidden="true">
                      <UserRound size={22} />
                    </div>
                  </div>
                ) : VehicleIcon || status || !isEmployeeCard ? (
                  <div className="record-card-top">
                    {VehicleIcon ? (
                      <div className="record-card-icon" aria-hidden="true">
                        <VehicleIcon size={22} />
                      </div>
                    ) : !isEmployeeCard ? (
                      <span className="record-card-module">{module.title}</span>
                    ) : null}
                    {status ? <span className={`record-card-status ${isInactive ? "inactive" : "active"}`}>{status}</span> : null}
                  </div>
                ) : null}
                <div className="record-card-main">
                  {isEmployeeCard ? (
                    <>
                      <strong>{title}</strong>
                      {employeeRole && employeeRole !== "-" ? (
                        <span className="employee-role">
                          <BriefcaseBusiness size={14} />
                          {employeeRole}
                        </span>
                      ) : null}
                      <div className="employee-card-info-grid">
                        {employeeCpf && employeeCpf !== "-" ? (
                          <small className="employee-card-info">
                            <IdCard size={14} />
                            CPF: {employeeCpf}
                          </small>
                        ) : null}
                        {employeePhone && employeePhone !== "-" ? (
                          <small className="employee-card-info">
                            <Phone size={14} />
                            {employeePhone}
                          </small>
                        ) : null}
                        {(!employeeCpf || employeeCpf === "-") && (!employeePhone || employeePhone === "-") ? (
                          <small>Clique para ver detalhes</small>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      {kicker ? <span>{kicker}</span> : null}
                      <strong>{title}</strong>
                      <small>{subtitle || "Clique para ver detalhes"}</small>
                    </>
                  )}
                </div>
                {cardFields.length ? (
                  <div className="record-card-meta">
                    {cardFields.map((field) => (
                      <div key={field}>
                        <span>{fieldLabels[field] ?? field}</span>
                        <strong>{displayValue(field, record[field])}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Nenhum registro encontrado.</div>
      )}
    </section>
  );
}
