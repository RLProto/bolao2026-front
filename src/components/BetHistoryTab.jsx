// src/components/BetHistoryTab.jsx
import React, { useMemo, useState } from "react";
import { fetchBetHistory } from "../api";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export default function BetHistoryTab({ matches = [] }) {
  const [userId, setUserId] = useState("");          // obrigatório
  const [matchId, setMatchId] = useState("");        // opcional ("" = todos)
  const [limit, setLimit] = useState(5000);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Ordenação dos usuários alfanumérica (para evitar o problema de 10 vir depois de 2)
  const userOptions = useMemo(() => {
    return matches
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)) // Alfabética
      .map((m) => ({
        id: m.id,
        label: `#${m.id} ${m.name}`,
      }));
  }, [matches]);

  // Ordenação das partidas numérica
  const matchOptions = useMemo(() => {
    return matches
      .slice()
      .sort((a, b) => a.id - b.id)  // Ordenação numérica
      .map((m) => ({
        id: m.id,
        label: `#${m.id} – ${m.home_team?.name || "???"} x ${m.away_team?.name || "???"}`,
      }));
  }, [matches]);

  async function onSearch() {
    setError("");
    setRows([]);

    const uid = Number(userId);
    if (!userId || Number.isNaN(uid) || uid <= 0) {
      setError("Selecione um usuário válido (user_id).");
      return;
    }

    const lim = Number(limit);
    if (Number.isNaN(lim) || lim < 1 || lim > 200000) {
      setError("Limit inválido (1 a 200000).");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchBetHistory({
        userId: uid,
        matchId: matchId ? Number(matchId) : undefined,
        limit: lim,
      });
      setRows(data);
    } catch (e) {
      setError(e.message || "Erro ao buscar histórico.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="info-card">
        <h2>Histórico de apostas</h2>
        <p className="subtitle">
          Para evitar travar, selecione um <b>usuário</b> e (opcionalmente) uma <b>partida</b>,
          depois clique em <b>Procurar</b>.
        </p>

        <div className="matches-toolbar" style={{ marginTop: "0.4rem" }}>
          {/* usuário obrigatório */}
          <div className="matches-filter-control">
            <span className="filter-label">Usuário (ID):</span>
            <input
              className="filter-select"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Ex: 1"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ maxWidth: 140 }}
            />
          </div>

          {/* partida opcional */}
          <div className="matches-filter-control">
            <span className="filter-label">Partida:</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas</option>
              {matchOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* limit */}
          <div className="matches-filter-control">
            <span className="filter-label">Limit:</span>
            <input
              className="filter-select"
              type="number"
              min="1"
              max="200000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ maxWidth: 120 }}
            />
          </div>

          <button
            type="button"
            className="btn ghost small"
            onClick={onSearch}
            disabled={loading}
          >
            {loading ? "Procurando..." : "Procurar"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && rows.length === 0 && !error && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Selecione um usuário e clique em <b>Procurar</b>.
          </div>
        )}

        {loading && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Buscando histórico…
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: "0.6rem", maxHeight: "60vh", overflow: "auto" }}>
            <div className="small" style={{ marginBottom: "0.4rem" }}>
              Retornou <b>{rows.length}</b> registros.
            </div>

            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quando</th>
                  <th>Partida</th>
                  <th>Ação</th>
                  <th>Palpite novo</th>
                  <th>Palpite anterior</th>
                </tr>
              </thead>
              <tbody>
                {rows.sort((a, b) => new Date(a.changed_at_utc) - new Date(b.changed_at_utc))  // Ordenação por data/hora
                .map((h) => (
                  <tr key={h.id}>
                    <td>{h.id}</td>
                    <td>{formatDateTime(h.changed_at_utc)}</td>
                    <td>
                      #{h.match_id}
                      <br />
                      <span className="small">
                        {h.home_team_name || "???"} x {h.away_team_name || "???"}
                      </span>
                      <br />
                      <span className="small">{h.match_stage}</span>
                    </td>
                    <td>{h.action_type}</td>
                    <td>{h.home_score_prediction} x {h.away_score_prediction}</td>
                    <td>
                      {h.prev_home_score_prediction ?? "-"} x {h.prev_away_score_prediction ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
