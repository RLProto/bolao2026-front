// src/components/LeaguesPage.jsx
import React, { useMemo, useState } from "react";
import { createLeague, addLeagueMember, leaveLeague, deleteLeague } from "../api";

function LeagueCard({ league, allUsers, session, onLeaguesChange }) {
  const [expanded, setExpanded] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const isCreator = league.created_by === session.id;

  const memberIds = useMemo(
    () => new Set(league.members.map((m) => m.user_id)),
    [league.members]
  );

  const availableUsers = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          !memberIds.has(u.id) &&
          u.name.toLowerCase().includes(addSearch.toLowerCase())
      ),
    [allUsers, memberIds, addSearch]
  );

  async function handleAddMember(userId) {
    setAddLoading(true);
    setAddError("");
    try {
      await addLeagueMember(league.id, userId);
      setAddSearch("");
      await onLeaguesChange();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleLeave() {
    setActionLoading(true);
    try {
      await leaveLeague(league.id);
      await onLeaguesChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir esta liga? Todos os membros serão removidos.")) return;
    setActionLoading(true);
    try {
      await deleteLeague(league.id);
      await onLeaguesChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="ranking-card" style={{ marginBottom: "0.8rem", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); setAddSearch(""); setAddError(""); }}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "1rem 1.1rem",
          background: "none", border: "none", cursor: "pointer",
          color: "inherit", textAlign: "left",
        }}
      >
        <span>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>{league.name}</span>
          <span style={{ marginLeft: "0.6rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
            {league.members.length} {league.members.length === 1 ? "membro" : "membros"}
            {isCreator && (
              <span style={{ marginLeft: "0.4rem", color: "var(--accent)", fontWeight: 600 }}>· admin</span>
            )}
          </span>
        </span>
        <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 1.1rem 1rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="ranking-table" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr><th>Membro</th></tr>
            </thead>
            <tbody>
              {league.members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    {m.user_name}
                    {m.user_id === league.created_by && (
                      <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>admin</span>
                    )}
                    {m.user_id === session.id && (
                      <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>você</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isCreator && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                Adicionar membro
              </p>
              <input
                className="filter-select"
                style={{ width: "100%", marginBottom: "0.5rem" }}
                placeholder="Buscar por nome..."
                value={addSearch}
                onChange={(e) => { setAddSearch(e.target.value); setAddError(""); }}
              />
              {addError && (
                <p className="field-error" style={{ marginBottom: "0.4rem" }}>{addError}</p>
              )}
              {addSearch.length > 0 && (
                <div style={{
                  maxHeight: "180px", overflowY: "auto",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                }}>
                  {availableUsers.length === 0 ? (
                    <p style={{ padding: "0.6rem 0.8rem", margin: 0, fontSize: "0.85rem", opacity: 0.5 }}>
                      Nenhum resultado
                    </p>
                  ) : (
                    availableUsers.slice(0, 20).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={addLoading}
                        onClick={() => handleAddMember(u.id)}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "0.55rem 0.8rem", background: "none", border: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          color: "inherit", cursor: "pointer", fontSize: "0.9rem",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        {u.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
            {!isCreator && (
              <button className="btn ghost small" disabled={actionLoading} onClick={handleLeave}>
                {actionLoading ? "Saindo..." : "Sair da liga"}
              </button>
            )}
            {isCreator && (
              <button
                className="btn ghost small"
                style={{ color: "#ef4444", borderColor: "#ef4444" }}
                disabled={actionLoading}
                onClick={handleDelete}
              >
                {actionLoading ? "Excluindo..." : "Excluir liga"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaguesPage({ leagues, allUsers, allUsersLoading, session, onLeaguesChange }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      await createLeague(newName.trim());
      setNewName("");
      setCreating(false);
      await onLeaguesChange();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <section className="section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Minhas Ligas</h2>
        {!creating && (
          <button className="btn primary small" onClick={() => { setCreating(true); setCreateError(""); }}>
            + Criar liga
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={{ marginBottom: "1.25rem" }}>
          <div className="ranking-card" style={{ padding: "1rem 1.1rem" }}>
            <p style={{ margin: "0 0 0.75rem", fontWeight: 600 }}>Nova liga</p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <input
                className="filter-select"
                style={{ flex: 1, minWidth: "180px" }}
                placeholder="Nome da liga"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                maxLength={100}
              />
              <button className="btn primary small" type="submit" disabled={createLoading || !newName.trim()}>
                {createLoading ? "Criando..." : "Criar"}
              </button>
              <button
                className="btn ghost small"
                type="button"
                onClick={() => { setCreating(false); setCreateError(""); setNewName(""); }}
              >
                Cancelar
              </button>
            </div>
            {createError && (
              <p className="field-error" style={{ marginTop: "0.5rem" }}>{createError}</p>
            )}
          </div>
        </form>
      )}

      {leagues.length === 0 && !creating && (
        <p className="empty-state">Você ainda não participa de nenhuma liga. Crie uma para começar!</p>
      )}

      {allUsersLoading && leagues.length > 0 && (
        <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "0.75rem" }}>Carregando lista de usuários...</p>
      )}

      {leagues.map((league) => (
        <LeagueCard
          key={league.id}
          league={league}
          allUsers={allUsers}
          session={session}
          onLeaguesChange={onLeaguesChange}
        />
      ))}
    </section>
  );
}
