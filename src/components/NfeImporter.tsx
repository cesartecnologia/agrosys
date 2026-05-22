"use client";

import { FileUp, Save } from "lucide-react";
import { useState } from "react";
import { parseNfeXml, persistNfeImport } from "@/lib/nfe";
import { notify } from "@/lib/notify";
import { toCurrency } from "@/lib/format";
import type { NfeImportResult } from "@/types/domain";

export function NfeImporter() {
  const [result, setResult] = useState<NfeImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File) {
    setMessage("");
    setResult(null);
    if (!file) return;

    try {
      if (file.size > 5_000_000) {
        throw new Error("Arquivo muito grande. Selecione um XML de até 5 MB.");
      }

      const xml = await file.text();
      setResult(parseNfeXml(xml));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao ler XML.");
    }
  }

  async function saveImport() {
    if (!result) return;
    setBusy(true);
    setMessage("");
    try {
      const nfeId = await persistNfeImport(result);
      setMessage(`NFe importada com sucesso. ID: ${nfeId}`);
      notify({ message: "NFe importada e lançamentos salvos.", tone: "success" });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Não foi possível persistir a NFe.";
      setMessage(nextMessage);
      notify({ message: nextMessage, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="module-content">
      <label className="upload-box">
        <FileUp size={24} />
        <span>Selecionar XML da NFe</span>
        <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => handleFile(event.target.files?.[0])} />
      </label>

      {message && <div className="alert">{message}</div>}

      {result && (
        <div className="nfe-preview">
          <div>
            <span className="eyebrow">NFe {result.numero}</span>
            <h3>{result.fornecedor.razao_social}</h3>
            <p>{result.fornecedor.cnpj}</p>
          </div>
          <strong>{toCurrency(result.valorTotal)}</strong>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th>NCM</th>
                  <th>Qtd.</th>
                  <th>Unidade</th>
                  <th>Unitário</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {result.produtos.map((produto, index) => (
                  <tr key={`${produto.codigo || produto.nome}-${index}`}>
                    <td>{produto.codigo || "-"}</td>
                    <td>{produto.nome}</td>
                    <td>{produto.ncm || "-"}</td>
                    <td>{produto.quantidade}</td>
                    <td>{produto.unidade_medida}</td>
                    <td>{toCurrency(produto.valor_unitario)}</td>
                    <td>{toCurrency(produto.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={saveImport} disabled={busy}>
            <Save size={18} />
            Importar, organizar produtos e lançar financeiro
          </button>
        </div>
      )}
    </section>
  );
}
