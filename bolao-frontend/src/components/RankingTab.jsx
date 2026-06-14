// src/components/RankingTab.jsx
import React, { useMemo, useState } from "react";
import FlagIcon from "./FlagIcon";

export default function RankingTab({
  ranking,
  rankingLoading,
  rankingError,
  onRetry,
  session,
  leagues = [],
  publicBets = [],
  matches = [],
}) {
  const [selectedLeagueId, setSelectedLeagueId] = useState("geral");

  const selectedLeague = useMemo(
    () => (selectedLeagueId === "geral" ? null : leagues.find((l) => l.id === selectedLeagueId) ?? null),
    [leagues, selectedLeagueId]
  );

  const leagueRanking = useMemo(() => {
    if (!selectedLeague) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    return ranking
      .map((r, idx) => ({ ...r, overallPos: idx + 1 }))
      .filter((r) => memberIds.has(r.user_id));
  }, [selectedLeague, ranking]);

  const lastLockedMatch = useMemo(() => {
    const locked = matches
      .filter((m) => m.is_locked)
      .sort((a, b) => new Date(b.kickoff_at_utc) - new Date(a.kickoff_at_utc));
    return locked[0] ?? null;
  }, [matches]);

  const leagueLastGameBets = useMemo(() => {
    if (!selectedLeague || !lastLockedMatch) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    return publicBets
      .filter((b) => b.match_id === lastLockedMatch.id && memberIds.has(b.user_id))
      .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
  }, [selectedLeague, lastLockedMatch, publicBets]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <section className="section">
      {/* Seletor de liga — só aparece se o usuário tem ligas */}
      {leagues.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <select
            className="filter-select"
            style={{ width: "100%", minHeight: "44px" }}
            value={selectedLeagueId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedLeagueId(v === "geral" ? "geral" : Number(v));
            }}
          >
            <option value="geral">Ranking Geral</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {rankingLoading && (
        <div className="loading-state">
          <span className="spinner" aria-hidden="true" />
          Carregando ranking...
        </div>
      )}

      {rankingError && (
        <div className="alert alert-error error-with-retry">
          {rankingError}
          {onRetry && (
            <button className="btn ghost small retry-btn" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {!rankingLoading && !rankingError && ranking.length === 0 && (
        <p className="empty-state">
          O ranking será exibido após o primeiro jogo com resultado oficial.
        </p>
      )}

      {/* ── Vista global ── */}
      {selectedLeagueId === "geral" && ranking.length > 0 && (
        <div className="ranking-card">
          <h2 className="section-title">Ranking geral</h2>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, index) => {
                const isMe = r.user_id === session.id;
                const rowClass = isMe
                  ? "me-row"
                  : index === 0 ? "rank-1"
                  : index === 1 ? "rank-2"
                  : index === 2 ? "rank-3"
                  : "";
                return (
                  <tr key={r.user_id} className={rowClass}>
                    <td>{medals[index] ?? index + 1}</td>
                    <td>
                      {r.user_name}
                      {isMe && (
                        <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>você</span>
                      )}
                    </td>
                    <td className="points-cell">{r.total_points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vista de liga ── */}
      {selectedLeagueId !== "geral" && selectedLeague && (
        <>
          {/* Ranking filtrado */}
          <div className="ranking-card">
            <h2 className="section-title">{selectedLeague.name}</h2>
            {leagueRanking.length === 0 ? (
              <p className="empty-state" style={{ padding: "0.75rem 0" }}>
                Nenhum membro com pontuação ainda.
              </p>
            ) : (
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>Pts</th>
                    <th style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: "0.8rem" }}>Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueRanking.map((r, idx) => {
                    const isMe = r.user_id === session.id;
                    const rowClass = isMe
                      ? "me-row"
                      : idx === 0 ? "rank-1"
                      : idx === 1 ? "rank-2"
                      : idx === 2 ? "rank-3"
                      : "";
                    return (
                      <tr key={r.user_id} className={rowClass}>
                        <td>{medals[idx] ?? idx + 1}</td>
                        <td>
                          {r.user_name}
                          {isMe && (
                            <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>você</span>
                          )}
                        </td>
                        <td className="points-cell">{r.total_points}</td>
                        <td style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8rem" }}>{r.overallPos}°</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Palpites do último jogo */}
          {lastLockedMatch && (
            <div className="ranking-card" style={{ marginTop: "1rem" }}>
              <h3 className="section-title" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", verticalAlign: "middle" }}>
                  <FlagIcon code={lastLockedMatch.home_team_code} name={lastLockedMatch.home_team_name} />
                  {lastLockedMatch.home_team_name ?? lastLockedMatch.home_team_code}
                  {" x "}
                  {lastLockedMatch.away_team_name ?? lastLockedMatch.away_team_code}
                  <FlagIcon code={lastLockedMatch.away_team_code} name={lastLockedMatch.away_team_name} />
                </span>
              </h3>
              {leagueLastGameBets.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.5 }}>
                  Nenhum palpite disponível ainda.
                </p>
              ) : (
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Palpite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueLastGameBets.map((b) => (
                      <tr key={b.user_id}>
                        <td>{b.user_name}</td>
                        <td>{b.home_score_prediction} x {b.away_score_prediction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
