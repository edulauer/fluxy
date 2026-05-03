import { LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function Login({ error, onLogin }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    await onLogin(password);
    setSubmitting(false);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-icon" aria-hidden="true">
          <LockKeyhole size={24} strokeWidth={2.2} />
        </div>
        <div>
          <p className="eyebrow">Mini SaaS financeiro</p>
          <h1>Fluxo Simples</h1>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Senha</span>
            <input
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite a senha"
              required
              type="password"
              value={password}
            />
          </label>

          {error && <div className="alert">{error}</div>}

          <button className="primary-button income" disabled={submitting} type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
