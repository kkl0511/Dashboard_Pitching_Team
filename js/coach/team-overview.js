// ════════════════════════════════════════════════════════
//  team-overview.js — Tab 1: 팀 현황
//
//  팀 KPI (평균 구속/점수, 최고 선수, 부상 위험)
//  + 선수 ranking (composite 내림차순)
//  + 팀 공통 약점 패턴
//
//  의존: helpers.js, variable-info.js (computeDvl5, compositeScore, gradeOf, modelLbl)
// ════════════════════════════════════════════════════════

function renderTeam(){
  const players = WIN.PLAYERS;
  const sessId = 1;   // 1차 측정 기준

  // 모든 선수의 measured_v + composite + risk 집계
  const rows = [];
  players.forEach(p => {
    const m = WIN.DATA?.[p.id]?.[sessId];
    if(!m) return;
    const dvl5 = computeDvl5(p, m);
    const comp = compositeScore(dvl5);
    const v = m.velocity?.measured_kmh ?? null;
    const risk = m.faults?.injury_risk || 'low';
    const isReal = WIN.REAL_DATA_KEYS?.has?.(`${p.id}:${sessId}`);
    rows.push({p, m, dvl5, comp, v, risk, isReal});
  });

  // 팀 KPI
  const validV = rows.filter(r => r.v != null);
  const avgVelo = validV.length ? Math.round(validV.reduce((a,r)=>a+r.v, 0) / validV.length * 10) / 10 : null;
  const maxVelo = validV.length ? Math.max(...validV.map(r => r.v)) : null;
  const minVelo = validV.length ? Math.min(...validV.map(r => r.v)) : null;
  const validC = rows.filter(r => r.comp != null && r.comp > 0);
  const avgComp = validC.length ? Math.round(validC.reduce((a,r)=>a+r.comp, 0) / validC.length) : null;
  const topPlayer = rows.slice().sort((a,b) => b.comp - a.comp)[0];
  const riskCount = rows.filter(r => r.risk === 'mid' || r.risk === 'high').length;

  // 팀 약점 패턴 (모든 선수 high-importance 음의 차이 빈도)
  const weakCount = {};
  rows.forEach(r => {
    if(!r.dvl5) return;
    ['arm_action','posture','rotation','block','cog'].forEach(mk => {
      const md = r.dvl5[mk]; if(!md?.metrics) return;
      Object.values(md.metrics).forEach(mt => {
        if(mt.value == null || mt.median_elite == null || !mt.per_1mph) return;
        const diff = (mt.value - mt.median_elite) / mt.per_1mph * 1.609;
        if(diff < -1 && mt.importance === 'high'){
          const key = mt.label;
          if(!weakCount[key]) weakCount[key] = {count:0, totalLoss:0, modelLbl:modelLbl(mk)};
          weakCount[key].count += 1;
          weakCount[key].totalLoss += Math.abs(diff);
        }
      });
    });
  });
  const teamWeak = Object.entries(weakCount)
    .map(([lbl, v]) => ({lbl, ...v, avgLoss: v.totalLoss/v.count}))
    .sort((a,b) => b.count - a.count || b.avgLoss - a.avgLoss)
    .slice(0, 3);

  // ranking (composite 내림차순)
  const ranked = rows.slice().sort((a,b) => b.comp - a.comp);

  $('team-content').innerHTML = `
    <!-- 팀 KPI -->
    <div class="kpi-row">
      <div class="kpi">
        <div class="label">팀 평균 측정 구속</div>
        <div class="value">${avgVelo != null ? avgVelo : '—'}<span class="unit">km/h</span></div>
        <div class="delta">최고 ${maxVelo != null ? maxVelo : '—'} / 최저 ${minVelo != null ? minVelo : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">팀 평균 종합 점수</div>
        <div class="value">${avgComp != null ? avgComp : '—'}<span class="unit">/100</span></div>
        <div class="delta">5 모델 평균</div>
      </div>
      <div class="kpi">
        <div class="label">최고 점수 선수</div>
        <div class="value" style="font-size:24px">${topPlayer ? topPlayer.p.name : '—'}</div>
        <div class="delta up">${topPlayer ? `Composite ${topPlayer.comp}` : '—'}</div>
      </div>
      <div class="kpi">
        <div class="label">집중 관리 대상</div>
        <div class="value ${riskCount > 0 ? 'risk-mid' : 'risk-low'}">${riskCount}<span class="unit">명</span></div>
        <div class="delta">부상 위험 mid/high</div>
      </div>
    </div>

    <!-- 선수 ranking -->
    <section class="section">
      <h2 class="section-title"><span class="step">1</span><span>RANKING</span><span class="h">선수 순위 — 1차 측정 종합 점수</span></h2>
      <div id="ranking-list">
        ${ranked.map((r, i) => {
          const g = gradeOf(r.comp);
          return `<div class="player-card" data-pid="${r.p.id}">
            <div class="rank-num">${i+1}</div>
            <div class="info">
              <div class="name">${r.p.name} <span style="color:var(--muted);font-size:11px;margin-left:4px">${r.p.id}</span> ${r.isReal ? '<span style="color:var(--grade-elite);font-size:10px;margin-left:4px">●실측</span>' : ''}</div>
              <div class="meta">${r.p.arm==='L'?'좌투':'우투'} · ${r.p.height}cm · ${r.p.weight}kg · 고${r.p.grade || '?'}</div>
            </div>
            <div class="velo">${r.v != null ? r.v : '—'}<span class="unit">km/h</span></div>
            <div class="composite ${g.cls}">${r.comp || '—'}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="legend-row">
        <span><span class="dot" style="background:var(--grade-elite)"></span>Elite (90+)</span>
        <span><span class="dot" style="background:var(--grade-above)"></span>Above (70~89)</span>
        <span><span class="dot" style="background:var(--grade-avg)"></span>Avg (50~69)</span>
        <span><span class="dot" style="background:var(--grade-below)"></span>Below (30~49)</span>
        <span><span class="dot" style="background:var(--grade-poor)"></span>Poor (&lt;30)</span>
      </div>
    </section>

    <!-- 팀 약점 패턴 -->
    <section class="section">
      <h2 class="section-title"><span class="step">2</span><span>TEAM WEAKNESS</span><span class="h">팀 공통 약점 — 다수 선수 영향</span></h2>
      ${teamWeak.length === 0
        ? '<div style="padding:18px;background:rgba(74,222,128,0.10);border-radius:8px;color:var(--grade-elite);text-align:center;font-weight:600">✅ 공통 약점 없음 — 팀 전반적으로 elite</div>'
        : `<div class="top3">${teamWeak.map((w, i) => `
          <div class="top3-item">
            <div class="rank">${i+1}</div>
            <div class="body">
              <div class="name">${w.lbl}</div>
              <div class="meta">${w.modelLbl} · <b style="color:var(--text)">${w.count}명</b> 영향 (전체 ${rows.length}명 중)</div>
            </div>
            <div class="impact">
              <div class="gain">+${w.avgLoss.toFixed(1)}</div>
              <div class="gain-unit">km/h 평균 잠재</div>
            </div>
          </div>
        `).join('')}</div>`
      }
    </section>
  `;
  // 선수 카드 클릭 → "선수별" 탭 이동
  document.querySelectorAll('#ranking-list .player-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.dataset.pid;
      CURRENT_PID = pid;
      $('player-select').value = pid;
      renderForPlayer(pid);
      // 탭 전환
      document.querySelector('nav.tabs button[data-tab="player"]').click();
    });
  });
}
