// src/components/MatchesTab.jsx
import React from "react";
import FlagIcon from "./FlagIcon";

export default function MatchesTab({
  visibleMatches,
  matchesLoading,
  matchesError,
  predictions,
  onUpdatePrediction,
  onSaveAllBets,
  savingAll,
  formatDateTime,
  ROUND_OPTIONS,
  selectedRound,
  onSelectedRoundChange,
  orderMode,
  onOrderModeChange,
  isGroupRound,
}) {
  return (
    <section className="section">
      {/* Toolbar de filtros + botão salvar (topo) */}
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

      {/* ✅ Só mostra "Carregando partidas..." quando NÃO está salvando */}
      {matchesLoading && !savingAll && <p>Carregando partidas...</p>}

      {matchesError && (
        <div className="alert alert-error">{matchesError}</div>
      )}

      {!matchesLoading && !matchesError && visibleMatches.length === 0 && (
        <p>Nenhuma partida cadastrada ainda.</p>
      )}

      <div className="match-grid">
        {visibleMatches.map((m) => {
          const pred = predictions[m.id] || { home: "", away: "" };

          const homeName = m.home_team_name || "TBD";
          const awayName = m.away_team_name || "TBD";
          const homeCode = m.home_team_name ? m.home_team_code : null;
          const awayCode = m.away_team_name ? m.away_team_code : null;
          const stageLabel = m.stage;

          return (
            <div
              className={`match-card ${m.is_locked ? "locked" : ""}`}
              key={m.id}
            >
              <div className="match-header">
                <span className="match-stage">{stageLabel}</span>
                <span className="match-datetime">
                  {formatDateTime(m.kickoff_at_utc)}
                </span>
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
                    value={pred.home}
                    onChange={(e) =>
                      onUpdatePrediction(m.id, "home", e.target.value)
                    }
                    disabled={m.is_locked}
                  />
                  <span className="x">x</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pred.away}
                    onChange={(e) =>
                      onUpdatePrediction(m.id, "away", e.target.value)
                    }
                    disabled={m.is_locked}
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
                    <strong>
                      {m.home_score} x {m.away_score}
                    </strong>
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
        })}
      </div>

      {/* Botão salvar (rodapé) */}
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
