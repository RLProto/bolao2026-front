// src/components/RankingTab.jsx
import React from "react";

export default function RankingTab({ ranking, rankingLoading, rankingError, onRetry, session }) {
  return (
    <section className="section">
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

      {ranking.length > 0 && (
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
              {ranking.map((r, index) => (
                <tr
                  key={r.user_id}
                  className={
                    r.user_id === session.id ? "me-row" : index < 3 ? "top-row" : ""
                  }
                >
                  <td>{index + 1}</td>
                  <td>{r.user_name}</td>
                  <td>{r.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
