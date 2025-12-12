// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  fetchMatches,
  fetchRanking,
  saveBetsBulk,
  fetchPublicBets,
  fetchBetHistory,           // histórico (admin)
  saveMatchResultsBulk,      // 👈 NOVO
} from "./api";

import AuthView from "./components/AuthView";
import ResetPasswordView from "./components/ResetPasswordView";
import MatchesTab from "./components/MatchesTab";
import RankingTab from "./components/RankingTab";
import ViewBetsTab from "./components/ViewBetsTab";
import BetHistoryTab from "./components/BetHistoryTab";
import ResultsTab from "./components/ResultsTab"; // 👈 NOVO

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hour}:${minute}`;
}

function getInitialSession() {
  const raw = localStorage.getItem("bolao_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Opções de etapa / rodada
const ROUND_OPTIONS = [
  { value: "all", label: "Todas as etapas" },
  { value: "1a rodada", label: "1ª rodada (grupos)" },
  { value: "2a rodada", label: "2ª rodada (grupos)" },
  { value: "3a rodada", label: "3ª rodada (grupos)" },
  { value: "16 avos", label: "16 avos" },
  { value: "oitavas", label: "Oitavas" },
  { value: "quartas", label: "Quartas" },
  { value: "semi", label: "Semifinais" },
  { value: "finais", label: "Finais" },
];

// Heurística para descobrir etapa de mata-mata a partir do stage
function getRoundFromStage(stage) {
  const s = (stage || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (s.includes("16 avos") || s.includes("round of 32")) return "16 avos";
  if (s.includes("oitavas") || s.includes("round of 16")) return "oitavas";
  if (s.includes("quartas") || s.includes("quarter")) return "quartas";
  if (s.includes("semi")) return "semi";

  if (
    s.includes("3º colocado") ||
    s.includes("3o colocado") ||
    s.includes("third place")
  ) {
    return "finais";
  }

  if (
    s.includes("final") &&
    !s.includes("semi") &&
    !s.includes("quartas") &&
    !s.includes("oitavas")
  ) {
    return "finais";
  }

  return null;
}

function App() {
  const [session, setSession] = useState(getInitialSession);
  const [view, setView] = useState("auth"); // auth | main | reset
  const [resetToken, setResetToken] = useState("");

  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");

  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");

  const [publicBets, setPublicBets] = useState([]);
  const [publicBetsLoading, setPublicBetsLoading] = useState(false);
  const [publicBetsError, setPublicBetsError] = useState("");

  // histórico de apostas (admin/debug)
  const [betHistory, setBetHistory] = useState([]);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [betHistoryError, setBetHistoryError] = useState("");

  const [tab, setTab] = useState("matches"); // matches | ranking | view-bets

  // páginas controladas pelo menu lateral
  const [page, setPage] = useState("main"); // main | rules | prize | history | results
  const [menuOpen, setMenuOpen] = useState(false);

  const [predictions, setPredictions] = useState({});
  const [savingAll, setSavingAll] = useState(false);

  // resultados oficiais (admin)
  const [officialResults, setOfficialResults] = useState({}); // { [matchId]: { home, away } }
  const [savingResults, setSavingResults] = useState(false);

  const [toast, setToast] = useState(null); // { type, message }

  const [selectedRound, setSelectedRound] = useState("all");
  const [orderMode, setOrderMode] = useState("date"); // date | group

  const isGroupRound = ["all", "1a rodada", "2a rodada", "3a rodada"].includes(
    selectedRound
  );

  const isAdmin = session?.profile === "admin";

  // Detecta token na URL -> tela de reset
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setResetToken(token);
      setView("reset");
    } else if (session) {
      setView("main");
    } else {
      setView("auth");
    }
  }, [session]);

  // Carrega dados ao logar
  useEffect(() => {
    if (!session) return;
    loadMatches();
    loadRanking();
  }, [session]);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadMatches() {
    setMatchesLoading(true);
    setMatchesError("");
    try {
      const data = await fetchMatches();
      setMatches(data);

      const mapPred = {};
      const mapRes = {};
      data.forEach((m) => {
        mapPred[m.id] = {
          home: m.my_bet ? m.my_bet.home_score_prediction : "",
          away: m.my_bet ? m.my_bet.away_score_prediction : "",
        };
        mapRes[m.id] = {
          home: m.home_score ?? "",
          away: m.away_score ?? "",
        };
      });
      setPredictions(mapPred);
      setOfficialResults(mapRes);
    } catch (err) {
      setMatchesError(err.message || "Erro ao carregar partidas");
    } finally {
      setMatchesLoading(false);
    }
  }

  async function loadRanking() {
    setRankingLoading(true);
    setRankingError("");
    try {
      const data = await fetchRanking();
      setRanking(data);
    } catch (err) {
      setRankingError(err.message || "Erro ao carregar ranking");
    } finally {
      setRankingLoading(false);
    }
  }

  async function loadPublicBets() {
    setPublicBetsLoading(true);
    setPublicBetsError("");
    try {
      const data = await fetchPublicBets();
      setPublicBets(data);
    } catch (err) {
      setPublicBetsError(err.message || "Erro ao carregar palpites públicos");
    } finally {
      setPublicBetsLoading(false);
    }
  }

  async function loadBetHistory(limit = 200000) {
    setBetHistoryLoading(true);
    setBetHistoryError("");
    try {
      const data = await fetchBetHistory(limit);
      setBetHistory(data);
    } catch (err) {
      setBetHistoryError(
        err.message || "Erro ao carregar histórico de apostas"
      );
    } finally {
      setBetHistoryLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("bolao_user");
    setSession(null);
    setMatches([]);
    setRanking([]);
    setPredictions({});
    setPublicBets([]);
    setBetHistory([]);
    setOfficialResults({});
    setPage("main");
    setMenuOpen(false);
    setView("auth");
  }

  function handleAuthSuccess(data) {
    const sessionData = {
      ...data,
      profile: data.profile || data.perfil || "user",
    };
    localStorage.setItem("bolao_user", JSON.stringify(sessionData));
    setSession(sessionData);
    setPage("main");
    setMenuOpen(false);
    setView("main");
  }

  function updatePrediction(matchId, field, value) {
    let cleaned = value.replace(/\D/g, "").slice(0, 2);

    if (cleaned !== "") {
      let num = Number(cleaned);
      if (num > 10) num = 10;
      cleaned = String(num);
    }

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: "", away: "" }),
        [field]: cleaned,
      },
    }));
  }

  function updateOfficialResult(matchId, field, value) {
    let cleaned = value.replace(/\D/g, "").slice(0, 2);
    if (cleaned !== "") {
      let num = Number(cleaned);
      if (num > 20) num = 20;
      cleaned = String(num);
    }

    setOfficialResults((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: "", away: "" }),
        [field]: cleaned,
      },
    }));
  }

  async function handleSaveAllBets() {
    if (!matches.length) {
      showToast("info", "Não há partidas para salvar.");
      return;
    }

    const hasAny = matches.some((m) => {
      const p = predictions[m.id];
      return p && p.home !== "" && p.away !== "";
    });

    if (!hasAny) {
      showToast("info", "Preencha ao menos um palpite antes de salvar.");
      return;
    }

    try {
      setSavingAll(true);

      // 1) Salva os palpites
      const result = await saveBetsBulk(matches, predictions);

      // 2) Recarrega as partidas (pode demorar por causa do Supabase)
      await loadMatches();

      // 3) Só agora mostra o toast
      if (result.saved > 0) {
        showToast("success", "Seus palpites foram salvos com sucesso!");
      } else {
        showToast(
          "info",
          "Nenhum palpite foi salvo (todos os jogos já estavam bloqueados ou sem palpite)."
        );
      }
    } catch (err) {
      showToast("error", err.message || "Erro ao salvar palpites.");
    } finally {
      setSavingAll(false);
    }
  }


  async function handleSaveAllResults() {
    if (!matches.length) {
      showToast("info", "Não há partidas para salvar.");
      return;
    }

    const hasAny = matches.some((m) => {
      const r = officialResults[m.id];
      return r && r.home !== "" && r.away !== "";
    });

    if (!hasAny) {
      showToast("info", "Preencha ao menos um resultado antes de salvar.");
      return;
    }

    try {
      setSavingResults(true);
      const result = await saveMatchResultsBulk(matches, officialResults);

      if (result.updated > 0) {
        showToast("success", "Resultados oficiais salvos com sucesso!");
      } else {
        showToast("info", "Nenhum resultado foi salvo.");
      }

      await loadMatches();
    } catch (err) {
      showToast("error", err.message || "Erro ao salvar resultados.");
    } finally {
      setSavingResults(false);
    }
  }

  // --------- MAPA DE RODADA POR PARTIDA ---------
  const roundByMatchId = useMemo(() => {
    const map = {};

    const groups = matches.reduce((acc, m) => {
      const key = m.stage || "";
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});

    Object.entries(groups).forEach(([stage, groupMatches]) => {
      const lowerStage = (stage || "").toLowerCase();

      if (lowerStage.startsWith("grupo")) {
        const sorted = groupMatches
          .slice()
          .sort(
            (a, b) =>
              new Date(a.kickoff_at_utc).getTime() -
              new Date(b.kickoff_at_utc).getTime()
          );

        sorted.forEach((m, idx) => {
          const roundIndex = Math.floor(idx / 2); // 2 jogos por rodada
          const roundLabel =
            roundIndex === 0
              ? "1a rodada"
              : roundIndex === 1
              ? "2a rodada"
              : roundIndex === 2
              ? "3a rodada"
              : null;
          if (roundLabel) {
            map[m.id] = roundLabel;
          }
        });
      } else {
        groupMatches.forEach((m) => {
          const round = getRoundFromStage(m.stage);
          if (round) {
            map[m.id] = round;
          }
        });
      }
    });

    return map;
  }, [matches]);

  const visibleMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      if (selectedRound === "all") return true;
      return roundByMatchId[m.id] === selectedRound;
    });

    if (orderMode === "date") {
      return [...filtered].sort(
        (a, b) =>
          new Date(a.kickoff_at_utc).getTime() -
          new Date(b.kickoff_at_utc).getTime()
      );
    }

    // orderMode === "group"
    return [...filtered].sort((a, b) => {
      const sA = (a.stage || "").toLowerCase();
      const sB = (b.stage || "").toLowerCase();

      const mA = sA.match(/grupo\s+([a-z])/i);
      const mB = sB.match(/grupo\s+([a-z])/i);

      const gA = mA ? mA[1] : "z";
      const gB = mB ? mB[1] : "z";

      if (gA < gB) return -1;
      if (gA > gB) return 1;

      return (
        new Date(a.kickoff_at_utc).getTime() -
        new Date(b.kickoff_at_utc).getTime()
      );
    });
  }, [matches, selectedRound, orderMode, roundByMatchId]);

  // ---------------- VIEWS ----------------

  if (view === "reset") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">🏆</span> Bolão 2026
          </div>
        </header>
        <ResetPasswordView
          resetToken={resetToken}
          resetPassword={resetPassword}
          onBackToAuth={() => setView("auth")}
        />
        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        )}
      </div>
    );
  }

  if (!session || view === "auth") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="logo">
            <span className="logo-mark">🏆</span> Bolão 2026
          </div>
        </header>
        <main className="main">
          <AuthView
            onAuthSuccess={handleAuthSuccess}
            registerUser={registerUser}
            loginUser={loginUser}
            requestPasswordReset={requestPasswordReset}
          />
        </main>
        {toast && (
          <div className={`toast toast-${toast.type}`}>{toast.message}</div>
        )}
      </div>
    );
  }

  // VIEW MAIN (logado)
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className={`menu-btn ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          >
            <span className="menu-icon" />
          </button>
          <span className="logo-title">MENU</span>
        </div>

        <div className="topbar-right">
          <div className="user-chip">
            <span className="user-avatar">
              {session.name?.[0]?.toUpperCase() ||
                session.email[0].toUpperCase()}
            </span>
            <div className="user-text">
              <span className="user-name">{session.name || session.email}</span>
              <span className="user-sub">{isAdmin ? "admin" : "logado"}</span>
            </div>
          </div>
          <button className="btn ghost small" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* Backdrop escuro quando o menu está aberto */}
      {menuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar lateral */}
      <aside className={`menu-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="menu-sidebar-header">
          <span className="menu-sidebar-title">Bolão 2026</span>
          <button
            className="menu-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <button
          className={`menu-item ${page === "main" ? "active" : ""}`}
          onClick={() => {
            setPage("main");
            setMenuOpen(false);
          }}
        >
          Menu principal
        </button>

        <button
          className={`menu-item ${page === "rules" ? "active" : ""}`}
          onClick={() => {
            setPage("rules");
            setMenuOpen(false);
          }}
        >
          Regras de pontuação
        </button>

        <button
          className={`menu-item ${page === "prize" ? "active" : ""}`}
          onClick={() => {
            setPage("prize");
            setMenuOpen(false);
          }}
        >
          Premiação
        </button>

        {isAdmin && (
          <>
            <button
              className={`menu-item ${page === "history" ? "active" : ""}`}
              onClick={() => {
                setPage("history");
                setMenuOpen(false);
                loadBetHistory();
              }}
            >
              Histórico de apostas
            </button>

            <button
              className={`menu-item ${page === "results" ? "active" : ""}`}
              onClick={() => {
                setPage("results");
                setMenuOpen(false);
                loadMatches(); // garante lista atualizada
              }}
            >
              Postar resultado
            </button>
          </>
        )}
      </aside>

      <main className="main">
        {page === "main" && (
          <>
            <section className="hero hero-compact hero-worldcup">
              <div className="hero-text">
                <h1>Seus palpites da Copa 2026</h1>
                <p>
                  Faça seus chutes até 5 minutos antes de cada jogo. A
                  pontuação é calculada automaticamente com base no resultado.
                </p>
              </div>
            </section>

            <div className="tabs">
              <button
                className={`tab ${tab === "matches" ? "active" : ""}`}
                onClick={() => setTab("matches")}
              >
                Partidas &amp; palpites
              </button>
              <button
                className={`tab ${tab === "ranking" ? "active" : ""}`}
                onClick={() => {
                  setTab("ranking");
                  loadRanking();
                }}
              >
                Ranking
              </button>
              <button
                className={`tab ${tab === "view-bets" ? "active" : ""}`}
                onClick={() => {
                  setTab("view-bets");
                  loadPublicBets();
                }}
              >
                Ver palpites
              </button>
            </div>

            {tab === "matches" && (
              <MatchesTab
                visibleMatches={visibleMatches}
                matchesLoading={matchesLoading}
                matchesError={matchesError}
                predictions={predictions}
                onUpdatePrediction={updatePrediction}
                onSaveAllBets={handleSaveAllBets}
                savingAll={savingAll}
                formatDateTime={formatDateTime}
                ROUND_OPTIONS={ROUND_OPTIONS}
                selectedRound={selectedRound}
                onSelectedRoundChange={setSelectedRound}
                orderMode={orderMode}
                onOrderModeChange={setOrderMode}
                isGroupRound={isGroupRound}
              />
            )}

            {tab === "ranking" && (
              <RankingTab
                ranking={ranking}
                rankingLoading={rankingLoading}
                rankingError={rankingError}
                session={session}
              />
            )}

            {tab === "view-bets" && (
              <ViewBetsTab
                matches={matches}
                bets={publicBets}
                loading={publicBetsLoading}
                error={publicBetsError}
                formatDateTime={formatDateTime}
              />
            )}
          </>
        )}

        {page === "rules" && (
          <section className="section">
            <div className="info-card">
              <h2>Regras de pontuação</h2>
              <p>
                Pontuação usada para cada palpite, de acordo com o resultado
                final do jogo:
              </p>
              <ul>
                <li>Placar exato: 18 pontos</li>
                <li>Resultado + 1 placar correto: 12 pontos</li>
                <li>Resultado correto: 9 pontos</li>
                <li>Resultado errado + 1 placar correto: 6 pontos</li>
                <li>Cravou empate, mas teve vencedor: 3 pontos</li>
              </ul>
            </div>
          </section>
        )}

        {page === "prize" && (
          <section className="section">
            <div className="info-card">
              <h2>Premiação</h2>
              <p>
                Descreva aqui a premiação combinada para as primeiras posições
                do ranking.
              </p>
            </div>
          </section>
        )}

        {page === "history" && (
          <>
            {isAdmin ? (
              <BetHistoryTab
                history={betHistory}
                loading={betHistoryLoading}
                error={betHistoryError}
                formatDateTime={formatDateTime}
              />
            ) : (
              <section className="section">
                <div className="info-card">
                  <h2>Histórico de apostas</h2>
                  <p>Essa área é restrita para administradores.</p>
                </div>
              </section>
            )}
          </>
        )}

        {page === "results" && (
          <>
            {isAdmin ? (
              <ResultsTab
                visibleMatches={visibleMatches}
                matchesLoading={matchesLoading}
                matchesError={matchesError}
                officialResults={officialResults}
                onUpdateResult={updateOfficialResult}
                onSaveAllResults={handleSaveAllResults}
                savingResults={savingResults}
                formatDateTime={formatDateTime}
              />
            ) : (
              <section className="section">
                <div className="info-card">
                  <h2>Postar resultado</h2>
                  <p>Essa área é restrita para administradores.</p>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}

export default App;
