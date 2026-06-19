// src/components/AdminOverridePage.jsx
import React, { useEffect, useState } from "react";
import { fetchAdminUsers, fetchAdminMatches, adminOverrideBet } from "../api";

export default function AdminOverridePage() {
  const [phase, setPhase] = useState("password"); // "password" | "panel"
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");

  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    if (phase !== "panel") return;
    setLoadingData(true);
    Promise.all([fetchAdminUsers(), fetchAdminMatches()])
      .then(([u, m]) => { setUsers(u); setMatches(m); })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [phase]);

  function handleUnlock(e) {
    e.preventDefault();
    if (!pw.trim()) { setPwError("Digite a senha."); return; }
    setPwError("");
    setPhase("panel");
  }

  function handleLock() {
    setPhase("password");
    setPw("");
    setSaveResult(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!selectedUserId || !selectedMatchId || homeScore === "" || awayScore === "") return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await adminOverrideBet({
        secondaryPassword: pw,
        userId: Number(selectedUserId),
        matchId: Number(selectedMatchId),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
      });
      setSaveResult({ ok: true, message: `Palpite salvo para ${res.user_name}: ${homeScore} x ${awayScore}` });
      setHomeScore("");
      setAwayScore("");
    } catch (err) {
      if (err.message === "Senha incorreta.") {
        setPw("");
        setPhase("password");
        setPwError("Senha incorreta. Tente novamente.");
      } else {
        setSaveResult({ ok: false, message: err.message });
      }
    } finally {
      setSaving(false);
    }
  }

  if (phase === "password") {
    return (
      <div className="override-pw-overlay">
        <div className="override-pw-card">
          <h2 className="override-pw-title">🔒 Acesso restrito</h2>
          <p className="override-pw-sub">Insira a senha de administrador para continuar.</p>
          <form onSubmit={handleUnlock} className="override-pw-form">
            <input
              type="password"
              className="override-pw-input"
              placeholder="Senha"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(""); }}
              autoFocus
            />
            {pwError && <p className="override-pw-error">{pwError}</p>}
            <button type="submit" className="btn primary">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <section className="section override-panel">
      <div className="ranking-card">
        <div className="ranking-card-header">
          <span className="ranking-card-icon">⚙️</span>
          <h2 className="section-title">Override de Palpite</h2>
          <button
            className="btn ghost small override-lock-btn"
            onClick={handleLock}
            title="Trancar painel"
          >
            🔒
          </button>
        </div>

        {loadingData ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" />
            Carregando...
          </div>
        ) : (
          <form onSubmit={handleSave} className="override-form">
            <div className="override-field">
              <label className="filter-label">Usuário</label>
              <select
                className="filter-select"
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setSaveResult(null); }}
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="override-field">
              <label className="filter-label">Jogo</label>
              <select
                className="filter-select"
                value={selectedMatchId}
                onChange={(e) => { setSelectedMatchId(e.target.value); setSaveResult(null); }}
              >
                <option value="">Selecione um jogo</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="override-field">
              <label className="filter-label">Palpite</label>
              <div className="override-score-row">
                <input
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  className="override-score-input"
                  placeholder="Casa"
                  value={homeScore}
                  onChange={(e) => { setHomeScore(e.target.value); setSaveResult(null); }}
                />
                <span className="override-score-x">×</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  className="override-score-input"
                  placeholder="Fora"
                  value={awayScore}
                  onChange={(e) => { setAwayScore(e.target.value); setSaveResult(null); }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn primary"
              disabled={saving || !selectedUserId || !selectedMatchId || homeScore === "" || awayScore === ""}
            >
              {saving
                ? <><span className="btn-spinner" aria-hidden="true" /> Salvando...</>
                : "Salvar palpite"}
            </button>

            {saveResult && (
              <div className={`alert ${saveResult.ok ? "alert-success" : "alert-error"}`}>
                {saveResult.message}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
