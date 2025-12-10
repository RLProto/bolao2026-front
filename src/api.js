// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function registerUser(name, email, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
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
  return stored ? JSON.parse(stored) : null;
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
    throw new Error(data.detail || "Erro ao carregar partidas");
  }
  return data;
}

export async function fetchRanking() {
  const res = await fetch(`${API_URL}/ranking`, {
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
    throw new Error(data.detail || "Erro ao salvar palpites.");
  }
  return data; // { status, saved, errors }
}

export async function fetchPublicBets() {
  const res = await fetch(`${API_URL}/bets/public`, {
    headers: {
      "Content-Type": "application/json",
      ...getHeadersWithAuth(),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao carregar palpites públicos");
  }
  return data;
}

/**
 * Histórico de apostas (tabela bet_history) – somente admin
 * GET /admin/bet-history?limit=500
 */
export async function fetchBetHistory(limit = 500) {
  const res = await fetch(
    `${API_URL}/admin/bet-history?limit=${encodeURIComponent(limit)}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...getHeadersWithAuth(),
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erro ao carregar histórico de apostas");
  }
  return data; // lista de BetHistoryOut
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
    throw new Error(data.detail || "Erro ao salvar resultados.");
  }
  return data; // { status, updated, errors }
}
