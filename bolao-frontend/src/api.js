// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function fireUnauthorized() {
  window.dispatchEvent(new CustomEvent("bolao:unauthorized"));
}

export async function registerUser(name, email, password, accessCode) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name?.trim(),
      email: email?.trim(),
      password,
      accessCode: accessCode?.trim(),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Erro ao registrar usuário");
  }

  return data; // { id, name, email, auth_token }
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao fazer login");
  }
  return data;
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_URL}/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao solicitar reset de senha");
  }
  return data;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao redefinir senha");
  }
  return data;
}

function getSession() {
  const stored = localStorage.getItem("bolao_user");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function getHeadersWithAuth() {
  const session = getSession();
  if (!session) return {};
  return {
    "X-User-Id": session.id,
    "X-Auth-Token": session.auth_token,
  };
}

export async function fetchMatches() {
  const res = await fetch(`${API_URL}/matches`, {
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data.detail || "Erro ao carregar partidas");
  }
  return data;
}

export async function fetchRanking(scope = "geral") {
  const res = await fetch(`${API_URL}/ranking?scope=${scope}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao carregar ranking");
  }
  return data;
}

export async function fetchChampionBonusRanking() {
  const res = await fetch(`${API_URL}/ranking/champion-bonus`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao carregar ranking com bônus");
  return data;
}

export async function saveBetsBulk(matches, predictions) {
  const session = getSession();
  if (!session) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const bets = matches
    .map((m) => {
      const p = predictions[m.id];
      if (!p) return null;
      if (p.home === "" || p.away === "") return null;
      return {
        match_id: m.id,
        home_score_prediction: Number(p.home),
        away_score_prediction: Number(p.away),
      };
    })
    .filter(Boolean);

  if (!bets.length) {
    throw new Error("Nenhum palpite preenchido para salvar.");
  }

  const res = await fetch(`${API_URL}/bets/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.id,
      "X-Auth-Token": session.auth_token,
    },
    body: JSON.stringify({ bets }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data.detail || "Erro ao salvar palpites.");
  }
  return data; // { status, saved, errors }
}

export async function fetchPublicBets({ matchId, userId } = {}) {
  const qs = new URLSearchParams();
  if (matchId != null) qs.set("match_id", String(matchId));
  if (userId != null) qs.set("user_id", String(userId));
  const url = `${API_URL}/bets/public${qs.toString() ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data.detail || "Erro ao carregar palpites públicos");
  }
  return data;
}

export async function fetchAdminUsers() {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
  });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao carregar usuários"); }
  return data; // [{id, name}]
}

export async function fetchAdminMatches() {
  const res = await fetch(`${API_URL}/admin/matches`, {
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
  });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao carregar jogos"); }
  return data; // [{id, label, stage, kickoff_at_utc}]
}

// Agora sem limit e com user_id obrigatório
export async function fetchBetHistory({ userId, matchId } = {}) {
  if (!userId) throw new Error("userId é obrigatório");

  const qs = new URLSearchParams();
  qs.set("user_id", String(userId));
  if (matchId) qs.set("match_id", String(matchId));

  const res = await fetch(`${API_URL}/admin/bet-history?${qs.toString()}`, {
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
  });

  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao carregar histórico de apostas"); }
  return data;
}


export async function fetchMatchStats(matchId) {
  const session = getSession();
  if (!session) throw new Error("Sessão expirada. Faça login novamente.");
  const res = await fetch(`${API_URL}/stats/match/${matchId}`, {
    headers: { "Content-Type": "application/json", "X-User-Id": session.id, "X-Auth-Token": session.auth_token },
  });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao carregar estatísticas."); }
  return data;
}


export async function saveMatchResultsBulk(matches, officialResults) {
  const session = getSession();
  if (!session) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const results = matches
    .map((m) => {
      const r = officialResults[m.id];
      if (!r) return null;
      if (r.home === "" || r.away === "") return null;
      return {
        match_id: m.id,
        home_score: Number(r.home),
        away_score: Number(r.away),
      };
    })
    .filter(Boolean);

  if (!results.length) {
    throw new Error("Nenhum resultado preenchido para salvar.");
  }

  const res = await fetch(`${API_URL}/matches/results/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
    body: JSON.stringify({ results }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data.detail || "Erro ao salvar resultados.");
  }
  return data; // { status, updated, errors }
}
export async function fetchTeams() {
  const res = await fetch(`${API_URL}/teams`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.detail || "Erro ao carregar seleções.");
  }

  return data;
}

export async function fetchChampionPick() {
  const res = await fetch(`${API_URL}/champion-pick`, {
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data?.detail || "Erro ao carregar palpite do campeão.");
  }

  return data;
}

export async function fetchPublicChampionPicks() {
  const res = await fetch(`${API_URL}/champion-picks/public`, {
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data?.detail || "Erro ao carregar palpites de campeão.");
  }

  return data;
}

export async function saveChampionPick(teamId) {
  const res = await fetch(`${API_URL}/champion-pick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
    body: JSON.stringify({ team_id: teamId }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data?.detail || "Erro ao salvar palpite do campeão.");
  }

  return data;
}

export async function fetchAdminChampionConfig() {
  const res = await fetch(`${API_URL}/admin/champion-config`, {
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
  });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao carregar campeão oficial"); }
  return data;
}

export async function saveAdminChampionConfig(teamId) {
  const res = await fetch(`${API_URL}/admin/champion-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
    body: JSON.stringify({ team_id: teamId ?? null }),
  });
  const data = await res.json();
  if (!res.ok) { if (res.status === 401) fireUnauthorized(); throw new Error(data.detail || "Erro ao salvar campeão oficial"); }
  return data;
}

// ── Ligas ───────────────────────────────────────────────────────────────────

async function leagueRequest(path, method = "GET", body = undefined) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) fireUnauthorized();
    throw new Error(data.detail || "Erro na operação de liga");
  }
  return data;
}

export const fetchAllUsers       = ()               => leagueRequest("/users");
export const fetchRankingEvolution = (userId)        => leagueRequest(`/ranking/evolution?user_id=${userId}`);
export const fetchMyLeagues   = ()               => leagueRequest("/leagues/mine");
export const createLeague     = (name)           => leagueRequest("/leagues", "POST", { name });
export const addLeagueMember  = (id, userId)     => leagueRequest(`/leagues/${id}/members`, "POST", { user_id: userId });
export const leaveLeague      = (id)             => leagueRequest(`/leagues/${id}/members/me`, "DELETE");
export const deleteLeague     = (id)             => leagueRequest(`/leagues/${id}`, "DELETE");

export async function adminOverrideBet({ secondaryPassword, userId, matchId, homeScore, awayScore }) {
  const res = await fetch(`${API_URL}/admin/bet-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getHeadersWithAuth() },
    body: JSON.stringify({
      secondary_password: secondaryPassword,
      user_id: userId,
      match_id: matchId,
      home_score_prediction: homeScore,
      away_score_prediction: awayScore,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403) fireUnauthorized();
    throw new Error(data.detail || "Erro ao salvar palpite.");
  }
  return data;
}