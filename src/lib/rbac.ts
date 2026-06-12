import type { ModuleConfig, ModuleKey, Role } from "@/types/domain";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  operador: "Operador",
  financeiro: "Financeiro"
};

export function canAccess(role: Role | undefined, module: ModuleConfig) {
  return Boolean(role && module.allowedRoles.includes(role));
}

export function roleLabel(role: Role | undefined) {
  return role ? roleLabels[role] : "Sem perfil";
}

export function getDefaultModuleForRole(role: Role): ModuleKey {
  if (role === "financeiro") return "entradas";
  if (role === "operador") return "colheitas";
  return "empresa";
}
