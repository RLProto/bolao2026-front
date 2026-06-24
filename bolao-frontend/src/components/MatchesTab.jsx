// src/components/MatchesTab.jsx
import React from "react";
import FlagIcon from "./FlagIcon";

function calculatePoints(realH, realA, predH, predA) {
  if (realH == null || realA == null) return null;
  const pH = Number(predH);
  const pA = Number(predA);
  if (predH === "" || predA === "" || isNaN(pH) || isNaN(pA)) return null;

  if (realH === pH && realA === pA) return 18;

  const realResult = Math.sign(realH - realA);
  const predResult = Math.sign(pH - pA);

  if (predResult === 0 && realResult !== 0) return 3;

  const correctScores = (realH === pH ? 1 : 0) + (realA === pA ? 1 : 0);

  if (realResult === predResult) {
    if (correctScores === 1) return 12;
    if (correctScores === 0) return 9;
  }

  if (correctScores >= 1) return 3;
  return 0;
}

const POINTS_STYLE = {
  18: { border: "#16a34a", bg: "rgba(22,163,74,0.08)",   label: "#16a34a" },
  12: { border: "#4ade80", bg: "rgba(74,222,128,0.08)",  label: "#4ade80" },
   9: { border: "#eab308", bg: "rgba(234,179,8,0.08)",  label: "#eab308" },
   3: { border: "#f97316", bg: "rgba(249,115,22,0.08)", label: "#f97316" },
   0: { border: "#ef4444", bg: "rgba(239,68,68,0.08)",  label: "#ef4444" },
};

const MatchCard = React.memo(function MatchCard({
  m,
  predHome,
  predAway,
  isDirty,
  cardIndex,
  onUpdatePrediction,
  formatDateTime,
}) {
  const homeName = m.home_team_name || "TBD";
  const awayName = m.away_team_name || "TBD";
  const homeCode = m.home_team_name ? m.home_team_code : null;
  const awayCode = m.away_team_name ? m.away_team_code : null;

  const hasResult = m.home_score != null && m.away_score != null;
  const pts = hasResult ? calculatePoints(m.home_score, m.away_score, predHome, predAway) : null;
  const ptStyle = pts != null ? POINTS_STYLE[pts] : null;

  return (
    <div
      className={`match-card ${m.is_locked ? "locked" : ""} ${isDirty && !m.is_locked ? "unsaved" : ""}`}
      style={{
        "--card-i": cardIndex,
        ...(ptStyle && {
          borderColor: ptStyle.border,
          borderWidth: "2px",
          boxShadow: `0 0 0 1px ${ptStyle.border}55, 0 8px 32px rgba(0,0,0,0.5)`,
          background: ptStyle.bg,
        }),
      }}
    >
      <div className="match-header">
        <span className="match-stage">{m.stage}</span>
        <span className="match-datetime">{formatDateTime(m.kickoff_at_utc)}</span>
      </div>

      <div className="match-teams">
        <div className="team">
          <FlagIcon code={homeCode} name={homeName} />
          <span className="team-name">{homeName}</span>
        </div>

        <div className="score-inputs">
          <input
            type="text"
            inputMode="numeric"
            value={predHome}
            onChange={(e) => onUpdatePrediction(m.id, "home", e.target.value)}
            disabled={m.is_locked}
            aria-label={`Gols ${homeName}`}
          />
          <span className="x">x</span>
          <input
            type="text"
            inputMode="numeric"
            value={predAway}
            onChange={(e) => onUpdatePrediction(m.id, "away", e.target.value)}
            disabled={m.is_locked}
            aria-label={`Gols ${awayName}`}
          />
        </div>

        <div className="team away">
          <FlagIcon code={awayCode} name={awayName} />
          <span className="team-name">{awayName}</span>
        </div>
      </div>

      <div className="match-footer">
        {hasResult && (
          <div className="final-score">
            Resultado oficial:{" "}
            <strong>{m.home_score} x {m.away_score}</strong>
          </div>
        )}
        <div className="match-actions">
          {pts != null && (
            <span
              className="badge points-badge"
              style={{ color: ptStyle.label, borderColor: ptStyle.border }}
            >
              {pts} pts
            </span>
          )}
          {m.is_locked && (
            <span className="badge locked">Palpites bloqueados</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function MatchesTab({
  visibleMatches,
  matchesLoading,
  matchesError,
  onRetry,
  predictions,
  dirtyIds,
  onUpdatePrediction,
  onSaveAllBets,
  savingAll,
  saveBetsResult,
  formatDateTime,
  ROUND_OPTIONS,
  selectedRound,
  onSelectedRoundChange,
  orderMode,
  onOrderModeChange,
  isGroupRound,
  hideFinished,
  onHideFinishedChange,
  teams,
  championPick,
  championPickLoading,
  championPickError,
  selectedChampionTeamId,
  onSelectedChampionTeamIdChange,
  onSaveChampionPick,
  savingChampionPick,
}) {
  return (
    <section className="section">
      {/* Container height-0 sticky: mantém o botão alinhado ao card e sticky no scroll */}
      <div className="save-btn-float">
        <button
          className="btn primary small btn-save-all"
          onClick={onSaveAllBets}
          disabled={savingAll || matchesLoading}
        >
          {savingAll && <span className="btn-spinner" aria-hidden="true" />}
          <span>{savingAll ? "Salvando..." : "Salvar todos os palpites"}</span>
        </button>
      </div>

      <div className="matches-top-row">
        {/* Coluna esquerda: filtros */}
        <div className="matches-controls-col">
          <div className="matches-filters">
            <div
              className="toolbar-control"
              style={{
                opacity: hideFinished ? 0.45 : 1,
                pointerEvents: hideFinished ? "none" : "auto",
              }}
            >
              <label className="filter-label">Fase</label>
              <select
                value={selectedRound}
                onChange={(e) => onSelectedRoundChange(e.target.value)}
                className="filter-select"
                disabled={hideFinished}
              >
                {ROUND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="toolbar-control"
              style={{
                opacity: isGroupRound && !hideFinished ? 1 : 0,
                pointerEvents: isGroupRound && !hideFinished ? "auto" : "none",
              }}
            >
              <label className="filter-label">Ordenar por</label>
              <select
                value={orderMode}
                onChange={(e) => onOrderModeChange(e.target.value)}
                className="filter-select"
                disabled={!isGroupRound || hideFinished}
              >
                <option value="date">Data</option>
                <option value="group">Grupo</option>
              </select>
            </div>

            <label className="matches-hide-toggle" title="Esconder jogos passados">
              <span className="matches-hide-toggle-label">Ocultar finalizados</span>
              <span
                className={`rank-bet-track${hideFinished ? " on" : ""}`}
                onClick={() => onHideFinishedChange(!hideFinished)}
                role="switch"
                aria-checked={hideFinished}
                tabIndex={0}
                onKeyDown={(e) => e.key === " " && onHideFinishedChange(!hideFinished)}
              >
                <span className="rank-bet-thumb" />
              </span>
            </label>
          </div>
        </div>

        {/* Coluna direita: palpite no campeão */}
        <div className="champion-pick-box">
          <div className="champion-pick-header">
            <div>
              <h3 className="champion-pick-title">Palpite no campeão</h3>
              <p className="champion-pick-subtitle">
                Quem acertar o campeão ganha <strong>40 pontos bônus</strong>.
              </p>
            </div>
          </div>

          {championPickLoading ? (
            <div className="loading-state">
              <span className="spinner" aria-hidden="true" />
              Carregando...
            </div>
          ) : championPick?.locked ? (
            <div className="champion-pick-locked-view">
              <span className="champion-pick-locked-label">Seu palpite</span>
              <span className="champion-pick-locked-team">
                {championPick.team_name ?? "Não registrado"}
              </span>
              <span className="champion-pick-info champion-pick-info-locked">
                Prazo encerrado em{" "}
                <strong>{formatDateTime(championPick?.lock_at_utc)}</strong>.
              </span>
            </div>
          ) : (
            <>
              <div className="champion-pick-controls">
                <div className="champion-pick-field">
                  <label className="filter-label" htmlFor="champion-team-select">
                    Campeão
                  </label>
                  <select
                    id="champion-team-select"
                    className="filter-select champion-pick-select"
                    value={selectedChampionTeamId}
                    onChange={(e) => onSelectedChampionTeamIdChange(e.target.value)}
                    disabled={savingChampionPick}
                  >
                    <option value="">Selecione uma seleção</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn primary small champion-pick-save-btn"
                  onClick={onSaveChampionPick}
                  disabled={savingChampionPick || !selectedChampionTeamId}
                >
                  {savingChampionPick
                    ? "Salvando..."
                    : championPick?.team_id
                    ? "Alterar palpite"
                    : "Salvar palpite"}
                </button>
              </div>

              {championPick?.team_name && (
                <div className="champion-pick-current">
                  Seu palpite atual: <strong>{championPick.team_name}</strong>
                </div>
              )}

              <div className="champion-pick-info">
                Você pode alterar seu palpite até{" "}
                <strong>{formatDateTime(championPick?.lock_at_utc)}</strong>.
              </div>

              {championPickError && (
                <div className="alert alert-error mt-8">{championPickError}</div>
              )}
            </>
          )}
        </div>
      </div>

      {matchesLoading && !savingAll && (
        <div className="loading-state">
          <span className="spinner" aria-hidden="true" />
          Carregando partidas...
        </div>
      )}

      {matchesError && (
        <div className="alert alert-error error-with-retry">
          {matchesError}
          {onRetry && (
            <button className="btn ghost small retry-btn" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {saveBetsResult?.incomplete?.length > 0 && (
        <div className="alert alert-warning save-bets-errors">
          <strong>Atenção: {saveBetsResult.incomplete.length} palpite(s) incompleto(s) não foram salvos:</strong>
          <ul>
            {saveBetsResult.incomplete.map((m) => (
              <li key={m.id}>
                {m.home_team_name || "TBD"} x {m.away_team_name || "TBD"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveBetsResult?.errors?.length > 0 && (
        <div className="alert alert-warning save-bets-errors">
          <strong>Alguns palpites não foram salvos:</strong>
          <ul>
            {saveBetsResult.errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {!matchesLoading && !matchesError && visibleMatches.length === 0 && (
        <p className="empty-state">Nenhuma partida cadastrada ainda.</p>
      )}

      <div className="match-grid">
        {visibleMatches.map((m, i) => (
          <MatchCard
            key={m.id}
            m={m}
            predHome={predictions[m.id]?.home ?? ""}
            predAway={predictions[m.id]?.away ?? ""}
            isDirty={dirtyIds?.has(m.id) ?? false}
            cardIndex={i}
            onUpdatePrediction={onUpdatePrediction}
            formatDateTime={formatDateTime}
          />
        ))}
      </div>

    </section>
  );
}
