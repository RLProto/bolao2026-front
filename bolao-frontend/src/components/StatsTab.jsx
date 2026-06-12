// src/components/StatsTab.jsx
import React, { useState } from "react";
import { fetchMatchStats } from "../api";
import FlagIcon from "./FlagIcon";

// ─── Canvas utilities ─────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const FIFA_TO_ISO2_CANVAS = {
  MEX:"mx",RSA:"za",KOR:"kr",CZE:"cz",IRL:"ie",DEN:"dk",MKD:"mk",
  CAN:"ca",ITA:"it",NIR:"gb",WAL:"gb",BIH:"ba",QAT:"qa",SUI:"ch",
  BRA:"br",MAR:"ma",HAI:"ht",SCO:"gb-sct",
  USA:"us",PAR:"py",AUS:"au",TUR:"tr",ROM:"ro",SVK:"sk",KOS:"xk",
  GER:"de",CUW:"cw",CIV:"ci",ECU:"ec",
  NED:"nl",JPN:"jp",UKR:"ua",SWE:"se",POL:"pl",ALB:"al",TUN:"tn",
  BEL:"be",EGY:"eg",IRN:"ir",NZL:"nz",
  ESP:"es",CPV:"cv",KSA:"sa",URU:"uy",
  FRA:"fr",SEN:"sn",BOL:"bo",SUR:"sr",IRQ:"iq",NOR:"no",
  ARG:"ar",ALG:"dz",AUT:"at",JOR:"jo",
  POR:"pt",COD:"cd",JAM:"jm",NCL:"nc",UZB:"uz",COL:"co",
  ENG:"gb-eng",CRO:"hr",GHA:"gh",PAN:"pa",
};

function loadFlagImage(code) {
  if (!code) return Promise.resolve(null);
  const iso2 = FIFA_TO_ISO2_CANVAS[String(code).trim().toUpperCase()];
  if (!iso2) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `https://flagcdn.com/w40/${iso2}.png`;
  });
}

async function drawStatsCanvas(stats) {
  const [homeFlag, awayFlag] = await Promise.all([
    loadFlagImage(stats.home_team_code),
    loadFlagImage(stats.away_team_code),
  ]);

  const W = 1080;
  const P = 60;
  const maxToShow = Math.min(stats.scores.length, 10);
  const BAR_H = 33;
  const BAR_GAP = 9;

  const HEADER_H  = 168;
  const OUTCOME_H = 118;
  const SCORES_H  = 30 + maxToShow * (BAR_H + BAR_GAP);
  const FOOTER_H  = 48;
  const H = HEADER_H + OUTCOME_H + SCORES_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#020617");
  bg.addColorStop(1, "#0b1120");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = "rgba(148,163,184,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Top accent
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(0, 0, W, 4);

  // Eyebrow — centered
  ctx.fillStyle = "#22c55e";
  ctx.font = "600 13px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("BOLÃO DA RAFA  ·  ESTATÍSTICAS", W / 2, 44);
  ctx.textAlign = "left";

  // Teams — centered with flanking flags
  const teamsStr = `${stats.home_team_name.toUpperCase()}  ×  ${stats.away_team_name.toUpperCase()}`;
  const fs = teamsStr.length > 30 ? 34 : teamsStr.length > 22 ? 40 : 46;
  ctx.font = `700 ${fs}px -apple-system, system-ui, sans-serif`;
  const tw = ctx.measureText(teamsStr).width;
  const FLAG_W = 50, FLAG_H = 33, FLAG_GAP = 16;
  const blockW = (homeFlag ? FLAG_W + FLAG_GAP : 0) + tw + (awayFlag ? FLAG_GAP + FLAG_W : 0);
  const blockX = (W - blockW) / 2;
  const titleY = 108;
  const flagTop = titleY - Math.round(fs * 0.76);

  let textX = blockX;
  if (homeFlag) {
    ctx.drawImage(homeFlag, blockX, flagTop, FLAG_W, FLAG_H);
    textX = blockX + FLAG_W + FLAG_GAP;
  }
  ctx.fillStyle = "#f1f5f9";
  ctx.fillText(teamsStr, textX, titleY);
  if (awayFlag) {
    ctx.drawImage(awayFlag, textX + tw + FLAG_GAP, flagTop, FLAG_W, FLAG_H);
  }

  // Subtitle — centered
  ctx.fillStyle = "rgba(148,163,184,0.72)";
  ctx.font = "400 15px -apple-system, system-ui, sans-serif";
  let sub = `${stats.total_bets} palpites registrados`;
  if (stats.official_home_score != null) {
    sub = `Resultado oficial: ${stats.official_home_score} × ${stats.official_away_score}   ·   ${stats.total_bets} palpites`;
  }
  ctx.textAlign = "center";
  ctx.fillText(sub, W / 2, 136);
  ctx.textAlign = "left";

  // Divider
  ctx.strokeStyle = "rgba(148,163,184,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, 154); ctx.lineTo(W - P, 154); ctx.stroke();

  // ── OUTCOME BOXES ──
  let curY = HEADER_H;
  ctx.fillStyle = "rgba(148,163,184,0.55)";
  ctx.font = "600 11px 'Courier New', monospace";
  ctx.fillText("COMO O BOLÃO APOSTOU", P, curY);
  curY += 16;

  const outcomes = [
    { label: stats.home_team_name, pct: stats.home_win_pct, count: stats.home_win_count, color: "#22c55e" },
    { label: "Empate", pct: stats.draw_pct, count: stats.draw_count, color: "#eab308" },
    { label: stats.away_team_name, pct: stats.away_win_pct, count: stats.away_win_count, color: "#60a5fa" },
  ];
  const boxW = (W - P * 2 - 24) / 3;
  const boxH = 86;

  outcomes.forEach((o, i) => {
    const bx = P + i * (boxW + 12);
    const by = curY;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, bx, by, boxW, boxH, 10);
    ctx.fill();

    ctx.fillStyle = o.color;
    ctx.fillRect(bx, by, 3, boxH);

    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "500 12px -apple-system, system-ui, sans-serif";
    ctx.fillText(o.label.toUpperCase(), bx + 18, by + 22);

    ctx.fillStyle = o.color;
    ctx.font = "800 30px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${o.pct}%`, bx + 18, by + 56);

    ctx.fillStyle = "rgba(148,163,184,0.55)";
    ctx.font = "400 12px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${o.count} palpites`, bx + 18, by + 76);
  });

  curY += boxH + 16;

  // Divider
  ctx.strokeStyle = "rgba(148,163,184,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, curY); ctx.lineTo(W - P, curY); ctx.stroke();
  curY += 14;

  // ── SCORES ──
  ctx.fillStyle = "rgba(148,163,184,0.55)";
  ctx.font = "600 11px 'Courier New', monospace";
  ctx.fillText("DISTRIBUIÇÃO DE PLACARES", P, curY);
  curY += 18;

  const maxCount = stats.scores[0]?.count || 1;
  const SCORE_COL = 80;
  const META_W = 130;
  const BAR_AREA = W - P * 2 - SCORE_COL - META_W;

  for (let i = 0; i < maxToShow; i++) {
    const s = stats.scores[i];
    const sy = curY + i * (BAR_H + BAR_GAP);
    const isTop = i === 0;
    const ratio = s.count / maxCount;
    const barW = Math.max(BAR_AREA * ratio, 6);

    // Score label — uniform font, color only differs for top
    ctx.fillStyle = isTop ? "#f1f5f9" : "rgba(148,163,184,0.82)";
    ctx.font = `${isTop ? 700 : 600} 15px 'Courier New', monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${s.home} × ${s.away}`, P, sy + BAR_H / 2 + 6);

    // Track
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, P + SCORE_COL, sy, BAR_AREA, BAR_H, 6);
    ctx.fill();

    // Bar fill — alpha scales with ratio for visual hierarchy
    const alpha = isTop ? 1 : 0.28 + 0.72 * ratio;
    ctx.fillStyle = `rgba(34,197,94,${alpha})`;
    roundRect(ctx, P + SCORE_COL, sy, barW, BAR_H, 6);
    ctx.fill();

    // Meta — uniform font, right-aligned at fixed column
    ctx.fillStyle = isTop ? "rgba(203,213,225,0.95)" : "rgba(148,163,184,0.82)";
    ctx.font = `${isTop ? 600 : 500} 13px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`${s.count}  (${s.pct}%)`, W - P, sy + BAR_H / 2 + 5);
    ctx.textAlign = "left";
  }

  curY += maxToShow * (BAR_H + BAR_GAP) + 20;

  // Footer
  ctx.fillStyle = "rgba(148,163,184,0.22)";
  ctx.font = "400 12px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("bolão da rafa", P, H - 18);
  ctx.textAlign = "right";
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  ctx.fillText(dateStr, W - P, H - 18);
  ctx.textAlign = "left";

  return canvas;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OutcomeCard({ label, pct, count, color }) {
  return (
    <div className="stats-outcome-card" style={{ borderLeftColor: color }}>
      <span className="stats-outcome-label">{label}</span>
      <span className="stats-outcome-pct" style={{ color }}>{pct}%</span>
      <div className="stats-outcome-bar-track">
        <div
          className="stats-outcome-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="stats-outcome-count">{count} palpites</span>
    </div>
  );
}

function ScoreRow({ home, away, count, pct, maxCount, rank }) {
  const isTop = rank === 0;
  const ratio = count / maxCount;

  return (
    <div className="stats-score-row" style={{ "--delay": `${rank * 0.04}s` }}>
      <span className={`stats-score-label${isTop ? " top-score" : ""}`}>
        {home} × {away}
      </span>
      <div className="stats-bar-track">
        <div
          className={`stats-bar-fill${isTop ? " top-bar" : ""}`}
          style={{ width: `${Math.max(ratio * 100, 1)}%`, animationDelay: `var(--delay)` }}
        />
      </div>
      <span className={`stats-score-meta${isTop ? " top-meta" : ""}`}>
        {count} <span className="stats-score-pct">({pct}%)</span>
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StatsTab({ matches, formatDateTime }) {
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lockedMatches = [...matches]
    .filter((m) => m.is_locked)
    .sort((a, b) => new Date(a.kickoff_at_utc) - new Date(b.kickoff_at_utc));

  async function handleSelectMatch(id) {
    setSelectedMatchId(id);
    setStats(null);
    setError("");
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchMatchStats(id);
      setStats(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!stats) return;
    const canvas = await drawStatsCanvas(stats);
    const a = document.createElement("a");
    a.download = `stats_${stats.home_team_code}_${stats.away_team_code}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  const maxCount = stats?.scores[0]?.count || 1;

  return (
    <section className="section">
      <div className="stats-toolbar">
        <div className="stats-match-select">
          <label className="filter-label">Jogo</label>
          <select
            className="filter-select"
            value={selectedMatchId}
            onChange={(e) => handleSelectMatch(e.target.value)}
          >
            <option value="">Selecione um jogo</option>
            {lockedMatches.map((m, i) => (
              <option key={m.id} value={m.id}>
                Jogo {i + 1} — {m.home_team_name} x {m.away_team_name}
              </option>
            ))}
          </select>
        </div>

        {stats && (
          <button className="btn primary small" onClick={handleExport}>
            Exportar imagem
          </button>
        )}
      </div>

      {!selectedMatchId && !loading && (
        <p className="empty-state">Selecione um jogo para ver as estatísticas.</p>
      )}

      {loading && (
        <div className="loading-state">
          <span className="spinner" aria-hidden="true" />
          Carregando estatísticas...
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {stats && !loading && (
        <div className="stats-display">

          {/* Header */}
          <div className="stats-header-card">
            <div className="stats-header-eyebrow">estatísticas do jogo</div>
            <div className="stats-teams">
              <FlagIcon code={stats.home_team_code} name={stats.home_team_name} />
              <span className="stats-team">{stats.home_team_name}</span>
              <span className="stats-vs">×</span>
              <span className="stats-team">{stats.away_team_name}</span>
              <FlagIcon code={stats.away_team_code} name={stats.away_team_name} />
            </div>
            <div className="stats-header-meta">
              {stats.official_home_score != null && (
                <span className="stats-official-result">
                  Resultado oficial: <strong>{stats.official_home_score} × {stats.official_away_score}</strong>
                </span>
              )}
              <span className="stats-total-badge">{stats.total_bets} palpites</span>
            </div>
          </div>

          {/* Winner distribution */}
          <div className="stats-section">
            <h4 className="stats-section-title">Como o bolão apostou</h4>
            <div className="stats-outcome-row">
              <OutcomeCard label={stats.home_team_name} pct={stats.home_win_pct} count={stats.home_win_count} color="#22c55e" />
              <OutcomeCard label="Empate" pct={stats.draw_pct} count={stats.draw_count} color="#eab308" />
              <OutcomeCard label={stats.away_team_name} pct={stats.away_win_pct} count={stats.away_win_count} color="#60a5fa" />
            </div>
          </div>

          {/* Score distribution */}
          <div className="stats-section">
            <h4 className="stats-section-title">Distribuição de placares</h4>
            <div className="stats-scores">
              {stats.scores.map((s, i) => (
                <ScoreRow
                  key={`${s.home}-${s.away}`}
                  home={s.home}
                  away={s.away}
                  count={s.count}
                  pct={s.pct}
                  maxCount={maxCount}
                  rank={i}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
