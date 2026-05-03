// src/components/ResultsTab.jsx
import React, { useState } from "react";
import FlagIcon from "./FlagIcon";

export default function ResultsTab({
  visibleMatches,
  matchesLoading,
  matchesError,
  officialResults,
  onUpdateResult,
  onSaveAllResults,
  savingResults,
  formatDateTime,
  teams,
  adminChampionConfig,
  adminChampionConfigLoading,
  adminChampionConfigError,
  selectedAdminChampionTeamId,
  onSelectedAdminChampionTeamIdChange,
  onSaveAdminChampionConfig,
  savingAdminChampion,
}) {
  // true = bloqueado. Default: bloqueado (se não existir ainda).
  const [lockedByMatchId, setLockedByMatchId] = useState({});
  // 👇 novo estado do slider
  const [hideCompleted, setHideCompleted] = useState(false);

  const toggleLock = (matchId) => {
    setLockedByMatchId((prev) => {
      const current = prev[matchId];
      const isLockedNow = current !== false; // default = true
      return {
        ...prev,
        [matchId]: !isLockedNow,
      };
    });
  };

  if (matchesLoading) {
    return (
      <section className="section">
        <div className="info-card">Carregando partidas...</div>
      </section>
    );
  }

  if (matchesError) {
    return (
      <section className="section">
        <div className="info-card">
          <h2>Postar resultado</h2>
          <p>{matchesError}</p>
        </div>
      </section>
    );
  }

  if (!visibleMatches.length) {
    return (
      <section className="section">
        <div className="info-card">
          <h2>Postar resultado</h2>
          <p>Nenhuma partida cadastrada.</p>
        </div>
      </section>
    );
  }

  // 👇 aplica o filtro baseado no slider
  const filteredMatches = visibleMatches.filter((m) => {
    const isLocked = lockedByMatchId[m.id] !== false;
    const hasPostedResult =
      m.home_score !== null &&
      m.home_score !== undefined &&
      m.away_score !== null &&
      m.away_score !== undefined;

    // Se o slider estiver ativado, esconde jogos que:
    // - já têm resultado postado
    // - e estão bloqueados
    if (hideCompleted && hasPostedResult && isLocked) {
      return false;
    }
    return true;
  });

  return (
    <section className="section">
      <div className="matches-toolbar">
        <div className="matches-hint">
          Poste aqui o <strong>resultado oficial</strong> de cada partida.
          <br />
          Esses valores vão para a tabela <code>matches</code> e serão usados
          para calcular a pontuação do bolão.
        </div>

        <div className="matches-filter-control">
          {/* 👇 Slider de filtro */}
          <span className="filter-label">
            Ocultar jogos já postados e bloqueados
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            <span className="slider-toggle" />
          </label>

          <button
            className="btn primary"
            onClick={onSaveAllResults}
            disabled={savingResults}
          >
            {savingResults ? "Salvando..." : "Salvar resultados oficiais"}
          </button>
        </div>
      </div>

      <div className="match-grid">
        {filteredMatches.map((m) => {
          const res = officialResults[m.id] || { home: "", away: "" };

          const isLocked = lockedByMatchId[m.id] !== false;
          const hasPostedResult =
            m.home_score !== null &&
            m.home_score !== undefined &&
            m.away_score !== null &&
            m.away_score !== undefined;

          const cardClasses = [
            "match-card",
            isLocked && hasPostedResult ? "posted" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={m.id} className={cardClasses}>
              <div className="match-header">
                <div className="match-header-left">
                  <span className="match-stage">{m.stage}</span>
                  <span className="match-datetime">
                    {formatDateTime(m.kickoff_at_utc)}
                  </span>
                  <span className="match-subtitle">
                    Resultado oficial (admin)
                  </span>
                </div>

                <div className="match-header-right">
                  <button
                    type="button"
                    className={
                      "result-lock-btn " + (isLocked ? "locked" : "unlocked")
                    }
                    onClick={() => toggleLock(m.id)}
                    title={
                      isLocked
                        ? "Clique para desbloquear este jogo"
                        : "Clique para bloquear este jogo"
                    }
                  >
                    <span className="lock-icon">
                      {isLocked ? "🔒" : "🔓"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="match-teams">
                <div className="team">
                  <FlagIcon
                    code={m.home_team_code}
                    name={m.home_team_name}
                  />
                  <span className="team-name">{m.home_team_name}</span>
                </div>

                <div className="score-inputs">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={res.home}
                    className="results-score-input"
                    onChange={(e) =>
                      onUpdateResult(m.id, "home", e.target.value)
                    }
                    disabled={isLocked}
                  />
                  <span className="x">x</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={res.away}
                    className="results-score-input"
                    onChange={(e) =>
                      onUpdateResult(m.id, "away", e.target.value)
                    }
                    disabled={isLocked}
                  />
                </div>

                <div className="team away">
                  <span className="team-name">{m.away_team_name}</span>
                  <FlagIcon
                    code={m.away_team_code}
                    name={m.away_team_name}
                  />
                </div>
              </div>

              <div className="match-footer">
                {isLocked ? (
                  hasPostedResult ? (
                    <span className="results-status success">
                      ✅ Resultado oficial já postado. (Card bloqueado)
                    </span>
                  ) : (
                    <span className="results-status">
                      🔒 Card bloqueado. Clique no cadeado para editar este
                      jogo.
                    </span>
                  )
                ) : (
                  <span className="results-status">
                    ✏️ Edite o placar e depois clique em “Salvar resultados
                    oficiais”.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="champion-pick-box">
        <div className="champion-pick-header">
          <h3 className="champion-pick-title">Definir campeão oficial</h3>
          <p className="champion-pick-subtitle">
            Selecione o time que venceu a Copa do Mundo para calcular os 40 pontos bônus.
          </p>
        </div>

        {adminChampionConfigLoading ? (
          <div className="champion-pick-loading">Carregando...</div>
        ) : (
          <>
            <div className="champion-pick-controls">
              <div className="champion-pick-field">
                <label className="filter-label" htmlFor="admin-champion-select">
                  Campeão oficial
                </label>
                <select
                  id="admin-champion-select"
                  className="filter-select champion-pick-select"
                  value={selectedAdminChampionTeamId}
                  onChange={(e) => onSelectedAdminChampionTeamIdChange(e.target.value)}
                  disabled={savingAdminChampion}
                >
                  <option value="">Nenhum definido</option>
                  {(teams || []).map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn primary small champion-pick-save-btn"
                onClick={onSaveAdminChampionConfig}
                disabled={savingAdminChampion}
              >
                {savingAdminChampion ? "Salvando..." : "Salvar campeão oficial"}
              </button>
            </div>

            {adminChampionConfig?.team_name && (
              <div className="champion-pick-current">
                Campeão definido: <strong>{adminChampionConfig.team_name}</strong>
              </div>
            )}

            {adminChampionConfigError && (
              <div className="alert alert-error mt-8">{adminChampionConfigError}</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
