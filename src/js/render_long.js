/* ╔══════════════════════════════════════════════════════════╗
   ║  5. TAB 3: 데이터 관리                                       ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderRoster(){
  const tb = document.querySelector('#roster-table tbody');
  const search = document.getElementById('roster-search').value.trim();
  const rows = PLAYERS.filter(p=>!search||p.name.includes(search)||p.id.includes(search));
  tb.innerHTML = rows.map(p=>{
    const m = DATA[p.id][1];
    const mech = m.velocity ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    const fit = m.fitness ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    const velo = m.velocity?.measured_kmh!=null ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    return `<tr><td><code>${p.id}</code></td><td><b>${p.name}</b></td><td>${p.arm}</td>
      <td class="right">${p.height}</td><td class="right">${p.weight}</td>
      <td>${mech}</td><td>${fit}</td><td>${velo}</td>
      <td><button class="btn ghost" onclick="switchTab('player');document.getElementById('player-select').value='${p.id}';renderPlayerView('${p.id}')">리포트 →</button></td></tr>`;
  }).join('');
  document.getElementById('roster-count').textContent = rows.length;
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  6. TAB 4: 장기 추적                                         ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderScheduleHalves(){
  const wrap = document.getElementById('schedule-halves');
  const halves = [...new Set(SESSIONS.map(s=>s.half))];   // ['상반기','하반기']
  wrap.innerHTML = halves.map(h=>{
    const ss = SESSIONS.filter(s=>s.half===h);
    return `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--muted);
                    text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;
                    padding-bottom:6px;border-bottom:1px solid var(--line-soft)">
          ${h} <span style="color:var(--text);margin-left:6px">${ss.length}회 측정</span>
        </div>
        <div class="grid" style="grid-template-columns:repeat(${ss.length},1fr);gap:12px">
          ${ss.map(s=>{
            const isTheia = s.protocol==='Theia+GRF';
            const color = isTheia?'var(--theia)':'var(--uplift)';
            const tag = isTheia?'theia':'uplift';
            const desc = isTheia
              ? '메카닉 + GRF + 체력(ForceDecks) + 구속'
              : '메카닉(스마트폰 markerless) + 구속';
            return `
              <div class="kpi" style="border-left:4px solid ${color}">
                <div class="label">${s.label} <span class="protocol-tag ${tag}">${s.protocol}</span></div>
                <div style="font-size:14px;font-weight:600;margin:6px 0">${s.date}</div>
                <div class="delta">${desc}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

/* 상·하반기 비교 분석 — 지표 추출, 등급, 정렬 */
const METRIC_DEFS = {
  score:       {label:'종합점수',     unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.velocity.score},
  velo:        {label:'측정 구속',    unit:'km/h', fmtDec:1, isScore:false, pick:m=>m.velocity.measured_kmh},
  velo_pot:    {label:'잠재 구속',    unit:'km/h', fmtDec:1, isScore:false, pick:m=>m.velocity.potential_kmh},
  sequence:    {label:'시퀀스 점수',  unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.sequence.score},
  consistency: {label:'제구 일관성',  unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.faults.consistency_score},
  fault:       {label:'결함 관리',    unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.faults.fault_score},
};

function halfAvg(pid, half, def){
  const ss = SESSIONS.filter(s=>s.half===half);
  const vals = ss.map(s=>def.pick(DATA[pid][s.id])).filter(v=>v!=null && !isNaN(v));
  return vals.length === ss.length ? avg(vals) : null;   // 한 회차라도 누락 → null
}
function gradeOf(delta, isScore){
  if(delta==null||isNaN(delta)) return {pill:'', label:'—'};
  if(isScore){
    if(delta >=  5) return {pill:'good', label:'★★★ 매우 향상'};
    if(delta >=  2) return {pill:'good', label:'★★ 향상'};
    if(delta >= -2) return {pill:'warn', label:'★ 유지'};
    return                  {pill:'bad',  label:'↓ 정체·하락'};
  } else {
    if(delta >=  3) return {pill:'good', label:'★★★ 매우 향상'};
    if(delta >=  1) return {pill:'good', label:'★★ 향상'};
    if(delta >= -1) return {pill:'warn', label:'★ 유지'};
    return                  {pill:'bad',  label:'↓ 정체·하락'};
  }
}

let chartHC = null;
let hcSort = {key:'delta', dir:'desc'};
function renderHalfComparison(){
  const key = document.getElementById('hc-metric').value;
  const def = METRIC_DEFS[key];

  // 선수별 행
  const rows = PLAYERS.map(p=>{
    const h1 = halfAvg(p.id, '상반기', def);
    const h2 = halfAvg(p.id, '하반기', def);
    const delta = (h1!=null && h2!=null) ? (h2 - h1) : null;
    return {pid:p.id, name:p.name, arm:p.arm, h1, h2, delta, grade: gradeOf(delta, def.isScore)};
  });

  // 팀 KPI: 상반기 평균 / 하반기 평균 / Δ / 향상자 비율
  const teamH1 = avg(rows.map(r=>r.h1));
  const teamH2 = avg(rows.map(r=>r.h2));
  const teamD  = (teamH1!=null && teamH2!=null) ? teamH2 - teamH1 : null;
  const improved = rows.filter(r=>r.delta!=null && r.delta>0).length;
  const declined = rows.filter(r=>r.delta!=null && r.delta<0).length;
  const validN = rows.filter(r=>r.delta!=null).length;
  const dColor = teamD==null ? 'var(--muted)' : teamD>=0 ? 'var(--good)' : 'var(--bad)';

  document.getElementById('hc-team-kpi').innerHTML = `
    <div class="kpi">
      <div class="label">팀 평균 — 상반기</div>
      <div class="value">${fmt(teamH1, def.fmtDec)} <span style="font-size:13px;color:var(--muted)">${def.unit}</span></div>
      <div class="delta">1차·2차 평균</div>
    </div>
    <div class="kpi">
      <div class="label">팀 평균 — 하반기</div>
      <div class="value">${fmt(teamH2, def.fmtDec)} <span style="font-size:13px;color:var(--muted)">${def.unit}</span></div>
      <div class="delta">3차·4차 평균</div>
    </div>
    <div class="kpi">
      <div class="label">팀 Δ (하반기 − 상반기)</div>
      <div class="value" style="color:${dColor}">
        ${teamD==null ? '—' : (teamD>=0?'+':'') + fmt(teamD, def.fmtDec)}
        <span style="font-size:13px;color:var(--muted)">${def.unit}</span>
      </div>
      <div class="delta">${def.label} 기준</div>
    </div>
    <div class="kpi">
      <div class="label">향상 / 유지 / 정체</div>
      <div class="value">
        <span style="color:var(--good)">${improved}</span> /
        <span style="color:var(--warn)">${validN - improved - declined}</span> /
        <span style="color:var(--bad)">${declined}</span>
      </div>
      <div class="delta">유효 ${validN}명 기준 (Δ &gt; 0 / -2~+2 / &lt; 0)</div>
    </div>
  `;

  document.getElementById('hc-bar-title').textContent =
    `선수별 향상도 (Δ ${def.label}, ${def.unit}) — 큰 순 정렬`;

  // 막대 차트 (Δ 큰 순)
  const sortedForBar = [...rows].filter(r=>r.delta!=null).sort((a,b)=>b.delta-a.delta);
  const barColors = sortedForBar.map(r=>{
    const d = r.delta, isS = def.isScore;
    if(isS ? d>=2 : d>=1) return '#1a7f37';        // 향상
    if(isS ? d>=-2 : d>=-1) return '#bf8700';      // 유지
    return '#cf222e';                              // 정체
  });
  if(chartHC) chartHC.destroy();
  chartHC = new Chart(document.getElementById('hc-bar'),{
    type:'bar',
    data:{
      labels: sortedForBar.map(r=>r.name),
      datasets:[{label:`Δ ${def.label}`, data: sortedForBar.map(r=>r.delta),
                 backgroundColor: barColors}]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{
          const r = sortedForBar[c.dataIndex];
          return `${r.name} · 상반기 ${fmt(r.h1,def.fmtDec)} → 하반기 ${fmt(r.h2,def.fmtDec)} (Δ ${r.delta>=0?'+':''}${r.delta.toFixed(def.fmtDec)})`;
        }}}
      },
      scales:{
        x:{ticks:{color:'#656d76',font:{size:10}},grid:{display:false}},
        y:{title:{display:true,text:`Δ ${def.unit}`,color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'},
           // 0 기준선 강조
           grace:'5%'}
      },
      onClick:(evt, elems)=>{
        if(elems.length){
          const pid = sortedForBar[elems[0].index].pid;
          switchTab('player'); document.getElementById('player-select').value = pid; renderPlayerView(pid);
        }
      }
    }
  });

  // 정렬 테이블
  const k = hcSort.key, dir = hcSort.dir==='asc'?1:-1;
  const sortedTable = [...rows].sort((a,b)=>{
    let av = k==='grade' ? (a.delta ?? -999) : a[k];
    let bv = k==='grade' ? (b.delta ?? -999) : b[k];
    if(av==null) return 1; if(bv==null) return -1;
    if(typeof av === 'string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
  const tb = document.querySelector('#hc-table tbody');
  tb.innerHTML = sortedTable.map(r=>{
    const dColor = r.delta==null?'var(--muted)':r.delta>=0?'var(--good)':'var(--bad)';
    const sign = r.delta>=0?'+':'';
    return `<tr data-pid="${r.pid}">
      <td><b>${r.name}</b></td>
      <td class="right">${r.arm}</td>
      <td class="right">${fmt(r.h1, def.fmtDec)}</td>
      <td class="right">${fmt(r.h2, def.fmtDec)}</td>
      <td class="right" style="color:${dColor};font-weight:600">${r.delta==null?'—':sign+r.delta.toFixed(def.fmtDec)}</td>
      <td class="right">${r.grade.pill ? `<span class="pill ${r.grade.pill}">${r.grade.label}</span>` : '—'}</td>
    </tr>`;
  }).join('');
  // 정렬 표시
  document.querySelectorAll('#hc-table thead th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.key===hcSort.key) th.classList.add(hcSort.dir==='asc'?'sort-asc':'sort-desc');
  });
  // 행 클릭 → 선수 리포트
  tb.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      switchTab('player'); document.getElementById('player-select').value = tr.dataset.pid; renderPlayerView(tr.dataset.pid);
    });
  });
}

// 헤더 정렬 클릭
document.addEventListener('click', e=>{
  const th = e.target.closest('#hc-table thead th');
  if(!th) return;
  const k = th.dataset.key;
  if(hcSort.key===k){hcSort.dir = hcSort.dir==='asc'?'desc':'asc'}
  else{hcSort.key=k; hcSort.dir = (k==='name'||k==='arm')?'asc':'desc'}
  renderHalfComparison();
});

let chartLong = null;
function renderLongTab(){
  renderScheduleHalves();
  renderHalfComparison();
  if(chartLong) chartLong.destroy();
  chartLong = new Chart(document.getElementById('long-trend'),{
    type:'line',
    data:{
      labels: SESSIONS.map(s=>`${s.label}\n(${s.protocol==='Theia+GRF'?'T+GRF':'Uplift'})`),
      datasets:[
        {label:'평균 구속 (km/h)', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].velocity.measured_kmh))),
         borderColor:'#0969da', backgroundColor:'rgba(9,105,218,.1)', tension:.3, yAxisID:'y', pointRadius:5},
        {label:'평균 종합점수', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].velocity.score))),
         borderColor:'#8250df', tension:.3, yAxisID:'y2', pointRadius:5},
        {label:'평균 시퀀스', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].sequence.score))),
         borderColor:'#1a7f37', tension:.3, yAxisID:'y2', pointRadius:4},
        {label:'평균 일관성', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].faults.consistency_score))),
         borderColor:'#bf8700', tension:.3, yAxisID:'y2', pointRadius:4}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#1f2328'}}},
      scales:{
        x:{ticks:{color:'#656d76'},grid:{color:'#eaeef2'}},
        y:{position:'left',title:{display:true,text:'구속 (km/h)',color:'#0969da'},
           ticks:{color:'#0969da'},grid:{color:'#eaeef2'}},
        y2:{position:'right',title:{display:true,text:'점수 (0~100)',color:'#8250df'},
            ticks:{color:'#8250df'},grid:{drawOnChartArea:false},min:0,max:100}
      }
    }
  });
}

