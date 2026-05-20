"use client";

import { Leaf, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

function friendlyLoginError(message: string) {
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) return "E-mail ou senha incorretos.";
  if (message.includes("auth/user-not-found")) return "Usuário não encontrado.";
  if (message.includes("auth/too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (message.includes("auth/network-request-failed")) return "Falha de conexão. Tente novamente.";
  return "Não foi possível entrar. Confira os dados e tente novamente.";
}

export function LoginScreen() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await login(email, password);
    } catch (error) {
      setMessage(error instanceof Error ? friendlyLoginError(error.message) : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setMessage("Informe o e-mail para redefinir a senha.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await resetPassword(email);
      setMessage("E-mail de redefinição enviado.");
    } catch (error) {
      setMessage(error instanceof Error ? friendlyLoginError(error.message) : "Não foi possível redefinir a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">
          <Leaf size={28} />
        </div>
        <h1>Gestão Agrícola</h1>
        <p>Entre para acompanhar a rotina da fazenda.</p>

        {!isFirebaseConfigured && (
          <div className="alert">
            Configuração de acesso pendente. Confira o arquivo `.env.local`.
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {message && <span className="form-message">{message}</span>}
          <button type="submit" disabled={busy || !isFirebaseConfigured}>
            <LogIn size={18} />
            Entrar
          </button>
          <button type="button" className="ghost-button" onClick={handleReset} disabled={busy || !isFirebaseConfigured}>
            Redefinir senha
          </button>
        </form>
      </section>
    </main>
  );
}
