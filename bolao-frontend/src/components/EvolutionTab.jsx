// src/components/EvolutionTab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import FlagIcon from "./FlagIcon";
import { fetchRankingEvolution } from "../api";

const CHART_W = 760;
const CHART_H = 320;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;

function buildPoints(data) {
  const n = data.length;
  const positions = data.map((d) => d.position);
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  const span = Math.max(maxPos - minPos, 1);

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  return data.map((d, i) => {
    const x = n > 1 ? PAD_L + (i / (n - 1)) * innerW : PAD_L + innerW / 2;
    // eixo Y invertido: posição 1 fica no topo
    const y = PAD_T + ((d.position - minPos) / span) * innerH;
    return { ...d, x, y };
  });
}

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

async function drawEvolutionCanvas(data, userName) {
  const W = 1080;
  const P = 60;
  const HEADER_H = 70;
  const CHART_AREA_H = 480;
  const FOOTER_H = 30;
  const H = HEADER_H + CHART_AREA_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#050B17";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#F0F4F8";
  ctx.font = "800 30px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Evolução do Ranking — ${userName}`, W / 2, 44);
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P, HEADER_H - 8);
  ctx.lineTo(W - P, HEADER_H - 8);
  ctx.stroke();

  const positions = data.map((d) => d.position);
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  const span = Math.max(maxPos - minPos, 1);

  const chartTop = HEADER_H + 20;
  const chartBottom = HEADER_H + CHART_AREA_H - 30;
  const chartLeft = P + 30;
  const chartRight = W - P;
  const innerW = chartRight - chartLeft;
  const innerH = chartBottom - chartTop;

  // Eixo Y: rótulos de posição
  ctx.fillStyle = "#8899AA";
  ctx.font = "500 13px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "right";
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const pos = Math.round(minPos + (span * i) / yTicks);
    const y = chartTop + innerH - (i / yTicks) * innerH;
    ctx.fillText(`#${pos}`, chartLeft - 10, y + 4);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
  }
  ctx.textAlign = "left";

  const n = data.length;
  const pts = data.map((d, i) => {
    const x = n > 1 ? chartLeft + (i / (n - 1)) * innerW : chartLeft + innerW / 2;
    const y = chartTop + ((d.position - minPos) / span) * innerH;
    return { x, y, ...d };
  });

  // Área preenchida
  ctx.beginPath();
  ctx.moveTo(pts[0].x, chartBottom);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, chartBottom);
  ctx.closePath();
  ctx.fillStyle = "rgba(46,204,113,0.08)";
  ctx.fill();

  // Linha
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = "#2ECC71";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pontos
  pts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#2ECC71";
    ctx.fill();
  });

  // Anotações melhor/pior (alinha à direita se o ponto estiver perto da borda)
  const bestIdx = positions.indexOf(minPos);
  const worstIdx = positions.indexOf(maxPos);
  ctx.font = "600 13px -apple-system, system-ui, sans-serif";

  function annotate(label, p, color, dy) {
    const nearRightEdge = p.x > chartRight - 90;
    ctx.fillStyle = color;
    ctx.textAlign = nearRightEdge ? "right" : "left";
    ctx.fillText(label, nearRightEdge ? p.x - 6 : p.x + 6, p.y + dy);
    ctx.textAlign = "left";
  }
  annotate(`Melhor: #${minPos}`, pts[bestIdx], "#F5C542", -8);
  annotate(`Pior: #${maxPos}`, pts[worstIdx], "#E74C3C", 18);

  // Final
  const last = data[data.length - 1];
  ctx.fillStyle = "#8899AA";
  ctx.font = "500 14px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `Posição atual: #${last.position}  ·  ${last.points} pts  ·  ${data.length} jogos considerados`,
    W / 2,
    HEADER_H + CHART_AREA_H + 4
  );
  ctx.textAlign = "left";

  ctx.fillStyle = "#8899AA";
  ctx.font = "400 12px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("bolaodarafa.com", W / 2, H - 12);
  ctx.textAlign = "left";

  return canvas;
}

export default function EvolutionTab({ session, allUsers = [], allUsersLoading = false }) {
  const [selectedUserId, setSelectedUserId] = useState(session?.id ?? "");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (session?.id && !selectedUserId) setSelectedUserId(session.id);
  }, [session, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchRankingEvolution(selectedUserId)
      .then((rows) => {
        if (cancelled) return;
        setData(rows || []);
        setSelectedIdx(rows && rows.length ? rows.length - 1 : null);
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Erro ao carregar evolução."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedUserId]);

  const points = useMemo(() => buildPoints(data), [data]);
  const { bestIdx, worstIdx } = useMemo(() => {
    if (!data.length) return { bestIdx: -1, worstIdx: -1 };
    const positions = data.map((d) => d.position);
    return {
      bestIdx: positions.indexOf(Math.min(...positions)),
      worstIdx: positions.indexOf(Math.max(...positions)),
    };
  }, [data]);
  const selectedUserName = useMemo(
    () => allUsers.find((u) => u.id === Number(selectedUserId))?.name || session?.name || "",
    [allUsers, selectedUserId, session]
  );

  const detail = selectedIdx != null ? data[selectedIdx] : null;

  async function handleExport() {
    if (!data.length) return;
    const canvas = await drawEvolutionCanvas(data, selectedUserName);
    const a = document.createElement("a");
    a.download = `evolucao_${selectedUserName.replace(/\s+/g, "_").toLowerCase()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <section className="section">
      <div className="ranking-card">
        <div className="ranking-card-header">
          <h2 className="section-title">Evolução no ranking</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1rem" }}>
          <label className="filter-label" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Participante</label>
          <select
            className="filter-select"
            style={{ minHeight: "44px" }}
            value={selectedUserId}
            disabled={allUsersLoading}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
          >
            {allUsersLoading && <option>Carregando...</option>}
            {!allUsersLoading && allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === session?.id ? `${u.name} (você)` : u.name}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" />
            Carregando evolução...
          </div>
        )}

        {error && (
          <div className="alert alert-error error-with-retry">
            {error}
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <p className="empty-state">Ainda não há jogos finalizados para mostrar a evolução.</p>
        )}

        {!loading && !error && data.length > 0 && (
          <>
            <div className="evolution-chart-wrap">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="evolution-chart-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                />
                {points.map((p, i) => {
                  const isSelected = i === selectedIdx;
                  const isBest = i === bestIdx;
                  const isWorst = i === worstIdx && worstIdx !== bestIdx;
                  let fill = "#22c55e";
                  if (isSelected) fill = "#facc15";
                  else if (isBest) fill = "#f5c542";
                  else if (isWorst) fill = "#e74c3c";
                  return (
                    <circle
                      key={p.match_id}
                      cx={p.x}
                      cy={p.y}
                      r={isSelected || isBest || isWorst ? 6 : 4}
                      fill={fill}
                      stroke="#020617"
                      strokeWidth="1"
                      className="evolution-chart-point"
                      onClick={() => setSelectedIdx(i)}
                      onTouchStart={() => setSelectedIdx(i)}
                    />
                  );
                })}
                {bestIdx >= 0 && (
                  <text
                    x={points[bestIdx].x > CHART_W - PAD_R - 80 ? points[bestIdx].x - 6 : points[bestIdx].x + 6}
                    y={points[bestIdx].y - 10}
                    textAnchor={points[bestIdx].x > CHART_W - PAD_R - 80 ? "end" : "start"}
                    fontSize="12"
                    fontWeight="600"
                    fill="#f5c542"
                  >
                    Melhor: #{points[bestIdx].position}
                  </text>
                )}
                {worstIdx >= 0 && worstIdx !== bestIdx && (
                  <text
                    x={points[worstIdx].x > CHART_W - PAD_R - 80 ? points[worstIdx].x - 6 : points[worstIdx].x + 6}
                    y={points[worstIdx].y + 18}
                    textAnchor={points[worstIdx].x > CHART_W - PAD_R - 80 ? "end" : "start"}
                    fontSize="12"
                    fontWeight="600"
                    fill="#e74c3c"
                  >
                    Pior: #{points[worstIdx].position}
                  </text>
                )}
              </svg>
            </div>

            {detail && (
              <div className="evolution-detail-card">
                <div className="evolution-detail-match">
                  <FlagIcon code={detail.home_team_code} name={detail.home_team_name} />
                  <span>{detail.home_team_name} {detail.home_score} x {detail.away_score} {detail.away_team_name}</span>
                  <FlagIcon code={detail.away_team_code} name={detail.away_team_name} />
                </div>
                <div className="evolution-detail-stats">
                  <span><strong>#{detail.position}</strong> de {detail.total_participants}</span>
                  <span><strong>{detail.points}</strong> pts</span>
                </div>
              </div>
            )}

            <button className="btn ghost small" onClick={handleExport} style={{ marginTop: "0.75rem" }}>
              Exportar imagem
            </button>
          </>
        )}
      </div>
    </section>
  );
}
