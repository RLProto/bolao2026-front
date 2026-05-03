// src/components/MatchesTab.jsx
import React from "react";
import FlagIcon from "./FlagIcon";

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

  return (
    <div
      className={`match-card ${m.is_locked ? "locked" : ""} ${isDirty && !m.is_locked ? "unsaved" : ""}`}
      style={{ "--card-i": cardIndex }}
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
        {m.home_score != null && m.away_score != null && (
          <div className="final-score">
            Resultado oficial:{" "}
            <strong>{m.home_score} x {m.away_score}</strong>
          </div>
        )}
        {m.is_locked && (
          <div className="match-actions">
            <span className="badge locked">Palpites bloqueados</span>
          </div>
        )}
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
                  disabled={championPick?.locked || savingChampionPick}
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
                disabled={championPick?.locked || savingChampionPick || !selectedChampionTeamId}
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

            {!championPick?.locked ? (
              <div className="champion-pick-info">
                Você pode alterar seu palpite até{" "}
                <strong>{formatDateTime(championPick?.lock_at_utc)}</strong>.
              </div>
            ) : (
              <div className="champion-pick-info champion-pick-info-locked">
                O prazo para palpitar o campeão foi encerrado em{" "}
                <strong>{formatDateTime(championPick?.lock_at_utc)}</strong>.
              </div>
            )}

            {championPickError && (
              <div className="alert alert-error mt-8">{championPickError}</div>
            )}
          </>
        )}
      </div>

      <div className="matches-toolbar">
        <div className="matches-toolbar-actions">
          <div className="toolbar-control">
            <label className="filter-label">Etapa</label>
            <select
              value={selectedRound}
              onChange={(e) => onSelectedRoundChange(e.target.value)}
              className="filter-select"
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
              opacity: isGroupRound ? 1 : 0,
              pointerEvents: isGroupRound ? "auto" : "none",
            }}
          >
            <label className="filter-label">Ordenar por</label>
            <select
              value={orderMode}
              onChange={(e) => onOrderModeChange(e.target.value)}
              className="filter-select"
              disabled={!isGroupRound}
            >
              <option value="date">Data</option>
              <option value="group">Grupo</option>
            </select>
          </div>

          <button
            className="btn primary small btn-save-all"
            onClick={onSaveAllBets}
            disabled={savingAll || matchesLoading}
          >
            {savingAll && <span className="btn-spinner" aria-hidden="true" />}
            <span>{savingAll ? "Salvando..." : "Salvar todos os palpites"}</span>
          </button>
        </div>
      </div>

      <p className="tz-hint">Horários exibidos no fuso horário local do seu dispositivo.</p>

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

      <div className="matches-toolbar bottom-toolbar">
        <button
          className="btn primary small btn-save-all"
          onClick={onSaveAllBets}
          disabled={savingAll || matchesLoading}
        >
          {savingAll && <span className="btn-spinner" aria-hidden="true" />}
          <span>{savingAll ? "Salvando..." : "Salvar todos os palpites"}</span>
        </button>
      </div>
    </section>
  );
}
