// src/components/RankingTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import FlagIcon from "./FlagIcon";
import { fetchPublicBets, fetchRanking, fetchPublicChampionPicks } from "../api";

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
  const [lastMatchBetsByMatch, setLastMatchBetsByMatch] = useState({}); // { [matchId]: Bet[] }
  const [lastBetsLoading, setLastBetsLoading] = useState(false);
  const [selectedLastMatchIndex, setSelectedLastMatchIndex] = useState(0);

  const [mataMataRanking, setMataMataRanking] = useState([]);
  const [mataMataLoading, setMataMataLoading] = useState(false);
  const [mataMataError, setMataMataError] = useState("");
  const [mataMataLoaded, setMataMataLoaded] = useState(false);

  const [showExactScores, setShowExactScores] = useState(false);

  const [showChampionFlag, setShowChampionFlag] = useState(false);
  const [championPicks, setChampionPicks] = useState([]);
  const [championPicksLoading, setChampionPicksLoading] = useState(false);
  const [championPicksLoaded, setChampionPicksLoaded] = useState(false);

  // Busca os palpites de campeão só na primeira vez que o toggle é ativado
  useEffect(() => {
    if (!showChampionFlag || championPicksLoaded) return;
    let cancelled = false;
    setChampionPicksLoading(true);
    fetchPublicChampionPicks()
      .then((data) => { if (!cancelled) { setChampionPicks(data || []); setChampionPicksLoaded(true); } })
      .catch(() => { if (!cancelled) setChampionPicks([]); })
      .finally(() => { if (!cancelled) setChampionPicksLoading(false); });
    return () => { cancelled = true; };
  }, [showChampionFlag, championPicksLoaded]);

  const championPickByUser = useMemo(
    () => new Map(championPicks.map((p) => [p.user_id, p])),
    [championPicks]
  );

  // Busca o ranking de mata-mata só na primeira vez que a aba é selecionada
  useEffect(() => {
    if (selectedLeagueId !== "mata_mata" || mataMataLoaded) return;
    let cancelled = false;
    setMataMataLoading(true);
    setMataMataError("");
    fetchRanking("mata_mata")
      .then((data) => { if (!cancelled) { setMataMataRanking(data || []); setMataMataLoaded(true); } })
      .catch((e) => { if (!cancelled) setMataMataError(e.message); })
      .finally(() => { if (!cancelled) setMataMataLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLeagueId, mataMataLoaded]);

  const selectedLeague = useMemo(
    () => (selectedLeagueId === "geral" || selectedLeagueId === "mata_mata" ? null : leagues.find((l) => l.id === selectedLeagueId) ?? null),
    [leagues, selectedLeagueId]
  );

  const leagueRanking = useMemo(() => {
    if (!selectedLeague) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    return ranking
      .map((r, idx) => ({ ...r, overallPos: idx + 1 }))
      .filter((r) => memberIds.has(r.user_id));
  }, [selectedLeague, ranking]);

  // Jogo(s) mais recentes que já começaram — pode ser mais de um quando há
  // horários simultâneos (ex: 3ª rodada da fase de grupos).
  const lastLockedMatches = useMemo(() => {
    const locked = matches.filter((m) => m.is_locked);
    if (locked.length === 0) return [];
    const maxKickoff = locked.reduce(
      (max, m) => Math.max(max, new Date(m.kickoff_at_utc).getTime()),
      -Infinity
    );
    return locked
      .filter((m) => new Date(m.kickoff_at_utc).getTime() === maxKickoff)
      .sort((a, b) => a.id - b.id);
  }, [matches]);

  const lastLockedIdsKey = lastLockedMatches.map((m) => m.id).join(",");

  // Garante que o índice selecionado continue válido se a lista mudar
  useEffect(() => {
    if (selectedLastMatchIndex >= lastLockedMatches.length) {
      setSelectedLastMatchIndex(0);
    }
  }, [lastLockedMatches.length, selectedLastMatchIndex]);

  const activeLastMatch = lastLockedMatches[selectedLastMatchIndex] ?? lastLockedMatches[0] ?? null;

  // Busca os palpites de todos os jogos do grupo simultâneo de uma vez —
  // assim trocar entre Jogo 1 / Jogo 2 não exige refetch.
  useEffect(() => {
    const needBets = showLastBet || selectedLeagueId !== "geral";
    if (!needBets || lastLockedMatches.length === 0) {
      setLastMatchBetsByMatch({});
      return;
    }
    let cancelled = false;
    setLastBetsLoading(true);
    Promise.all(
      lastLockedMatches.map((m) =>
        fetchPublicBets({ matchId: m.id }).then((data) => [m.id, data || []])
      )
    )
      .then((results) => {
        if (cancelled) return;
        const map = {};
        results.forEach(([id, data]) => { map[id] = data; });
        setLastMatchBetsByMatch(map);
      })
      .catch(() => { if (!cancelled) setLastMatchBetsByMatch({}); })
      .finally(() => { if (!cancelled) setLastBetsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLeagueId, lastLockedIdsKey, showLastBet]);

  const betsMap = useMemo(() => {
    if (!activeLastMatch) return new Map();
    const bets = lastMatchBetsByMatch[activeLastMatch.id] || [];
    return new Map(bets.map((b) => [b.user_id, b]));
  }, [lastMatchBetsByMatch, activeLastMatch]);

  const leagueLastGameBets = useMemo(() => {
    if (!selectedLeague || !activeLastMatch) return [];
    const memberIds = new Set(selectedLeague.members.map((m) => m.user_id));
    const bets = lastMatchBetsByMatch[activeLastMatch.id] || [];
    return bets
      .filter((b) => memberIds.has(b.user_id))
      .sort((a, b) => a.user_name.localeCompare(b.user_name, "pt-BR"));
  }, [selectedLeague, activeLastMatch, lastMatchBetsByMatch]);

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
      <span className="rank-bet-toggle-label">
        <span className="rank-bet-toggle-label-full">Palpites</span>
        <span className="rank-bet-toggle-label-icon">⚽</span>
      </span>
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

  const ExactScoresToggle = () => (
    <label className="rank-bet-toggle" title="Mostrar número de placares exatos (18 pts)">
      <span className="rank-bet-toggle-label">
        <span className="rank-bet-toggle-label-full">Cravadas</span>
        <span className="rank-bet-toggle-label-icon">🎯</span>
      </span>
      <span
        className={`rank-bet-track${showExactScores ? " on" : ""}`}
        onClick={() => setShowExactScores((v) => !v)}
        role="switch"
        aria-checked={showExactScores}
        tabIndex={0}
        onKeyDown={(e) => e.key === " " && setShowExactScores((v) => !v)}
      >
        <span className="rank-bet-thumb" />
      </span>
    </label>
  );

  const ChampionToggle = () => (
    <label className="rank-bet-toggle" title="Mostrar bandeira do campeão escolhido">
      <span className="rank-bet-toggle-label">
        <span className="rank-bet-toggle-label-full">Campeão</span>
        <span className="rank-bet-toggle-label-icon">👑</span>
      </span>
      <span
        className={`rank-bet-track${showChampionFlag ? " on" : ""}`}
        onClick={() => setShowChampionFlag((v) => !v)}
        role="switch"
        aria-checked={showChampionFlag}
        tabIndex={0}
        onKeyDown={(e) => e.key === " " && setShowChampionFlag((v) => !v)}
      >
        <span className="rank-bet-thumb" />
      </span>
    </label>
  );

  // Seletor Jogo 1 / Jogo 2 — só aparece quando há jogos simultâneos
  const MatchPicker = () =>
    lastLockedMatches.length > 1 ? (
      <div className="rank-match-picker">
        {lastLockedMatches.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            className={`rank-match-picker-btn${idx === selectedLastMatchIndex ? " active" : ""}`}
            onClick={() => setSelectedLastMatchIndex(idx)}
            title={`${m.home_team_name ?? m.home_team_code} x ${m.away_team_name ?? m.away_team_code}`}
          >
            <span className="rank-bet-flag-wrap">
              <FlagIcon code={m.home_team_code} name={m.home_team_name} />
            </span>
            <span className="rank-bet-header-x">×</span>
            <span className="rank-bet-flag-wrap">
              <FlagIcon code={m.away_team_code} name={m.away_team_name} />
            </span>
          </button>
        ))}
      </div>
    ) : null;

  const BetColHeader = () =>
    activeLastMatch ? (
      <th className="rank-bet-col">
        <span className="rank-bet-col-header-inner">
          <span className="rank-bet-flag-wrap">
            <FlagIcon code={activeLastMatch.home_team_code} name={activeLastMatch.home_team_name} />
          </span>
          <span className="rank-bet-header-x">×</span>
          <span className="rank-bet-flag-wrap">
            <FlagIcon code={activeLastMatch.away_team_code} name={activeLastMatch.away_team_name} />
          </span>
        </span>
      </th>
    ) : (
      <th className="rank-bet-col">Ult.</th>
    );

  const RankingRows = ({ rows, showOverall = false, showBetCol = showLastBet }) =>
    rows.map((r, index) => {
      const isMe = r.user_id === session.id;
      const isLast = index === rows.length - 1;
      const rowClass = isMe
        ? "me-row"
        : index === 0 ? "rank-1"
        : index === 1 ? "rank-2"
        : index === 2 ? "rank-3"
        : "";
      const bet = showBetCol ? betsMap.get(r.user_id) : null;
      const championPick = showChampionFlag ? championPickByUser.get(r.user_id) : null;
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
              {showChampionFlag && (
                <span
                  className="rank-champion-flag rank-bet-flag-wrap"
                  title={championPick ? `Campeão: ${championPick.team_name}` : "Sem palpite de campeão"}
                >
                  {championPicksLoading
                    ? <span className="rank-champion-flag-none">…</span>
                    : championPick
                    ? <FlagIcon code={championPick.team_code} name={championPick.team_name} />
                    : <span className="rank-champion-flag-none">—</span>
                  }
                </span>
              )}
            </div>
          </td>
          <td>
            <span className={`rank-pts ${ptsColorClass(index)}`}>{r.total_points}</span>
          </td>
          {showExactScores && (
            <td className="rank-exact-col">{r.exact_scores ?? 0}</td>
          )}
          {showOverall && (
            <td className="rank-overall-pos">{r.overallPos}°</td>
          )}
          {showBetCol && (
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
      {/* Seletor de ranking/liga */}
      <div style={{ marginBottom: "1.25rem" }}>
        <select
          className="filter-select"
          style={{ width: "100%", minHeight: "44px" }}
          value={selectedLeagueId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedLeagueId(v === "geral" || v === "mata_mata" ? v : Number(v));
          }}
        >
          <option value="geral">Ranking Geral</option>
          <option value="mata_mata">Ranking Mata-mata</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

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

      {selectedLeagueId === "geral" && !rankingLoading && !rankingError && ranking.length === 0 && (
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
            <div className="ranking-card-header-actions">
              <ExactScoresToggle />
              <ChampionToggle />
              {lastLockedMatches.length > 0 && <BetToggle />}
              {showLastBet && <MatchPicker />}
            </div>
          </div>
          <table className="ranking-table">
            <colgroup>
              <col style={{ width: "2.5rem" }} />
              <col />
              <col style={{ width: "3rem" }} />
              {showExactScores && <col style={{ width: "2.3rem" }} />}
              {showLastBet && <col style={{ width: "4rem" }} />}
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Pts</th>
                {showExactScores && <th className="rank-exact-col" title="Placares exatos (18 pts)">🎯</th>}
                {showLastBet && <BetColHeader />}
              </tr>
            </thead>
            <tbody>
              <RankingRows rows={ranking} />
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vista mata-mata ── */}
      {selectedLeagueId === "mata_mata" && (
        <div className="ranking-card">
          <div className="ranking-card-header">
            <h2 className="section-title">Ranking Mata-mata</h2>
            <div className="ranking-card-header-actions">
              <ExactScoresToggle />
              {lastLockedMatches.length > 0 && <BetToggle />}
              {showLastBet && <MatchPicker />}
            </div>
          </div>
          {mataMataLoading ? (
            <div className="loading-state">
              <span className="spinner" aria-hidden="true" />
              Carregando ranking...
            </div>
          ) : mataMataError ? (
            <div className="alert alert-error error-with-retry">
              {mataMataError}
              <button
                className="btn ghost small retry-btn"
                onClick={() => setMataMataLoaded(false)}
              >
                Tentar novamente
              </button>
            </div>
          ) : mataMataRanking.length === 0 ? (
            <p className="empty-state">
              O ranking de mata-mata será exibido após o primeiro jogo das fases eliminatórias com resultado oficial.
            </p>
          ) : (
            <table className="ranking-table">
              <colgroup>
                <col style={{ width: "2.5rem" }} />
                <col />
                <col style={{ width: "3rem" }} />
                {showExactScores && <col style={{ width: "2.3rem" }} />}
                {showLastBet && <col style={{ width: "4rem" }} />}
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Pts</th>
                  {showExactScores && <th className="rank-exact-col" title="Placares exatos (18 pts)">🎯</th>}
                  {showLastBet && <BetColHeader />}
                </tr>
              </thead>
              <tbody>
                <RankingRows rows={mataMataRanking} />
              </tbody>
            </table>
          )}
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
              <div className="ranking-card-header-actions">
                <ExactScoresToggle />
                <ChampionToggle />
                {lastLockedMatches.length > 0 && <BetToggle />}
                {showLastBet && <MatchPicker />}
              </div>
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
                  {showExactScores && <col style={{ width: "2.3rem" }} />}
                  <col style={{ width: "3rem" }} />
                  {showLastBet && <col style={{ width: "4rem" }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>Pts</th>
                    {showExactScores && <th className="rank-exact-col" title="Placares exatos (18 pts)">🎯</th>}
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
          {activeLastMatch && (
            <div className="ranking-card" style={{ marginTop: "1rem" }}>
              <div className="ranking-card-header">
                <h3 className="section-title" style={{ fontSize: "0.9rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", verticalAlign: "middle" }}>
                    <FlagIcon code={activeLastMatch.home_team_code} name={activeLastMatch.home_team_name} />
                    {activeLastMatch.home_team_name ?? activeLastMatch.home_team_code}
                    {" x "}
                    {activeLastMatch.away_team_name ?? activeLastMatch.away_team_code}
                    <FlagIcon code={activeLastMatch.away_team_code} name={activeLastMatch.away_team_name} />
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
