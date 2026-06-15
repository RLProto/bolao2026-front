// src/components/RankingTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import FlagIcon from "./FlagIcon";
import { fetchPublicBets } from "../api";

export default function RankingTab({
  ranking,
  rankingLoading,
  rankingError,
  onRetry,
  session,
  leagues = [],
  matches = [],
}) {
  const [selectedLeagueId, setSelectedLeagueId] = useState("geral");
  const [leagueBets, setLeagueBets] = useState([]);
  const [leagueBetsLoading, setLeagueBetsLoading] = useState(false);

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

  // Busca palpites do último jogo apenas quando uma liga está selecionada
  useEffect(() => {
    if (selectedLeagueId === "geral" || !lastLockedMatch) {
      setLeagueBets([]);
      return;
    }
    let cancelled = false;
    setLeagueBetsLoading(true);
    fetchPublicBets({ matchId: lastLockedMatch.id })
      .then((data) => { if (!cancelled) setLeagueBets(data || []); })
      .catch(() => { if (!cancelled) setLeagueBets([]); })
      .finally(() => { if (!cancelled) setLeagueBetsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLeagueId, lastLockedMatch?.id]);

  const leagueLastGameBets = useMemo(() => {
    if (!selectedLeague || !lastLockedMatch) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    return leagueBets
      .filter((b) => memberIds.has(b.user_id))
      .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
  }, [selectedLeague, lastLockedMatch, leagueBets]);

  const medals = ["🥇", "🥈", "🥉"];
  const ptsColorClass = (index) =>
    index === 0 ? "rank-pts-gold"
    : index === 1 ? "rank-pts-silver"
    : index === 2 ? "rank-pts-bronze"
    : index === 3 ? "rank-pts-sky"
    : index === 4 ? "rank-pts-violet"
    : "";
  const avatarColorClass = (index) =>
    index === 0 ? "rank-avatar-gold"
    : index === 1 ? "rank-avatar-silver"
    : index === 2 ? "rank-avatar-bronze"
    : index === 3 ? "rank-avatar-sky"
    : index === 4 ? "rank-avatar-violet"
    : "";
  const posIcon = (index) => {
    if (index < 3) return medals[index];
    if (index === 3) return <span className="rank-pos-chip rank-pos-chip-sky">4</span>;
    if (index === 4) return <span className="rank-pos-chip rank-pos-chip-violet">5</span>;
    return <span style={{ paddingLeft: "0.15rem", color: "var(--text-muted)" }}>{index + 1}</span>;
  };

  const RankingRows = ({ rows, showOverall = false }) =>
    rows.map((r, index) => {
      const isMe = r.user_id === session.id;
      const rowClass = isMe
        ? "me-row"
        : index === 0 ? "rank-1"
        : index === 1 ? "rank-2"
        : index === 2 ? "rank-3"
        : index === 3 ? "rank-4"
        : index === 4 ? "rank-5"
        : "";
      const initials = r.user_name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
      return (
        <tr key={r.user_id} className={rowClass}>
          <td className="rank-pos-cell">
            {posIcon(index)}
          </td>
          <td>
            <div className="rank-name-cell">
              <span className={`rank-avatar ${avatarColorClass(index)}`}>{initials}</span>
              <span className="rank-name-text">{r.user_name}</span>
              {isMe && <span className="rank-you-badge">você</span>}
            </div>
          </td>
          <td style={{ textAlign: "right" }}>
            <span className={`rank-pts-badge ${ptsColorClass(index)}`}>{r.total_points}</span>
          </td>
          {showOverall && (
            <td className="rank-overall-pos" style={{ textAlign: "right" }}>{r.overallPos}°</td>
          )}
        </tr>
      );
    });

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
          <div className="ranking-card-header">
            <span className="ranking-card-icon">🏆</span>
            <h2 className="section-title">Ranking geral</h2>
          </div>
          <table className="ranking-table">
            <thead>
              <tr>
                <th style={{ width: "2rem" }}>#</th>
                <th>Nome</th>
                <th style={{ textAlign: "right" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              <RankingRows rows={ranking} />
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vista de liga ── */}
      {selectedLeagueId !== "geral" && selectedLeague && (
        <>
          {/* Ranking filtrado */}
          <div className="ranking-card">
            <div className="ranking-card-header">
              <span className="ranking-card-icon">🏅</span>
              <h2 className="section-title">{selectedLeague.name}</h2>
            </div>
            {leagueRanking.length === 0 ? (
              <p className="empty-state" style={{ padding: "0.75rem 0" }}>
                Nenhum membro com pontuação ainda.
              </p>
            ) : (
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th style={{ width: "2rem" }}>#</th>
                    <th>Nome</th>
                    <th style={{ textAlign: "right" }}>Pts</th>
                    <th style={{ textAlign: "right" }}>Geral</th>
                  </tr>
                </thead>
                <tbody>
                  <RankingRows rows={leagueRanking} showOverall />
                </tbody>
              </table>
            )}
          </div>

          {/* Palpites do último jogo */}
          {lastLockedMatch && (
            <div className="ranking-card" style={{ marginTop: "1rem" }}>
              <div className="ranking-card-header">
                <span className="ranking-card-icon">⚽</span>
                <h3 className="section-title" style={{ fontSize: "0.9rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", verticalAlign: "middle" }}>
                    <FlagIcon code={lastLockedMatch.home_team_code} name={lastLockedMatch.home_team_name} />
                    {lastLockedMatch.home_team_name ?? lastLockedMatch.home_team_code}
                    {" x "}
                    {lastLockedMatch.away_team_name ?? lastLockedMatch.away_team_code}
                    <FlagIcon code={lastLockedMatch.away_team_code} name={lastLockedMatch.away_team_name} />
                  </span>
                </h3>
              </div>
              {leagueBetsLoading ? (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.5 }}>Carregando...</p>
              ) : leagueLastGameBets.length === 0 ? (
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
                        <td>
                          <div className="rank-name-cell">
                            <span className="rank-avatar">
                              {b.user_name.split(" ").slice(0,2).map((w) => w[0]).join("").toUpperCase()}
                            </span>
                            <span className="rank-name-text">{b.user_name}</span>
                          </div>
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {b.home_score_prediction} x {b.away_score_prediction}
                        </td>
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
