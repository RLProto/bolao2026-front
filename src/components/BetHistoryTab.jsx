// src/components/BetHistoryTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchBetHistory, fetchAdminUsers, fetchAdminMatches } from "../api";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export default function BetHistoryTab() {
  const [userId, setUserId] = useState("");     // obrigatório
  const [matchId, setMatchId] = useState("");   // opcional ("" = todos)

  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState("");

  // carrega listas (users + matches) ao abrir a aba
  useEffect(() => {
    let alive = true;

    async function loadLists() {
      setLoadingLists(true);
      setError("");
      try {
        const [u, m] = await Promise.all([fetchAdminUsers(), fetchAdminMatches()]);
        if (!alive) return;
        setUsers(Array.isArray(u) ? u : []);
        setMatches(Array.isArray(m) ? m : []);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Erro ao carregar listas (usuários/jogos).");
      } finally {
        if (alive) setLoadingLists(false);
      }
    }

    loadLists();
    return () => {
      alive = false;
    };
  }, []);

  const userOptions = useMemo(() => {
    // backend já ordena por nome; aqui é só garantir
    return users
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
      .map((u) => ({ id: u.id, label: `${u.name} (#${u.id})` }));
  }, [users]);

  const matchOptions = useMemo(() => {
    return matches
      .slice()
      .sort((a, b) => new Date(a.kickoff_at_utc) - new Date(b.kickoff_at_utc))
      .map((m) => ({
        id: m.id,
        label: `#${m.id} – ${m.label}${m.stage ? ` • ${m.stage}` : ""} • ${formatDateTime(
          m.kickoff_at_utc
        )}`,
      }));
  }, [matches]);

  async function onSearch() {
    setError("");
    setRows([]);

    const uid = Number(userId);
    if (!userId || Number.isNaN(uid) || uid <= 0) {
      setError("Selecione um usuário.");
      return;
    }

    const mid = matchId ? Number(matchId) : undefined;
    if (matchId && (Number.isNaN(mid) || mid <= 0)) {
      setError("Partida inválida.");
      return;
    }

    setLoading(true);
    try {
      // backend exige user_id
      const data = await fetchBetHistory({
        userId: uid,
        matchId: mid,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Erro ao buscar histórico.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="info-card">
        <h2>Histórico de apostas</h2>
        <p className="subtitle">
          Selecione um <b>usuário</b> e (opcionalmente) uma <b>partida</b>, depois clique em{" "}
          <b>Procurar</b>.
        </p>

        <div className="matches-toolbar" style={{ marginTop: "0.4rem" }}>
          {/* usuário obrigatório */}
          <div className="matches-filter-control">
            <span className="filter-label">Usuário:</span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="filter-select"
              disabled={loadingLists}
            >
              <option value="">Selecione…</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* partida opcional */}
          <div className="matches-filter-control">
            <span className="filter-label">Partida:</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="filter-select"
              disabled={loadingLists || !userId}
              title={!userId ? "Selecione um usuário primeiro" : ""}
            >
              <option value="">Todas</option>
              {matchOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn ghost small"
            onClick={onSearch}
            disabled={loading || loadingLists || !userId}
          >
            {loading ? "Procurando..." : "Procurar"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loadingLists && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Carregando usuários e jogos…
          </div>
        )}

        {!loading && !loadingLists && rows.length === 0 && !error && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Selecione um usuário e clique em <b>Procurar</b>.
          </div>
        )}

        {loading && (
          <div className="small" style={{ marginTop: "0.4rem" }}>
            Buscando histórico…
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: "0.6rem", maxHeight: "60vh", overflow: "auto" }}>
            <div className="small" style={{ marginBottom: "0.4rem" }}>
              Retornou <b>{rows.length}</b> registros.
            </div>

            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Partida</th>
                  <th>Ação</th>
                  <th>Palpite novo</th>
                  <th>Palpite anterior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td>{h.id}</td>
                    <td>{formatDateTime(h.changed_at_utc)}</td>
                    <td>
                      {h.user_name} <span className="small">#{h.user_id}</span>
                    </td>
                    <td>
                      #{h.match_id}
                      <br />
                      <span className="small">
                        {h.home_team_name || "???"} x {h.away_team_name || "???"}
                      </span>
                      <br />
                      <span className="small">{h.match_stage}</span>
                    </td>
                    <td>{h.action_type}</td>
                    <td>
                      {h.home_score_prediction} x {h.away_score_prediction}
                    </td>
                    <td>
                      {h.prev_home_score_prediction ?? "-"} x{" "}
                      {h.prev_away_score_prediction ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
