// src/components/RankingTab.jsx
import React from "react";

export default function RankingTab({ ranking, rankingLoading, rankingError, session }) {
  return (
    <section className="section">
      {rankingLoading && <p>Carregando ranking...</p>}
      {rankingError && <div className="alert alert-error">{rankingError}</div>}
      {!rankingLoading && !rankingError && ranking.length === 0 && (
        <p>Ainda não há usuários no ranking.</p>
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
