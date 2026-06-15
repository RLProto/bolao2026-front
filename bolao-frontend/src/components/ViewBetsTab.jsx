// src/components/ViewBetsTab.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import FlagIcon from "./FlagIcon";
import { fetchPublicBets } from "../api";

export default function ViewBetsTab({
  matches,
  formatDateTime,
  championPicks = [],
  championPicksLoading = false,
  championPicksError = "",
}) {
  const [selectedMatchId, setSelectedMatchId] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [championOpen, setChampionOpen] = useState(false);

  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const autoSelected = useRef(false);

  const lockedMatches = useMemo(() => {
    const base = matches
      .filter((m) => m.is_locked)
      .sort((a, b) => new Date(a.kickoff_at_utc) - new Date(b.kickoff_at_utc));
    if (!hideCompleted) return base;
    return base.filter((m) => m.home_score == null && m.away_score == null);
  }, [matches, hideCompleted]);

  // Auto-seleciona o último jogo bloqueado
  useEffect(() => {
    if (!autoSelected.current && lockedMatches.length > 0) {
      setSelectedMatchId(lockedMatches[lockedMatches.length - 1].id);
      autoSelected.current = true;
    }
  }, [lockedMatches]);

  // Fetch ao mudar filtro — sempre filtra no backend
  useEffect(() => {
    if (selectedMatchId !== "all") {
      setLoading(true);
      setError("");
      fetchPublicBets({ matchId: selectedMatchId })
        .then((data) => setBets(data || []))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (selectedUserId !== "all") {
      setLoading(true);
      setError("");
      fetchPublicBets({ userId: selectedUserId })
        .then((data) => setBets(data || []))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      setBets([]);
    }
  }, [selectedMatchId, selectedUserId]);

  function handleUserChange(val) {
    setSelectedUserId(val);
    if (val === "all" && selectedMatchId === "all") {
      setSelectedMatchId(lockedMatches[lockedMatches.length - 1]?.id ?? "all");
    }
  }

  const lockedMatchIds = useMemo(
    () => new Set(lockedMatches.map((m) => m.id)),
    [lockedMatches]
  );

  const lockedBets = useMemo(
    () => bets.filter((b) => lockedMatchIds.has(b.match_id)),
    [bets, lockedMatchIds]
  );

  // Usuários derivados dos palpites carregados (para o dropdown de filtro)
  const users = useMemo(() => {
    const map = new Map();
    lockedBets.forEach((b) => {
      if (!map.has(b.user_id)) map.set(b.user_id, b.user_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [lockedBets]);

  const matchLabelById = useMemo(() => {
    const map = {};
    lockedMatches.forEach((m, idx) => {
      const home = m.home_team_code || m.home_team_name || "TBD";
      const away = m.away_team_code || m.away_team_name || "TBD";
      map[m.id] = `Jogo ${idx + 1} - ${home} x ${away}`;
    });
    return map;
  }, [lockedMatches]);

  const filteredBets = useMemo(() => {
    return lockedBets.filter((b) => {
      if (selectedMatchId !== "all" && b.match_id !== selectedMatchId) return false;
      if (selectedUserId !== "all" && b.user_id !== selectedUserId) return false;
      return true;
    });
  }, [lockedBets, selectedMatchId, selectedUserId]);

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
      {(championPicksLoading || championPicksError || championPicks.length > 0) && (
        <div
          className="ranking-card"
          style={{ marginTop: "1.25rem", marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}
        >
          <button
            type="button"
            onClick={() => setChampionOpen((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "1rem 1.1rem",
              background: "none", border: "none", cursor: "pointer",
              color: "inherit", fontSize: "1rem", fontWeight: 700, textAlign: "left",
            }}
          >
            <span>Campeão da Copa</span>
            <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>
              {championOpen ? "▲ recolher" : "▼ ver palpites"}
            </span>
          </button>

          {championOpen && (
            <div style={{ padding: "0 1.1rem 1rem" }}>
              {championPicksLoading && <p style={{ margin: 0, opacity: 0.6 }}>Carregando...</p>}
              {championPicksError && <div className="alert alert-error">{championPicksError}</div>}
              {!championPicksLoading && !championPicksError && (
                <table className="ranking-table">
                  <colgroup><col /><col style={{ width: "55%" }} /></colgroup>
                  <thead>
                    <tr><th>Jogador</th><th>Campeão escolhido</th></tr>
                  </thead>
                  <tbody>
                    {championPicks.map((p) => (
                      <tr key={p.user_id}>
                        <td>{p.user_name}</td>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FlagIcon code={p.team_code} name={p.team_name} />
                            {p.team_name}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className="view-bets-toolbar"
        style={{
          marginTop: "1.25rem", marginBottom: "1.25rem", padding: "1rem 1.1rem",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div
          className="view-bets-toolbar-header"
          style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: "1rem", marginBottom: "1rem", flexWrap: "wrap",
          }}
        >
          <div>
            <h3 className="view-bets-title" style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700 }}>
              Palpites públicos
            </h3>
            <p className="view-bets-description" style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: "0.95rem", lineHeight: 1.45 }}>
              Veja os palpites dos outros jogadores para partidas cujo prazo já encerrou.
            </p>
          </div>
          <label htmlFor="hideCompletedSwitch" style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <div className="switch">
              <input type="checkbox" id="hideCompletedSwitch" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
              <span className="switch-slider" />
            </div>
          </label>
        </div>

        <div
          className="view-bets-filters-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <label className="filter-label" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Jogo</label>
            <select
              className="filter-select"
              style={{ minHeight: "44px" }}
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              {selectedUserId !== "all" && <option value="all">Todos os jogos</option>}
              {lockedMatches.map((m) => (
                <option key={m.id} value={m.id}>{matchLabelById[m.id]}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <label className="filter-label" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Usuário</label>
            <select
              className="filter-select"
              style={{ minHeight: "44px" }}
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Todos os usuários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p>Carregando palpites...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && groupedByMatch.length === 0 && (selectedMatchId !== "all" || selectedUserId !== "all") && (
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", marginTop: "2rem" }}>
          Nenhum palpite encontrado.
        </p>
      )}

      {!loading && !error && groupedByMatch.map(({ match, bets }) => {
        const homeName = match.home_team_name || "TBD";
        const awayName = match.away_team_name || "TBD";
        return (
          <div key={match.id} className="ranking-card" style={{ marginTop: "0.8rem" }}>
            <div className="match-header">
              <div className="match-header-left">
                <span className="match-stage">{match.stage}</span>
                <span className="match-subtitle">{homeName} x {awayName}</span>
              </div>
              <div className="match-header-right">
                <div className="flags-row">
                  <FlagIcon code={match.home_team_code} name={homeName} />
                  <span className="vs">x</span>
                  <FlagIcon code={match.away_team_code} name={awayName} />
                </div>
                <span className="match-datetime-short">{formatDateTime(match.kickoff_at_utc)}</span>
              </div>
            </div>
            <table className="ranking-table">
              <colgroup><col /><col style={{ width: "5rem" }} /></colgroup>
              <thead>
                <tr><th>Jogador</th><th>Palpite</th></tr>
              </thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={`${b.match_id}-${b.user_id}`}>
                    <td>{b.user_name}</td>
                    <td>{b.home_score_prediction} x {b.away_score_prediction}</td>
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
