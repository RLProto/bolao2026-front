// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  fetchMatches,
  fetchRanking,
  saveBetsBulk,
  fetchPublicBets,
  saveMatchResultsBulk,
  fetchTeams,
  fetchChampionPick,
  saveChampionPick,
  fetchAdminChampionConfig,
  saveAdminChampionConfig,
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

  const rankingFetchedAt = useRef(null);

  const [tab, setTab] = useState("matches"); // matches | ranking | view-bets

   // Palpite no campeão
  const [teams, setTeams] = useState([]);
  const [championPick, setChampionPick] = useState(null);
  const [selectedChampionTeamId, setSelectedChampionTeamId] = useState("");
  const [championPickLoading, setChampionPickLoading] = useState(false);
  const [savingChampionPick, setSavingChampionPick] = useState(false);
  const [championPickError, setChampionPickError] = useState("");

  // páginas controladas pelo menu lateral
  const [page, setPage] = useState("main"); // main | rules | prize | history | results
  const [menuOpen, setMenuOpen] = useState(false);

  const [predictions, setPredictions] = useState({});
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [saveBetsResult, setSaveBetsResult] = useState(null); // { saved, errors }

  // resultados oficiais (admin)
  const [officialResults, setOfficialResults] = useState({}); // { [matchId]: { home, away } }
  const [savingResults, setSavingResults] = useState(false);

  // campeão oficial (admin)
  const [adminChampionConfig, setAdminChampionConfig] = useState(null);
  const [adminChampionConfigLoading, setAdminChampionConfigLoading] = useState(false);
  const [adminChampionConfigError, setAdminChampionConfigError] = useState("");
  const [selectedAdminChampionTeamId, setSelectedAdminChampionTeamId] = useState("");
  const [savingAdminChampion, setSavingAdminChampion] = useState(false);

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
    loadChampionFeatureData();
  }, [session]);


  async function loadChampionFeatureData() {
    setChampionPickLoading(true);
    setChampionPickError("");

    try {
      const [teamsData, pickData] = await Promise.all([
        fetchTeams(),
        fetchChampionPick(),
      ]);

      setTeams(teamsData || []);
      setChampionPick(pickData || null);
      setSelectedChampionTeamId(
        pickData?.team_id ? String(pickData.team_id) : ""
      );
    } catch (err) {
      setChampionPickError(
        err.message || "Erro ao carregar palpite do campeão."
      );
    } finally {
      setChampionPickLoading(false);
    }
  }

  async function handleSaveChampionPick() {
    if (!selectedChampionTeamId) {
      showToast("info", "Selecione uma equipe para palpitar o campeão.");
      return;
    }

    try {
      setSavingChampionPick(true);
      setChampionPickError("");

      const data = await saveChampionPick(Number(selectedChampionTeamId));

      setChampionPick(data);
      setSelectedChampionTeamId(
        data?.team_id ? String(data.team_id) : ""
      );

      showToast("success", "Palpite no campeão salvo com sucesso!");
    } catch (err) {
      const msg = err.message || "Erro ao salvar palpite do campeão.";
      setChampionPickError(msg);
      showToast("error", msg);
    } finally {
      setSavingChampionPick(false);
    }
  }

  async function loadAdminChampionConfig() {
    setAdminChampionConfigLoading(true);
    setAdminChampionConfigError("");
    try {
      const data = await fetchAdminChampionConfig();
      setAdminChampionConfig(data);
      setSelectedAdminChampionTeamId(data?.team_id ? String(data.team_id) : "");
    } catch (err) {
      setAdminChampionConfigError(err.message || "Erro ao carregar campeão oficial.");
    } finally {
      setAdminChampionConfigLoading(false);
    }
  }

  async function handleSaveAdminChampionConfig() {
    try {
      setSavingAdminChampion(true);
      setAdminChampionConfigError("");
      const teamId = selectedAdminChampionTeamId ? Number(selectedAdminChampionTeamId) : null;
      const data = await saveAdminChampionConfig(teamId);
      setAdminChampionConfig(data);
      setSelectedAdminChampionTeamId(data?.team_id ? String(data.team_id) : "");
      showToast("success", "Campeão oficial definido com sucesso!");
    } catch (err) {
      const msg = err.message || "Erro ao salvar campeão oficial.";
      setAdminChampionConfigError(msg);
      showToast("error", msg);
    } finally {
      setSavingAdminChampion(false);
    }
  }

  function showToast(type, message) {
    setToast({ type, message, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
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
    const now = Date.now();
    if (rankingFetchedAt.current && now - rankingFetchedAt.current < 60_000) return;
    setRankingLoading(true);
    setRankingError("");
    try {
      const data = await fetchRanking();
      setRanking(data);
      rankingFetchedAt.current = Date.now();
    } catch (err) {
      setRankingError(err.message || "Erro ao carregar ranking");
    } finally {
      setRankingLoading(false);
    }
  }

  async function loadRankingForced() {
    rankingFetchedAt.current = null;
    await loadRanking();
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

  function handleLogout() {
    localStorage.removeItem("bolao_user");
    setSession(null);
    setMatches([]);
    setRanking([]);
    rankingFetchedAt.current = null;
    setPredictions({});
    setDirtyIds(new Set());
    setPublicBets([]);
    setOfficialResults({});
    setPage("main");
    setMenuOpen(false);
    setView("auth");
    setTeams([]);
    setChampionPick(null);
    setSelectedChampionTeamId("");
    setChampionPickError("");
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

  const updatePrediction = useCallback((matchId, field, value) => {
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
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(matchId);
      return next;
    });
  }, []);

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
      setSaveBetsResult(null);

      const result = await saveBetsBulk(matches, predictions);

      setSaveBetsResult({ saved: result.saved, errors: result.errors || [] });
      setDirtyIds(new Set());

      await loadMatches();

      if (result.saved > 0) {
        showToast("success", "Palpites salvos com sucesso!");
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
  // Backend já calcula o campo `round` em cada partida — apenas indexamos por id.
  const roundByMatchId = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      if (m.round) map[m.id] = m.round;
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
            BOLÃO DA COPA 2026
          </div>
        </header>
        <ResetPasswordView
          resetToken={resetToken}
          resetPassword={resetPassword}
          onBackToAuth={() => setView("auth")}
        />
        {toast && (
          <div className={`toast toast-${toast.type}`} key={toast.id}>
            <div className="toast-inner">
              <span className="toast-icon">
                {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
              </span>
              <span className="toast-msg">{toast.message}</span>
            </div>
            <div className="toast-bar" />
          </div>
        )}
      </div>
    );
  }

  if (!session || view === "auth") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="logo">
            BOLÃO DA COPA 2026
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
          <div className={`toast toast-${toast.type}`} key={toast.id}>
            <div className="toast-inner">
              <span className="toast-icon">
                {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
              </span>
              <span className="toast-msg">{toast.message}</span>
            </div>
            <div className="toast-bar" />
          </div>
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
            aria-expanded={menuOpen}
            aria-controls="main-sidebar"
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
      <aside id="main-sidebar" className={`menu-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="menu-sidebar-header">
          <span className="menu-sidebar-title">COPA DO MUNDO 2026</span>
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
              }}
            >
              Histórico de apostas
            </button>

            <button
              className={`menu-item ${page === "results" ? "active" : ""}`}
              onClick={() => {
                setPage("results");
                setMenuOpen(false);
                loadMatches();
                loadAdminChampionConfig();
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
                <h1>COPA DO MUNDO 2026</h1>
                <p>
                  Faça seus palpites até 30 minutos antes de cada jogo. A
                  pontuação é calculada automaticamente com base no resultado da partida.
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
                onRetry={loadMatches}
                predictions={predictions}
                onUpdatePrediction={updatePrediction}
                dirtyIds={dirtyIds}
                onSaveAllBets={handleSaveAllBets}
                savingAll={savingAll}
                saveBetsResult={saveBetsResult}
                formatDateTime={formatDateTime}
                ROUND_OPTIONS={ROUND_OPTIONS}
                selectedRound={selectedRound}
                onSelectedRoundChange={setSelectedRound}
                orderMode={orderMode}
                onOrderModeChange={setOrderMode}
                isGroupRound={isGroupRound}
                teams={teams}
                championPick={championPick}
                championPickLoading={championPickLoading}
                championPickError={championPickError}
                selectedChampionTeamId={selectedChampionTeamId}
                onSelectedChampionTeamIdChange={setSelectedChampionTeamId}
                onSaveChampionPick={handleSaveChampionPick}
                savingChampionPick={savingChampionPick}
              />
            )}

            {tab === "ranking" && (
              <RankingTab
                ranking={ranking}
                rankingLoading={rankingLoading}
                rankingError={rankingError}
                onRetry={loadRankingForced}
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
                A pontuação de cada palpite depende do quão perto ele fica do placar
                final da partida.
              </p>

              <ul className="rules-list">
                <li>
                  <strong>18 pontos — Placar exato</strong>
                  <span>Acertou exatamente o placar final.</span>
                </li>

                <li>
                  <strong>12 pontos — Resultado correto + gols de um time</strong>
                  <span>
                    Acertou o vencedor (ou empate) e também os gols de um dos times.
                  </span>
                </li>

                <li>
                  <strong>9 pontos — Resultado correto</strong>
                  <span>Acertou apenas o vencedor da partida ou o empate.</span>
                </li>

                <li>
                  <strong>3 pontos — Acerto parcial</strong>
                  <span>
                    Vale 3 pontos quando você acerta os gols de apenas um dos times,
                    mesmo errando o resultado, ou quando aposta em empate mas o jogo
                    termina com vencedor.
                  </span>
                </li>
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
              <BetHistoryTab />
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
                teams={teams}
                adminChampionConfig={adminChampionConfig}
                adminChampionConfigLoading={adminChampionConfigLoading}
                adminChampionConfigError={adminChampionConfigError}
                selectedAdminChampionTeamId={selectedAdminChampionTeamId}
                onSelectedAdminChampionTeamIdChange={setSelectedAdminChampionTeamId}
                onSaveAdminChampionConfig={handleSaveAdminChampionConfig}
                savingAdminChampion={savingAdminChampion}
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
