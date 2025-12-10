// src/components/BetHistoryTab.jsx
import React, { useMemo, useState } from "react";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export default function BetHistoryTab({ history, loading, error, onReload }) {
  const [userFilter, setUserFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");

  // opções de usuários e partidas com base no resultado carregado
  const { userOptions, matchOptions, filtered } = useMemo(() => {
    const usersMap = new Map();
    const matchesMap = new Map();

    history.forEach((h) => {
      if (!usersMap.has(h.user_id)) {
        usersMap.set(h.user_id, h.user_name);
      }
      const labelMatch = `${h.match_id} – ${h.home_team_name || "???"} x ${
        h.away_team_name || "???"
      }`;
      if (!matchesMap.has(h.match_id)) {
        matchesMap.set(h.match_id, labelMatch);
      }
    });

    const uOpts = Array.from(usersMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
    const mOpts = Array.from(matchesMap.entries()).map(([id, label]) => ({
      id,
      label,
    }));

    return {
      userOptions: uOpts,
      matchOptions: mOpts,
      filtered: history,
    };
  }, [history]);

  const rows = useMemo(() => {
    return filtered.filter((h) => {
      if (userFilter && h.user_id !== Number(userFilter)) return false;
      if (matchFilter && h.match_id !== Number(matchFilter)) return false;
      return true;
    });
  }, [filtered, userFilter, matchFilter]);

  return (
    <section className="section">
      <div className="info-card">
        <h2>Histórico de apostas </h2>
        <p className="subtitle">
          Últimos registros da tabela <code>bet_history</code>. Apenas admins
          conseguem ver esta tela.
        </p>

        {/* toolbar de filtros + botão recarregar */}
        <div className="matches-toolbar" style={{ marginTop: "0.4rem" }}>
          <div className="matches-filter-control">
            <span className="filter-label">Usuário:</span>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (#{u.id})
                </option>
              ))}
            </select>
          </div>

          <div className="matches-filter-control">
            <span className="filter-label">Partida:</span>
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
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

          <button
            type="button"
            className="btn ghost small"
            onClick={onReload}
            disabled={loading}
          >
            {loading ? "Recarregando..." : "Recarregar"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading && !rows.length && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Carregando histórico…
          </div>
        )}

        {!loading && !rows.length && !error && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Nenhum registro encontrado para os filtros atuais.
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: "0.6rem", maxHeight: "60vh", overflow: "auto" }}>
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Partida</th>
                  <th>Ação</th>
                  <th>Palpite novo</th>
                  <th>Palpite anterior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td>{h.id}</td>
                    <td>{formatDateTime(h.changed_at_utc)}</td>
                    <td>
                      {h.user_name} <span className="small">#{h.user_id}</span>
                    </td>
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
                    <td>
                      {h.home_score_prediction} x {h.away_score_prediction}
                    </td>
                    <td>
                      {h.prev_home_score_prediction ?? "-"} x{" "}
                      {h.prev_away_score_prediction ?? "-"}
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
