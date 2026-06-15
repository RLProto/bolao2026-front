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
  const maxToShow = stats.scores.length;
  const ROW_H = 46;

  const HEADER_H  = 148;
  const OUTCOME_H = 28 + 124 + 14; // label + boxes + gap
  const DIST_H    = 1 + 14 + 28 + maxToShow * ROW_H; // divider + gap + label + rows
  const FOOTER_H  = 24;
  const H = HEADER_H + OUTCOME_H + DIST_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ── Background ──────────────────────────────────────────────────
  ctx.fillStyle = "#050B17";
  ctx.fillRect(0, 0, W, H);

  // ── Teams + flags (centered) ─────────────────────────────────────
  const teamsStr = `${stats.home_team_name.toUpperCase()}  ×  ${stats.away_team_name.toUpperCase()}`;
  const fs = teamsStr.length > 30 ? 36 : teamsStr.length > 22 ? 42 : 48;
  ctx.font = `800 ${fs}px -apple-system, system-ui, sans-serif`;
  const tw = ctx.measureText(teamsStr).width;
  const FLAG_W = 48, FLAG_H = 32, FLAG_GAP = 14;
  const titleY = 90;
  const flagTop = titleY - Math.round(fs * 0.78);

  // Text always centered at W/2; flags flanking based on measured width
  ctx.fillStyle = "#F0F4F8";
  ctx.textAlign = "center";
  ctx.fillText(teamsStr, W / 2, titleY);
  if (homeFlag) ctx.drawImage(homeFlag, W / 2 - tw / 2 - FLAG_GAP - FLAG_W, flagTop, FLAG_W, FLAG_H);
  if (awayFlag) ctx.drawImage(awayFlag, W / 2 + tw / 2 + FLAG_GAP, flagTop, FLAG_W, FLAG_H);
  ctx.textAlign = "left";

  // ── Meta pill (centered) ─────────────────────────────────────────
  ctx.fillStyle = "#8899AA";
  ctx.font = "500 14px -apple-system, system-ui, sans-serif";
  let sub = `${stats.total_bets} palpites`;
  if (stats.official_home_score != null)
    sub = `Resultado: ${stats.official_home_score} × ${stats.official_away_score}  ·  ${stats.total_bets} palpites`;
  ctx.fillText(sub, W / 2, 118);
  ctx.textAlign = "left";

  // ── Divider ──────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, 134); ctx.lineTo(W - P, 134); ctx.stroke();

  // ── OUTCOME SECTION ──────────────────────────────────────────────
  let curY = HEADER_H;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 13px -apple-system, system-ui, sans-serif";
  ctx.fillText("COMO O BOLÃO APOSTOU", P, curY + 16);
  curY += 28;

  const outcomes = [
    { label: stats.home_team_name, pct: stats.home_win_pct, count: stats.home_win_count, color: "#2ECC71" },
    { label: "Empate",             pct: stats.draw_pct,     count: stats.draw_count,      color: "#F5C542" },
    { label: stats.away_team_name, pct: stats.away_win_pct, count: stats.away_win_count,  color: "#5DADE2" },
  ];
  const boxW = (W - P * 2 - 24) / 3;
  const boxH = 124;

  outcomes.forEach((o, i) => {
    const bx  = P + i * (boxW + 12);
    const by  = curY;
    const bcx = bx + boxW / 2; // center x

    // Card border only (sem fundo)
    ctx.strokeStyle = `${o.color}66`;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, boxW, boxH, 14);
    ctx.stroke();

    // Label — centered
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 14px -apple-system, system-ui, sans-serif";
    const labelText = o.label.toUpperCase();
    ctx.fillText(labelText.length > 16 ? labelText.slice(0, 15) + "…" : labelText, bcx, by + 36);

    // Percentage (big) — centered
    ctx.fillStyle = o.color;
    ctx.font = "800 40px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${o.pct}%`, bcx, by + 82);

    // Count — centered
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "400 13px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${o.count} palpites`, bcx, by + 112);

    ctx.textAlign = "left";
  });

  curY += boxH + 14;

  // ── SCORE DISTRIBUTION ───────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, curY); ctx.lineTo(W - P, curY); ctx.stroke();
  curY += 14;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 13px -apple-system, system-ui, sans-serif";
  ctx.fillText("DISTRIBUIÇÃO DE PLACARES", P, curY + 16);
  curY += 28;

  const maxCount = stats.scores[0]?.count || 1;
  const SCORE_COL = 78;
  const META_W    = 132;
  const BAR_AREA  = W - P * 2 - SCORE_COL - META_W;

  for (let i = 0; i < maxToShow; i++) {
    const s = stats.scores[i];
    const sy = curY + i * ROW_H;
    const isTop = i === 0;
    const isOfficial = stats.official_home_score != null &&
      s.home === stats.official_home_score && s.away === stats.official_away_score;
    const ratio = s.count / maxCount;
    const barH = 26;
    const barY = sy + (ROW_H - barH) / 2;
    const barW = Math.max(BAR_AREA * ratio, 6);

    // Top row pill background
    if (isTop) {
      ctx.fillStyle = "rgba(46,204,113,0.08)";
      roundRect(ctx, P - 10, sy - 2, W - P * 2 + 20, ROW_H, 10);
      ctx.fill();
    } else {
      // Thin row separator
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P, sy); ctx.lineTo(W - P, sy); ctx.stroke();
    }

    // Score label
    ctx.fillStyle = isTop ? "#2ECC71" : "#FFFFFF";
    ctx.font = `700 15px 'Courier New', monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${s.home} × ${s.away}`, P, sy + ROW_H / 2 + 6);

    // Bar track
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, P + SCORE_COL, barY, BAR_AREA, barH, 999);
    ctx.fill();

    // Bar fill
    if (isTop) { ctx.shadowColor = "rgba(46,204,113,0.35)"; ctx.shadowBlur = 8; }
    ctx.fillStyle = isTop ? "#2ECC71" : "rgba(46,204,113,0.55)";
    roundRect(ctx, P + SCORE_COL, barY, barW, barH, 999);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Official result badge
    if (isOfficial) {
      ctx.fillStyle = "#F5C542";
      ctx.font = "700 12px -apple-system, system-ui, sans-serif";
      ctx.fillText("✓", P + SCORE_COL + barW + 8, sy + ROW_H / 2 + 5);
    }

    // Meta (right-aligned)
    ctx.fillStyle = isTop ? "#2ECC71" : "#FFFFFF";
    ctx.font = `600 13px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`${s.count}  (${s.pct}%)`, W - P, sy + ROW_H / 2 + 5);
    ctx.textAlign = "left";
  }

  return canvas;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const WinIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polyline points="2,7 5.5,11 12,3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const DrawIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill={color}>
    <rect x="1.5" y="4" width="11" height="2" rx="1"/>
    <rect x="1.5" y="8" width="11" height="2" rx="1"/>
  </svg>
);

function OutcomeCard({ label, pct, count, color, isDraw }) {
  return (
    <div className="stats-outcome-card">
      <div className="stats-outcome-icon" style={{ background: `${color}22`, color }}>
        {isDraw ? <DrawIcon color={color} /> : <WinIcon color={color} />}
      </div>
      <span className="stats-outcome-label">{label}</span>
      <span className="stats-outcome-pct" style={{ color }}>{pct}%</span>
      <div className="stats-outcome-bar-track">
        <div className="stats-outcome-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stats-outcome-count">{count} palpites</span>
    </div>
  );
}

function ScoreRow({ home, away, count, pct, maxCount, rank, isOfficial }) {
  const isTop = rank === 0;
  const ratio = count / maxCount;

  return (
    <div className={`stats-score-row${isTop ? " top-row" : ""}`} style={{ "--delay": `${rank * 0.04}s` }}>
      <span className="stats-score-label">
        {home} × {away}
      </span>
      <div className="stats-bar-track">
        <div
          className="stats-bar-fill"
          style={{ width: `${Math.max(ratio * 100, 1)}%`, animationDelay: `var(--delay)` }}
        />
      </div>
      <span className="stats-score-meta">
        {isOfficial && <span className="stats-official-check">✓</span>}
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
              <OutcomeCard label={stats.home_team_name} pct={stats.home_win_pct} count={stats.home_win_count} color="#2ECC71" />
              <OutcomeCard label="Empate" pct={stats.draw_pct} count={stats.draw_count} color="#F5C542" isDraw />
              <OutcomeCard label={stats.away_team_name} pct={stats.away_win_pct} count={stats.away_win_count} color="#5DADE2" />
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
                  isOfficial={
                    stats.official_home_score != null &&
                    s.home === stats.official_home_score &&
                    s.away === stats.official_away_score
                  }
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
