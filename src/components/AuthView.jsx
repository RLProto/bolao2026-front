// src/components/AuthView.jsx
import React, { useState } from "react";

export default function AuthView({
  onAuthSuccess,
  registerUser,
  loginUser,
  requestPasswordReset,
}) {
  const [authMode, setAuthMode] = useState("login"); // login | register | reset

  // Campos de autenticação
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  // Mensagens
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Reset
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // -------------------------------
  // LOGIN / REGISTER
  // -------------------------------
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!authEmail || !authPassword || (authMode === "register" && !authName)) {
      setAuthError("Preencha todos os campos.");
      return;
    }

    if (authPassword.length < 8) {
      setAuthError("Senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setAuthLoading(true);
    try {
      let data;
      if (authMode === "register") {
        data = await registerUser(authName.trim(), authEmail.trim(), authPassword);
        setAuthMessage("Cadastro realizado com sucesso! Você já está logado.");
      } else {
        data = await loginUser(authEmail.trim(), authPassword);
      }

      onAuthSuccess(data);
      setAuthPassword("");

    } catch (err) {
      setAuthError(err.message || "Erro na autenticação");
    } finally {
      setAuthLoading(false);
    }
  }

  // -------------------------------
  // RESET DE SENHA
  // -------------------------------
  async function handleRequestReset(e) {
    e.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!resetEmail) {
      setResetError("Informe o email cadastrado.");
      return;
    }

    setResetLoading(true);
    try {
      await requestPasswordReset(resetEmail.trim());
      setResetMessage(
        "Se este email estiver cadastrado, você receberá um link de redefinição (em ambiente dev, veja o console do backend)."
      );
    } catch (err) {
      setResetError(err.message || "Erro ao solicitar reset de senha.");
    } finally {
      setResetLoading(false);
    }
  }

  // -------------------------------
  // JSX
  // -------------------------------
  return (
    <>
      {/* HERO */}
      <section className="hero hero-worldcup">
        <div className="hero-text">
          <h1>Bolão 2026</h1>
          <p>
            Monte seus palpites e acompanhe o ranking em tempo real.
            Visual otimizado para celular • Estilo app oficial.
          </p>
        </div>

        <div className="hero-badge">
          <span>2026</span>
          <small>World Cup</small>
        </div>
      </section>

      <div className="auth-layout">
        {/* ==========================
            PAINEL LOGIN / REGISTER
           ========================== */}
        {authMode !== "reset" && (
          <div className="auth-card">
            <div className="auth-toggle">
              <button
                className={`pill ${authMode === "login" ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Entrar
              </button>

              <button
                className={`pill ${authMode === "register" ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="form">
              {authMode === "register" && (
                <div className="form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Como quer aparecer no ranking"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Senha</label>
                <div className="password-wrapper">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />

                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    aria-label={showAuthPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showAuthPassword ? (
                      // Olho cortado
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 2 12 2 12a18.37 18.37 0 0 1 4.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.38 18.38 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      // Olho normal
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {authError && <div className="alert alert-error">{authError}</div>}
              {authMessage && <div className="alert alert-success">{authMessage}</div>}

              <button className="btn primary w-100" disabled={authLoading} type="submit">
                {authLoading
                  ? "Enviando..."
                  : authMode === "login"
                  ? "Entrar"
                  : "Criar conta"}
              </button>
            </form>

            {authMode === "login" && (
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setAuthMode("reset");
                  setResetEmail(authEmail || "");
                }}
              >
                Esqueceu a senha?
              </button>
            )}
          </div>
        )}

        {/* ==========================
            PAINEL RESET DE SENHA
           ========================== */}
        {authMode === "reset" && (
          <div className="auth-card secondary">
            <h2>Redefinir senha</h2>
            <p className="subtitle">
              Informe seu email cadastrado:
              <br />
              <span className="small">(Em dev, o link aparece no console do backend)</span>
            </p>

            <form onSubmit={handleRequestReset} className="form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              {resetError && <div className="alert alert-error">{resetError}</div>}
              {resetMessage && (
                <div className="alert alert-success">{resetMessage}</div>
              )}

              <button className="btn ghost w-100" disabled={resetLoading} type="submit">
                {resetLoading ? "Enviando..." : "Enviar link de reset"}
              </button>
            </form>

            <button
              className="link-button"
              type="button"
              onClick={() => {
                setAuthMode("login");
                setResetMessage("");
                setResetError("");
              }}
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
