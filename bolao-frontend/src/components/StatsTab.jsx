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

function drawStatsCanvas(stats) {
  const W = 1080;
  const P = 60;
  const maxToShow = Math.min(stats.scores.length, 10);
  const BAR_H = 33;
  const BAR_GAP = 9;

  const HEADER_H    = 168;
  const OUTCOME_H   = 118;
  const SCORES_H    = 30 + maxToShow * (BAR_H + BAR_GAP);
  const FOOTER_H    = 48;
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

  // Eyebrow
  ctx.fillStyle = "#22c55e";
  ctx.font = "600 13px 'Courier New', monospace";
  ctx.fillText("BOLÃO DA COPA 2026  ·  ESTATÍSTICAS", P, 44);

  // Teams
  const teamsStr = `${stats.home_team_name.toUpperCase()}  ×  ${stats.away_team_name.toUpperCase()}`;
  const fs = teamsStr.length > 30 ? 34 : teamsStr.length > 22 ? 40 : 46;
  ctx.fillStyle = "#f1f5f9";
  ctx.font = `700 ${fs}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(teamsStr, P, 100);

  // Subtitle
  ctx.fillStyle = "rgba(148,163,184,0.55)";
  ctx.font = "400 15px -apple-system, system-ui, sans-serif";
  let sub = `${stats.total_bets} palpites registrados`;
  if (stats.official_home_score != null) {
    sub = `Resultado oficial: ${stats.official_home_score} × ${stats.official_away_score}   ·   ${stats.total_bets} palpites`;
  }
  ctx.fillText(sub, P, 132);

  // Divider
  ctx.strokeStyle = "rgba(148,163,184,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, 154); ctx.lineTo(W - P, 154); ctx.stroke();

  // ── OUTCOME BOXES ──
  let curY = HEADER_H;
  ctx.fillStyle = "rgba(148,163,184,0.4)";
  ctx.font = "600 11px 'Courier New', monospace";
  ctx.fillText("RESULTADO ESPERADO", P, curY);
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

    const lbl = o.label.length > 15 ? o.label.slice(0, 14) + "…" : o.label;
    ctx.fillStyle = "rgba(148,163,184,0.55)";
    ctx.font = "500 12px -apple-system, system-ui, sans-serif";
    ctx.fillText(lbl.toUpperCase(), bx + 18, by + 22);

    ctx.fillStyle = o.color;
    ctx.font = "800 30px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${o.pct}%`, bx + 18, by + 56);

    ctx.fillStyle = "rgba(148,163,184,0.45)";
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
  ctx.fillStyle = "rgba(148,163,184,0.4)";
  ctx.font = "600 11px 'Courier New', monospace";
  ctx.fillText("DISTRIBUIÇÃO DE PLACARES", P, curY);
  curY += 18;

  const maxCount = stats.scores[0]?.count || 1;
  const SCORE_COL = 80;
  const BAR_AREA = W - P * 2 - SCORE_COL - 110;

  for (let i = 0; i < maxToShow; i++) {
    const s = stats.scores[i];
    const sy = curY + i * (BAR_H + BAR_GAP);
    const isTop = i === 0;
    const isOfficial = stats.official_home_score != null &&
      s.home === stats.official_home_score && s.away === stats.official_away_score;
    const ratio = s.count / maxCount;
    const barW = Math.max(BAR_AREA * ratio, 6);

    ctx.fillStyle = isTop ? "#f1f5f9" : `rgba(148,163,184,${0.35 + 0.65 * ratio})`;
    ctx.font = `${isTop ? 700 : 500} ${isTop ? 17 : 14}px 'Courier New', monospace`;
    ctx.fillText(`${s.home} × ${s.away}`, P, sy + BAR_H / 2 + 6);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, P + SCORE_COL, sy, BAR_AREA, BAR_H, 6);
    ctx.fill();

    const barColor = isOfficial ? "#eab308" : "#22c55e";
    const alpha = isTop ? 1 : 0.2 + 0.8 * ratio;
    ctx.fillStyle = isOfficial ? `rgba(234,179,8,${alpha})` : `rgba(34,197,94,${alpha})`;
    roundRect(ctx, P + SCORE_COL, sy, barW, BAR_H, 6);
    ctx.fill();

    if (isOfficial) {
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.5;
      roundRect(ctx, P + SCORE_COL, sy, BAR_AREA, BAR_H, 6);
      ctx.stroke();
    }

    ctx.fillStyle = isTop ? "#f1f5f9" : `rgba(148,163,184,${0.35 + 0.65 * ratio})`;
    ctx.font = `${isTop ? 600 : 400} ${isTop ? 14 : 12}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${s.count}  (${s.pct}%)`, P + SCORE_COL + barW + 10, sy + BAR_H / 2 + 5);
  }

  curY += maxToShow * (BAR_H + BAR_GAP) + 20;

  // Footer
  ctx.fillStyle = "rgba(148,163,184,0.22)";
  ctx.font = "400 12px -apple-system, system-ui, sans-serif";
  ctx.fillText("bolão da copa 2026", P, H - 18);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const dw = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, W - P - dw, H - 18);

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

function ScoreRow({ home, away, count, pct, maxCount, rank, officialHome, officialAway }) {
  const isTop = rank === 0;
  const isOfficial = officialHome != null && home === officialHome && away === officialAway;
  const ratio = count / maxCount;

  return (
    <div className="stats-score-row" style={{ "--delay": `${rank * 0.04}s` }}>
      <span className={`stats-score-label${isTop ? " top-score" : ""}`}>
        {home} × {away}
        {isOfficial && <span className="stats-official-star" title="Resultado oficial"> ★</span>}
      </span>
      <div className="stats-bar-track">
        <div
          className={`stats-bar-fill${isTop ? " top-bar" : ""}${isOfficial ? " official-bar" : ""}`}
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

  function handleExport() {
    if (!stats) return;
    const canvas = drawStatsCanvas(stats);
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
            <option value="">Selecione um jogo encerrado</option>
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
            <h4 className="stats-section-title">Resultado esperado</h4>
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
                  officialHome={stats.official_home_score}
                  officialAway={stats.official_away_score}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
