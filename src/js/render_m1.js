/* ╔══════════════════════════════════════════════════════════╗
   ║  3. TAB 1: 1차 측정 결과                                    ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderM1KPI(){
  const m1 = PLAYERS.map(p=>DATA[p.id][1]);
  // 진행: 메카닉(velocity 있음), 체력(fitness 있음), 구속(measured 있음) 셋 — 더미는 모두 채움
  const total = PLAYERS.length * 3;
  let done = 0;
  m1.forEach(m=>{
    if(m.velocity) done++;        // 메카닉
    if(m.fitness) done++;          // 체력
    if(m.velocity?.measured_kmh!=null) done++;  // 구속
  });
  document.getElementById('kpi-progress').textContent = `${done} / ${total}`;
  document.getElementById('kpi-progress-sub').textContent =
    `${PLAYERS.length}명 × {Theia+GRF, ForceDecks, Rapsodo}`;

  const velos = m1.map(m=>m.velocity.measured_kmh);
  const va = avg(velos);
  document.getElementById('kpi-velo').textContent = `${fmt(va,1)} km/h`;
  document.getElementById('kpi-velo-delta').textContent =
    `최고 ${fmt(Math.max(...velos),1)} / 최저 ${fmt(Math.min(...velos),1)}`;

  const sc = avg(m1.map(m=>m.velocity.score));
  document.getElementById('kpi-score').textContent = fmt(sc,1);
  const gen = avg(m1.map(m=>m.energy?.generation?.score).filter(x=>x!=null));
  const trf = avg(m1.map(m=>m.energy?.transfer?.score).filter(x=>x!=null));
  const eli = avg(m1.map(m=>m.energy?.leakage?.eli_score).filter(x=>x!=null));
  const grf = avg(m1.map(m=>m.grf?.lhei).filter(x=>x!=null));
  document.getElementById('kpi-score-delta').textContent =
    `출력 ${fmt(gen,1)} · 전달 ${fmt(trf,1)} · 누수관리 ${fmt(eli,1)} · GRF ${fmt(grf,1)}`;

  const focus = m1.filter(m=>m.faults.injury_risk==='high'||m.faults.injury_risk==='mid'||m.velocity.score<50).length;
  const elr = document.getElementById('kpi-risk');
  elr.textContent = `${focus}명`;
  elr.style.color = focus>5?'var(--bad)':focus>2?'var(--warn)':'var(--good)';
}

function renderProgressGrid(){
  const g = document.getElementById('progress-grid');
  g.style.setProperty('--pc', PLAYERS.length);   // CSS grid 컬럼 수 동적
  let html = '<div class="row-h">데이터 종류</div>';
  PLAYERS.forEach(p=>{ html += `<div class="col-h" title="${p.name}">${p.name.replace('선수','P')}</div>`; });

  const kinds = [
    {label:'메카닉 (Theia+GRF)', test:m=>m && m.velocity},
    {label:'체력 (ForceDecks)',  test:m=>m && m.fitness},
    {label:'구속 (Rapsodo)',     test:m=>m && m.velocity?.measured_kmh!=null},
  ];
  kinds.forEach(k=>{
    html += `<div class="row-h">${k.label}</div>`;
    PLAYERS.forEach(p=>{
      const m = DATA[p.id][1];
      const ok = k.test(m);
      const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
      const cls = (ok ? 'cell done' : 'cell empty') + (isReal ? ' real-marker' : '');
      const sym = ok ? '✓' : '·';
      const tip = `${p.name} · ${k.label} · ${ok?'완료':'미입력'}${isReal?' (실측)':' (샘플)'}`;
      html += `<div class="${cls}" title="${tip}" data-pid="${p.id}">${sym}</div>`;
    });
  });
  g.innerHTML = html;
  g.querySelectorAll('.cell').forEach(c=>{
    c.addEventListener('click', ()=>switchTab('data'));
  });
}

let m1Sort = {key:'score', dir:'desc'};
function buildM1Table(){
  const rows = PLAYERS.map(p=>{
    const m = DATA[p.id][1];
    const fb = m.rapsodo?.fb;
    return {
      // 식별
      pid:p.id, name:p.name, arm:p.arm, grade:p.grade,
      // 구속
      velo:     fb?.velocity?.max ?? m.velocity.measured_kmh,
      velo_avg: fb?.velocity?.avg ?? null,
      // 체력
      fitness:  m.fitness?.score ?? null,
      // 메카닉
      gen:      m.energy?.generation?.score ?? null,
      trf:      m.energy?.transfer?.score ?? null,
      eli:      m.energy?.leakage?.eli_score ?? null,
      grf:      m.grf ? m.grf.lhei : null,
      stuff:    fb?.stuff_score ?? null,
      // 제구 (통합 점수: command_composite 우선, 없으면 Rapsodo command_score)
      command:  m.faults.command_composite ?? fb?.command_score ?? null,
      // 부상
      risk:     m.faults.injury_risk,
      // 종합
      score:    m.velocity.score,
    };
  });
  const k=m1Sort.key, dir=m1Sort.dir==='asc'?1:-1;
  const riskOrder={low:1,mid:2,high:3};
  rows.sort((a,b)=>{
    let av=a[k], bv=b[k];
    if(k==='risk'){av=riskOrder[av];bv=riskOrder[bv]}
    if(av==null) return 1; if(bv==null) return -1;
    if(typeof av==='string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
  const tb = document.querySelector('#m1-table tbody');
  tb.innerHTML = rows.map(r=>{
    const isReal = REAL_DATA_KEYS.has(`${r.pid}:1`);
    const realDot = isReal ? ' <span title="실측 데이터" style="color:var(--accent);font-size:10px">●</span>' : '';
    const leakDisplay = r.eli==null ? '—' : (100 - r.eli);
    return `
    <tr data-pid="${r.pid}">
      <!-- 식별 -->
      <td><b>${r.name}</b>${realDot}</td>
      <td class="right">${r.grade?`<span style="background:#ddf4ff;color:#0969da;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">고${r.grade}</span>`:'—'}</td>
      <td class="right">${r.arm}</td>
      <!-- 구속 -->
      <td class="right" style="background:#f0f6ff"><b>${fmt(r.velo,1)}</b></td>
      <td class="right" style="background:#f0f6ff">${fmt(r.velo_avg,1)}</td>
      <!-- 체력 -->
      <td class="right" style="background:#fff3e7"><b style="color:${scoreColor(r.fitness)}">${fmt0(r.fitness)}</b></td>
      <!-- 메카닉 -->
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.gen)}">${fmt0(r.gen)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.trf)}">${fmt0(r.trf)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${r.eli==null?'var(--muted)':r.eli<55?'var(--bad)':r.eli<70?'var(--warn)':'var(--good)'}">${leakDisplay}</b></td>
      <td class="right" style="background:#dafbe130">${fmt0(r.grf)}</td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.stuff)}">${fmt0(r.stuff)}</b></td>
      <!-- 제구 -->
      <td class="right" style="background:#fff8c530"><b style="color:${scoreColor(r.command)}">${fmt0(r.command)}</b></td>
      <!-- 부상 -->
      <td class="right" style="background:#ffebe930">${riskPill(r.risk)}</td>
      <!-- 종합 -->
      <td class="right" style="background:#eaeef2"><b style="color:${scoreColor(r.score)};font-size:14px">${fmt0(r.score)}</b></td>
    </tr>`;
  }).join('');
  document.querySelectorAll('#m1-table thead th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.key===m1Sort.key) th.classList.add(m1Sort.dir==='asc'?'sort-asc':'sort-desc');
  });
  tb.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click',()=>{
      switchTab('player');
      document.getElementById('player-select').value = tr.dataset.pid;
      renderPlayerView(tr.dataset.pid);
    });
  });
}
document.addEventListener('click', e=>{
  const th = e.target.closest('#m1-table thead th');
  if(!th) return;
  const k = th.dataset.key;
  if(m1Sort.key===k){m1Sort.dir = m1Sort.dir==='asc'?'desc':'asc'}
  else{m1Sort.key=k; m1Sort.dir = (k==='name'||k==='arm')?'asc':'desc'}
  buildM1Table();
});

function renderM1Heatmap(){
  // 1차 5축 — 에너지 프레임워크: 구속·출력·전달·누수관리·GRF
  const tb = document.getElementById('m1-heatmap');
  const axes = ['구속','출력 (Output)','전달 (Transfer)','누수관리 (역ELI)','GRF/LHEI'];
  let html = '<thead><tr><th style="text-align:left;padding-left:10px">선수</th>';
  axes.forEach(a=>{ html += `<th>${a}</th>`; });
  html += '<th>평균</th></tr></thead><tbody>';
  PLAYERS.forEach(p=>{
    const m = DATA[p.id][1];
    const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
    const realCls = isReal ? ' real-marker' : '';
    const sc = [
      m.velocity.score,
      m.energy?.generation?.score ?? null,
      m.energy?.transfer?.score ?? null,
      m.energy?.leakage?.eli_score ?? null,
      m.grf ? Math.round(m.grf.lhei) : null
    ];
    const nameSuffix = isReal ? ' <span style="font-size:9px;color:var(--accent)">●</span>' : '';
    html += `<tr><td class="name" data-pid="${p.id}">${p.name} <span style="color:var(--muted);font-size:10.5px">(${p.arm})</span>${nameSuffix}</td>`;
    sc.forEach(s=>{
      if(s==null){ html += '<td class="empty">—</td>'; }
      else { html += `<td class="cell-score ${scoreClass(s)}${realCls}">${s}</td>`; }
    });
    const av = avg(sc);
    html += `<td class="cell-score ${scoreClass(av)}${realCls}">${fmt0(av)}</td></tr>`;
  });
  tb.innerHTML = html + '</tbody>';
  tb.querySelectorAll('td.name').forEach(td=>{
    td.addEventListener('click', ()=>{
      switchTab('player');
      document.getElementById('player-select').value = td.dataset.pid;
      renderPlayerView(td.dataset.pid);
    });
  });
}

let chartsM1 = {};
function renderM1Charts(){
  // 4분면: x = 출력(generation), y = 전달(transfer), 점 크기 = 누수(역 ELI)
  if(chartsM1.q) chartsM1.q.destroy();
  const points = PLAYERS.map(p=>{
    const m = DATA[p.id][1];
    const gen = m.energy?.generation?.score ?? 0;
    const trf = m.energy?.transfer?.score ?? 0;
    const eli = m.energy?.leakage?.eli_score ?? 100;  // 데이터 없으면 누수 0
    return {
      x: gen, y: trf,
      label: p.name, pid: p.id,
      r: 4 + (100 - eli) / 8   // 누수 큰 선수일수록 큰 점 (4~16)
    };
  });
  const colors = points.map(p=>{
    if(p.x>=70 && p.y>=70) return '#1a7f37';        // 균형 elite
    if(p.x>=70 && p.y<70)  return '#bf8700';        // 출력 OK 전달 부족
    if(p.x<70  && p.y>=70) return '#0969da';        // 전달 OK 출력 부족
    return '#cf222e';                               // 둘 다 부족
  });
  chartsM1.q = new Chart(document.getElementById('chart-quadrant'), {
    type:'scatter',
    data:{datasets:[{
      label:'선수', data:points,
      backgroundColor: colors.map(c=>c+'cc'),
      borderColor: colors, pointRadius: points.map(p=>p.r),
      pointHoverRadius: 14
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{
          const p = points[c.dataIndex];
          const m = DATA[p.pid][1];
          const eli = m.energy?.leakage?.eli_score ?? '—';
          return `${p.label} · 출력 ${Math.round(p.x)} · 전달 ${Math.round(p.y)} · ELI ${eli} (누수↑ 클수록 점 큼)`;
        }}}
      },
      scales:{
        x:{min:20,max:100,title:{display:true,text:'에너지 출력 (Generation, 0~100)',color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{min:20,max:100,title:{display:true,text:'에너지 전달 (Transfer, 0~100)',color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      },
      onClick:(evt, elems)=>{
        if(elems.length){
          const pid = points[elems[0].index].pid;
          switchTab('player');
          document.getElementById('player-select').value = pid;
          renderPlayerView(pid);
        }
      }
    }
  });

  // 구속 vs 잠재
  if(chartsM1.vp) chartsM1.vp.destroy();
  const vp = PLAYERS.map(p=>({
    x: DATA[p.id][1].velocity.measured_kmh,
    y: DATA[p.id][1].velocity.potential_kmh,
    label: p.name, pid: p.id
  }));
  const minV = Math.floor(Math.min(...vp.map(p=>Math.min(p.x,p.y)))/5)*5;
  const maxV = Math.ceil(Math.max(...vp.map(p=>Math.max(p.x,p.y)))/5)*5;
  chartsM1.vp = new Chart(document.getElementById('chart-velo-potential'), {
    type:'scatter',
    data:{datasets:[
      {label:'선수', data:vp, backgroundColor:'rgba(9,105,218,.7)', borderColor:'#0969da', pointRadius:6},
      {label:'대각선 (측정=잠재)', type:'line', data:[{x:minV,y:minV},{x:maxV,y:maxV}],
       borderColor:'#cf222e', borderDash:[5,4], pointRadius:0, showLine:true, fill:false}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#1f2328'}},
        tooltip:{callbacks:{label:c=>{
          if(c.datasetIndex===1) return '대각선';
          const p = vp[c.dataIndex];
          return `${p.label} · 측정 ${p.x} → 잠재 ${p.y} (잔차 ${(p.y-p.x).toFixed(1)})`;
        }}}
      },
      scales:{
        x:{min:minV,max:maxV,title:{display:true,text:'측정 구속 (km/h)',color:'#656d76'},grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{min:minV,max:maxV,title:{display:true,text:'잠재 구속 (km/h)',color:'#656d76'},grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      },
      onClick:(evt, elems)=>{
        if(elems.length && elems[0].datasetIndex===0){
          const pid = vp[elems[0].index].pid;
          switchTab('player'); document.getElementById('player-select').value = pid; renderPlayerView(pid);
        }
      }
    }
  });
}

