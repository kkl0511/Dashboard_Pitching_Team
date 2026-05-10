/* ╔══════════════════════════════════════════════════════════╗
   ║  v5.14: 새 5섹션 흐름 — 체력 이동 + 메카닉 보강           ║
   ╚══════════════════════════════════════════════════════════╝ */
function v514_moveFitnessCards(){
  // 체력 카드들을 § 2 체력 자리(section-fitness-cards)로 이동
  // v5.16: card-hp-ridge도 함께 (분석가용 details)
  const target = document.getElementById('section-fitness-cards');
  const cards = ['card-hp-assessment','card-fitness-raw','card-hp-ridge'];
  if(!target) return;
  for(const id of cards){
    const c = document.getElementById(id);
    if(c && c.parentElement?.id === 'hidden-fitness-source'){
      target.appendChild(c);   // hidden source → 체력 섹션 자리
    }
  }
}

/* v5.17: 체력 6축 라디아 (구속 핵심 4 + 제구 1 + 부상 1) + hover 효과 + 17 변인 details */
let chartFitnessRadar = null;
function v516_renderFitnessHexRadar(m, p){
  // v5.25: Driveline HP Assessment 6축 framework로 전환
  // 6축: Strength / Relative Strength / Power / Relative Power / Reactive Strength / Upper Body Power
  // 각 축 100 = HS group 평균, 본인 score는 변인별 raw value / hs_avg × 100
  if(typeof ANALYTICS === 'undefined' || !ANALYTICS.drivelineHPDiagnosis) return;
  const fit = m.fitness;
  if(!fit){
    const wrap = document.getElementById('p-fitness-summary');
    if(wrap) wrap.innerHTML = '<span style="color:var(--muted)">체력 데이터 미입력</span>';
    return;
  }
  // Driveline HP 6 변인 추출 (DRIVELINE_HP_6_MODELS의 metric_key와 매칭)
  const hpInput = {
    imtp_npf:        fit.imtp?.peak_force_n,
    imtp_pf_bm:      fit.imtp?.peak_force_bm_n_kg,
    sj_pp_bm:        fit.sj?.peak_power_bm_w_kg,
    cmj_pp_bm:       fit.cmj?.peak_power_bm_w_kg,
    pogo_rsi:        fit.pogo?.rsi_ms,
    plyo_push_up_pf: fit.pp?.peak_takeoff_force_n   // 미측정 — undefined 허용
  };
  const dx = ANALYTICS.drivelineHPDiagnosis(hpInput);
  if(!dx) return;

  // 6 축 순서 (Driveline HP 표준)
  const axisOrder = ['strength','rel_strength','power','rel_power','reactive','upper_power'];
  const labels = axisOrder.map(k => `${dx[k].label_kr}\n(${dx[k].label})`);
  // 미측정 축은 0 대신 null로 표시 (radar에 빈 칸)
  const myData = axisOrder.map(k => dx[k].not_measured ? 0 : (dx[k].score ?? 0));
  // hover에 표시할 raw 데이터
  const hoverInfo = axisOrder.map(k => ({
    score: dx[k].score, value: dx[k].value, unit: dx[k].unit,
    sub: dx[k].sub, hs_avg: dx[k].hs_avg,
    velo_group: dx[k].velo_group, refs: dx[k].velo_group_refs,
    not_measured: dx[k].not_measured
  }));
  // Reference rings: HS 평균(100) + 90+ mph cohort 목표
  const hsAvgRef = axisOrder.map(_ => 100);
  const elitemphRef = axisOrder.map(k => {
    const refs = dx[k].velo_group_refs;
    const hsAvg = dx[k].hs_avg;
    if(!refs || !hsAvg) return 130;
    return Math.round((refs['90+'] / hsAvg) * 100);
  });

  const canvas = document.getElementById('p-fitness-radar');
  if(!canvas) return;
  if(chartFitnessRadar) chartFitnessRadar.destroy();
  chartFitnessRadar = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [
        { label: `${p.name} (HP Composite ${dx.overall_score ?? '—'})`,
          data: myData,
          backgroundColor: 'rgba(188,76,0,.20)', borderColor: '#bc4c00', borderWidth: 2.4,
          pointBackgroundColor: '#bc4c00', pointRadius: 4, order: 1 },
        { label: '⬜ HS 평균 (100)', data: hsAvgRef,
          backgroundColor: 'rgba(101,109,118,.04)', borderColor: '#656d76', borderWidth: 1.4,
          borderDash: [4,3], pointRadius: 0, order: 2 },
        { label: '🟦 90+ mph cohort 목표', data: elitemphRef,
          backgroundColor: 'rgba(9,105,218,.04)', borderColor: '#0969da', borderWidth: 1.5,
          borderDash: [6,4], pointRadius: 0, order: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 10 } },
        tooltip: {
          callbacks: {
            title: items => labels[items[0].dataIndex].replace('\n', ' '),
            label: ctx => {
              if(ctx.datasetIndex !== 0) return ctx.dataset.label + ': ' + Math.round(ctx.parsed.r);
              const info = hoverInfo[ctx.dataIndex];
              if(info.not_measured) return ['미측정 (Plyo Push-up 측정 추가 시 자동 채워짐)'];
              const fmtV = v => v == null ? '—' : (typeof v === 'number' ? (v >= 1000 ? Math.round(v) : v.toFixed(2)) : v);
              return [
                '본인: ' + fmtV(info.value) + ' ' + info.unit + '  (HP 점수 ' + (info.score ?? '—') + ')',
                'HS 평균: ' + fmtV(info.hs_avg) + ' ' + info.unit + ' = 100점',
                '본인 위치: ' + (info.velo_group ?? '—') + ' mph cohort',
                'cohort 평균: <80=' + fmtV(info.refs['<80']) + ', 80-85=' + fmtV(info.refs['80-85']) + ', 85-90=' + fmtV(info.refs['85-90']) + ', 90+=' + fmtV(info.refs['90+'])
              ];
            }
          }
        }
      },
      scales: { r: { min: 0, max: 200, ticks: { stepSize: 50, color: '#656d76', font: { size: 10 }, backdropColor: 'transparent',
                       callback: v => v === 100 ? '100 (평균)' : v === 200 ? '200' : v },
                     grid: { color: '#eaeef2' }, angleLines: { color: '#eaeef2' },
                     pointLabels: { color: '#1f2328', font: { size: 10 } } } }
    }
  });

  // HP Composite 요약 + Velo Group + 강약점
  const summaryEl = document.getElementById('p-fitness-summary');
  if(summaryEl){
    // 강점/약점 (미측정 제외)
    const measuredAxes = axisOrder.filter(k => !dx[k].not_measured && dx[k].score != null);
    const sortedAxes = measuredAxes.slice().sort((a,b) => dx[b].score - dx[a].score);
    const top = sortedAxes[0], bottom = sortedAxes[sortedAxes.length-1];
    // 본인이 가장 자주 속한 velo group (mode)
    const vgs = measuredAxes.map(k => dx[k].velo_group).filter(Boolean);
    const vgCount = {}; vgs.forEach(v => vgCount[v] = (vgCount[v]||0) + 1);
    const dominantVG = Object.entries(vgCount).sort((a,b) => b[1] - a[1])[0]?.[0];

    let html = `<div style="background:#f6f8fa;padding:10px 12px;border-radius:6px;margin-bottom:10px">`;
    html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">HP Composite Score</div>`;
    html += `<div style="font-size:24px;font-weight:600;color:#bc4c00">${dx.overall_score ?? '—'}<span style="font-size:13px;color:var(--muted)"> / 100 (HS 평균)</span></div>`;
    if(dominantVG) html += `<div style="font-size:11px;color:var(--muted);margin-top:4px">체력 수준 ≈ <b style="color:#0969da">${dominantVG} mph cohort</b></div>`;
    html += `</div>`;
    if(top) html += `<div style="background:#f0fff4;border-left:3px solid #1a7f37;padding:8px 10px;border-radius:4px;margin-bottom:6px">
      <div style="font-size:11px;color:var(--muted)">▲ 강점</div>
      <div style="font-size:13px;font-weight:600;color:#1a7f37">${dx[top].label_kr} (${dx[top].score}점)</div></div>`;
    if(bottom && bottom !== top) html += `<div style="background:#fff5f5;border-left:3px solid #cf222e;padding:8px 10px;border-radius:4px">
      <div style="font-size:11px;color:var(--muted)">▼ 약점</div>
      <div style="font-size:13px;font-weight:600;color:#cf222e">${dx[bottom].label_kr} (${dx[bottom].score}점)</div></div>`;
    summaryEl.innerHTML = html;
  }

  // v5.25: Velo Group cohort 비교표 (Driveline HP, 분석가용)
  const cohortBody = document.getElementById('p-hp-cohort-body');
  if(cohortBody){
    const fmtV = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === 'm/s' || unit === 'W/kg' || unit === 'N/kg') return v.toFixed(2);
      return Math.round(v).toString();
    };
    const colorScore = s => s == null ? '#656d76' : s >= 130 ? '#1a7f37' : s >= 100 ? '#0969da' : s >= 75 ? '#bc4c00' : '#cf222e';
    cohortBody.innerHTML = axisOrder.map(k => {
      const a = dx[k];
      const myCellColor = a.not_measured ? 'var(--muted)' : '#1f2328';
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:6px;font-weight:500">${a.label_kr}<br><span style="font-size:10px;color:var(--muted)">${a.label}</span></td>
        <td style="text-align:right;padding:6px;font-weight:600;color:${myCellColor}">${a.not_measured ? '미측정' : fmtV(a.value, a.unit)} <span style="color:var(--muted);font-size:10px">${a.unit}</span></td>
        <td style="text-align:right;padding:6px;background:#f0f3f6">${fmtV(a.hs_avg, a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['<80'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['80-85'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['85-90'], a.unit)}</td>
        <td style="text-align:right;padding:6px;background:#ddf4ff;font-weight:500">${fmtV(a.velo_group_refs['90+'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:${colorScore(a.score)};font-weight:600">${a.not_measured ? '—' : (a.score ?? '—')}</td>
      </tr>`;
    }).join('');
  }

  // v5.25: Asymmetry 별도 카드 (Driveline 패턴 — 좌우 균형 ±15% 임계)
  const asymBars = document.getElementById('p-asym-bars');
  const asymBadge = document.getElementById('p-asym-badge');
  if(asymBars){
    const asyms = [
      { label: 'IMTP (다리 좌우 힘 차이)', val: fit.imtp?.asymmetry_pct },
      { label: 'CMJ Concentric Impulse', val: fit.cmj?.asymmetry_pct },
      { label: 'Plyo Push Up (상체 좌우)', val: fit.pp?.asymmetry_pct }
    ];
    const measured = asyms.filter(a => a.val != null);
    const maxAbs = measured.length > 0 ? Math.max(...measured.map(a => Math.abs(a.val))) : null;
    if(asymBadge){
      if(maxAbs == null) asymBadge.innerHTML = '<span style="color:var(--muted)">측정 데이터 없음</span>';
      else if(maxAbs >= 15) asymBadge.innerHTML = `<span style="color:#cf222e">⚠ 임계 초과 (max ${maxAbs.toFixed(1)}%)</span>`;
      else if(maxAbs >= 10) asymBadge.innerHTML = `<span style="color:#bc4c00">주의 (max ${maxAbs.toFixed(1)}%)</span>`;
      else asymBadge.innerHTML = `<span style="color:#1a7f37">✅ 균형 양호 (max ${maxAbs.toFixed(1)}%)</span>`;
    }
    asymBars.innerHTML = asyms.map(a => {
      if(a.val == null) return `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:10.5px"><span style="width:140px">${a.label}</span><span>측정 없음</span></div>`;
      const v = a.val;
      const absV = Math.abs(v);
      const c = absV >= 15 ? '#cf222e' : absV >= 10 ? '#bc4c00' : '#1a7f37';
      // 가로 막대: -20 to +20 % 범위, 중앙 0 (균형). 점선 ±15% 임계
      const pct = Math.max(-20, Math.min(20, v));
      const offset = 50 + (pct / 20 * 50); // 중앙 50%, 좌우 0~100%
      return `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
        <span style="width:140px">${a.label}</span>
        <div style="flex:1;position:relative;height:18px;background:#f6f8fa;border-radius:3px;overflow:visible">
          <div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:#ccc"></div>
          <div style="position:absolute;top:0;bottom:0;left:12.5%;width:1px;border-left:1px dashed #cf222e;opacity:.5"></div>
          <div style="position:absolute;top:0;bottom:0;left:87.5%;width:1px;border-left:1px dashed #cf222e;opacity:.5"></div>
          <div style="position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:${c};transform:translate(-50%,-50%);left:${offset}%"></div>
        </div>
        <span style="width:60px;text-align:right;color:${c};font-weight:600">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>
        <span style="width:30px;color:var(--muted);font-size:10px">${v < 0 ? 'L↑' : v > 0 ? 'R↑' : ''}</span>
      </div>`;
    }).join('');
  }

  // v5.17: 17 변인 전체 표 (분석가용 details) — Driveline HP 6축 외 추가 변인
  const detailBody = document.getElementById('p-fitness-detail-body');
  if(detailBody && ANALYTICS.FITNESS_VARIABLE_MAP){
    const vmap = ANALYTICS.FITNESS_VARIABLE_MAP;
    // 17 변인 표용 vars (drivelineHPDiagnosis용 hpInput과 별개)
    const vars = {
      cmj_jh:       fit.cmj?.jump_height_cm,
      cmj_pp_bm:    fit.cmj?.peak_power_bm_w_kg,
      cmj_rsi_mod:  fit.cmj?.rsi_modified_ms,
      cmj_conc_pf:  fit.cmj?.conc_peak_force_bm_n_kg,
      cmj_ec_ratio: fit.cmj?.ecc_conc_force_ratio,
      sj_jh:        fit.sj?.jump_height_cm,
      sj_pp_bm:     fit.sj?.peak_power_bm_w_kg,
      sj_conc_pf:   fit.sj?.conc_peak_force_bm_n_kg,
      eur:          fit.eur,
      pogo_rsi:     fit.pogo?.rsi_ms,
      pogo_ct:      fit.pogo?.mean_contact_time_ms,
      pogo_jh:      fit.pogo?.mean_jump_height_cm,
      imtp_pf:      fit.imtp?.peak_force_n,
      imtp_pf_bm:   fit.imtp?.peak_force_bm_n_kg,
      imtp_rfd:     fit.imtp?.rfd_0_100ms_n_s,
      imtp_f100:    fit.imtp?.force_at_100ms_bm_n_kg,
      imtp_asym:    fit.imtp?.asymmetry_pct
    };
    const order = ['cmj_jh','cmj_pp_bm','cmj_rsi_mod','cmj_conc_pf','cmj_ec_ratio',
                   'sj_jh','sj_pp_bm','sj_conc_pf','eur',
                   'pogo_rsi','pogo_ct','pogo_jh',
                   'imtp_pf','imtp_pf_bm','imtp_rfd','imtp_f100','imtp_asym'];
    const fmtVal = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === '' || unit === 'm/s') return v.toFixed(2);
      if(unit === 'cm' || unit === 'kg' || unit === '%' || unit === 'ms' || unit === 'N' || unit === 'N/s') return Math.round(v).toString();
      return v.toFixed(1);
    };
    // 효과별 배경 색
    const eBg = e => e === 'velo' ? '#dafbe1' : e === 'cmd' ? '#fce7e8' : e === 'cmd_inj' ? '#fff8c5' : '#f6f8fa';
    const eC  = e => e === 'velo' ? '#1a7f37' : e === 'cmd' ? '#cf222e' : e === 'cmd_inj' ? '#9a6700' : '#656d76';
    const eLabel = e => e === 'velo' ? '⚾ 구속' : e === 'cmd' ? '🎯 제구' : e === 'cmd_inj' ? '🎯⚠ 제구·부상' : '—';
    detailBody.innerHTML = order.map(k => {
      const def = vmap[k]; if(!def) return '';
      const v = vars[k];
      const rowBg = def.priority === 1 ? '#fafffe' : '';
      return `<tr style="border-bottom:1px solid #f0f3f6;background:${rowBg}">
        <td style="padding:6px;color:var(--muted);font-size:11px">${def.test}</td>
        <td style="padding:6px;font-weight:500">${def.short}${def.priority === 1 ? ' <span style="color:#bc4c00">⭐</span>' : ''}</td>
        <td style="text-align:right;padding:6px;font-weight:600">${fmtVal(v, def.unit)} <span style="color:var(--muted);font-size:10px">${def.unit}</span></td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtVal(def.goodKR, def.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtVal(def.mlb, def.unit)}</td>
        <td style="padding:6px"><span style="background:${eBg(def.effect)};color:${eC(def.effect)};padding:2px 6px;border-radius:3px;font-size:10px">${eLabel(def.effect)}</span></td>
        <td style="padding:6px;color:var(--muted);font-size:11px">${def.purpose}</td>
      </tr>`;
    }).join('');
  }
}

function v514_renderMechanicTables(m, p){
  if(typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const fmtPctile = pct => {
    if(pct == null) return '<span style="color:var(--muted)">—</span>';
    const c = pct >= 75 ? '#1a7f37' : pct >= 50 ? '#0969da' : pct >= 25 ? '#bc4c00' : '#cf222e';
    return `<span style="color:${c};font-weight:600">${pct}</span>`;
  };

  // [3-1] v5.24: Driveline 5 모델 변인 상세 표 (Per 1mph)
  const dvBody = document.getElementById('p-driveline-vars-body');
  if(dvBody && A.DRIVELINE_5_MODELS && A.drivelineFiveModelDiagnosis){
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      shoulder_abd_fp_deg:    m.faults?.shoulder_abd_fp_deg,
      scap_load_fp_deg:       m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg:      m.faults?.elbow_flex_fp_deg,
      x_factor:               m.faults?.x_factor_deg,
      trunk_forward_tilt:     m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt:     m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg:  m.faults?.torso_counter_rot_deg,
      torso_rot_fp_deg:       m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg:       m.faults?.torso_rot_br_deg,
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change:   m.faults?.lead_knee_change,
      stride_length:      m.faults?.stride_length_m,                     // m (driveline.js에서 × 100 → cm)
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel:    m.cog?.decel,
      cog_decel_ae: m.cog?.decel_ae,      // v5.40: Above Expected = 회귀 잔차 (KR cohort 기반)
      max_cog_velo: m.cog?.max_velo
    });
    if(dvl5){
      const modelOrder = ['arm_action','posture','rotation','block','cog'];
      const modelLabel = {arm_action:'🚀 팔동작', posture:'🛡 자세', rotation:'🔄 회전 속도', block:'🦵 앞다리 제동', cog:'🎯 체중이동'};
      const impColor = imp => imp === 'high' ? '#cf222e' : imp === 'med' ? '#bc4c00' : '#656d76';
      const impLabel = imp => imp === 'high' ? '높음' : imp === 'med' ? '보통' : '낮음';
      const fmtV = (v, unit) => v == null ? '<span style="color:var(--muted)">—</span>' :
        (unit === 'deg' || unit === 'in' ? Math.round(v) :
         unit === 'm/s' ? v.toFixed(2) :
         unit === 'deg/s' ? Math.round(v) : v.toFixed(1));
      let html = '';
      modelOrder.forEach(mk => {
        const md = dvl5[mk];
        if(!md || !md.metrics) return;
        Object.entries(md.metrics).forEach(([k, mt], i) => {
          // v5.36: mph → km/h 표시 변환 (1 mph = 1.609 km/h, per_1km/h = per_1mph × 0.621)
          const diff_mph = (mt.value != null && mt.median_elite != null && mt.per_1mph) ?
            ((mt.value - mt.median_elite) / mt.per_1mph) : null;
          const diff_kmh = diff_mph == null ? null : diff_mph * 1.609;
          const diffColor = diff_kmh == null ? '#656d76' : diff_kmh > 0 ? '#1a7f37' : '#cf222e';
          const diffStr = diff_kmh == null ? '—' : (diff_kmh >= 0 ? '+' : '') + diff_kmh.toFixed(1) + ' km/h';
          // per_1km/h = per_1mph * 0.621 (1 km/h 향상에 필요한 변인 변화량)
          const per_1kmh = mt.per_1mph != null ? mt.per_1mph * 0.621 : null;
          html += `<tr style="border-bottom:1px solid #f0f3f6">
            <td style="padding:5px 6px;color:var(--muted);font-size:10.5px">${i === 0 ? modelLabel[mk] : ''}</td>
            <td style="padding:5px 6px">${mt.label}</td>
            <td style="text-align:right;padding:5px 6px;font-weight:600">${fmtV(mt.value, mt.unit)} <span style="color:var(--muted);font-size:10px">${mt.unit}</span></td>
            <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtV(mt.median_elite, mt.unit)}</td>
            <td style="text-align:center;padding:5px 6px;color:${impColor(mt.importance)};font-size:10px;font-weight:600">${impLabel(mt.importance)}</td>
            <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtV(per_1kmh, mt.unit)}</td>
            <td style="text-align:right;padding:5px 6px;color:${diffColor};font-weight:600">${diffStr}</td>
          </tr>`;
        });
      });
      dvBody.innerHTML = html;

      // [3-5] v5.39: 에너지 손실 Top 3 (이전 ELI causal-chains 대체) — 동일 dvl5 + ETE 결합
      const top3wrap = document.getElementById('p-energy-loss-top3');
      if(top3wrap){
        const trans = (A.segmentTransitionETE) ? A.segmentTransitionETE({
          peak_pelvis_v:  m.sequence?.pelvis_dps,
          peak_trunk_v:   m.sequence?.trunk_dps,
          peak_humerus_v: m.sequence?.arm_dps,
          peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
          peak_hand_v:    m.sequence?.peak_hand_v ?? m.energy?.transfer?.peak_forearm_v,
          pelvis_to_trunk_lag_ms:    m.energy?.transfer?.pelvis_to_trunk_lag_ms,
          trunk_to_humerus_lag_ms:   m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
          humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
          forearm_to_hand_lag_ms:    m.energy?.transfer?.forearm_to_hand_lag_ms
        }) : null;
        const candidates = [];
        // 5 모델 high-importance 음의 차이
        ['arm_action','posture','rotation','block','cog'].forEach(mk => {
          const md = dvl5[mk]; if(!md || !md.metrics) return;
          Object.values(md.metrics).forEach(mt => {
            if(mt.value == null || mt.median_elite == null || !mt.per_1mph) return;
            const diff_kmh = (mt.value - mt.median_elite)/mt.per_1mph * 1.609;
            if(diff_kmh < 0 && mt.importance === 'high'){
              candidates.push({type:'driveline', model:mk, model_lbl:modelLabel[mk], var_lbl:mt.label,
                value:mt.value, elite:mt.median_elite, unit:mt.unit||'',
                loss:Math.abs(diff_kmh)});
            }
          });
        });
        // ETE transitions <100점
        if(trans){
          ['pelvis_to_trunk','trunk_to_humerus','humerus_to_forearm','forearm_to_hand'].forEach(k => {
            const t = trans[k]; if(!t || t.score == null || t.score >= 95) return;
            const loss = (100 - t.score) * 0.06;
            candidates.push({type:'ete', model_lbl:'🔗 분절간 흐름',
              var_lbl:`${t.label_kr} (Lag ${t.lag_ms!=null?t.lag_ms.toFixed(1):'—'} ms · Gain ${t.speed_gain?t.speed_gain.toFixed(2)+'×':'—'})`,
              value:t.score, elite:100, unit:'점', loss, ete_score:t.score,
              ete_fault:t.lag_fault || t.gain_fault || ''});
          });
        }
        candidates.sort((a,b)=>b.loss-a.loss);
        const top3 = candidates.slice(0,3);
        const rxMap = {
          'Layback (어깨 최대 외회전)':'어깨 모빌리티 (sleeper stretch) · long-toss · plyo-ball Layback drill',
          'Shoulder Abduction at FP':'어깨 셋업 단계에서 외전 90° 유지 · scap retraction throw',
          'Scap Load at FP':'광배·후면삼각근 강화 · scap retraction throw drill (절댓값 평가)',
          'Shoulder Rotation Velo':'Layback 후 explosive 외→내회전 plyo throw · ball weight 진행',
          'Peak Hip-Shoulder Sep at FP (X-factor)':'골반-몸통 분리 강조 throw · medball rotational throw',
          'Peak Torso Counter Rot':'와인드업 시 몸통 반대 회전 강조 · stride 시 어깨 잔류 cueing',
          'Torso Forward Tilt at FP':'FP 시점 trunk forward tilt 만들기 — front leg block + 코어 stability drill',
          'Torso Rotation at FP':'FP closed posture 유지 → release 직전 폭발적 회전',
          'Torso Rotation at BR':'follow-through trunk 회전 끝까지 (홈쪽 110°+)',
          'Torso Side Bend at MER':'release 직전 contralateral side bend drill',
          'Torso Rotation Velo':'medball rotational throw (heavy → light) · 코어 power',
          'Pelvis Rotation Velo':'골반 가속 drill (markerless 보정 caveat)',
          'Lead Knee Extension':'앞발 착지 후 knee 신전 강조 · RDL · lateral squat',
          'Stride Length':'Stride 거리 점진 증가 (체중 90%+ 권장) · towel drill',
          'CoG Decel AE':'앞발 block + 골반 braking 통합 drill (정의 caveat)',
          'Peak Lead Knee Ext Velo':'single leg jumping · 앞발 explosive block',
          'CoG Decel':'Lead leg AP impulse 18-28 %BW·s 목표 · 앞발 block + 골반 braking 통합',
          'Max CoG Velo':'explosive stride drill, KB swing'
        };
        const eteRxMap = {
          'pelvis_to_trunk':'골반→몸통 lag 보정 — 골반 단독 회전 후 몸통 따라가기 drill',
          'trunk_to_humerus':'몸통→위팔 lag 보정 — Layback 유지 → 폭발적 내회전 plyo',
          'humerus_to_forearm':'위팔→아래팔 — 너무 이른 elbow 신전 방지 (valgus stress ↑)',
          'forearm_to_hand':'아래팔→손 — release 시점 손 가속 cueing (towel drill)'
        };
        if(top3.length === 0){
          top3wrap.innerHTML = `<div style="padding:14px;background:#dafbe1;border-radius:5px;color:#1a7f37;font-weight:600">✅ 큰 에너지 손실 영역 없음 — 5 모델 + ETE 모두 elite 수준</div>`;
        } else {
          top3wrap.innerHTML = top3.map((c,i) => {
            const num = i+1;
            const numColor = ['#cf222e','#bc4c00','#8250df'][i];
            const rx = c.type==='ete' ? eteRxMap[c.model||''] : (rxMap[c.var_lbl] || '해당 변인 강화 drill');
            const valStr = c.type==='ete'
              ? `점수 ${c.value} <span style="color:var(--muted);font-size:11px">(${c.ete_fault || 'gain·lag 누수'})</span>`
              : `${c.unit==='m/s'?c.value.toFixed(2):Math.round(c.value)} ${c.unit} <span style="color:var(--muted);font-size:11px">(Elite ${c.unit==='m/s'?c.elite.toFixed(2):Math.round(c.elite)} ${c.unit})</span>`;
            return `<div style="position:relative;padding:8px 11px 8px 48px;background:#fff5f5;border:1px solid #ffaaa3;border-radius:5px;margin:5px 0;font-size:12px">
              <div style="position:absolute;left:10px;top:10px;width:28px;height:28px;border-radius:50%;background:${numColor};color:#fff;text-align:center;line-height:28px;font-weight:700">${num}</div>
              <div style="font-weight:700;color:${numColor};margin-bottom:4px">${c.model_lbl} — ${c.var_lbl}</div>
              <div style="font-size:11.5px"><b>현재:</b> ${valStr}</div>
              <div style="font-size:11.5px"><b>추정 구속 손실:</b> <span style="color:#cf222e;font-weight:600">−${c.loss.toFixed(1)} km/h</span></div>
              <div style="font-size:11.5px;margin-top:4px;color:#1a7f37"><b>💪 처방:</b> ${rx}</div>
            </div>`;
          }).join('');
        }
      }
    }
  }

  // [3-1] v5.18: 메카닉 7 변인 → 본인/한국우수/MLB + 효과 매핑 표 (체력과 동일 패턴)
  const tbody = document.getElementById('p-mech-percentile-body');
  if(tbody && A.MECHANIC_VARIABLE_MAP){
    const mvars = {
      pelvis_dps: m.sequence?.pelvis_dps,
      trunk_dps:  m.sequence?.trunk_dps,
      arm_dps:    m.sequence?.arm_dps,
      x_factor:   m.faults?.x_factor_deg,
      stride_pct: (m.faults?.stride_pct ?? 0.80) * 100,    // 0.80 → 80
      hp_ratio_pct: m.energy?.transfer?.ratio_humerus_to_pelvis_pct,
      ete_pct:    m.energy?.transfer?.ete_pct
    };
    const order = ['pelvis_dps','trunk_dps','arm_dps','x_factor','stride_pct','hp_ratio_pct','ete_pct'];
    const eBg = e => e === 'velo' ? '#dafbe1' : e === 'cmd' ? '#fce7e8' : e === 'cmd_velo' ? '#ddf4ff' : '#f6f8fa';
    const eC  = e => e === 'velo' ? '#1a7f37' : e === 'cmd' ? '#cf222e' : e === 'cmd_velo' ? '#0969da' : '#656d76';
    const eLabel = e => e === 'velo' ? '⚾ 구속' : e === 'cmd' ? '🎯 제구' : e === 'cmd_velo' ? '🎯⚾ 제구·구속' : '—';
    const fmtVal = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === '°/s' || unit === 'N/s' || unit === '%') return Math.round(v).toString();
      return v.toFixed(1);
    };
    tbody.innerHTML = order.map(k => {
      const def = A.MECHANIC_VARIABLE_MAP[k]; if(!def) return '';
      const v = mvars[k];
      const rowBg = def.priority === 1 ? '#fafffe' : '';
      return `<tr style="border-bottom:1px solid #f0f3f6;background:${rowBg}">
        <td style="padding:5px 6px;font-weight:500">${def.short}${def.priority === 1 ? ' <span style="color:#bc4c00">⭐</span>' : ''}</td>
        <td style="text-align:right;padding:5px 6px;font-weight:600">${fmtVal(v, def.unit)} <span style="color:var(--muted);font-size:10px">${def.unit}</span></td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtVal(def.goodKR, def.unit)}</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtVal(def.mlb, def.unit)}</td>
      </tr>`;
    }).join('');
  }

  // [3-2] 분절별 metric 표 — peak ω + KE_rot + speed gain + lag
  const segBody = document.getElementById('p-segment-body');
  if(segBody){
    const seq = m.sequence; const trf = m.energy?.transfer;
    const massKg = p.weight, heightM = p.height/100;
    const ke = (seg, omega) => (A.selfCalcSegmentKE && omega) ? A.selfCalcSegmentKE(seg, massKg, heightM, omega) : null;
    const fmt0 = v => v == null ? '—' : Math.round(v);
    const fmt1 = v => v == null ? '—' : v.toFixed(1);
    const segs = [
      {lbl:'골반', omega: seq?.pelvis_dps, ke: ke('pelvis', seq?.pelvis_dps), gain: '—', lag: '—'},
      {lbl:'몸통', omega: seq?.trunk_dps,  ke: ke('trunk',  seq?.trunk_dps),
       gain: trf?.speed_gain_pt != null ? trf.speed_gain_pt.toFixed(2) + '×' : '—',
       lag: trf?.pelvis_to_trunk_lag_ms != null ? trf.pelvis_to_trunk_lag_ms + ' ms' : '—'},
      {lbl:'팔 (Humerus IR)', omega: seq?.arm_dps, ke: ke('humerus', seq?.arm_dps),
       gain: trf?.speed_gain_ta != null ? trf.speed_gain_ta.toFixed(2) + '×' : '—',
       lag: trf?.trunk_to_arm_lag_ms != null ? trf.trunk_to_arm_lag_ms + ' ms' : '—'},
      {lbl:'손 (추정)', omega: seq?.arm_dps != null ? Math.round(seq.arm_dps * 1.8) : null,
       ke: '—', gain: '~1.8×', lag: '~20 ms'}
    ];
    segBody.innerHTML = segs.map(s => `<tr style="border-bottom:1px solid #f0f3f6">
      <td style="padding:5px 6px">${s.lbl}</td>
      <td style="text-align:right;padding:5px 6px">${fmt0(s.omega)} <span style="color:var(--muted);font-size:10px">°/s</span></td>
      <td style="text-align:right;padding:5px 6px">${typeof s.ke === 'number' ? fmt1(s.ke) : '—'} <span style="color:var(--muted);font-size:10px">J</span></td>
      <td style="text-align:right;padding:5px 6px">${s.gain}</td>
      <td style="text-align:right;padding:5px 6px">${s.lag}</td>
    </tr>`).join('');
  }

  // [3-3] ELI 6 zone 상세 표
  const eliBody = document.getElementById('p-eli-detail-body');
  const leak = m.energy?.leakage;
  if(eliBody && leak){
    const zones = [
      ['Z1','Sequential timing — 분절 가속 순차성', leak.zone1_sequence],
      ['Z2','X-factor 분리 — 골반-상체 분리각', leak.zone2_x_factor],
      ['Z3','Lead leg block — 앞발 받쳐주기', leak.zone3_lead_block],
      ['Z4','Trunk at FC — FC 시점 트렁크 자세', leak.zone4_trunk_at_fc],
      ['Z5','Shoulder ER — 어깨 외회전 가동성', leak.zone5_shoulder_align],
      ['Z6','Pelvis braking — 골반 감속', leak.zone6_pelvis_brake]
    ];
    const colorScore = s => s == null ? '#656d76' : s >= 80 ? '#1a7f37' : s >= 60 ? '#bc4c00' : s >= 40 ? '#d4a017' : '#cf222e';
    eliBody.innerHTML = zones.map(([z, desc, score]) => `<tr style="border-bottom:1px solid #f0f3f6">
      <td style="padding:5px 6px;font-weight:600;color:#0969da">${z}</td>
      <td style="padding:5px 6px;color:var(--muted)">${desc}</td>
      <td style="text-align:right;padding:5px 6px;font-weight:600;color:${colorScore(score)}">${score ?? '—'}</td>
    </tr>`).join('');
  }

  // [3-3 NEW v5.25] 에너지·파워 — Mechanical Energy 분절별 + 관절 Power Scalar
  const enBody = document.getElementById('p-energy-segment-body');
  const gen = m.energy?.generation;
  const trf = m.energy?.transfer;
  if(enBody && gen){
    // 학술 평균 (한국 우수+OBP cohort): pelvis 400J, trunk 600J, humerus 590J
    const refKE = { pelvis: 400, trunk: 600, humerus: 590 };
    const segments = [
      { lbl: '골반 (Pelvis)',  v: gen.mech_energy_pelvis_J,  ref: refKE.pelvis },
      { lbl: '몸통 (Trunk)',   v: gen.mech_energy_trunk_J,   ref: refKE.trunk },
      { lbl: '팔  (Humerus)',  v: gen.mech_energy_humerus_J, ref: refKE.humerus }
    ];
    const colorByRatio = r => r == null ? '#656d76' : r >= 1.1 ? '#1a7f37' : r >= 0.85 ? '#0969da' : r >= 0.65 ? '#bc4c00' : '#cf222e';
    enBody.innerHTML = segments.map((s, i) => {
      const ratio = s.v != null ? s.v / s.ref : null;
      const c = colorByRatio(ratio);
      // 전달율 = 다음 분절 KE / 현재 분절 KE
      let trans = null;
      if(i < segments.length - 1 && s.v != null && segments[i+1].v != null){
        trans = (segments[i+1].v / s.v * 100).toFixed(0);
      }
      const tColor = trans == null ? '#656d76' : (+trans) >= 100 ? '#1a7f37' : (+trans) >= 70 ? '#0969da' : '#cf222e';
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:5px 6px;font-weight:500">${s.lbl}</td>
        <td style="text-align:right;padding:5px 6px;color:${c};font-weight:600">${s.v != null ? Math.round(s.v) : '—'} J</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${s.ref} J</td>
        <td style="text-align:right;padding:5px 6px;color:${tColor};font-weight:600">${trans != null ? trans + '%' : '—'}</td>
      </tr>`;
    }).join('');
  }
  // ETE 요약
  const eteEl = document.getElementById('p-ete-summary');
  if(eteEl && trf){
    const ete = trf.ete_pct;
    const speedGainPT = trf.speed_gain_pt;
    const speedGainTA = trf.speed_gain_ta;
    const ratio = trf.ratio_humerus_to_pelvis_pct;
    const c = ete == null ? '#656d76' : ete >= 80 ? '#1a7f37' : ete >= 70 ? '#0969da' : ete >= 60 ? '#bc4c00' : '#cf222e';
    eteEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">⚡ 에너지 전달 효율 (ETE)</div>
      <div>전체 전달율: <b style="color:${c};font-size:14px">${ete != null ? ete + '%' : '—'}</b>
        <span style="color:var(--muted);font-size:10.5px"> (기준 80%+ Elite, 70%+ 정상)</span></div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:4px">
        Speed Gain: 골반→몸통 <b>${speedGainPT?.toFixed(2) ?? '—'}×</b> · 몸통→팔 <b>${speedGainTA?.toFixed(2) ?? '—'}×</b><br>
        H/P KE_rot 비율: <b>${ratio ?? '—'}%</b> (작을수록 분절 균형 — Elite ~1190%)
      </div>`;
  }

  // 관절 파워 표 (Hip/Knee/Shoulder/Elbow)
  const pwBody = document.getElementById('p-power-joint-body');
  if(pwBody && gen){
    const joints = [
      { lbl: 'Hip 파워',     l: gen.hip_L_W,    r: gen.hip_R_W },
      { lbl: 'Knee 파워',    l: gen.knee_L_W,   r: gen.knee_R_W },
      { lbl: 'Shoulder 파워',l: null,           r: gen.shoulder_W },
      { lbl: 'Elbow 파워',   l: null,           r: gen.elbow_W }
    ];
    pwBody.innerHTML = joints.map(j => {
      const sum = (j.l ?? 0) + (j.r ?? 0);
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:5px 6px;font-weight:500">${j.lbl}</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${j.l != null ? Math.round(j.l) : '—'}</td>
        <td style="text-align:right;padding:5px 6px;font-weight:600">${j.r != null ? Math.round(j.r) : '—'}</td>
        <td style="text-align:right;padding:5px 6px;color:#bc4c00;font-weight:600">${sum > 0 ? Math.round(sum) : '—'}</td>
      </tr>`;
    }).join('');
  }
  // 파워 요약
  const pwEl = document.getElementById('p-power-summary');
  if(pwEl && gen){
    const totalW = gen.total_W;
    const driveLeg = (gen.hip_R_W ?? 0) + (gen.knee_R_W ?? 0); // 우완 기준 Drive Leg = R hip+knee
    const leadLeg  = (gen.hip_L_W ?? 0) + (gen.knee_L_W ?? 0);
    const lead_drive_ratio = driveLeg > 0 ? (leadLeg / driveLeg * 100).toFixed(0) : null;
    pwEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">🔋 총 파워 출력</div>
      <div>총합: <b style="color:#bc4c00;font-size:14px">${totalW != null ? Math.round(totalW) + ' W' : '—'}</b></div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:4px">
        Drive Leg (R hip+knee): <b>${Math.round(driveLeg)} W</b><br>
        Lead Leg (L hip+knee): <b>${Math.round(leadLeg)} W</b>
        ${lead_drive_ratio != null ? '<span style="color:var(--muted)"> · Lead/Drive 비율: ' + lead_drive_ratio + '%</span>' : ''}
      </div>`;
  }

  // [3-4 NEW v5.25] 지면반력 — FP1/FP2 + LHEI
  const grf = m.grf;
  if(grf){
    // FP1 (뒷발) %BW
    const rearPct = grf.rear_force_pct;
    const rearEl = document.getElementById('p-grf-rear-pct');
    const rearFill = document.getElementById('p-grf-rear-fill');
    if(rearEl && rearPct != null){
      const c = rearPct >= 80 ? '#1a7f37' : rearPct >= 60 ? '#bc4c00' : '#cf222e';
      rearEl.innerHTML = `<span style="color:${c}">${rearPct.toFixed(1)}%</span>`;
      if(rearFill) rearFill.style.width = Math.min(100, rearPct / 150 * 100) + '%';
    } else if(rearEl){ rearEl.textContent = '—'; }

    // FP2 (앞발) %BW
    const leadPct = grf.lead_force_pct;
    const leadEl = document.getElementById('p-grf-lead-pct');
    const leadFill = document.getElementById('p-grf-lead-fill');
    if(leadEl && leadPct != null){
      const c = leadPct >= 110 ? '#1a7f37' : leadPct >= 90 ? '#0969da' : leadPct >= 70 ? '#bc4c00' : '#cf222e';
      leadEl.innerHTML = `<span style="color:${c}">${leadPct.toFixed(1)}%</span>`;
      if(leadFill) leadFill.style.width = Math.min(100, leadPct / 150 * 100) + '%';
    } else if(leadEl){ leadEl.textContent = '—'; }

    // LHEI 종합 점수
    const lheiEl = document.getElementById('p-grf-lhei-score');
    if(lheiEl && grf.lhei != null){
      const c = grf.lhei >= 80 ? '#1a7f37' : grf.lhei >= 60 ? '#0969da' : grf.lhei >= 40 ? '#bc4c00' : '#cf222e';
      lheiEl.innerHTML = `<span style="color:${c}">${grf.lhei}</span> <span style="font-size:13px;color:var(--muted)">/100</span>`;
    }

    // 유형 판정
    const typeEl = document.getElementById('p-grf-type-label');
    if(typeEl){
      let typeLabel = grf.type || '—';
      if(rearPct != null && leadPct != null){
        const ratio = leadPct / rearPct;
        if(ratio > 1.4)      typeLabel = '🦵 Lead 우세 (블로킹 강함)';
        else if(ratio < 0.7) typeLabel = '🦵 Drive 우세 (push 강함)';
        else                 typeLabel = '⚖ 균형형';
      }
      typeEl.innerHTML = `<b>유형: ${typeLabel}</b>`;
    }
  }

  // ──────────────────────────────────────────────────────
  // [v5.28 §3-3] 분절간 ETE — proximal-to-distal 4 transition + bottleneck
  // ──────────────────────────────────────────────────────
  const trnsEl = document.getElementById('p-energy-transitions');
  const tr = m.energy?.transitions;
  if(trnsEl){
    if(!tr){
      trnsEl.innerHTML = '<div style="color:var(--muted);font-size:11.5px;padding:10px;background:#f6f8fa;border-radius:4px">분절간 ETE 데이터 없음 (Theia 측정 필요)</div>';
    } else {
      const TKEYS = ['pelvis_to_trunk','trunk_to_humerus','humerus_to_forearm','forearm_to_hand'];
      const SEG_LABEL = ['🦴 골반','💪 몸통','🤲 위팔','✊ 아래팔','👋 손'];
      const statusColor = s => s === 'ideal' ? '#1a7f37' : s === 'acceptable' ? '#0969da' : s === 'fault' ? '#cf222e' : '#656d76';
      const statusBadge = s => s === 'ideal' ? '✅ 이상적' : s === 'acceptable' ? '🟦 허용' : s === 'fault' ? '❌ 결함' : '—';

      // 분절 chain 시각화
      let chainHtml = '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
      SEG_LABEL.forEach((lbl, i) => {
        chainHtml += `<div style="background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600">${lbl}</div>`;
        if(i < TKEYS.length){
          const t = tr[TKEYS[i]];
          if(!t){ chainHtml += '<span style="color:var(--muted)">→</span>'; return; }
          const c = statusColor(t.gain_status === 'fault' || t.lag_status === 'fault' ? 'fault' :
                                t.gain_status === 'ideal' && t.lag_status === 'ideal' ? 'ideal' : 'acceptable');
          chainHtml += `<div style="display:flex;flex-direction:column;align-items:center;min-width:90px">
            <div style="color:${c};font-size:18px;line-height:1">→</div>
            <div style="font-size:10px;color:var(--muted)">${t.lag_ms != null ? t.lag_ms.toFixed(1) + 'ms' : '—'}</div>
            <div style="font-size:10px;color:${c};font-weight:600">${t.speed_gain != null ? t.speed_gain.toFixed(2) + '×' : '—'}</div>
          </div>`;
        }
      });
      chainHtml += '</div>';

      // bottleneck 강조 박스
      let bottleHtml = '';
      if(tr.bottleneck && tr.bottleneck_score != null){
        const b = tr[tr.bottleneck];
        bottleHtml = `<div style="background:#fff5f5;border-left:4px solid #cf222e;padding:10px 12px;border-radius:4px;margin-bottom:10px">
          <div style="font-weight:600;font-size:13px;color:#cf222e">⚠ 가장 큰 누수: ${b.label_kr} <span style="font-size:11px;color:var(--muted);font-weight:400">(점수 ${tr.bottleneck_score})</span></div>
          <div style="font-size:11.5px;color:#1f2328;margin-top:4px">${b.description}</div>
          ${b.lag_fault ? `<div style="font-size:11px;color:#cf222e;margin-top:4px">▸ 타이밍: ${b.lag_fault}</div>` : ''}
          ${b.gain_fault ? `<div style="font-size:11px;color:#cf222e;margin-top:2px">▸ 속도전달: ${b.gain_fault}</div>` : ''}
          <div style="font-size:10.5px;color:var(--muted);margin-top:4px">출처: ${b.citation}</div>
        </div>`;
      }

      // 4 transition 표
      const r2 = (x, p=1) => x == null ? '—' : x.toFixed(p);
      let tableHtml = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
        <thead style="background:#f6f8fa">
          <tr><th style="text-align:left;padding:6px 8px">Transition</th>
              <th style="text-align:right;padding:6px 8px">lag (ms)</th>
              <th style="text-align:center;padding:6px 8px">이상 범위</th>
              <th style="text-align:right;padding:6px 8px">speed gain</th>
              <th style="text-align:center;padding:6px 8px">이상 범위</th>
              <th style="text-align:center;padding:6px 8px">진단</th>
              <th style="text-align:right;padding:6px 8px">점수</th></tr>
        </thead><tbody>`;
      TKEYS.forEach(k => {
        const t = tr[k]; if(!t) return;
        const lagC = statusColor(t.lag_status);
        const gainC = statusColor(t.gain_status);
        const overall = t.gain_status === 'fault' || t.lag_status === 'fault' ? 'fault'
                      : t.gain_status === 'ideal' && t.lag_status === 'ideal' ? 'ideal'
                      : 'acceptable';
        tableHtml += `<tr style="border-bottom:1px solid #f0f3f6">
          <td style="padding:6px 8px;font-weight:500">${t.label_kr}<br><span style="font-size:10px;color:var(--muted)">${t.label_en}</span></td>
          <td style="text-align:right;padding:6px 8px;color:${lagC};font-weight:600">${r2(t.lag_ms)}</td>
          <td style="text-align:center;padding:6px 8px;color:var(--muted);font-size:10.5px">${t.lag_ideal_ms[0]}–${t.lag_ideal_ms[1]}</td>
          <td style="text-align:right;padding:6px 8px;color:${gainC};font-weight:600">${t.speed_gain != null ? t.speed_gain.toFixed(2) + '×' : '—'}</td>
          <td style="text-align:center;padding:6px 8px;color:var(--muted);font-size:10.5px">${t.speed_gain_ideal[0].toFixed(1)}–${t.speed_gain_ideal[1].toFixed(1)}×</td>
          <td style="text-align:center;padding:6px 8px;color:${statusColor(overall)};font-weight:600;font-size:10.5px">${statusBadge(overall)}</td>
          <td style="text-align:right;padding:6px 8px;font-weight:600;color:${statusColor(overall)}">${t.score ?? '—'}</td>
        </tr>`;
      });
      tableHtml += `</tbody></table></div>`;

      const overallColor = statusColor(tr.overall_score >= 80 ? 'ideal' : tr.overall_score >= 60 ? 'acceptable' : 'fault');
      const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div style="font-weight:600;font-size:13.5px">🔗 분절간 에너지 흐름 (proximal-to-distal)</div>
        <div style="font-size:11.5px;color:var(--muted)">종합 점수: <b style="color:${overallColor};font-size:14px">${tr.overall_score ?? '—'}</b> / 100</div>
      </div>`;

      trnsEl.innerHTML = headerHtml + chainHtml + bottleHtml + tableHtml;
    }
  }

  // ──────────────────────────────────────────────────────
  // [v5.28 §3-4] GRF 수평 + 임펄스 + 타이밍 (Drive 추진 / Lead 블록)
  // ──────────────────────────────────────────────────────
  const grfHEl = document.getElementById('p-grf-horizontal');
  const grfH = m.grf?.horizontal;
  if(grfHEl){
    if(!grfH){
      grfHEl.innerHTML = '<div style="color:var(--muted);font-size:11.5px;padding:10px;background:#f6f8fa;border-radius:4px">GRF 수평 성분 데이터 없음 (Force Plate Y/X 시계열 필요)</div>';
    } else {
      const fmtV = (v, u, p=1) => v == null ? '—' : v.toFixed(p) + (u ? ' ' + u : '');
      const scoreColor = s => s == null ? '#656d76' : s >= 80 ? '#1a7f37' : s >= 60 ? '#0969da' : s >= 40 ? '#bc4c00' : '#cf222e';

      function metricRow(m){
        const c = scoreColor(m.score);
        const range = m.elite_range ? `${m.elite_range[0]}–${m.elite_range[1]}` : '—';
        return `<tr style="border-bottom:1px solid #f0f3f6">
          <td style="padding:5px 8px;font-weight:500">${m.label_kr}</td>
          <td style="text-align:right;padding:5px 8px;color:${c};font-weight:600">${fmtV(m.value, m.unit, 1)}</td>
          <td style="text-align:center;padding:5px 8px;color:var(--muted);font-size:10.5px">${range}</td>
          <td style="text-align:right;padding:5px 8px;color:${c};font-weight:600">${m.score ?? '—'}</td>
          <td style="padding:5px 8px;color:var(--muted);font-size:10px">${m.citation || ''}</td>
        </tr>`;
      }

      const driveColor = scoreColor(grfH.drive_score);
      const leadColor  = scoreColor(grfH.lead_score);
      const overallColor = scoreColor(grfH.overall_score);

      const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div style="font-weight:600;font-size:13.5px">⚡ 수평 성분 + 임펄스 + 타이밍 — 운동량 변화의 본질</div>
        <div style="font-size:11.5px;color:var(--muted)">종합: <b style="color:${overallColor};font-size:14px">${grfH.overall_score ?? '—'}</b> / 100
          <span style="margin-left:10px">Drive: <b style="color:${driveColor}">${grfH.drive_score ?? '—'}</b></span>
          <span style="margin-left:6px">Lead: <b style="color:${leadColor}">${grfH.lead_score ?? '—'}</b></span>
        </div>
      </div>`;

      // Drive leg (3 metrics)
      let driveHtml = `<div style="background:#fff8c5;padding:8px 10px;border-radius:4px;margin-bottom:8px">
        <div style="font-weight:600;font-size:12.5px;color:#9a6700;margin-bottom:6px">🦵 Drive Leg (뒷발) — Mound 방향 추진</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr style="color:var(--muted);font-size:10.5px">
            <th style="text-align:left;padding:3px 8px">변인</th>
            <th style="text-align:right;padding:3px 8px">실측</th>
            <th style="text-align:center;padding:3px 8px">Elite 범위</th>
            <th style="text-align:right;padding:3px 8px">점수</th>
            <th style="text-align:left;padding:3px 8px">출처</th>
          </tr></thead><tbody>`;
      for(const k of ['drive_propulsive_peak_pct_bw','drive_propulsive_impulse_pct_bw_s','drive_propulsive_peak_time_pct']){
        if(grfH.drive[k]) driveHtml += metricRow(grfH.drive[k]);
      }
      driveHtml += `</tbody></table></div>`;

      // Lead leg (4 metrics)
      let leadHtml = `<div style="background:#ddf4ff;padding:8px 10px;border-radius:4px;margin-bottom:8px">
        <div style="font-weight:600;font-size:12.5px;color:#0969da;margin-bottom:6px">🦵 Lead Leg (앞발) — 블록 (∫F·dt = 운동량 흡수)</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr style="color:var(--muted);font-size:10.5px">
            <th style="text-align:left;padding:3px 8px">변인</th>
            <th style="text-align:right;padding:3px 8px">실측</th>
            <th style="text-align:center;padding:3px 8px">Elite 범위</th>
            <th style="text-align:right;padding:3px 8px">점수</th>
            <th style="text-align:left;padding:3px 8px">출처</th>
          </tr></thead><tbody>`;
      for(const k of ['lead_braking_peak_pct_bw','lead_braking_impulse_pct_bw_s','lead_braking_peak_ms_after_fc','lead_block_duration_ms']){
        if(grfH.lead[k]) leadHtml += metricRow(grfH.lead[k]);
      }
      leadHtml += `</tbody></table></div>`;

      // 수평/수직 비율
      let ratioHtml = '';
      const r = grfH.ratio?.horizontal_to_vertical_ratio;
      if(r){
        const c = scoreColor(r.score);
        ratioHtml = `<div style="background:#f6f8fa;padding:8px 12px;border-radius:4px;font-size:11.5px">
          <b>수평/수직 비율</b>: <b style="color:${c}">${r.value != null ? r.value.toFixed(2) : '—'}</b>
          <span style="color:var(--muted)"> (Elite ${r.elite_range[0]}–${r.elite_range[1]} · Kageyama 2014). 점수 <b style="color:${c}">${r.score ?? '—'}</b></span>
          <div style="font-size:10.5px;color:var(--muted);margin-top:3px">수평 추진이 수직 push 대비 충분한지 평가 — mound로의 운동량 전달 효율</div>
        </div>`;
      }

      grfHEl.innerHTML = headerHtml + driveHtml + leadHtml + ratioHtml;
    }
  }

  // ──────────────────────────────────────────────────────
  // [v5.29 §3-4] NewtForce 핵심 8 변인 (Florida Baseball Armory 표준)
  // ──────────────────────────────────────────────────────
  const nfEl = document.getElementById('p-grf-newtforce');
  const nf = m.grf?.newtforce;
  if(nfEl){
    if(!nf){
      nfEl.innerHTML = '<div style="color:var(--muted);font-size:11.5px;padding:10px;background:#f6f8fa;border-radius:4px">NewtForce 데이터 없음 (Force Plate 시계열 필요)</div>';
    } else {
      const fmtV = (v, u, p=1) => v == null ? '—' : v.toFixed(p) + (u ? ' ' + u : '');
      const scoreColor = s => s == null ? '#656d76' : s >= 80 ? '#1a7f37' : s >= 60 ? '#0969da' : s >= 40 ? '#bc4c00' : '#cf222e';

      const overallC = scoreColor(nf.overall_score);
      const ampC = scoreColor(nf.amplitude_score);
      const timC = scoreColor(nf.timing_score);

      const headerHtml = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div style="font-weight:600;font-size:13.5px">⚙️ NewtForce 핵심 8 변인 <span style="font-size:10.5px;color:var(--muted);font-weight:400">(Florida Baseball Armory chart, Vanderbilt·TCU·Twins 사용 표준)</span></div>
        <div style="font-size:11.5px;color:var(--muted)">종합: <b style="color:${overallC};font-size:14px">${nf.overall_score ?? '—'}</b> / 100
          <span style="margin-left:10px">Amplitude: <b style="color:${ampC}">${nf.amplitude_score ?? '—'}</b></span>
          <span style="margin-left:6px">Timing: <b style="color:${timC}">${nf.timing_score ?? '—'}</b></span>
        </div>
      </div>`;

      function nfRow(key, m){
        const c = scoreColor(m.score);
        const range = m.elite_range ? `${m.elite_range[0]}–${m.elite_range[1]}` : '—';
        const newBadge = m.new_in_v529 ? '<span style="background:#dafbe1;color:#1a7f37;padding:1px 5px;border-radius:3px;font-size:9.5px;margin-left:4px">NEW</span>' : '';
        return `<tr style="border-bottom:1px solid #f0f3f6">
          <td style="padding:5px 8px;color:var(--muted);font-size:10px">#${m.nf_id}</td>
          <td style="padding:5px 8px;font-weight:500">${m.label_kr}${newBadge}<br><span style="font-size:10px;color:var(--muted)">${m.label_en}</span></td>
          <td style="text-align:right;padding:5px 8px;color:${c};font-weight:600">${fmtV(m.value, m.unit, 1)}</td>
          <td style="text-align:center;padding:5px 8px;color:var(--muted);font-size:10.5px">${range}</td>
          <td style="text-align:right;padding:5px 8px;color:${c};font-weight:600">${m.score ?? '—'}</td>
        </tr>`;
      }

      // Amplitude (7) — impulse, back_z, turn_z, lead_z, back_y, lead_y, lead_neg_y
      let amplHtml = `<div style="background:#f6f8fa;padding:8px 10px;border-radius:4px;margin-bottom:8px">
        <div style="font-weight:600;font-size:12.5px;margin-bottom:6px">📊 Amplitude (7 변인)</div>
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr style="color:var(--muted);font-size:10.5px">
            <th style="text-align:left;padding:3px 8px;width:30px">#</th>
            <th style="text-align:left;padding:3px 8px">변인</th>
            <th style="text-align:right;padding:3px 8px">실측</th>
            <th style="text-align:center;padding:3px 8px">Elite</th>
            <th style="text-align:right;padding:3px 8px">점수</th>
          </tr></thead><tbody>`;
      for(const k of ['impulse','back_leg_peak_z','turning_point_z','lead_leg_peak_z','back_leg_peak_y','lead_leg_peak_y','lead_leg_negative_y']){
        if(nf.metrics[k]) amplHtml += nfRow(k, nf.metrics[k]);
      }
      amplHtml += `</tbody></table></div>`;

      // Timing (1)
      let timHtml = '';
      if(nf.metrics.time_of_transfer){
        const m13 = nf.metrics.time_of_transfer;
        const c = scoreColor(m13.score);
        timHtml = `<div style="background:#fff8c5;padding:8px 12px;border-radius:4px;font-size:11.5px">
          <div style="font-weight:600;font-size:12.5px;color:#9a6700;margin-bottom:4px">⏱ Timing — Time of Transfer (가장 중요한 timing metric)</div>
          <div style="font-size:11.5px">Back Leg Peak Z → Lead Leg Peak Z: <b style="color:${c};font-size:13px">${fmtV(m13.value, m13.unit, 1)}</b>
            <span style="color:var(--muted)">  (Elite ${m13.elite_range[0]}–${m13.elite_range[1]} ms)</span>
            <span style="margin-left:8px">점수 <b style="color:${c}">${m13.score ?? '—'}</b></span>
          </div>
          <div style="font-size:10.5px;color:var(--muted);margin-top:3px">${m13.description}. ${m13.citation}</div>
        </div>`;
      }

      nfEl.innerHTML = headerHtml + amplHtml + timHtml;
    }
  }
}

function v514_renderActionPlan(m, p){
  // [3-4] 메카닉 발달 권장 — 4축 약점 + ELI 약점 → 우선순위 훈련
  const wrap = document.getElementById('p-mech-action-plan');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const fa = A.fourAxisDiagnosis ? A.fourAxisDiagnosis({
    pelvis_dps: m.sequence?.pelvis_dps, trunk_dps: m.sequence?.trunk_dps,
    arm_dps: m.sequence?.arm_dps, x_factor: m.faults?.x_factor_deg,
    stride_pct: m.faults?.stride_pct ?? 0.80,
    speed_gain_pt: m.energy?.transfer?.speed_gain_pt,
    speed_gain_ta: m.energy?.transfer?.speed_gain_ta,
    eli_score: m.energy?.leakage?.eli_score
  }) : null;
  if(!fa) { wrap.innerHTML = '<span style="color:var(--muted)">데이터 부족</span>'; return; }

  // 4축 점수 → 약점 우선순위
  const axes = [
    {key:'power', label:'⚡ 힘 (Power)', score: fa.power.score,
     drills: ['분절 회전 power (medicine ball rotational throw)', 'Plyometric trunk drill', 'Hip rotation banded resistance']},
    {key:'timing', label:'⏱ 타이밍 (Timing)', score: fa.timing.score,
     drills: ['Kinematic sequence drill (towel drill)', 'Walking windup', 'Tempo/rhythm 변화 throw']},
    {key:'separation', label:'✂️ 분리 (Separation)', score: fa.separation.score,
     drills: ['Hip-shoulder separation (X-factor) stretch', 'Anti-rotation core (Pallof press)', 'Stride length 발달 drill']},
    {key:'stability', label:'🛡 안정성 (Stability)', score: fa.stability.score,
     drills: ['Lead leg block 강화 (single leg box jump)', 'Trunk control (Pallof press)', 'Pelvis braking drill (RFE split squat)']}
  ];
  axes.sort((a,b) => (a.score ?? 100) - (b.score ?? 100));   // 가장 낮은 점수 순

  // ELI 가장 낮은 zone 1개 추가
  const leak = m.energy?.leakage;
  let eliWeakest = null;
  if(leak){
    const zones = [
      ['Z1', '분절 시퀀싱 timing', leak.zone1_sequence, 'Towel drill, walking windup'],
      ['Z2', 'X-factor 분리', leak.zone2_x_factor, 'Hip-shoulder separation stretch'],
      ['Z3', 'Lead leg block', leak.zone3_lead_block, '단일하지 박스점프, 깊은 스쿼트'],
      ['Z4', 'Trunk at FC', leak.zone4_trunk_at_fc, 'Anti-rotation core (Pallof)'],
      ['Z5', 'Shoulder ER', leak.zone5_shoulder_align, 'Sleeper stretch + cuff 강화'],
      ['Z6', 'Pelvis braking', leak.zone6_pelvis_brake, 'RFE 스플릿 스쿼트, 디셀러레이션']
    ].filter(z => z[2] != null).sort((a,b) => a[2] - b[2]);
    eliWeakest = zones[0];
  }

  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
  // 4축 약점 Top 2
  html += `<div>`;
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#cf222e">▼ 4축 약점 우선순위</div>`;
  axes.slice(0, 2).forEach((a, i) => {
    html += `<div style="background:#fff5f5;border-left:3px solid #cf222e;padding:8px 10px;margin-bottom:6px;border-radius:4px">
      <div style="font-weight:600;font-size:12px">${i+1}. ${a.label} <span style="color:#cf222e;font-size:11px">(${a.score ?? '—'}점)</span></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">권장 drill:</div>
      <ul style="margin:4px 0 0;padding-left:16px;font-size:11px;line-height:1.5">${a.drills.map(d => `<li>${d}</li>`).join('')}</ul>
    </div>`;
  });
  html += `</div>`;
  // ELI 가장 낮은 zone + 강점 1개
  html += `<div>`;
  if(eliWeakest){
    html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#bc4c00">⚠ 가장 낮은 ELI Zone</div>`;
    html += `<div style="background:#fff8f0;border-left:3px solid #bc4c00;padding:8px 10px;margin-bottom:8px;border-radius:4px">
      <div style="font-weight:600;font-size:12px">${eliWeakest[0]} ${eliWeakest[1]} <span style="color:#bc4c00;font-size:11px">(${eliWeakest[2]}점)</span></div>
      <div style="font-size:11px;margin-top:4px">→ ${eliWeakest[3]}</div>
    </div>`;
  }
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#1a7f37">▲ 강점 (유지)</div>`;
  html += `<div style="background:#f0fff4;border-left:3px solid #1a7f37;padding:8px 10px;border-radius:4px">
    <div style="font-weight:600;font-size:12px">${axes[axes.length-1].label} <span style="color:#1a7f37;font-size:11px">(${axes[axes.length-1].score ?? '—'}점)</span></div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">현재 수준 유지하면서 약점 발달 우선</div>
  </div>`;
  html += `</div></div>`;
  wrap.innerHTML = html;
}

function v514_renderSummaryAction(m, p){
  // [§ 5] 종합 권장 — bigger lever 진단 (v5.25: Mechanical Ceiling 기반)
  const wrap = document.getElementById('p-summary-action');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const measured = m.velocity?.measured_kmh;
  if(!A.expectedVelocityFromFitness || measured == null){
    wrap.innerHTML = '<span style="color:var(--muted)">실측 구속 또는 모델 데이터 부족</span>';
    return;
  }
  const fitIn = {
    height_cm: p.height, weight_kg: p.weight,
    cmj_pp_bm: m.fitness?.cmj?.peak_power_bm_w_kg,
    imtp_pf_bm: m.fitness?.imtp?.peak_force_bm_n_kg,
    hop_rsi: m.fitness?.pogo?.rsi_ms, grip_kg: null
  };
  const fit = A.expectedVelocityFromFitness(fitIn, measured);
  const fitGain = fit?.expected_gain ?? 0;

  // v5.25: 메카닉 향상 = Driveline Mechanical Ceiling 잠재
  let meGain = 0;
  if(A.drivelineFiveModelDiagnosis && A.drivelineMechanicalCeiling){
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      shoulder_abd_fp_deg:    m.faults?.shoulder_abd_fp_deg,
      scap_load_fp_deg:       m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg:      m.faults?.elbow_flex_fp_deg,
      x_factor:               m.faults?.x_factor_deg,
      trunk_forward_tilt:     m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt:     m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg:  m.faults?.torso_counter_rot_deg,
      torso_rot_fp_deg:       m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg:       m.faults?.torso_rot_br_deg,
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change:   m.faults?.lead_knee_change,
      stride_length:      m.faults?.stride_length_m,                     // m (driveline.js × 100 → cm) v5.40
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel:    m.cog?.decel,
      cog_decel_ae: m.cog?.decel_ae,      // v5.40: Above Expected = 회귀 잔차
      max_cog_velo: m.cog?.max_velo
    });
    const ceil = A.drivelineMechanicalCeiling(dvl5, measured);
    if(ceil && ceil.added_kmh_potential != null) meGain = ceil.added_kmh_potential;
  }
  const totalGain = Math.round((fitGain + meGain) * 10) / 10;
  const lever = meGain > fitGain ? '메카닉' : '체력';
  const leverColor = lever === '체력' ? '#bc4c00' : '#1a7f37';
  const leverMsg = totalGain < 1 ? '이미 종합 잠재 도달 — release/spin 등 기타 요인 발달' :
                   totalGain < 5 ? '통합 향상으로 +' + totalGain + ' km/h 기대' :
                   totalGain < 10 ? '통합 향상 잠재 +' + totalGain + ' km/h — 메카닉/체력 모두 발달 권장' :
                                    '통합 향상 잠재 +' + totalGain + ' km/h — 큰 발달 여지';

  let html = `<div style="background:#f6f8fa;border-radius:6px;padding:12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:600;margin-bottom:6px">🎯 향상 시나리오 비교</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px">
      <div style="background:#fff8f0;padding:8px 10px;border-radius:4px;border-left:3px solid #bc4c00">
        <div style="font-size:11px;color:var(--muted)">💪 체력만 향상</div>
        <div style="font-size:18px;font-weight:600;color:#bc4c00">+${fitGain} km/h</div>
      </div>
      <div style="background:#f0f9f4;padding:8px 10px;border-radius:4px;border-left:3px solid #1a7f37">
        <div style="font-size:11px;color:var(--muted)">⚙️ 메카닉 천장</div>
        <div style="font-size:18px;font-weight:600;color:#1a7f37">+${meGain} km/h</div>
      </div>
      <div style="background:#f5f0ff;padding:8px 10px;border-radius:4px;border-left:3px solid #8250df">
        <div style="font-size:11px;color:var(--muted)">🎯 통합 향상</div>
        <div style="font-size:18px;font-weight:600;color:#8250df">+${totalGain} km/h</div>
      </div>
    </div>
  </div>`;
  html += `<div style="padding:10px;background:${leverColor}10;border-left:4px solid ${leverColor};border-radius:4px;margin-bottom:8px">
    <div style="font-size:13px;font-weight:600;color:${leverColor}">💡 더 큰 leverage: <b>${lever}</b></div>
    <div style="font-size:11.5px;color:var(--text);margin-top:4px">${leverMsg}</div>
  </div>`;
  html += `<div style="font-size:11.5px;color:var(--muted);margin-top:8px">
    <b>📋 다음 3개월 권장 흐름:</b><br>
    1. <b>§ 3-4 메카닉 발달 권장</b>의 4축 약점 Top 2 drill 4-6주 적용<br>
    2. <b>§ 2 체력</b> ForceDecks 측정값 weak link 변수에 S&C 보강<br>
    3. <b>다음 측정 (3개월 후)</b> 같은 방식 측정 후 percentile 변화 확인 → 효과 검증
  </div>`;
  wrap.innerHTML = html;
}

/* 코호트 모드 — KBO/HS 토글로 비교 평가 변경 */
let RAP_COHORT = (typeof localStorage !== 'undefined' && localStorage.getItem('rap_cohort')) || 'KBO';

function renderRapsodoFB(rap, player){
  const area = document.getElementById('p-rapsodo-area');
  if(!area) return;
  if(!rap || !rap.fb){
    area.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;background:var(--panel2);border-radius:6px">
      Rapsodo CSV 인입 후 자동 표시 — <a href="#" onclick="switchTab('data');return false;" style="color:var(--accent)">데이터 관리 탭으로 이동</a>
    </div>`;
    return;
  }
  const fb = rap.fb;
  const COH = RAPSODO_BENCHMARKS[RAP_COHORT];
  const armSign = player.arm === 'R' ? 1 : -1;
  document.getElementById('rap-cohort-badge').textContent = `코호트: ${RAP_COHORT} 기준`;

  // 코호트 대비 평가
  function vs(val, ref, fmt=0, unit='', lowerBetter=false){
    if(val == null) return '<span style="color:var(--muted)">—</span>';
    const diff = val - ref;
    const good = lowerBetter ? diff < 0 : diff > 0;
    const c = Math.abs(diff) < (Math.abs(ref) * 0.03) ? 'var(--muted)' : (good ? 'var(--good)' : 'var(--bad)');
    const sign = diff >= 0 ? '+' : '';
    return `<span style="color:${c};font-weight:600">${sign}${diff.toFixed(fmt)}${unit}</span>`;
  }

  // 6 카드
  area.innerHTML = `
    <div class="grid grid-3">
      <!-- ① Velocity -->
      <div class="scard" style="border-top:3px solid #cf222e">
        <h3>① Velocity (구속)</h3>
        <div class="row"><span>최고 (max)</span><span class="v" style="font-size:18px;font-weight:700">${fb.velocity.max} <span style="font-size:11px;color:var(--muted)">km/h</span></span></div>
        <div class="row"><span>평균 (avg)</span><span class="v">${fb.velocity.avg} km/h</span></div>
        <div class="row"><span>변동 (SD)</span><span class="v">${fb.velocity.sd} km/h</span></div>
        <div class="row"><span>플레이트 평균</span><span class="v">${fb.plate_velocity.avg} km/h</span></div>
        <div class="row"><span>감속률</span><span class="v">${fb.velo_loss_pct}%</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>${RAP_COHORT} 평균 ${COH.velo} 대비</span>${vs(fb.velocity.avg, COH.velo, 1, ' km/h')}
        </div>
      </div>

      <!-- ② Spin & Stuff -->
      <div class="scard" style="border-top:3px solid #0969da">
        <h3>② Spin & Stuff (회전·구위)</h3>
        <div class="row"><span>회전수 (Spin)</span><span class="v" style="font-size:16px;font-weight:700">${fb.spin.avg} rpm</span></div>
        <div class="row"><span>True Spin</span><span class="v">${fb.true_spin_avg} rpm</span></div>
        <div class="row"><span>회전효율 (Efficiency)</span><span class="v" style="color:${fb.spin_eff.avg>=90?'var(--good)':fb.spin_eff.avg>=80?'var(--warn)':'var(--bad)'}">${fb.spin_eff.avg}%</span></div>
        <div class="row"><span>회전축 (deg)</span><span class="v">${fb.spin_axis_deg}°</span></div>
        <div class="row"><span>Gyro 각도</span><span class="v">${fb.gyro_avg}°</span></div>
        <div class="row"><span>Bauer Units</span><span class="v" style="font-weight:700">${fb.bauer_units}</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Stuff Score</span><span class="v" style="font-size:16px;color:${scoreColor(fb.stuff_score)}">${fb.stuff_score}/100</span>
        </div>
      </div>

      <!-- ③ Movement -->
      <div class="scard" style="border-top:3px solid #1a7f37">
        <h3>③ Movement (무브먼트)</h3>
        <div class="row"><span>IVB (수직 라이즈)</span><span class="v" style="font-size:16px;font-weight:700">${fb.ivb.avg} cm</span></div>
        <div class="row"><span>IVB SD</span><span class="v">${fb.ivb.sd} cm</span></div>
        <div class="row"><span>HB (수평 무브)</span><span class="v">${fb.hb.avg>0?'+':''}${fb.hb.avg} cm</span></div>
        <div class="row"><span>VB Total (중력 포함)</span><span class="v">${fb.vb_total_avg} cm</span></div>
        <div class="row"><span>VAA (진입각)</span><span class="v" style="color:${fb.vaa_avg>=-5.0?'var(--good)':fb.vaa_avg>=-6.0?'var(--warn)':'var(--bad)'}">${fb.vaa_avg}°</span></div>
        <div class="row"><span>HAA</span><span class="v">${fb.haa_avg}°</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>${RAP_COHORT} IVB ${COH.ivb} 대비</span>${vs(fb.ivb.avg, COH.ivb, 1, ' cm')}
        </div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:12px">
      <!-- ④ Release Consistency -->
      <div class="scard" style="border-top:3px solid #bc4c00">
        <h3>④ Release Consistency (릴리스 일관성)</h3>
        <div class="row"><span>Height (높이)</span><span class="v">${fb.release.height_avg} m</span></div>
        <div class="row"><span>Height SD</span><span class="v" style="color:${fb.release.height_sd_cm<3?'var(--good)':fb.release.height_sd_cm<5?'var(--warn)':'var(--bad)'}">${fb.release.height_sd_cm} cm</span></div>
        <div class="row"><span>Side (좌우)</span><span class="v">${fb.release.side_avg} m</span></div>
        <div class="row"><span>Side SD</span><span class="v" style="color:${fb.release.side_sd_cm<3?'var(--good)':fb.release.side_sd_cm<5?'var(--warn)':'var(--bad)'}">${fb.release.side_sd_cm} cm</span></div>
        <div class="row"><span>Extension (앞으로)</span><span class="v">${fb.release.extension_avg} m</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Release Angle</span><span class="v">${fb.release.angle_avg}°</span>
        </div>
      </div>

      <!-- ⑤ Command -->
      <div class="scard" style="border-top:3px solid #8250df">
        <h3>⑤ Command (제구)</h3>
        <div class="row"><span>In-Zone %</span><span class="v" style="font-size:16px;font-weight:700;color:${fb.in_zone_pct>=60?'var(--good)':fb.in_zone_pct>=45?'var(--warn)':'var(--bad)'}">${fb.in_zone_pct}%</span></div>
        <div class="row"><span>플레이트 평균 높이</span><span class="v">${fb.plate.height_avg} cm</span></div>
        <div class="row"><span>플레이트 평균 좌우</span><span class="v">${fb.plate.side_avg} cm</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Command Score</span><span class="v" style="font-size:16px;color:${scoreColor(fb.command_score)}">${fb.command_score}/100</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">
          Stuff vs Command 4분면 → 우상=Elite · 우하=Stuff Only · 좌상=Strike Thrower · 좌하=Develop
        </div>
      </div>

      <!-- ⑥ ${RAP_COHORT} 코호트 비교 -->
      <div class="scard" style="border-top:3px solid #6e7781">
        <h3>⑥ ${RAP_COHORT} 코호트 평가</h3>
        <div class="row"><span>구속</span>${vs(fb.velocity.avg, COH.velo, 1, ' km/h')}</div>
        <div class="row"><span>회전수</span>${vs(fb.spin.avg, COH.spin, 0, ' rpm')}</div>
        <div class="row"><span>회전효율</span>${vs(fb.spin_eff.avg, COH.eff, 1, '%')}</div>
        <div class="row"><span>IVB</span>${vs(fb.ivb.avg, COH.ivb, 1, ' cm')}</div>
        <div class="row"><span>Bauer Units</span>${vs(fb.bauer_units, COH.bauer, 1, '')}</div>
        <div class="row"><span>VAA (낮을수록 좋음)</span>${vs(fb.vaa_avg, COH.vaa, 2, '°', true)}</div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span><b>Extension</b></span>${vs(fb.release.extension_avg, COH.ext, 2, ' m')}
        </div>
      </div>
    </div>

    <!-- Movement Profile (IVB vs HB scatter) — Chart.js → SVG로 그림 -->
    <div class="grid grid-2" style="margin-top:14px">
      <div class="panel" style="margin:0">
        <h3 style="margin:0 0 8px;font-size:12.5px">Movement Profile · IVB vs HB
          <span style="float:right;font-size:11px;color:var(--muted)">개별 throw + 평균(◆) + 코호트(✚)</span></h3>
        <div class="chart-wrap" style="height:280px"><canvas id="rap-mov-chart"></canvas></div>
      </div>
      <div class="panel" style="margin:0">
        <h3 style="margin:0 0 8px;font-size:12.5px">Stuff vs Command 4분면
          <span style="float:right;font-size:11px;color:var(--muted)">우상=Elite</span></h3>
        <div class="chart-wrap" style="height:280px"><canvas id="rap-sc-chart"></canvas></div>
      </div>
    </div>

    <div class="footnote" style="margin-top:12px">
      <b>지표 해설</b>:
      <code>IVB</code>=Induced Vertical Break (중력 제외 수직 무브먼트, 클수록 "라이즈") ·
      <code>Spin Efficiency</code>=True Spin/Total Spin (높을수록 회전이 무브먼트로 변환) ·
      <code>VAA</code>=Vertical Approach Angle (덜 가파를수록=0에 가까울수록 "플랫" 패스트볼, 헛스윙 유도) ·
      <code>Bauer Units</code>=Spin/Velocity(mph) (회전 효율 proxy, 25+ 양호) ·
      <code>Extension</code>=릴리스 시 마운드에서 앞으로 나간 거리 (길수록 "체감 구속" ↑)
    </div>
  `;

  // 차트 — Movement Profile (산점도)
  if(chartsP.rapMov) chartsP.rapMov.destroy();
  const throwsPts = (fb.throws||[]).map(t => ({x: t.hb, y: t.ivb}));
  const avgPt = {x: fb.hb.avg, y: fb.ivb.avg};
  const cohPt = {x: armSign * 8, y: COH.ivb};
  chartsP.rapMov = new Chart(document.getElementById('rap-mov-chart'), {
    type: 'scatter',
    data: {datasets: [
      {label:'개별 throw', data: throwsPts, backgroundColor:'rgba(13,109,253,0.5)', borderColor:'#0969da', pointRadius:4},
      {label:'평균 ◆', data: [avgPt], backgroundColor:'#0969da', borderColor:'#0969da', pointRadius:9, pointStyle:'rectRot'},
      {label:`${RAP_COHORT} 코호트 ✚`, data: [cohPt], backgroundColor:'#cf222e', borderColor:'#cf222e', pointRadius:9, pointStyle:'crossRot', borderWidth:3}
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#1f2328',font:{size:11}}}},
      scales:{
        x:{title:{display:true,text:'HB · 수평 무브 (cm, +=arm side)',color:'#656d76'},
           min:-30, max:30, grid:{color:'#eaeef2'}, ticks:{color:'#656d76'}},
        y:{title:{display:true,text:'IVB · 수직 라이즈 (cm)',color:'#656d76'},
           min:0, max:65, grid:{color:'#eaeef2'}, ticks:{color:'#656d76'}}
      }
    }
  });

  // Stuff vs Command — 본인 1점 + 팀 다른 선수들 비교
  if(chartsP.rapSC) chartsP.rapSC.destroy();
  const teamSC = PLAYERS.map(pl => {
    const r = DATA[pl.id]?.[1]?.rapsodo?.fb;
    return r ? {x: r.stuff_score, y: r.command_score, label: pl.name, isMe: pl.id === player.id} : null;
  }).filter(Boolean);
  chartsP.rapSC = new Chart(document.getElementById('rap-sc-chart'), {
    type: 'scatter',
    data: {datasets: [
      {label:'팀 동료', data: teamSC.filter(p=>!p.isMe), backgroundColor:'rgba(101,109,118,0.4)', borderColor:'#656d76', pointRadius:4},
      {label:'본인', data: teamSC.filter(p=>p.isMe), backgroundColor:'#0969da', borderColor:'#0969da', pointRadius:10, pointStyle:'rectRot'}
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#1f2328',font:{size:11}}},
        tooltip:{callbacks:{label:c=>{const d=teamSC[c.datasetIndex===0?c.dataIndex:teamSC.findIndex(p=>p.isMe)];return `${d?.label} · S${d?.x} / C${d?.y}`;}}}
      },
      scales:{
        x:{title:{display:true,text:'Stuff Score (구위 →)',color:'#656d76'}, min:0, max:100, grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{title:{display:true,text:'Command Score (제구 →)',color:'#656d76'}, min:0, max:100, grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      }
    }
  });
}

/* v4.0 [5]: Outcome Diagnosis — 체력 한계 vs 메카닉 비효율 자동 진단 */
function renderOutcomeDiagnosis(m, p){
  const wrap = document.getElementById('p-outcome-diagnosis');
  if(!wrap) return;
  const d = m.velocity.diagnosis;
  if(!d){ wrap.innerHTML = ''; return; }

  const aeColor = d.ae_kmh >= 3 ? '#1a7f37' : d.ae_kmh >= -3 ? '#0969da' : '#cf222e';
  const aeBg    = d.ae_kmh >= 3 ? '#dafbe1' : d.ae_kmh >= -3 ? '#ddf4ff' : '#ffebe9';
  const groupColor = (g) => ({미달:'#7e57c2',평균:'#e91e63',우수:'#ff9800',Elite:'#ff6f00'})[g] || '#656d76';

  wrap.innerHTML = `
    <div style="background:linear-gradient(135deg,#fafbfc,#fff);border:2px solid ${aeColor};
                border-radius:8px;padding:14px 16px">
      <h3 style="margin:0 0 10px;font-size:13px;color:${aeColor}">
        📊 [5] 자동 진단 — 체력 ceiling vs 메카닉 효율
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:var(--muted)">실측 구속</div>
          <div style="font-size:18px;font-weight:700">${d.measured_kmh}<span style="font-size:11px;color:var(--muted);font-weight:400"> km/h</span></div>
          <div style="font-size:10px"><span style="background:${groupColor(d.measured_group)};color:#fff;padding:1px 6px;border-radius:3px">${d.measured_group}</span></div>
        </div>
        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:var(--muted)">체력 Predicted</div>
          <div style="font-size:18px;font-weight:700">${d.predicted_kmh}<span style="font-size:11px;color:var(--muted);font-weight:400"> km/h</span></div>
          <div style="font-size:10px"><span style="background:${groupColor(d.predicted_group)};color:#fff;padding:1px 6px;border-radius:3px">${d.predicted_group}</span></div>
        </div>
        <div style="background:${aeBg};border:1px solid ${aeColor};border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:${aeColor}">메카닉 효율 (AE)</div>
          <div style="font-size:18px;font-weight:700;color:${aeColor}">${d.ae_kmh >= 0 ? '+' : ''}${d.ae_kmh}<span style="font-size:11px;font-weight:400"> km/h</span></div>
          <div style="font-size:10px;color:${aeColor};font-weight:600">${d.ae_label}</div>
        </div>
      </div>
      <div style="background:#fff;border-left:4px solid ${aeColor};padding:10px 12px;border-radius:4px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">핵심 진단</div>
        <div style="font-size:13px;font-weight:600;color:${aeColor}">${d.primary_finding}</div>
      </div>
      <div style="background:#f6f8fa;padding:10px 12px;border-radius:4px;font-size:12px;color:var(--text)">
        <b>권장:</b> ${d.recommendation}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:right">
        Predicted Velo = 체력+신체 회귀 baseline / AE = 실측 − Predicted (Driveline HP Assessment 모방)
      </div>
    </div>`;
}

/* v5.0: HP Assessment — 5 체력 변수 × 4 Velo Group 분포 (Driveline HP 5 테스트 + BW 자동 = 6축 호환)
   매뉴얼 v2.0 호환 — Grip 제거 (Driveline HP에 없음), Plyo Push Up 추가 (NEW) */
function renderHPAssessment(m, p){
  const wrap = document.getElementById('p-hp-assessment');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  if(!m.fitness){ wrap.innerHTML = '<div style="color:var(--muted);padding:14px;text-align:center">체력 데이터 미입력 (Theia+GRF 회차에만)</div>'; return; }

  // 5 체력 변수 (5 테스트 대표 1개씩) + 본인 측정값 + Velo Group 4그룹별 평균
  const vars = [
    { key: 'cmj_jh_cm',         label: 'CMJ Jump Height',      unit: 'cm',   value: m.fitness.cmj?.jump_height_cm },
    { key: 'cmj_pp_bm',         label: 'CMJ Peak Power / BM',  unit: 'W/kg', value: m.fitness.cmj?.peak_power_bm_w_kg },
    { key: 'imtp_pf_bm',        label: 'IMTP Peak Force / BM', unit: 'N/kg', value: m.fitness.imtp?.peak_force_bm_n_kg },
    { key: 'hop_rsi',           label: 'Hop Test RSI',         unit: '',     value: m.fitness.pogo?.rsi_ms },
    { key: 'pp_peak_takeoff_bm',label: 'Plyo Push Up Takeoff', unit: 'N/kg', value: m.fitness.pp?.peak_takeoff_force_bm_n_kg },
  ];

  const groups = ['미달', '평균', '우수', 'Elite'];
  const groupColors = { '미달':'#7e57c2', '평균':'#e91e63', '우수':'#ff9800', 'Elite':'#ff6f00' };

  // 본인의 Velo Group
  const myGroup = m.velocity.velo_group || ANALYTICS.veloGroup(m.velocity.measured_kmh);

  let html = `<div style="background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;font-size:11px">
      <span><b>본인 Velo Group:</b>
        <span style="background:${groupColors[myGroup]||'#666'};color:#fff;padding:2px 8px;border-radius:3px;font-weight:600">${myGroup||'—'}</span>
      </span>
      <span style="color:var(--muted)">|  미달 (&lt;128) · 평균 (128-133) · 우수 (133-138) · Elite (138+) km/h</span>
    </div>`;

  // 변수별 분포 막대
  vars.forEach(v => {
    if(v.value == null) return;
    const groupNorms = groups.map(g => ANALYTICS.VELO_GROUP_NORMS[g]?.[v.key] || 0).filter(x => x > 0);
    if(!groupNorms.length) return;
    const maxV = Math.max(...groupNorms, v.value) * 1.15;
    const minV = Math.min(...groupNorms, v.value) * 0.85;
    const range = maxV - minV;

    const myPct = ((v.value - minV) / range) * 100;

    html += `<div style="display:grid;grid-template-columns:160px 1fr 80px;gap:10px;align-items:center;
                          padding:6px 0;border-top:1px dashed #eaeef2;font-size:11.5px">
      <div>
        <div style="font-weight:600">${v.label}</div>
        <div style="font-size:10px;color:var(--muted)">${v.unit}</div>
      </div>
      <div style="position:relative;height:48px;background:linear-gradient(90deg,
                  ${groupColors['미달']}22 0%, ${groupColors['미달']}22 25%,
                  ${groupColors['평균']}22 25%, ${groupColors['평균']}22 50%,
                  ${groupColors['우수']}22 50%, ${groupColors['우수']}22 75%,
                  ${groupColors['Elite']}22 75%, ${groupColors['Elite']}22 100%);
                  border-radius:4px">`;

    // 4 그룹 평균 dot
    groups.forEach((g, gi) => {
      const norm = ANALYTICS.VELO_GROUP_NORMS[g]?.[v.key];
      if(!norm) return;
      const xPct = ((norm - minV) / range) * 100;
      html += `<div style="position:absolute;left:${xPct}%;top:50%;transform:translate(-50%,-50%);
                width:8px;height:8px;background:${groupColors[g]};border-radius:50%;
                border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.2)" title="${g} 평균: ${norm}"></div>
              <div style="position:absolute;left:${xPct}%;bottom:0;transform:translate(-50%,0);
                font-size:8px;color:${groupColors[g]};font-weight:600">${g}</div>`;
    });

    // 본인 vertical line
    html += `<div style="position:absolute;left:${Math.max(0,Math.min(100,myPct))}%;top:0;bottom:0;
              width:3px;background:#0969da;transform:translateX(-50%);box-shadow:0 0 4px rgba(9,105,218,.5)" title="본인 ${v.value}">
            </div>
            <div style="position:absolute;left:${Math.max(0,Math.min(100,myPct))}%;top:-8px;transform:translate(-50%,-100%);
              background:#0969da;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">▼ ${typeof v.value === 'number' ? v.value.toFixed(1) : v.value}</div>`;

    html += `</div>
      <div style="text-align:right;font-weight:700;color:#0969da">
        ${typeof v.value === 'number' ? v.value.toFixed(1) : v.value}<br>
        <span style="font-size:9px;color:var(--muted);font-weight:400">${v.unit}</span>
      </div>
    </div>`;
  });

  html += `<div style="font-size:10px;color:var(--muted);margin-top:10px;padding-top:8px;border-top:1px solid #eaeef2">
    Driveline HP Assessment 모방. 4 그룹 평균값을 점으로, 본인 위치를 ▼ 라인으로 표시.
    각 그룹 평균은 VELO_GROUP_NORMS (analytics.js v4.0) 기반.
  </div></div>`;

  wrap.innerHTML = html;
}

/* v3.5-4: 3-tier 코호트 overlay — 한국 elite vs College vs MLB percentile */
function renderTierOverlay(m, p){
  const wrap = document.getElementById('p-tier-overlay');
  if(!wrap) return;
  if(!m.fitness){ wrap.innerHTML = ''; return; }
  // 비교할 metrics 4개
  const items = [];
  // 1. 구속
  if(m.velocity?.measured_kmh != null && typeof ANALYTICS !== 'undefined'){
    const tier = ANALYTICS.valdMultiTier(m.velocity.measured_kmh, 'pitching', 'velocity_mean_kmh');
    items.push({ label: '평균 구속', value: m.velocity.measured_kmh, unit: 'km/h', tier });
  }
  // 2. CMJ JH
  if(m.fitness.cmj?.jump_height_cm != null && m.fitness.vald_cmj_jh){
    items.push({ label: 'CMJ Jump Height', value: m.fitness.cmj.jump_height_cm, unit: 'cm', tier: m.fitness.vald_cmj_jh });
  }
  // 3. CMJ Conc PP
  if(m.fitness.cmj?.peak_power_bm_w_kg != null && m.fitness.vald_cmj_pp){
    items.push({ label: 'CMJ Peak Power/BM', value: m.fitness.cmj.peak_power_bm_w_kg, unit: 'W/kg', tier: m.fitness.vald_cmj_pp });
  }
  // 4. CMJ RSI-Modified
  if(m.fitness.cmj?.rsi_modified_ms != null && m.fitness.vald_cmj_rsi){
    items.push({ label: 'CMJ RSI-Modified', value: m.fitness.cmj.rsi_modified_ms, unit: 'm/s', tier: m.fitness.vald_cmj_rsi });
  }
  if(items.length === 0){ wrap.innerHTML = ''; return; }

  const tierColors = { kr_hs_elite: '#0969da', college: '#bc4c00', mlb: '#a40e26' };
  const tierLabels = { kr_hs_elite: '🇰🇷 KR Elite', college: '🇺🇸 College', mlb: '🇺🇸 MLB' };

  let html = `<div class="panel" style="background:#fafbfc;padding:14px 16px;margin:0">
    <h3 style="margin:0 0 10px;font-size:13px">3-Tier 코호트 percentile 비교
      <span style="font-size:11px;color:var(--muted);font-weight:400">한국 elite (N=41) · College Baseball · MLB Pro</span>
    </h3>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(items.length, 4)}, 1fr);gap:10px">`;

  items.forEach(it => {
    html += `<div style="background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 10px">
      <div style="font-size:11px;color:var(--muted);margin-bottom:2px">${it.label}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">${it.value} <span style="font-size:10px;color:var(--muted);font-weight:400">${it.unit}</span></div>`;
    ['kr_hs_elite', 'college', 'mlb'].forEach(c => {
      const t = it.tier[c];
      if(!t) return;
      const pct = t.percentile;
      const color = pct >= 75 ? '#1a7f37' : pct >= 50 ? '#0969da' : pct >= 25 ? '#bf8700' : '#cf222e';
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;margin:2px 0">
        <span style="flex:0 0 75px;color:${tierColors[c]}">${tierLabels[c]}</span>
        <div style="flex:1;height:8px;background:#eaeef2;border-radius:4px;position:relative">
          <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100,pct)}%;background:${color};border-radius:4px"></div>
        </div>
        <span style="flex:0 0 38px;text-align:right;color:${color};font-weight:600">${pct}p</span>
      </div>`;
    });
    html += '</div>';
  });

  html += '</div></div>';
  wrap.innerHTML = html;
}

function renderFitnessCards(fit){
  const wrap = document.getElementById('fitness-cards');
  if(!fit){ wrap.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:30px">체력 측정 데이터 없음</div>'; return; }
  const teamCMJ_JH = avg(PLAYERS.map(p=>DATA[p.id][1].fitness?.cmj.jump_height_cm).filter(v=>v!=null));
  const teamIMTP_PF = avg(PLAYERS.map(p=>DATA[p.id][1].fitness?.imtp.peak_force_bm_n_kg).filter(v=>v!=null));
  function bar(val, max){return Math.min(100, (val/max)*100)}
  const eurClass = fit.eur >= 1.10 ? 'good' : fit.eur >= 1.00 ? 'warn' : 'bad';
  const eurLabel = fit.eur >= 1.10 ? '우수 SSC' : fit.eur >= 1.00 ? '정상' : 'SSC 미활용';
  wrap.innerHTML = `
    <div class="fit-card">
      <div class="test-name">CMJ <span style="font-size:11px;color:var(--muted)">Slow SSC</span></div>
      <div class="test-sub">Counter-Movement Jump · 카운터무브 후 폭발</div>
      <div class="var-row"><span class="lbl">Jump Height<span class="star">★★★</span></span><span class="val">${fit.cmj.jump_height_cm} cm</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.cmj.jump_height_cm,55)}%"></div></div>
      <div class="var-row"><span class="lbl">Peak Power / BM<span class="star">★★★</span></span><span class="val">${fit.cmj.peak_power_bm_w_kg} W/kg</span></div>
      <div class="var-row"><span class="lbl">RSI-mod<span class="star">★★</span></span><span class="val">${fit.cmj.rsi_modified_ms} m/s</span></div>
      <div class="var-row"><span class="lbl">Conc PF / BM<span class="star">★★</span></span><span class="val">${fit.cmj.conc_peak_force_bm_n_kg} N/kg</span></div>
      <div class="var-row"><span class="lbl">Ecc:Conc Ratio<span class="star">★</span></span><span class="val">${fit.cmj.ecc_conc_force_ratio}</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        팀 평균 JH: ${fmt(teamCMJ_JH,1)} cm
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">SJ <span style="font-size:11px;color:var(--muted)">Pure Concentric</span></div>
      <div class="test-sub">Squat Jump · 90° hold 후 폭발 (SSC 없음)</div>
      <div class="var-row"><span class="lbl">Jump Height<span class="star">★★</span></span><span class="val">${fit.sj.jump_height_cm} cm</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.sj.jump_height_cm,50)}%;background:#1a7f37"></div></div>
      <div class="var-row"><span class="lbl">Peak Power / BM<span class="star">★★</span></span><span class="val">${fit.sj.peak_power_bm_w_kg} W/kg</span></div>
      <div class="var-row"><span class="lbl">Conc PF / BM<span class="star">★★</span></span><span class="val">${fit.sj.conc_peak_force_bm_n_kg} N/kg</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft)">
        <div class="var-row"><span class="lbl"><b>EUR (CMJ JH / SJ JH)<span class="star">★★</span></b></span>
          <span class="val">${fit.eur} <span class="pill ${eurClass}">${eurLabel}</span></span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">McGuigan 2018 · &gt;1.10 우수 / 1.00~1.10 정상 / &lt;1.00 미활용</div>
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">Pogo <span style="font-size:11px;color:var(--muted)">Fast SSC</span></div>
      <div class="test-sub">Repeated Hops · 발목·아킬레스 stiffness</div>
      <div class="var-row"><span class="lbl">RSI<span class="star">★★★</span></span><span class="val">${fit.pogo.rsi_ms} m/s</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.pogo.rsi_ms,3.0)}%;background:#bc4c00"></div></div>
      <div class="var-row"><span class="lbl">Mean Contact Time<span class="star">★★</span></span><span class="val">${fit.pogo.mean_contact_time_ms} ms</span></div>
      <div class="var-row"><span class="lbl">Mean JH<span class="star">★★</span></span><span class="val">${fit.pogo.mean_jump_height_cm} cm</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        Flanagan & Comyns 2008 · fast SSC 표준 — 투수 FC reactive와 매칭
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">IMTP <span style="font-size:11px;color:var(--muted)">Isometric</span></div>
      <div class="test-sub">Isometric Mid-Thigh Pull · 최대 정적 힘 + RFD</div>
      <div class="var-row"><span class="lbl">Peak Force<span class="star">★★★</span></span><span class="val">${fit.imtp.peak_force_n} N</span></div>
      <div class="var-row"><span class="lbl">Peak Force / BM<span class="star">★★★</span></span><span class="val">${fit.imtp.peak_force_bm_n_kg} N/kg</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.imtp.peak_force_bm_n_kg,32)}%;background:#cf222e"></div></div>
      <div class="var-row"><span class="lbl">RFD 0-100ms<span class="star">★★</span></span><span class="val">${fit.imtp.rfd_0_100ms_n_s} N/s</span></div>
      <div class="var-row"><span class="lbl">Force at 100ms / BM<span class="star">★★</span></span><span class="val">${fit.imtp.force_at_100ms_bm_n_kg} N/kg</span></div>
      <div class="var-row"><span class="lbl">Asymmetry<span class="star">★★</span></span>
        <span class="val ${fit.imtp.asymmetry_pct>5?'':'good'}">${fit.imtp.asymmetry_pct}%
        <span class="pill ${fit.imtp.asymmetry_pct<5?'good':fit.imtp.asymmetry_pct<10?'warn':'bad'}">${fit.imtp.asymmetry_pct<5?'정상':fit.imtp.asymmetry_pct<10?'경계':'위험'}</span></span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        팀 평균 PF/BM: ${fmt(teamIMTP_PF,1)} N/kg · Lehman 2013 · pitching velocity와 r≈0.30~0.40
      </div>
    </div>
  `;
}

