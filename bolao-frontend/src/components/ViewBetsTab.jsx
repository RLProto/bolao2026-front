// src/components/ViewBetsTab.jsx
import React, { useMemo, useState } from "react";
import FlagIcon from "./FlagIcon";

export default function ViewBetsTab({
  matches,
  bets,
  loading,
  error,
  formatDateTime,
}) {
  const [selectedMatchId, setSelectedMatchId] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);

  // Só partidas cujo prazo já encerrou (is_locked = true)
  const lockedMatches = useMemo(() => {
    const base = matches
      .filter((m) => m.is_locked)
      .sort(
        (a, b) =>
          new Date(a.kickoff_at_utc).getTime() -
          new Date(b.kickoff_at_utc).getTime()
      );

    if (!hideCompleted) return base;

    // esconder jogos que já têm resultado oficial
    return base.filter((m) => m.home_score == null && m.away_score == null);
  }, [matches, hideCompleted]);

  const lockedMatchIds = useMemo(
    () => new Set(lockedMatches.map((m) => m.id)),
    [lockedMatches]
  );

  // Bets somente desses jogos
  const lockedBets = useMemo(
    () => bets.filter((b) => lockedMatchIds.has(b.match_id)),
    [bets, lockedMatchIds]
  );

  // Usuários únicos, ordenados por nome
  const users = useMemo(() => {
    const map = new Map();
    lockedBets.forEach((b) => {
      if (!map.has(b.user_id)) {
        map.set(b.user_id, b.user_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [lockedBets]);

  // Label de jogo: "Jogo 1 - BRA x HOL"
  const matchLabelById = useMemo(() => {
    const map = {};
    lockedMatches.forEach((m, idx) => {
      const home = m.home_team_code || m.home_team_name || "TBD";
      const away = m.away_team_code || m.away_team_name || "TBD";
      map[m.id] = `Jogo ${idx + 1} - ${home} x ${away}`;
    });
    return map;
  }, [lockedMatches]);

  // Aplica filtros
  const filteredBets = useMemo(
    () =>
      lockedBets.filter((b) => {
        if (selectedMatchId !== "all" && b.match_id !== selectedMatchId) {
          return false;
        }
        if (selectedUserId !== "all" && b.user_id !== selectedUserId) {
          return false;
        }
        return true;
      }),
    [lockedBets, selectedMatchId, selectedUserId]
  );

  // Agrupa por partida
  const groupedByMatch = useMemo(() => {
    const map = new Map();
    filteredBets.forEach((b) => {
      if (!map.has(b.match_id)) map.set(b.match_id, []);
      map.get(b.match_id).push(b);
    });

    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
    }

    return lockedMatches
      .filter((m) => map.has(m.id))
      .map((m) => ({ match: m, bets: map.get(m.id) }));
  }, [filteredBets, lockedMatches]);

  return (
    <section className="section">
      <div
        className="view-bets-toolbar"
        style={{
          marginTop: "1.25rem",
          marginBottom: "1.25rem",
          padding: "1rem 1.1rem",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          background: "rgba(255, 255, 255, 0.03)",
        }}
      >
        <div
          className="view-bets-toolbar-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              className="view-bets-title"
              style={{
                margin: "0 0 0.25rem 0",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              Palpites públicos
            </h3>

            <p
              className="view-bets-description"
              style={{
                margin: 0,
                color: "rgba(255, 255, 255, 0.78)",
                fontSize: "0.95rem",
                lineHeight: 1.45,
              }}
            >
              Veja os palpites dos outros jogadores para partidas cujo prazo já
              encerrou.
            </p>
          </div>

          <label
            className="view-bets-switch-label"
            htmlFor="hideCompletedSwitch"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              cursor: "pointer",
            }}
          >
            <div className="switch">
              <input
                type="checkbox"
                id="hideCompletedSwitch"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
              />
              <span className="switch-slider" />
            </div>
          </label>
        </div>

        <div
          className="view-bets-filters-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            className="matches-filter-control"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            <label
              className="filter-label"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              Jogo
            </label>
            <select
              className="filter-select"
              style={{ minHeight: "44px" }}
              value={selectedMatchId}
              onChange={(e) =>
                setSelectedMatchId(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
            >
              <option value="all">Todos os jogos</option>
              {lockedMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabelById[m.id]}
                </option>
              ))}
            </select>
          </div>

          <div
            className="matches-filter-control"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            <label
              className="filter-label"
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
            >
              Usuário
            </label>
            <select
              className="filter-select"
              style={{ minHeight: "44px" }}
              value={selectedUserId}
              onChange={(e) =>
                setSelectedUserId(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
            >
              <option value="all">Todos os usuários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p>Carregando palpites...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && groupedByMatch.length === 0 && (
        <p>Ainda não há palpites públicos para exibir com os filtros atuais.</p>
      )}

      {!loading &&
        !error &&
        groupedByMatch.map(({ match, bets }) => {
          const homeName = match.home_team_name || "TBD";
          const awayName = match.away_team_name || "TBD";
          const homeCode = match.home_team_code;
          const awayCode = match.away_team_code;

          return (
            <div
              key={match.id}
              className="ranking-card"
              style={{ marginTop: "0.8rem" }}
            >
              <div className="match-header">
                <div className="match-header-left">
                  <span className="match-stage">{match.stage}</span>
                  <span className="match-subtitle">
                    {homeName} x {awayName}
                  </span>
                </div>

                <div className="match-header-right">
                  <div className="flags-row">
                    <FlagIcon code={homeCode} name={homeName} />
                    <span className="vs">x</span>
                    <FlagIcon code={awayCode} name={awayName} />
                  </div>

                  <span className="match-datetime-short">
                    {formatDateTime(match.kickoff_at_utc)}
                  </span>
                </div>
              </div>

              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Jogador</th>
                    <th>Palpite</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((b) => (
                    <tr key={`${b.match_id}-${b.user_id}`}>
                      <td>{b.user_name}</td>
                      <td>
                        {b.home_score_prediction} x {b.away_score_prediction}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
    </section>
  );
}