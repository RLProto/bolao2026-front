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
              {ranking.map((r, index) => {
                const medals = ["🥇", "🥈", "🥉"];
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
                    <td>{r.user_name}{isMe && <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>você</span>}</td>
                    <td className="points-cell">{r.total_points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
