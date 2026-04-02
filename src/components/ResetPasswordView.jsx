// src/components/ResetPasswordView.jsx
import React, { useEffect, useRef, useState } from "react";

export default function ResetPasswordView({
  resetToken,
  resetPassword,
  onBackToAuth,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  const backTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (backTimerRef.current) {
        clearTimeout(backTimerRef.current);
      }
    };
  }, []);

  function clearTokenFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }

  function handleBackToAuth() {
    clearTokenFromUrl();
    onBackToAuth();
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!resetToken) {
      setResetError("Token não encontrado.");
      return;
    }

    if (newPassword.length < 8) {
      setResetError("Nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setResetError("As senhas não conferem.");
      return;
    }

    setResetLoading(true);

    try {
      await resetPassword(resetToken, newPassword);

      setResetMessage("Senha redefinida com sucesso. Faça login novamente.");
      setNewPassword("");
      setNewPasswordConfirm("");

      clearTokenFromUrl();

      backTimerRef.current = setTimeout(() => {
        onBackToAuth();
      }, 1500);
    } catch (err) {
      setResetError(err.message || "Erro ao redefinir senha");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="main">
      <div className="auth-layout">
        <div className="auth-card secondary">
          <h1>Redefinir senha</h1>
          <p className="subtitle">
            Defina uma nova senha para sua conta. Ela deve ter pelo menos 8
            caracteres.
          </p>

          <form onSubmit={handleResetPassword} className="form">
            <div className="form-group">
              <label>Nova senha</label>
              <div className="password-wrapper">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={
                    showNewPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {showNewPassword ? (
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

            <div className="form-group">
              <label>Confirmar nova senha</label>
              <div className="password-wrapper">
                <input
                  type={showNewPasswordConfirm ? "text" : "password"}
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowNewPasswordConfirm((v) => !v)}
                  aria-label={
                    showNewPasswordConfirm ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {showNewPasswordConfirm ? (
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

            {resetError && <div className="alert alert-error">{resetError}</div>}
            {resetMessage && (
              <div className="alert alert-success">{resetMessage}</div>
            )}

            <button
              className="btn primary w-100"
              disabled={resetLoading}
              type="submit"
            >
              {resetLoading ? "Enviando..." : "Salvar nova senha"}
            </button>

            <button
              type="button"
              className="btn ghost w-100 mt-8"
              onClick={handleBackToAuth}
            >
              Voltar para login
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}