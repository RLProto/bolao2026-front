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
  const [showLastBet, setShowLastBet] = useState(false);
  const [lastMatchBets, setLastMatchBets] = useState([]);
  const [lastBetsLoading, setLastBetsLoading] = useState(false);

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

  // Fetch bets when toggle is on OR when viewing a league
  useEffect(() => {
    const needBets = showLastBet || selectedLeagueId !== "geral";
    if (!needBets || !lastLockedMatch) {
      setLastMatchBets([]);
      return;
    }
    let cancelled = false;
    setLastBetsLoading(true);
    fetchPublicBets({ matchId: lastLockedMatch.id })
      .then((data) => { if (!cancelled) setLastMatchBets(data || []); })
      .catch(() => { if (!cancelled) setLastMatchBets([]); })
      .finally(() => { if (!cancelled) setLastBetsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLeagueId, lastLockedMatch?.id, showLastBet]);

  const betsMap = useMemo(
    () => new Map(lastMatchBets.map((b) => [b.user_id, b])),
    [lastMatchBets]
  );

  const leagueLastGameBets = useMemo(() => {
    if (!selectedLeague || !lastLockedMatch) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    return lastMatchBets
      .filter((b) => memberIds.has(b.user_id))
      .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
  }, [selectedLeague, lastLockedMatch, lastMatchBets]);

  const medals = ["🥇", "🥈", "🥉"];
  const ptsColorClass = (index) =>
    index === 0 ? "rank-pts-gold"
    : index === 1 ? "rank-pts-silver"
    : index === 2 ? "rank-pts-bronze"
    : "rank-pts-default";
  const posIcon = (index) => {
    if (index < 3) return medals[index];
    return <span style={{ paddingLeft: "0.15rem", color: "var(--text-muted)" }}>{index + 1}</span>;
  };

  const BetToggle = () => (
    <label className="rank-bet-toggle" title="Mostrar palpite do último jogo">
      <span className="rank-bet-toggle-label">Palpites</span>
      <span
        className={`rank-bet-track${showLastBet ? " on" : ""}`}
        onClick={() => setShowLastBet((v) => !v)}
        role="switch"
        aria-checked={showLastBet}
        tabIndex={0}
        onKeyDown={(e) => e.key === " " && setShowLastBet((v) => !v)}
      >
        <span className="rank-bet-thumb" />
      </span>
    </label>
  );

  const BetColHeader = () =>
    lastLockedMatch ? (
      <th className="rank-bet-col">
        <span className="rank-bet-col-header-inner">
          <span className="rank-bet-flag-wrap">
            <FlagIcon code={lastLockedMatch.home_team_code} name={lastLockedMatch.home_team_name} />
          </span>
          <span className="rank-bet-header-x">×</span>
          <span className="rank-bet-flag-wrap">
            <FlagIcon code={lastLockedMatch.away_team_code} name={lastLockedMatch.away_team_name} />
          </span>
        </span>
      </th>
    ) : (
      <th className="rank-bet-col">Ult.</th>
    );

  const RankingRows = ({ rows, showOverall = false }) =>
    rows.map((r, index) => {
      const isMe = r.user_id === session.id;
      const isLast = index === rows.length - 1;
      const rowClass = isMe
        ? "me-row"
        : index === 0 ? "rank-1"
        : index === 1 ? "rank-2"
        : index === 2 ? "rank-3"
        : "";
      const bet = showLastBet ? betsMap.get(r.user_id) : null;
      return (
        <tr key={r.user_id} className={rowClass}>
          <td className="rank-pos-cell">
            {posIcon(index)}
          </td>
          <td>
            <div className="rank-name-cell">
              <span className="rank-name-text">{r.user_name}</span>
              {isMe && <span className="rank-you-badge">você</span>}
              {isLast && <span title="Lanterna">🔦</span>}
            </div>
          </td>
          <td>
            <span className={`rank-pts ${ptsColorClass(index)}`}>{r.total_points}</span>
          </td>
          {showOverall && (
            <td className="rank-overall-pos">{r.overallPos}°</td>
          )}
          {showLastBet && (
            <td className="rank-bet-col">
              {lastBetsLoading
                ? <span className="rank-bet-loading">…</span>
                : bet
                ? <span className="rank-bet-score">{bet.home_score_prediction} × {bet.away_score_prediction}</span>
                : <span className="rank-bet-none">—</span>
              }
            </td>
          )}
        </tr>
      );
    });

  return (
    <section className="section">
      {/* Seletor de liga */}
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
            {lastLockedMatch && <BetToggle />}
          </div>
          <table className="ranking-table">
            <colgroup>
              <col style={{ width: "2.5rem" }} />
              <col />
              <col style={{ width: "3rem" }} />
              {showLastBet && <col style={{ width: "4rem" }} />}
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Pts</th>
                {showLastBet && <BetColHeader />}
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
              {lastLockedMatch && <BetToggle />}
            </div>
            {leagueRanking.length === 0 ? (
              <p className="empty-state" style={{ padding: "0.75rem 0" }}>
                Nenhum membro com pontuação ainda.
              </p>
            ) : (
              <table className="ranking-table">
                <colgroup>
                  <col style={{ width: "2.5rem" }} />
                  <col />
                  <col style={{ width: "3rem" }} />
                  <col style={{ width: "3rem" }} />
                  {showLastBet && <col style={{ width: "4rem" }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>Pts</th>
                    <th className="rank-overall-pos">Geral</th>
                    {showLastBet && <BetColHeader />}
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
              {lastBetsLoading ? (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.5 }}>Carregando...</p>
              ) : leagueLastGameBets.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.5 }}>
                  Nenhum palpite disponível ainda.
                </p>
              ) : (
                <table className="ranking-table">
                  <colgroup><col /><col style={{ width: "5rem" }} /></colgroup>
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th style={{ textAlign: "right" }}>Palpite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueLastGameBets.map((b) => (
                      <tr key={b.user_id}>
                        <td>
                          <div className="rank-name-cell">
                            <span className="rank-name-text">{b.user_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
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
