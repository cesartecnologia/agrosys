export type Role = "admin" | "operador" | "financeiro";

export type FieldCondition = {
  field: string;
  value: string;
};

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "vehicle"
  | "tank"
  | "station"
  | "parts"
  | "tags"
  | "multiselect";

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  requiredWhen?: FieldCondition;
  requiredWhenAll?: FieldCondition[];
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  visibleWhen?: FieldCondition;
  visibleWhenAll?: FieldCondition[];
};

export type ModuleKey =
  | "empresa"
  | "funcionarios"
  | "users"
  | "veiculos"
  | "manutencoes"
  | "tanques_combustivel"
  | "reabastecimentos_tanque"
  | "postos_combustiveis"
  | "combustivel"
  | "colheitas"
  | "adubacoes"
  | "entradas"
  | "saidas"
  | "cheques"
  | "fornecedores"
  | "produtos"
  | "nfe";

export type AppRecord = Record<string, unknown> & {
  id?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ModuleConfig = {
  key: ModuleKey;
  collection?: string;
  title: string;
  description: string;
  group: "Empresa" | "Pessoas" | "Frota" | "Produção" | "Financeiro" | "Fiscal";
  allowedRoles: Role[];
  searchFields: string[];
  listFields: string[];
  fields: FormField[];
  fixedValues?: Record<string, string>;
};

export type UserProfile = {
  uid: string;
  nome: string;
  email: string;
  role: Role;
  fazenda_id?: string;
};

export type NfeImportResult = {
  numero: string;
  dataEmissao: string;
  valorTotal: number;
  fornecedor: {
    razao_social: string;
    cnpj: string;
    endereco?: Record<string, string>;
  };
  produtos: Array<{
    codigo: string;
    nome: string;
    ncm: string;
    unidade_medida: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
};
