"use client";

import { Plus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { listRecords } from "@/lib/firestore-service";
import { formatChoiceLabel } from "@/lib/format";
import type { AppRecord, FormField, ModuleConfig } from "@/types/domain";

type Props = {
  module: ModuleConfig;
  initial?: AppRecord | null;
  onSubmit: (record: AppRecord, forcedId?: string) => Promise<void>;
  onCancel: () => void;
};

type PartItem = {
  nome: string;
  valor: string;
};

function initialValue(field: FormField, initial?: AppRecord | null) {
  const value = initial?.[field.name];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  return String(value ?? field.defaultValue ?? "");
}

function cleanText(value: string, field: FormField) {
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  const limit = field.type === "textarea" ? 3000 : 180;

  if (cleaned.length > limit) {
    throw new Error(`${field.label} ultrapassa o limite de ${limit} caracteres.`);
  }

  return cleaned;
}

function parseNumber(value: string, field: FormField) {
  const normalized = value.replace(",", ".");
  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    throw new Error(`${field.label} precisa ser um número válido.`);
  }

  if (number < 0) {
    throw new Error(`${field.label} não pode ser negativo.`);
  }

  return number;
}

function parseTags(value: string, field: FormField) {
  const items = value
    .split(",")
    .map((item) => cleanText(item, { ...field, type: "text" }))
    .filter(Boolean);

  if (items.length > 50) {
    throw new Error(`${field.label} aceita no máximo 50 itens.`);
  }

  return items;
}

function tagItemsFromValue(value: string) {
  const items = value.split(",").map((item) => item.trim());
  return items.some(Boolean) ? items : [""];
}

function partItemsFromValue(value: unknown): PartItem[] {
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return {
          nome: String(record.nome ?? record.peca ?? "").trim(),
          valor: record.valor === undefined || record.valor === null ? "" : String(record.valor)
        };
      }

      return { nome: String(item ?? "").trim(), valor: "" };
    });

    return items.some((item) => item.nome || item.valor) ? items : [{ nome: "", valor: "" }];
  }

  const items = String(value ?? "")
    .split(",")
    .map((item) => ({ nome: item.trim(), valor: "" }));

  return items.some((item) => item.nome) ? items : [{ nome: "", valor: "" }];
}

function parseParts(items: PartItem[], field: FormField) {
  const filled = items.filter((item) => item.nome.trim() || item.valor.trim());

  if (filled.length > 50) {
    throw new Error(`${field.label} aceita no máximo 50 itens.`);
  }

  return filled.map((item) => {
    const nome = cleanText(item.nome, { ...field, type: "text" });
    if (!nome) throw new Error("Informe o nome da peça.");
    if (!item.valor.trim()) throw new Error("Informe o valor da peça.");

    return {
      nome,
      valor: parseNumber(item.valor, { ...field, label: "Valor da peça", type: "number" })
    };
  });
}

function vehiclePlate(record: AppRecord) {
  return String(record.placa ?? record.id ?? "").trim();
}

function vehicleDetail(record: AppRecord) {
  return [record.tipo, record.modelo, record.marca].map((item) => String(item ?? "").trim()).filter(Boolean).join(" - ");
}

function tankName(record: AppRecord) {
  return String(record.nome ?? "").trim();
}

function tankDetail(record: AppRecord) {
  return [record.tipo_combustivel, record.localizacao].map((item) => String(item ?? "").trim()).filter(Boolean).join(" - ");
}

function stationName(record: AppRecord) {
  return String(record.nome ?? "").trim();
}

function stationDetail(record: AppRecord) {
  return [record.cidade, record.cnpj].map((item) => String(item ?? "").trim()).filter(Boolean).join(" - ");
}

function parseVehicle(value: string, field: FormField, vehicles: AppRecord[]) {
  const cleaned = cleanText(value, field);
  const normalized = cleaned.toLocaleLowerCase("pt-BR");
  const match = vehicles.find((vehicle) => {
    const plate = vehiclePlate(vehicle).toLocaleLowerCase("pt-BR");
    const id = String(vehicle.id ?? "").toLocaleLowerCase("pt-BR");
    return plate === normalized || id === normalized;
  });

  if (!match) {
    throw new Error(`${field.label} deve ser selecionado no cadastro de veículos.`);
  }

  return vehiclePlate(match);
}

function parseTank(value: string, field: FormField, tanks: AppRecord[]) {
  const cleaned = cleanText(value, field);
  const normalized = cleaned.toLocaleLowerCase("pt-BR");
  const match = tanks.find((tank) => {
    const name = tankName(tank).toLocaleLowerCase("pt-BR");
    const id = String(tank.id ?? "").toLocaleLowerCase("pt-BR");
    return name === normalized || id === normalized;
  });

  if (!match?.id) {
    throw new Error(`${field.label} deve ser selecionado no cadastro de tanques.`);
  }

  return String(match.id);
}

function parseStation(value: string, field: FormField, stations: AppRecord[]) {
  const cleaned = cleanText(value, field);
  const normalized = cleaned.toLocaleLowerCase("pt-BR");
  const match = stations.find((station) => {
    const name = stationName(station).toLocaleLowerCase("pt-BR");
    const id = String(station.id ?? "").toLocaleLowerCase("pt-BR");
    return name === normalized || id === normalized;
  });

  if (!match?.id) {
    throw new Error(`${field.label} deve ser selecionado no cadastro de postos.`);
  }

  return String(match.id);
}

function fieldIsVisible(field: FormField, values: Record<string, string>) {
  if (field.visibleWhen && values[field.visibleWhen.field] !== field.visibleWhen.value) return false;
  return field.visibleWhenAll?.every((condition) => values[condition.field] === condition.value) ?? true;
}

function fieldIsRequired(field: FormField, values: Record<string, string>) {
  const requiredBySingleCondition = field.requiredWhen && values[field.requiredWhen.field] === field.requiredWhen.value;
  const requiredByAllConditions =
    field.requiredWhenAll?.every((condition) => values[condition.field] === condition.value) ?? false;
  return Boolean(field.required || requiredBySingleCondition || requiredByAllConditions);
}

export function RecordForm({ module, initial, onSubmit, onCancel }: Props) {
  const defaults = useMemo(
    () => Object.fromEntries(module.fields.map((field) => [field.name, initialValue(field, initial)])),
    [initial, module.fields]
  );
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [partsValues, setPartsValues] = useState<Record<string, PartItem[]>>(() =>
    Object.fromEntries(
      module.fields
        .filter((field) => field.type === "parts")
        .map((field) => [field.name, partItemsFromValue(initial?.[field.name])])
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<AppRecord[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [tanks, setTanks] = useState<AppRecord[]>([]);
  const [tanksLoading, setTanksLoading] = useState(false);
  const [stations, setStations] = useState<AppRecord[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const needsVehicleSearch = useMemo(() => module.fields.some((field) => field.type === "vehicle"), [module.fields]);
  const needsTankSearch = useMemo(() => module.fields.some((field) => field.type === "tank"), [module.fields]);
  const needsStationSearch = useMemo(() => module.fields.some((field) => field.type === "station"), [module.fields]);

  useEffect(() => {
    if (!needsVehicleSearch) return;
    let active = true;

    async function loadVehicles() {
      setVehiclesLoading(true);
      try {
        const nextVehicles = await listRecords("veiculos", 300);
        if (active) setVehicles(nextVehicles);
      } catch {
        if (active) setVehicles([]);
      } finally {
        if (active) setVehiclesLoading(false);
      }
    }

    void loadVehicles();

    return () => {
      active = false;
    };
  }, [needsVehicleSearch]);

  useEffect(() => {
    if (!needsTankSearch) return;
    let active = true;

    async function loadTanks() {
      setTanksLoading(true);
      try {
        const nextTanks = await listRecords("tanques_combustivel", 300);
        if (active) setTanks(nextTanks);
      } catch {
        if (active) setTanks([]);
      } finally {
        if (active) setTanksLoading(false);
      }
    }

    void loadTanks();

    return () => {
      active = false;
    };
  }, [needsTankSearch]);

  useEffect(() => {
    if (!needsStationSearch) return;
    let active = true;

    async function loadStations() {
      setStationsLoading(true);
      try {
        const nextStations = await listRecords("postos_combustiveis", 300);
        if (active) setStations(nextStations);
      } catch {
        if (active) setStations([]);
      } finally {
        if (active) setStationsLoading(false);
      }
    }

    void loadStations();

    return () => {
      active = false;
    };
  }, [needsStationSearch]);

  const vehicleOptions = useMemo(
    () =>
      vehicles
        .map((vehicle) => ({
          detail: vehicleDetail(vehicle),
          id: String(vehicle.id ?? ""),
          plate: vehiclePlate(vehicle)
        }))
        .filter((vehicle) => vehicle.plate)
        .sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR")),
    [vehicles]
  );

  const tankOptions = useMemo(
    () =>
      tanks
        .map((tank) => {
          const id = String(tank.id ?? "").trim();
          const name = tankName(tank);
          const detail = tankDetail(tank);
          return name ? { key: id || name, label: detail, value: name } : null;
        })
        .filter((option): option is { key: string; label: string; value: string } => Boolean(option?.value))
        .sort((a, b) => a.value.localeCompare(b.value, "pt-BR")),
    [tanks]
  );

  const stationOptions = useMemo(
    () =>
      stations
        .map((station) => {
          const id = String(station.id ?? "").trim();
          const name = stationName(station);
          const detail = stationDetail(station);
          return name ? { key: id || name, label: detail, value: name } : null;
        })
        .filter((option): option is { key: string; label: string; value: string } => Boolean(option?.value))
        .sort((a, b) => a.value.localeCompare(b.value, "pt-BR")),
    [stations]
  );

  function setValue(name: string, value: string) {
    setValues((current) => {
      const next = { ...current, [name]: value };

      return next;
    });
  }

  function selectOptions(field: FormField) {
    return field.options ?? [];
  }

  function tankInputValue(name: string) {
    const value = String(values[name] ?? "").trim();
    const tank = tanks.find((item) => String(item.id ?? "").trim() === value);
    return tank ? tankName(tank) || value : value;
  }

  function stationInputValue(name: string) {
    const value = String(values[name] ?? "").trim();
    const station = stations.find((item) => String(item.id ?? "").trim() === value);
    return station ? stationName(station) || value : value;
  }

  function setTagItems(name: string, items: string[]) {
    setValue(name, items.join(", "));
  }

  function updateTagItem(name: string, index: number, nextValue: string) {
    const items = tagItemsFromValue(values[name] ?? "");
    items[index] = nextValue;
    setTagItems(name, items);
  }

  function addTagItem(name: string) {
    setTagItems(name, [...tagItemsFromValue(values[name] ?? ""), ""]);
  }

  function removeTagItem(name: string, index: number) {
    const items = tagItemsFromValue(values[name] ?? "").filter((_, itemIndex) => itemIndex !== index);
    setTagItems(name, items.length ? items : [""]);
  }

  function updatePartItem(name: string, index: number, key: keyof PartItem, nextValue: string) {
    setPartsValues((current) => {
      const items = current[name] ?? [{ nome: "", valor: "" }];
      return {
        ...current,
        [name]: items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: nextValue } : item))
      };
    });
  }

  function addPartItem(name: string) {
    setPartsValues((current) => ({
      ...current,
      [name]: [...(current[name] ?? [{ nome: "", valor: "" }]), { nome: "", valor: "" }]
    }));
  }

  function removePartItem(name: string, index: number) {
    setPartsValues((current) => {
      const items = (current[name] ?? [{ nome: "", valor: "" }]).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        [name]: items.length ? items : [{ nome: "", valor: "" }]
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload: AppRecord = {};

      for (const field of module.fields) {
        if (!fieldIsVisible(field, values)) continue;

        if (field.type === "parts") {
          const parts = parseParts(partsValues[field.name] ?? [{ nome: "", valor: "" }], field);
          if (fieldIsRequired(field, values) && !parts.length) throw new Error(`Preencha o campo ${field.label}.`);
          if (parts.length) payload[field.name] = parts;
          continue;
        }

        const value = values[field.name]?.trim() ?? "";
        if (fieldIsRequired(field, values) && !value) throw new Error(`Preencha o campo ${field.label}.`);
        if (!value) continue;

        if (field.type === "number") payload[field.name] = parseNumber(value, field);
        else if (field.type === "vehicle") payload[field.name] = parseVehicle(value, field, vehicles);
        else if (field.type === "tank") payload[field.name] = parseTank(value, field, tanks);
        else if (field.type === "station") payload[field.name] = parseStation(value, field, stations);
        else if (field.type === "tags" || field.type === "multiselect") {
          payload[field.name] = parseTags(value, field);
        } else payload[field.name] = cleanText(value, field);
      }

      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        {module.fields.filter((field) => fieldIsVisible(field, values)).map((field) => (
          <label
            key={field.name}
            className={field.type === "textarea" || field.type === "tags" || field.type === "parts" ? "span-2" : ""}
          >
            {field.label}
            {field.type === "select" ? (
              <select
                value={values[field.name] ?? ""}
                onChange={(event) => setValue(field.name, event.target.value)}
                required={fieldIsRequired(field, values)}
              >
                <option value="">Selecione</option>
                {selectOptions(field).map((option) => (
                  <option value={option} key={option}>
                    {formatChoiceLabel(option)}
                  </option>
                ))}
              </select>
            ) : field.type === "vehicle" ? (
              <>
                <input
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValue(field.name, event.target.value)}
                  required={fieldIsRequired(field, values)}
                  placeholder={vehiclesLoading ? "Carregando..." : "Placa"}
                  list={`${module.key}-${field.name}-vehicles`}
                  autoComplete="off"
                />
                <datalist id={`${module.key}-${field.name}-vehicles`}>
                  {vehicleOptions.map((vehicle) => (
                    <option value={vehicle.plate} key={vehicle.id || vehicle.plate}>
                      {vehicle.detail || vehicle.plate}
                    </option>
                  ))}
                </datalist>
              </>
            ) : field.type === "tank" ? (
              <>
                <input
                  value={tankInputValue(field.name)}
                  onChange={(event) => setValue(field.name, event.target.value)}
                  required={fieldIsRequired(field, values)}
                  placeholder={tanksLoading ? "Carregando..." : "Nome do tanque"}
                  list={`${module.key}-${field.name}-tanks`}
                  autoComplete="off"
                />
                <datalist id={`${module.key}-${field.name}-tanks`}>
                  {tankOptions.map((tank) => (
                    <option value={tank.value} key={tank.key}>
                      {tank.label || tank.value}
                    </option>
                  ))}
                </datalist>
              </>
            ) : field.type === "station" ? (
              <>
                <input
                  value={stationInputValue(field.name)}
                  onChange={(event) => setValue(field.name, event.target.value)}
                  required={fieldIsRequired(field, values)}
                  placeholder={stationsLoading ? "Carregando..." : "Nome do posto"}
                  list={`${module.key}-${field.name}-stations`}
                  autoComplete="off"
                />
                <datalist id={`${module.key}-${field.name}-stations`}>
                  {stationOptions.map((station) => (
                    <option value={station.value} key={station.key}>
                      {station.label || station.value}
                    </option>
                  ))}
                </datalist>
              </>
            ) : field.type === "tags" ? (
              <div className="tag-editor">
                {tagItemsFromValue(values[field.name] ?? "").map((item, index, items) => (
                  <div className={items.length > 1 ? "tag-row" : "tag-row single"} key={`${field.name}-${index}`}>
                    <input
                      value={item}
                      onChange={(event) => updateTagItem(field.name, index, event.target.value)}
                      placeholder={field.name === "pecas_utilizadas" ? "Nome da peça" : "Nome"}
                    />
                    {items.length > 1 ? (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeTagItem(field.name, index)}
                        title="Remover"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="ghost-button tag-add" onClick={() => addTagItem(field.name)}>
                  <Plus size={16} />
                  {field.name === "pecas_utilizadas" ? "Adicionar peça" : "Adicionar item"}
                </button>
              </div>
            ) : field.type === "parts" ? (
              <div className="parts-editor">
                {(partsValues[field.name] ?? [{ nome: "", valor: "" }]).map((item, index, items) => (
                  <div className={items.length > 1 ? "parts-row" : "parts-row single"} key={`${field.name}-${index}`}>
                    <input
                      value={item.nome}
                      onChange={(event) => updatePartItem(field.name, index, "nome", event.target.value)}
                      placeholder="Peça"
                    />
                    <input
                      value={item.valor}
                      onChange={(event) => updatePartItem(field.name, index, "valor", event.target.value)}
                      placeholder="Valor"
                      type="number"
                      step="0.01"
                    />
                    {items.length > 1 ? (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removePartItem(field.name, index)}
                        title="Remover"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="ghost-button tag-add" onClick={() => addPartItem(field.name)}>
                  <Plus size={16} />
                  Adicionar peça
                </button>
              </div>
            ) : field.type === "textarea" ? (
              <textarea
                value={values[field.name] ?? ""}
                onChange={(event) => setValue(field.name, event.target.value)}
                required={fieldIsRequired(field, values)}
                placeholder={field.placeholder}
              />
            ) : (
              <input
                value={values[field.name] ?? ""}
                onChange={(event) => setValue(field.name, event.target.value)}
                required={fieldIsRequired(field, values)}
                placeholder={field.placeholder}
                type={field.type === "number" || field.type === "date" || field.type === "email" ? field.type : "text"}
                step={field.type === "number" ? "0.01" : undefined}
              />
            )}
          </label>
        ))}
      </div>
      {error && <span className="form-message">{error}</span>}
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={busy}>
          Salvar
        </button>
      </div>
    </form>
  );
}
