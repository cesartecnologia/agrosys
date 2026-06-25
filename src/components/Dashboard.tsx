"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarClock,
  ChevronRight,
  Droplets,
  Fuel,
  Sprout,
  Tractor,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { listRecords } from "@/lib/firestore-service";
import { formatDateValue, formatValue, parseDateValue, toCurrency } from "@/lib/format";
import type { AppRecord, ModuleConfig, ModuleKey } from "@/types/domain";

type Props = {
  allowedModules: ModuleConfig[];
  onNavigate: (key: ModuleKey) => void;
  onOpenRecord: (key: ModuleKey, record: AppRecord) => void;
};

type DashboardData = Record<string, AppRecord[]>;
type GroupSummary = { label: string; value: number };
type PendingView = "recentes" | "todos";
type PendingRow = {
  date: string;
  id: string;
  name: string;
  sortDate: number;
  status: string;
  tone: "green" | "yellow";
  value: string;
};
type DashboardNotification = {
  date: string;
  overdue: boolean;
  record: AppRecord;
  sortDate: number;
  title: string;
  value: string;
};
type StatCard = {
  detail: string;
  icon: ReactNode;
  label: string;
  target: ModuleKey;
  tone: "cream" | "mint" | "lavender" | "aqua";
  value: string;
};
type OperationCard = {
  icon: ReactNode;
  label: string;
  tone: "purple" | "yellow" | "blue" | "green" | "violet";
  value: string;
};

const dashboardCollections = [
  "adubacoes",
  "cheques",
  "colheitas",
  "combustivel",
  "manutencoes",
  "movimentacoes_financeiras",
  "tanques_combustivel",
  "veiculos"
];

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asDate(value: unknown) {
  return parseDateValue(value);
}

function isWithinDays(value: unknown, days: number) {
  const date = asDate(value);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return date >= now && date <= limit;
}

function isOverdue(value: unknown) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function isToday(value: unknown) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isWithinPastDays(value: unknown, days: number) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= today;
}

function isCurrentMonth(value: unknown) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function latestRecords(records: AppRecord[], dateField: string, limit = 5) {
  return [...records]
    .sort((left, right) => (asDate(right[dateField])?.getTime() ?? 0) - (asDate(left[dateField])?.getTime() ?? 0))
    .slice(0, limit);
}

function groupByNumber(records: AppRecord[], labelField: string, valueField: string, fallback: string) {
  const groups = new Map<string, number>();

  for (const record of records) {
    const label = String(record[labelField] ?? fallback).trim() || fallback;
    groups.set(label, (groups.get(label) ?? 0) + asNumber(record[valueField]));
  }

  return Array.from(groups, ([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

function percentage(value: number, max: number) {
  if (!max) return 0;
  return Math.max(4, Math.min(100, (value / max) * 100));
}

function compactNumber(value: number, suffix = "") {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`;
}

function dateTimeValue(value: unknown) {
  return asDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function buildWeeklyBars(records: AppRecord[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const end = new Date(today);
  end.setDate(today.getDate() + 1);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, value: 0 };
  });

  for (const record of records) {
    const recordDate = asDate(record.data_abastecimento);
    if (!recordDate || recordDate < start || recordDate >= end) continue;
    recordDate.setHours(0, 0, 0, 0);
    const day = days.find((item) => item.date.getTime() === recordDate.getTime());
    if (day) day.value += asNumber(record.litros);
  }

  return days.map((day) => {
    const label = dayLabels[day.date.getDay()];
    const dateLabel = formatDateValue(day.date);
    return {
      dateLabel,
      isToday: day.date.getTime() === today.getTime(),
      label,
      tooltip: `${label}, ${dateLabel}: ${day.value.toLocaleString("pt-BR")} L`,
      value: day.value
    };
  });
}

function ProgressRow({ item, max, suffix = "" }: { item: GroupSummary; max: number; suffix?: string }) {
  return (
    <div className="reference-progress-row">
      <div>
        <strong>{item.label}</strong>
        <span>{compactNumber(item.value, suffix)}</span>
      </div>
      <div className="reference-progress-track" aria-hidden="true">
        <span style={{ width: `${percentage(item.value, max)}%` }} />
      </div>
    </div>
  );
}

export function Dashboard({ allowedModules, onNavigate, onOpenRecord }: Props) {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingView, setPendingView] = useState<PendingView>("recentes");
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const allowedCollections = new Set(allowedModules.map((module) => module.collection).filter(Boolean));
      const uniqueCollections = dashboardCollections.filter((collection) => allowedCollections.has(collection));
      const entries = await Promise.all(
        uniqueCollections.map(async (collection) => [collection, await listRecords(collection, 200)] as const)
      );

      if (active) {
        setData(Object.fromEntries(entries));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [allowedModules]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  const summary = useMemo(() => {
    const adubacoes = data.adubacoes ?? [];
    const cheques = data.cheques ?? [];
    const colheitas = data.colheitas ?? [];
    const combustivel = data.combustivel ?? [];
    const financeiro = data.movimentacoes_financeiras ?? [];
    const manutencoes = data.manutencoes ?? [];
    const tanques = data.tanques_combustivel ?? [];
    const veiculos = data.veiculos ?? [];

    const gastosFinanceirosPagosMes = financeiro
      .filter(
        (item) =>
          item.tipo === "saida" &&
          item.status === "pago" &&
          isCurrentMonth(item.data_pagamento || item.data_lancamento)
      )
      .reduce((total, item) => total + asNumber(item.valor), 0);
    const chequesCompensadosMes = cheques
      .filter(
        (item) =>
          item.status === "compensado" &&
          isCurrentMonth(item.data_compensacao || item.data_vencimento)
      )
      .reduce((total, item) => total + asNumber(item.valor), 0);
    const gastosManutencoesMes = manutencoes
      .filter((item) => isCurrentMonth(item.data_manutencao))
      .reduce((total, item) => total + asNumber(item.custo_total), 0);
    const gastosPagosMes = gastosFinanceirosPagosMes + chequesCompensadosMes + gastosManutencoesMes;
    const pendente = financeiro
      .filter((item) => item.status === "pendente")
      .reduce((total, item) => total + asNumber(item.valor), 0);
    const sacas = colheitas.reduce((total, item) => total + asNumber(item.quantidade_sacas), 0);
    const litrosCafe = colheitas.reduce((total, item) => total + asNumber(item.quantidade_litros), 0);
    const consumoSemanal = combustivel
      .filter((item) => isWithinPastDays(item.data_abastecimento, 7))
      .reduce((total, item) => total + asNumber(item.litros), 0);
    const saldoTanques = tanques.reduce((total, item) => total + asNumber(item.saldo_atual_litros), 0);
    const capacidadeTanques = tanques.reduce((total, item) => total + asNumber(item.capacidade_litros), 0);
    const manutencoesMes = manutencoes.filter((item) => isWithinPastDays(item.data_manutencao, 30)).length;
    const manutencoesProximas = manutencoes.filter((item) => isWithinDays(item.proxima_manutencao, 30));
    const notifications: DashboardNotification[] = financeiro
      .filter(
        (item) =>
          item.tipo === "saida" &&
          item.status === "pendente" &&
          (isOverdue(item.data_vencimento_recebimento) || isToday(item.data_vencimento_recebimento))
      )
      .map((item) => ({
        date: formatDateValue(item.data_vencimento_recebimento) || "-",
        overdue: isOverdue(item.data_vencimento_recebimento),
        record: item,
        sortDate: dateTimeValue(item.data_vencimento_recebimento),
        title: String(item.descricao || "Conta pendente"),
        value: toCurrency(asNumber(item.valor))
      }))
      .sort((left, right) => left.sortDate - right.sortDate);
    const pendingRows: PendingRow[] = [
      ...financeiro
        .filter((item) => item.status === "pendente")
        .map((item) => ({
          date: formatDateValue(item.data_vencimento_recebimento) || "-",
          id: `financeiro-${String(item.id)}`,
          name: String(item.descricao || "Conta pendente"),
          sortDate: dateTimeValue(item.data_vencimento_recebimento),
          status: isOverdue(item.data_vencimento_recebimento) ? "Vencida" : "Pendente",
          tone: isOverdue(item.data_vencimento_recebimento) ? ("yellow" as const) : ("green" as const),
          value: toCurrency(asNumber(item.valor))
        })),
      ...cheques
        .filter((item) => item.status === "a_compensar")
        .map((item) => ({
          date: formatDateValue(item.data_vencimento) || "-",
          id: `cheque-${String(item.id)}`,
          name: `Cheque ${String(item.numero || item.banco || "").trim()}`.trim(),
          sortDate: dateTimeValue(item.data_vencimento),
          status: "A compensar",
          tone: "green" as const,
          value: toCurrency(asNumber(item.valor))
        })),
      ...manutencoesProximas.map((item) => ({
        date: formatDateValue(item.proxima_manutencao) || "-",
        id: `manutencao-${String(item.id)}`,
        name: String(item.oficina || item.descricao || "Manutenção"),
        sortDate: dateTimeValue(item.proxima_manutencao),
        status: "Próxima",
        tone: "green" as const,
        value: toCurrency(asNumber(item.custo_total))
      }))
    ].sort((left, right) => left.sortDate - right.sortDate);

    return {
      adubacoesMes: adubacoes.filter((item) => isWithinPastDays(item.data_aplicacao, 30)).length,
      chequesACompensar: cheques.filter((item) => item.status === "a_compensar").length,
      chequesCompensadosMes,
      consumoPorVeiculo: groupByNumber(
        combustivel.filter((item) => isWithinPastDays(item.data_abastecimento, 30)),
        "veiculo_id",
        "litros",
        "Veículo"
      ),
      consumoSemanal,
      gastosManutencoesMes,
      gastosPagosMes,
      litrosCafe,
      manutencoesMes,
      manutencoesProximas,
      manutencoesTotal: manutencoes.length,
      notifications,
      pendente,
      pendingRows,
      producaoPorFazenda: groupByNumber(colheitas, "fazenda", "quantidade_sacas", "Fazenda"),
      saldoTanques,
      capacidadeTanques,
      sacas,
      ultimasColheitas: latestRecords(colheitas, "data_colheita", 4),
      vencidas: financeiro.filter(
        (item) => item.status === "pendente" && isOverdue(item.data_vencimento_recebimento)
      ).length,
      veiculosAtivos: veiculos.filter((item) => item.status !== "inativo").length,
      weeklyBars: buildWeeklyBars(combustivel)
    };
  }, [data]);

  const maxProducao = Math.max(...summary.producaoPorFazenda.map((item) => item.value), 0);
  const maxConsumo = Math.max(...summary.consumoPorVeiculo.map((item) => item.value), 0);
  const maxWeekly = Math.max(...summary.weeklyBars.map((item) => item.value), 1);
  const tankPercent = summary.capacidadeTanques ? (summary.saldoTanques / summary.capacidadeTanques) * 100 : 0;
  const allowedKeys = useMemo(() => new Set(allowedModules.map((module) => module.key)), [allowedModules]);
  const visiblePendingRows = pendingView === "recentes" ? summary.pendingRows.slice(0, 2) : summary.pendingRows;

  const statCards: StatCard[] = [
    {
      detail: `${summary.litrosCafe.toLocaleString("pt-BR")} litros`,
      icon: <Sprout size={18} />,
      label: "Colheita",
      target: "colheitas",
      tone: "cream",
      value: `${summary.sacas.toLocaleString("pt-BR")} sc`
    },
    {
      detail: `${toCurrency(summary.gastosManutencoesMes)} em manutenção`,
      icon: <Banknote size={18} />,
      label: "Gastos pagos",
      target: "saidas",
      tone: "mint",
      value: toCurrency(summary.gastosPagosMes)
    },
    {
      detail: `${summary.consumoSemanal.toLocaleString("pt-BR")} L na semana`,
      icon: <Fuel size={18} />,
      label: "Combustível",
      target: "combustivel",
      tone: "lavender",
      value: `${summary.saldoTanques.toLocaleString("pt-BR")} L`
    },
    {
      detail: `${summary.manutencoesTotal} manutenções cadastradas`,
      icon: <Tractor size={18} />,
      label: "Frota",
      target: "veiculos",
      tone: "aqua",
      value: summary.veiculosAtivos.toLocaleString("pt-BR")
    }
  ];

  const operations: OperationCard[] = [
    { icon: <Droplets size={22} />, label: "Tanque", tone: "purple", value: `${tankPercent.toFixed(0)}%` },
    { icon: <Sprout size={22} />, label: "Adubação", tone: "yellow", value: String(summary.adubacoesMes) },
    { icon: <AlertTriangle size={22} />, label: "Vencidas", tone: "blue", value: String(summary.vencidas) },
    { icon: <Wrench size={22} />, label: "Manutenção", tone: "green", value: String(summary.manutencoesMes) },
    { icon: <Fuel size={22} />, label: "Consumo", tone: "violet", value: `${summary.consumoSemanal.toLocaleString("pt-BR")} L` }
  ];

  if (loading) return <section className="dashboard-panel">Carregando painel...</section>;

  return (
    <section className="dashboard dashboard-reference">
      <div className="dashboard-notifications" ref={notificationsRef}>
        <button
          aria-expanded={notificationsOpen}
          aria-label={`${summary.notifications.length} notificações financeiras`}
          className="dashboard-notification-trigger"
          onClick={() => setNotificationsOpen((current) => !current)}
          type="button"
        >
          <Bell size={20} />
          <span>{summary.notifications.length}</span>
        </button>

        {notificationsOpen ? (
          <section className="dashboard-notification-popover" aria-label="Notificações financeiras">
            <header>
              <div>
                <h2>Pendências</h2>
                <p>Vencidas e com vencimento hoje</p>
              </div>
              <strong>{summary.notifications.length}</strong>
            </header>

            {summary.notifications.length ? (
              <div className="dashboard-notification-list">
                {summary.notifications.slice(0, 5).map((notification) => (
                  <button
                    className={`dashboard-notification-item ${notification.overdue ? "overdue" : ""}`}
                    key={String(notification.record.id)}
                    onClick={() => onOpenRecord("saidas", notification.record)}
                    type="button"
                  >
                    <span className="dashboard-notification-icon">
                      {notification.overdue ? <AlertTriangle size={18} /> : <CalendarClock size={18} />}
                    </span>
                    <span>
                      <strong>{notification.title}</strong>
                      <small>
                        {notification.overdue ? "Vencida" : "Vence hoje"} · {notification.date}
                      </small>
                    </span>
                    <strong>{notification.value}</strong>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="dashboard-notification-empty">Nenhuma pendência para hoje.</p>
            )}
          </section>
        ) : null}
      </div>

      <section className="reference-top-grid">
        <div className="reference-stat-grid">
          {statCards.map((card) => (
            <article className={`reference-stat-card ${card.tone}`} key={card.label}>
              <button
                className="reference-card-action"
                type="button"
                aria-label={`Abrir ${card.label}`}
                disabled={!allowedKeys.has(card.target)}
                onClick={() => onNavigate(card.target)}
              >
                <ArrowUpRight size={15} />
              </button>
              <div className="reference-stat-icon">{card.icon}</div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </article>
          ))}
        </div>

        <article className="reference-chart-card">
          <header>
            <div>
              <h3>Consumo</h3>
              <strong>{summary.consumoSemanal.toLocaleString("pt-BR")} L</strong>
            </div>
            <span>7 dias</span>
          </header>
          <div className="reference-chart">
            <div className="reference-chart-axis">
              <span>{Math.ceil(maxWeekly).toLocaleString("pt-BR")} L</span>
              <span>{Math.ceil(maxWeekly / 2).toLocaleString("pt-BR")} L</span>
              <span>0 L</span>
            </div>
            <div className="reference-bars">
              {summary.weeklyBars.map((bar) => (
                <div className="reference-bar-item" key={bar.dateLabel} data-tooltip={bar.tooltip} title={bar.tooltip}>
                  <span
                    className={bar.isToday ? "hatched" : ""}
                    style={{ height: `${percentage(bar.value, maxWeekly)}%` }}
                  />
                  <small>{bar.label}</small>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="reference-bottom-grid">
        <article className="reference-list-card">
          <header>
            <h3>Últimas colheitas</h3>
            <span>•••</span>
          </header>
          <div className="reference-transaction-list">
            {summary.ultimasColheitas.length ? (
              summary.ultimasColheitas.map((item, index) => (
                <div key={item.id}>
                  <div className={`reference-list-icon tone-${index % 4}`}>
                    <Sprout size={21} />
                  </div>
                  <div>
                    <strong>{String(item.fazenda || item.talhao || "Fazenda")}</strong>
                    <span>{formatValue(item.data_colheita)}</span>
                  </div>
                  <strong>{asNumber(item.quantidade_sacas).toLocaleString("pt-BR")} sc</strong>
                </div>
              ))
            ) : (
              <p>Nenhuma colheita lançada.</p>
            )}
          </div>
        </article>

        <div className="reference-right-stack">
          <article className="reference-spending-card">
            <header>
              <h3>Operação</h3>
              <span>•••</span>
            </header>
            <div className="reference-operation-row">
              {operations.map((operation) => (
                <div className={`reference-operation-card ${operation.tone}`} key={operation.label}>
                  <span>{operation.icon}</span>
                  <strong>{operation.label}</strong>
                  <small>{operation.value}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="reference-table-card">
            <header>
              <h3>Pendências</h3>
              <div>
                <button
                  className={pendingView === "recentes" ? "active" : ""}
                  type="button"
                  onClick={() => setPendingView("recentes")}
                >
                  Recentes
                </button>
                <button
                  className={pendingView === "todos" ? "active" : ""}
                  type="button"
                  onClick={() => setPendingView("todos")}
                >
                  Todos
                </button>
              </div>
            </header>
            <div className="reference-table">
              <div>
                <span>Nome</span>
                <span>Status</span>
                <span>Data</span>
                <span>Valor</span>
              </div>
              {visiblePendingRows.length ? (
                visiblePendingRows.map((item) => (
                  <div key={item.id}>
                    <strong>{item.name}</strong>
                    <span className={`pill ${item.tone}`}>{item.status}</span>
                    <span>{item.date}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))
              ) : (
                <div className="reference-table-empty">
                  <strong>Nenhuma pendência.</strong>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="reference-progress-panel">
        <article>
          <h3>Produção por fazenda</h3>
          <div className="reference-progress-list">
            {summary.producaoPorFazenda.length ? (
              summary.producaoPorFazenda.map((item) => (
                <ProgressRow item={item} key={item.label} max={maxProducao} suffix=" sc" />
              ))
            ) : (
              <p>Nenhuma colheita lançada.</p>
            )}
          </div>
        </article>
        <article>
          <h3>Consumo por veículo</h3>
          <div className="reference-progress-list">
            {summary.consumoPorVeiculo.length ? (
              summary.consumoPorVeiculo.map((item) => (
                <ProgressRow item={item} key={item.label} max={maxConsumo} suffix=" L" />
              ))
            ) : (
              <p>Nenhum abastecimento lançado.</p>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
