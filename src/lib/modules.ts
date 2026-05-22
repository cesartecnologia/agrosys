import type { ModuleConfig } from "@/types/domain";

const roleAll = ["admin", "operador", "financeiro"] as const;
const fuelTypeOptions = ["diesel", "diesel_s10", "gasolina", "etanol", "biodiesel", "outro"];

export const modules: ModuleConfig[] = [
  {
    key: "empresa",
    collection: "empresas",
    title: "Dados da empresa",
    description: "Informações básicas da fazenda.",
    group: "Empresa",
    allowedRoles: ["admin"],
    searchFields: ["nome", "razao_social", "documento", "responsavel"],
    listFields: ["nome", "razao_social", "documento", "telefone", "responsavel"],
    fields: [
      { name: "nome", label: "Nome da fazenda", type: "text", required: true },
      { name: "razao_social", label: "Razão social", type: "text" },
      { name: "documento", label: "CNPJ ou CPF", type: "text", required: true },
      { name: "inscricao_estadual", label: "Inscrição estadual", type: "text" },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "responsavel", label: "Responsável", type: "text" },
      { name: "endereco", label: "Endereço", type: "textarea" },
      { name: "observacoes", label: "Observações", type: "textarea" }
    ]
  },
  {
    key: "funcionarios",
    collection: "funcionarios",
    title: "Funcionários",
    description: "Cadastro, contatos, cargo, admissão e salário.",
    group: "Pessoas",
    allowedRoles: ["admin"],
    searchFields: ["nome", "cpf", "cargo"],
    listFields: ["nome", "cpf", "cargo", "data_admissao", "salario"],
    fields: [
      { name: "nome", label: "Nome completo", type: "text", required: true },
      { name: "cpf", label: "CPF", type: "text", required: true },
      { name: "cargo", label: "Cargo", type: "text", required: true },
      { name: "data_admissao", label: "Data de admissão", type: "date", required: true },
      { name: "salario", label: "Salário", type: "number", required: true },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "endereco", label: "Endereço", type: "textarea" }
    ]
  },
  {
    key: "users",
    collection: "users",
    title: "Usuários e permissões",
    description: "Controle de acesso dos usuários da fazenda.",
    group: "Empresa",
    allowedRoles: ["admin"],
    searchFields: ["nome", "email", "role"],
    listFields: ["nome", "email", "role", "fazenda_id"],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "email", label: "E-mail", type: "email", required: true },
      { name: "password", label: "Senha temporária", type: "text" },
      { name: "role", label: "Perfil", type: "select", required: true, options: ["admin", "operador", "financeiro"] },
      { name: "fazenda_id", label: "Fazenda ID", type: "text" }
    ]
  },
  {
    key: "veiculos",
    collection: "veiculos",
    title: "Veículos e máquinas",
    description: "Frota agrícola, máquinas sem placa e status operacional.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["placa", "tipo", "modelo", "marca"],
    listFields: ["placa", "tipo", "modelo", "marca", "status"],
    fields: [
      { name: "placa", label: "Placa ou identificador", type: "text", required: true },
      { name: "tipo", label: "Tipo", type: "select", required: true, options: ["trator", "caminhão", "caminhonete", "colheitadeira", "carro", "pulverizador", "outro"] },
      { name: "modelo", label: "Modelo", type: "text", required: true },
      { name: "ano", label: "Ano de fabricação", type: "number" },
      { name: "marca", label: "Marca", type: "text" },
      { name: "numero_serie", label: "Número de série", type: "text" },
      { name: "status", label: "Status", type: "select", required: true, options: ["ativo", "inativo"] }
    ]
  },
  {
    key: "manutencoes",
    collection: "manutencoes",
    title: "Manutenções",
    description: "Preventivas, corretivas, custos, peças e próximos serviços.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["veiculo_id", "tipo", "oficina", "responsavel", "descricao"],
    listFields: ["veiculo_id", "data_manutencao", "tipo", "oficina", "custo_total", "proxima_manutencao"],
    fields: [
      { name: "veiculo_id", label: "Veículo/Máquina (placa)", type: "vehicle", required: true },
      { name: "data_manutencao", label: "Data da manutenção", type: "date", required: true },
      { name: "tipo", label: "Tipo", type: "select", required: true, options: ["preventiva", "corretiva"] },
      { name: "descricao", label: "Descrição", type: "textarea", required: true },
      { name: "pecas_utilizadas", label: "Peças utilizadas", type: "parts" },
      { name: "custo_total", label: "Custo total", type: "number", required: true },
      { name: "oficina", label: "Oficina", type: "text" },
      { name: "responsavel", label: "Responsável", type: "text" },
      { name: "proxima_manutencao", label: "Próxima manutenção", type: "date" }
    ]
  },
  {
    key: "combustivel",
    collection: "combustivel",
    title: "Combustível",
    description: "Abastecimentos por tanque da fazenda ou posto.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["veiculo_id", "origem_abastecimento", "tanque_id", "posto_id", "funcionario", "tipo_combustivel"],
    listFields: ["veiculo_id", "origem_abastecimento", "tanque_id", "posto_id", "data_abastecimento", "litros", "valor_litro", "tipo_combustivel"],
    fields: [
      { name: "veiculo_id", label: "Veículo/Máquina (placa)", type: "vehicle", required: true },
      { name: "origem_abastecimento", label: "Origem", type: "select", required: true, defaultValue: "tanque", options: ["tanque", "posto"] },
      { name: "tanque_id", label: "Tanque", type: "tank", requiredWhen: { field: "origem_abastecimento", value: "tanque" }, visibleWhen: { field: "origem_abastecimento", value: "tanque" } },
      { name: "posto_id", label: "Posto", type: "station", requiredWhen: { field: "origem_abastecimento", value: "posto" }, visibleWhen: { field: "origem_abastecimento", value: "posto" } },
      { name: "tipo_combustivel", label: "Tipo de combustível", type: "select", requiredWhen: { field: "origem_abastecimento", value: "posto" }, visibleWhen: { field: "origem_abastecimento", value: "posto" }, options: fuelTypeOptions },
      { name: "funcionario", label: "Funcionário", type: "text", required: true },
      { name: "data_abastecimento", label: "Data", type: "date", required: true },
      { name: "litros", label: "Litros", type: "number", required: true },
      { name: "valor_litro", label: "Valor do combustível", type: "number", requiredWhen: { field: "origem_abastecimento", value: "posto" }, visibleWhen: { field: "origem_abastecimento", value: "posto" } },
      { name: "odometro_horimetro", label: "Odômetro/Horímetro", type: "number" }
    ]
  },
  {
    key: "tanques_combustivel",
    collection: "tanques_combustivel",
    title: "Tanques de combustível",
    description: "Cadastro dos tanques da fazenda e saldo disponível.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["nome", "tipo_combustivel", "localizacao", "status"],
    listFields: ["nome", "tipo_combustivel", "capacidade_litros", "saldo_atual_litros", "status"],
    fields: [
      { name: "nome", label: "Nome do tanque", type: "text", required: true },
      { name: "tipo_combustivel", label: "Tipo de combustível", type: "select", required: true, options: fuelTypeOptions },
      { name: "capacidade_litros", label: "Capacidade (litros)", type: "number", required: true },
      { name: "saldo_atual_litros", label: "Saldo atual (litros)", type: "number", required: true },
      { name: "localizacao", label: "Localização", type: "text" },
      { name: "status", label: "Status", type: "select", required: true, options: ["ativo", "inativo"] },
      { name: "observacoes", label: "Observações", type: "textarea" }
    ]
  },
  {
    key: "reabastecimentos_tanque",
    collection: "reabastecimentos_tanque",
    title: "Reabastecimento",
    description: "Entradas de combustível nos tanques da fazenda.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["tanque_id", "tipo_combustivel", "fornecedor", "responsavel"],
    listFields: ["tanque_id", "data_reabastecimento", "tipo_combustivel", "litros", "valor_total", "fornecedor"],
    fields: [
      { name: "tanque_id", label: "Tanque", type: "tank", required: true },
      { name: "data_reabastecimento", label: "Data", type: "date", required: true },
      { name: "litros", label: "Litros", type: "number", required: true },
      { name: "valor_litro", label: "Valor por litro", type: "number", required: true },
      { name: "valor_total", label: "Valor total", type: "number", required: true },
      { name: "fornecedor", label: "Fornecedor", type: "text" },
      { name: "documento", label: "Nota/Documento", type: "text" },
      { name: "responsavel", label: "Responsável", type: "text" },
      { name: "observacoes", label: "Observações", type: "textarea" }
    ]
  },
  {
    key: "postos_combustiveis",
    collection: "postos_combustiveis",
    title: "Postos",
    description: "Cadastro de postos usados nos abastecimentos externos.",
    group: "Frota",
    allowedRoles: ["admin", "operador"],
    searchFields: ["nome", "cnpj", "cidade", "telefone", "status"],
    listFields: ["nome", "cnpj", "cidade", "telefone", "status"],
    fields: [
      { name: "nome", label: "Nome do posto", type: "text", required: true },
      { name: "cnpj", label: "CNPJ", type: "text" },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "cidade", label: "Cidade", type: "text" },
      { name: "endereco", label: "Endereço", type: "textarea" },
      { name: "status", label: "Status", type: "select", required: true, defaultValue: "ativo", options: ["ativo", "inativo"] },
      { name: "observacoes", label: "Observações", type: "textarea" }
    ]
  },
  {
    key: "colheitas",
    collection: "colheitas",
    title: "Colheitas de café",
    description: "Produção por talhão, safra, tipo de café e equipe.",
    group: "Produção",
    allowedRoles: ["admin", "operador"],
    searchFields: ["fazenda", "talhao", "tipo_cafe", "safra"],
    listFields: ["fazenda", "talhao", "data_colheita", "quantidade_sacas", "tipo_cafe", "safra"],
    fields: [
      { name: "fazenda", label: "Fazenda", type: "text", required: true },
      { name: "talhao", label: "Talhão/Área", type: "text", required: true },
      { name: "data_colheita", label: "Data da colheita", type: "date", required: true },
      { name: "quantidade_sacas", label: "Sacas de 60kg", type: "number" },
      { name: "quantidade_litros", label: "Litros", type: "number" },
      { name: "tipo_cafe", label: "Tipo de café", type: "select", required: true, options: ["arábica", "robusta", "conilon", "bourbon", "catuaí", "mundo novo", "acaiá", "topázio", "catucaí", "obatã"] },
      { name: "funcionarios_envolvidos", label: "Funcionários envolvidos", type: "tags" },
      { name: "observacoes", label: "Observações", type: "textarea" },
      { name: "safra", label: "Safra", type: "text", required: true, placeholder: "2025/2026" }
    ]
  },
  {
    key: "adubacoes",
    collection: "adubacoes",
    title: "Adubações",
    description: "Aplicações por talhão, insumo, dose e método.",
    group: "Produção",
    allowedRoles: ["admin", "operador"],
    searchFields: ["fazenda", "talhao", "tipo_adubo", "responsavel"],
    listFields: ["fazenda", "talhao", "data_aplicacao", "tipo_adubo", "quantidade_aplicada", "responsavel"],
    fields: [
      { name: "fazenda", label: "Fazenda", type: "text", required: true },
      { name: "talhao", label: "Talhão/Área", type: "text", required: true },
      { name: "data_aplicacao", label: "Data da aplicação", type: "date", required: true },
      { name: "tipo_adubo", label: "Tipo de adubo", type: "text", required: true },
      { name: "quantidade_aplicada", label: "Quantidade aplicada", type: "number", required: true },
      { name: "unidade_medida", label: "Unidade", type: "select", options: ["kg/ha", "kg/planta", "t/ha", "litros/ha"] },
      { name: "metodo_aplicacao", label: "Método", type: "text" },
      { name: "responsavel", label: "Responsável", type: "text" }
    ]
  },
  {
    key: "movimentacoes_financeiras",
    collection: "movimentacoes_financeiras",
    title: "Entrada e saída",
    description: "Entradas, saídas, fluxo de caixa e lançamentos gerais.",
    group: "Financeiro",
    allowedRoles: ["admin", "financeiro"],
    searchFields: ["descricao", "categoria", "status", "tipo"],
    listFields: ["descricao", "valor", "tipo", "data_vencimento_recebimento", "status"],
    fields: [
      { name: "descricao", label: "Descrição", type: "text", required: true },
      { name: "valor", label: "Valor", type: "number", required: true },
      { name: "tipo", label: "Tipo", type: "select", required: true, options: ["entrada", "saida"] },
      { name: "data_lancamento", label: "Data de lançamento", type: "date", required: true },
      { name: "data_vencimento_recebimento", label: "Vencimento/Recebimento", type: "date" },
      { name: "categoria", label: "Categoria", type: "select", options: ["insumos", "salarios", "vendas_cafe", "manutencao", "combustivel", "outros"] },
      { name: "status", label: "Status", type: "select", required: true, options: ["pendente", "pago", "recebido"] },
      { name: "referencia_nfe_id", label: "Referência NFe", type: "text" },
      { name: "referencia_cheque_id", label: "Referência cheque", type: "text" }
    ]
  },
  {
    key: "cheques",
    collection: "cheques",
    title: "Cheques",
    description: "Emitidos, recebidos, vencimentos e compensações.",
    group: "Financeiro",
    allowedRoles: ["admin", "financeiro"],
    searchFields: ["numero", "banco", "emitente_beneficiario", "status"],
    listFields: ["numero", "banco", "valor", "data_vencimento", "status"],
    fields: [
      { name: "numero", label: "Número", type: "text", required: true },
      { name: "banco", label: "Banco", type: "text", required: true },
      { name: "valor", label: "Valor", type: "number", required: true },
      { name: "data_emissao", label: "Data de emissão", type: "date", required: true },
      { name: "data_vencimento", label: "Data de vencimento", type: "date", required: true },
      { name: "emitente_beneficiario", label: "Emitente/Beneficiário", type: "text", required: true },
      { name: "status", label: "Status", type: "select", required: true, options: ["a_compensar", "compensado", "devolvido"] }
    ]
  },
  {
    key: "fornecedores",
    collection: "fornecedores",
    title: "Fornecedores",
    description: "Fornecedores cadastrados manualmente ou pelas notas importadas.",
    group: "Fiscal",
    allowedRoles: ["admin", "financeiro"],
    searchFields: ["razao_social", "cnpj"],
    listFields: ["razao_social", "cnpj", "telefone", "email"],
    fields: [
      { name: "razao_social", label: "Razão social", type: "text", required: true },
      { name: "cnpj", label: "CNPJ", type: "text", required: true },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "endereco", label: "Endereço", type: "textarea" }
    ]
  },
  {
    key: "produtos",
    collection: "produtos",
    title: "Produtos",
    description: "Insumos e produtos usados nas compras e notas.",
    group: "Fiscal",
    allowedRoles: ["admin", "financeiro"],
    searchFields: ["nome", "codigo", "ncm", "unidade_medida", "ultimo_fornecedor"],
    listFields: ["nome", "codigo", "unidade_medida", "ultima_quantidade", "ultimo_valor_total", "ultimo_fornecedor"],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "codigo", label: "Código", type: "text" },
      { name: "ncm", label: "NCM", type: "text" },
      { name: "unidade_medida", label: "Unidade", type: "text", required: true },
      { name: "ultima_quantidade", label: "Quantidade", type: "number" },
      { name: "ultimo_valor_unitario", label: "Valor unitário", type: "number" },
      { name: "ultimo_valor_total", label: "Valor total", type: "number" },
      { name: "ultimo_fornecedor", label: "Fornecedor", type: "text" },
      { name: "ultima_nfe", label: "NFe", type: "text" },
      { name: "ultima_compra_em", label: "Data da compra", type: "date" },
      { name: "descricao", label: "Descrição", type: "textarea" }
    ]
  }
];

export const moduleGroups = ["Pessoas", "Frota", "Produção", "Financeiro", "Fiscal", "Empresa"] as const;

export function getModule(key: string) {
  return modules.find((module) => module.key === key) ?? modules[0];
}

export const allRoles = [...roleAll];
