import { createRecord, findFirstByField, updateRecord } from "@/lib/firestore-service";
import type { NfeImportResult } from "@/types/domain";

function textFrom(parent: Element | Document, selector: string) {
  return parent.querySelector(selector)?.textContent?.trim() ?? "";
}

function numberFrom(parent: Element | Document, selector: string) {
  const raw = textFrom(parent, selector).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function parseNfeXml(xml: string): NfeImportResult {
  if (xml.length > 5_000_000) {
    throw new Error("XML muito grande. Importe um arquivo de até 5 MB.");
  }

  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("XML recusado por conter declaração insegura.");
  }

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");

  if (parserError) {
    throw new Error("XML inválido. Verifique se o arquivo é uma NFe autorizada.");
  }

  const emit = doc.querySelector("emit");
  const ide = doc.querySelector("ide");
  const total = doc.querySelector("ICMSTot");
  const produtos = Array.from(doc.querySelectorAll("det prod")).slice(0, 500).map((prod) => ({
    codigo: textFrom(prod, "cProd"),
    nome: textFrom(prod, "xProd"),
    ncm: textFrom(prod, "NCM"),
    unidade_medida: textFrom(prod, "uCom") || "un",
    quantidade: numberFrom(prod, "qCom"),
    valor_unitario: numberFrom(prod, "vUnCom"),
    valor_total: numberFrom(prod, "vProd")
  }));

  const numero = textFrom(ide ?? doc, "nNF");
  const dataEmissao = textFrom(ide ?? doc, "dhEmi") || textFrom(ide ?? doc, "dEmi");
  const valorTotal = numberFrom(total ?? doc, "vNF");
  const razaoSocial = textFrom(emit ?? doc, "xNome");
  const cnpj = textFrom(emit ?? doc, "CNPJ");

  if (!numero || !razaoSocial || !cnpj) {
    throw new Error("Não foi possível identificar número, emitente e CNPJ no XML.");
  }

  return {
    numero,
    dataEmissao,
    valorTotal,
    fornecedor: {
      razao_social: razaoSocial,
      cnpj,
      endereco: {
        rua: textFrom(emit ?? doc, "xLgr"),
        numero: textFrom(emit ?? doc, "nro"),
        cidade: textFrom(emit ?? doc, "xMun"),
        estado: textFrom(emit ?? doc, "UF"),
        cep: textFrom(emit ?? doc, "CEP")
      }
    },
    produtos
  };
}

export async function persistNfeImport(result: NfeImportResult) {
  let fornecedor = await findFirstByField("fornecedores", "cnpj", result.fornecedor.cnpj);

  if (!fornecedor) {
    const id = await createRecord("fornecedores", result.fornecedor);
    fornecedor = { id, ...result.fornecedor };
  }

  for (const produto of result.produtos) {
    const existingByCode = produto.codigo ? await findFirstByField("produtos", "codigo", produto.codigo) : null;
    const existing =
      existingByCode ??
      (await findFirstByField("produtos", "nome_normalizado", normalizedName(produto.nome))) ??
      (await findFirstByField("produtos", "nome", produto.nome));
    const productPayload = {
      nome: produto.nome,
      nome_normalizado: normalizedName(produto.nome),
      ...(produto.codigo ? { codigo: produto.codigo } : {}),
      ...(produto.ncm ? { ncm: produto.ncm } : {}),
      unidade_medida: produto.unidade_medida,
      ultima_quantidade: produto.quantidade,
      ultimo_valor_unitario: produto.valor_unitario,
      ultimo_valor_total: produto.valor_total,
      ultimo_fornecedor: result.fornecedor.razao_social,
      ultimo_fornecedor_cnpj: result.fornecedor.cnpj,
      ultima_nfe: result.numero,
      ultima_compra_em: result.dataEmissao.slice(0, 10),
      descricao: existing?.descricao ?? "Cadastrado automaticamente via importação de NFe"
    };

    if (!existing) {
      await createRecord("produtos", productPayload);
    } else if (existing.id) {
      await updateRecord("produtos", existing.id, productPayload);
    }
  }

  const nfeId = await createRecord("nfes_importadas", {
    numero: result.numero,
    data_emissao: result.dataEmissao,
    valor_total: result.valorTotal,
    fornecedor_id: fornecedor.id,
    fornecedor_cnpj: result.fornecedor.cnpj,
    produtos: result.produtos
  });

  await createRecord("movimentacoes_financeiras", {
    descricao: `NFe ${result.numero} - ${result.fornecedor.razao_social}`,
    valor: result.valorTotal,
    tipo: "saida",
    data_lancamento: new Date().toISOString().slice(0, 10),
    data_vencimento_recebimento: result.dataEmissao.slice(0, 10),
    categoria: "insumos",
    status: "pendente",
    referencia_nfe_id: nfeId
  });

  return nfeId;
}
