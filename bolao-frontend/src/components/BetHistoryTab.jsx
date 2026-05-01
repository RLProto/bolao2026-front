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

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function badgeClassForAction(action) {
  const a = String(action || "").toLowerCase();
  if (a === "insert") return "badge badge-ok";
  if (a === "update") return "badge badge-warn";
  return "badge";
}

function badgeClassForGroup(group) {
  const g = String(group || "").toLowerCase();
  if (g.includes("group") || g.includes("grupo")) return "badge badge-neutral";
  if (g.includes("oitav")) return "badge badge-stage";
  if (g.includes("quart")) return "badge badge-stage";
  if (g.includes("semi")) return "badge badge-stage";
  if (g.includes("final")) return "badge badge-final";
  return "badge badge-neutral";
}

export default function BetHistoryTab() {
  const [userId, setUserId] = useState("");
  const [matchId, setMatchId] = useState("");

  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState("");

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
    return users
      .slice()
      .sort((a, b) => {
        const nameCmp = naturalCompare(a?.name ?? "", b?.name ?? "");
        if (nameCmp !== 0) return nameCmp;
        return (a?.id ?? 0) - (b?.id ?? 0);
      })
      .map((u) => ({ id: u.id, label: `${u.name}` }));
  }, [users]);

  const matchOptions = useMemo(() => {
    return matches
      .slice()
      .sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0))
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
      const data = await fetchBetHistory({ userId: uid, matchId: mid });
      const arr = Array.isArray(data) ? data : [];
      arr.sort(
        (a, b) => new Date(a.changed_at_utc).getTime() - new Date(b.changed_at_utc).getTime()
      );
      setRows(arr);
    } catch (e) {
      setError(e.message || "Erro ao buscar histórico.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="info-card">
        <div className="bh-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Histórico de apostas</h2>
            <p className="subtitle" style={{ marginTop: 0 }}>
              Selecione um <b>usuário</b> e (opcionalmente) uma <b>partida</b>.
            </p>
          </div>

          <div className="bh-meta">
            <span className="bh-meta-pill">
              {loading ? "Buscando..." : `${rows.length} registros`}
            </span>
          </div>
        </div>

        <div className="bh-toolbar">
          <div className="bh-field">
            <span className="filter-label">Usuário</span>
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

          <div className="bh-field">
            <span className="filter-label">Partida</span>
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
            className="btn ghost small bh-btn"
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
          <div className="bh-empty">
            Selecione um usuário e clique em <b>Procurar</b>.
          </div>
        )}

        {rows.length > 0 && (
          <div className="bh-table-wrap">
            <table className="ranking-table bh-table">
              <thead>
                <tr>
                  <th className="col-id">#</th>
                  <th className="col-when">Quando</th>
                  <th className="col-match">Partida</th>
                  <th className="col-group">Grupo</th>
                  <th className="col-action">Ação</th>
                  <th className="col-new">Palpite novo</th>
                  <th className="col-prev">Palpite anterior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td className="col-id">{h.id}</td>

                    <td className="col-when">
                      <span className="bh-mono">{formatDateTime(h.changed_at_utc)}</span>
                    </td>

                    <td className="col-match">
                      <div className="bh-match-title">
                        <span className="bh-mono">#{h.match_id}</span>
                        <span className="bh-dot">•</span>
                        <span className="bh-teamline">
                          {h.home_team_name || "???"} x {h.away_team_name || "???"}
                        </span>
                      </div>
                    </td>

                    <td className="col-group">
                      <span className={badgeClassForGroup(h.match_stage)}>
                        {h.match_stage || "-"}
                      </span>
                    </td>

                    <td className="col-action">
                      <span className={badgeClassForAction(h.action_type)}>
                        {h.action_type}
                      </span>
                    </td>

                    <td className="col-new">
                      <span className="bh-score">
                        {h.home_score_prediction} <span className="bh-x">x</span>{" "}
                        {h.away_score_prediction}
                      </span>
                    </td>

                    <td className="col-prev">
                      <span className="bh-score muted">
                        {h.prev_home_score_prediction ?? "-"}{" "}
                        <span className="bh-x">x</span>{" "}
                        {h.prev_away_score_prediction ?? "-"}
                      </span>
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
