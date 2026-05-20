"use client";

import {
  Banknote,
  BarChart3,
  Building2,
  Car,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Leaf,
  LogOut,
  Sprout,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CrudModule } from "@/components/CrudModule";
import { Dashboard } from "@/components/Dashboard";
import { LoginScreen } from "@/components/LoginScreen";
import { NfeImporter } from "@/components/NfeImporter";
import { Reports } from "@/components/Reports";
import { listRecords } from "@/lib/firestore-service";
import { canAccess, getDefaultModuleForRole } from "@/lib/rbac";
import { moduleGroups, modules } from "@/lib/modules";
import type { ModuleKey } from "@/types/domain";

const fuelModuleKeys = new Set<ModuleKey>([
  "combustivel",
  "tanques_combustivel",
  "reabastecimentos_tanque",
  "postos_combustiveis"
]);
const hiddenSidebarModuleKeys = new Set<ModuleKey>([
  "tanques_combustivel",
  "reabastecimentos_tanque",
  "postos_combustiveis"
]);

const groupIcons = {
  Empresa: Building2,
  Pessoas: Users,
  Frota: Car,
  Produção: Sprout,
  Financeiro: Banknote,
  Fiscal: FileText
};

export function AppShell() {
  const { user, profile, loading, logout } = useAuth();
  const [activeKey, setActiveKey] = useState<ModuleKey | "nfe" | "dashboard" | "reports">("dashboard");
  const [expandedGroup, setExpandedGroup] = useState<(typeof moduleGroups)[number] | null>(null);
  const [companyName, setCompanyName] = useState("");

  const allowedModules = useMemo(() => {
    if (!profile) return [];
    return modules.filter((module) => canAccess(profile.role, module));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let active = true;

    async function loadCompanyName(force = false) {
      try {
        const records = await listRecords("empresas", 1, { force });
        const company = records[0];
        const nextName = String(company?.nome || company?.razao_social || "");
        if (active) setCompanyName(nextName);
      } catch {
        if (active) setCompanyName("");
      }
    }

    const handleCompanyUpdate = () => {
      void loadCompanyName(true);
    };

    void loadCompanyName();
    window.addEventListener("empresa-updated", handleCompanyUpdate);

    return () => {
      active = false;
      window.removeEventListener("empresa-updated", handleCompanyUpdate);
    };
  }, [profile]);

  if (loading) return <main className="center-state">Carregando...</main>;
  if (!user || !profile) return <LoginScreen />;

  const currentKey: ModuleKey = allowedModules.some((module) => module.key === activeKey)
    ? (activeKey as ModuleKey)
    : getDefaultModuleForRole(profile.role);
  const currentModule = modules.find((module) => module.key === currentKey);
  const activeModule = allowedModules.find((module) => module.key === activeKey);

  function activateDashboard() {
    setActiveKey("dashboard");
    setExpandedGroup(null);
  }

  function activateGroup(group: (typeof moduleGroups)[number]) {
    setExpandedGroup((current) => (current === group ? null : group));
  }

  function activateModule(key: ModuleKey | "nfe" | "reports") {
    setActiveKey(key);

    if (key === "nfe") {
      setExpandedGroup("Fiscal");
      return;
    }

    if (key === "reports") {
      setExpandedGroup("Empresa");
      return;
    }

    const nextModule = allowedModules.find((module) => module.key === key);
    if (nextModule) setExpandedGroup(nextModule.group);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Leaf size={26} />
          <div>
            {companyName ? <strong>{companyName}</strong> : null}
          </div>
        </div>

        <nav>
          <div className="nav-group">
            <button onClick={activateDashboard} className={activeKey === "dashboard" ? "active" : ""}>
              <LayoutDashboard size={16} />
              Painel
            </button>
          </div>
          {moduleGroups.map((group) => {
            const groupModules = allowedModules.filter(
              (module) => module.group === group && !hiddenSidebarModuleKeys.has(module.key)
            );
            const hasFiscalAction = group === "Fiscal" && (profile.role === "admin" || profile.role === "financeiro");
            const hasReportsAction = group === "Empresa";
            if (!groupModules.length && !hasFiscalAction && !hasReportsAction) return null;
            const Icon = groupIcons[group];
            const isExpanded = expandedGroup === group;
            const isActiveGroup =
              activeModule?.group === group ||
              (group === "Fiscal" && activeKey === "nfe") ||
              (group === "Empresa" && activeKey === "reports");
            return (
              <div className={`nav-group ${isExpanded ? "expanded" : ""}`} key={group}>
                <button
                  type="button"
                  className={`nav-heading nav-section-toggle ${isActiveGroup ? "active-group" : ""}`}
                  onClick={() => activateGroup(group)}
                  aria-expanded={isExpanded}
                  aria-label={group === "Empresa" ? "Área da empresa" : group}
                >
                  <Icon size={16} />
                  {group === "Empresa" ? <span aria-hidden="true" /> : group}
                  <ChevronDown className="nav-chevron" size={15} />
                </button>
                {isExpanded ? (
                  <div className="nav-subitems">
                    {groupModules.map((module) => (
                      <button
                        key={module.key}
                        onClick={() => activateModule(module.key)}
                        className={
                          activeKey === module.key ||
                          (module.key === "combustivel" && fuelModuleKeys.has(activeKey as ModuleKey))
                            ? "active"
                            : ""
                        }
                      >
                        {module.key === "users" ? "Usuários" : module.title}
                      </button>
                    ))}
                    {hasFiscalAction && (
                      <button onClick={() => activateModule("nfe")} className={activeKey === "nfe" ? "active" : ""}>
                        Importar NFe
                      </button>
                    )}
                    {hasReportsAction && (
                      <button onClick={() => activateModule("reports")} className={activeKey === "reports" ? "active" : ""}>
                        <BarChart3 size={16} />
                        Relatórios
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <footer className="sidebar-footer">
          <div>
            <strong>{profile.nome}</strong>
          </div>
          <button className="icon-button" onClick={logout} title="Sair" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </footer>
      </aside>

      <main className="main-area">
        {activeKey === "dashboard" ? (
          <Dashboard allowedModules={allowedModules} onNavigate={activateModule} />
        ) : activeKey === "reports" ? (
          <Reports allowedModules={allowedModules} />
        ) : activeKey === "nfe" ? (
          <NfeImporter />
        ) : currentModule ? (
          <CrudModule
            key={currentModule.key}
            module={currentModule}
            activeKey={currentModule.key}
            relatedModules={
              fuelModuleKeys.has(currentModule.key) ? allowedModules.filter((module) => fuelModuleKeys.has(module.key)) : []
            }
            onNavigate={setActiveKey}
          />
        ) : null}
      </main>
    </div>
  );
}
