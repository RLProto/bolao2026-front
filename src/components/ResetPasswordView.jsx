// src/components/ResetPasswordView.jsx
import React, { useState } from "react";

export default function ResetPasswordView({ resetToken, resetPassword, onBackToAuth }) {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

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

      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());

      setTimeout(() => {
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
      <div className="auth-card">
        <h1>Redefinir senha</h1>
        <p className="subtitle">
          Defina uma nova senha para sua conta. Ela deve ter pelo menos 8 caracteres.
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
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showNewPassword ? "🙈" : "👁"}
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
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowNewPasswordConfirm((v) => !v)}
                aria-label={showNewPasswordConfirm ? "Ocultar senha" : "Mostrar senha"}
              >
                {showNewPasswordConfirm ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {resetError && <div className="alert alert-error">{resetError}</div>}
          {resetMessage && <div className="alert alert-success">{resetMessage}</div>}
          <button className="btn primary w-100" disabled={resetLoading} type="submit">
            {resetLoading ? "Enviando..." : "Salvar nova senha"}
          </button>
          <button
            type="button"
            className="btn ghost w-100 mt-8"
            onClick={onBackToAuth}
          >
            Voltar para login
          </button>
        </form>
      </div>
    </main>
  );
}
