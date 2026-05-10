/* ╔══════════════════════════════════════════════════════════╗
   ║  8. Theia+GRF 결과 JSON 인입 (v1.2)                          ║
   ╚══════════════════════════════════════════════════════════╝ */

// 어떤 (선수, 세션) 셀이 실측 데이터인지 추적 — 헤더 상태 + 향후 시각 구분에 사용
const REAL_DATA_KEYS = new Set();   // "P01:1" 형식

function parseTheiaJson(obj){
  // 단일 형식 또는 배치 형식 모두 → 표준 [{pid, sid, body}, ...]로 정규화
  const out = [];
  if(Array.isArray(obj)){
    obj.forEach(o => out.push(...parseTheiaJson(o)));
    return out;
  }
  if(obj.results && Array.isArray(obj.results)){           // 배치 형식
    const sid = obj.session?.id;
    const date = obj.session?.date;
    const proto = obj.session?.protocol;
    obj.results.forEach(r => {
      out.push({
        pid: r.athlete_external_id,
        sid: r.session_id ?? sid,
        body: {...r, test_date: r.test_date ?? date, protocol: r.protocol ?? proto}
      });
    });
    return out;
  }
  if(obj.athlete_external_id && obj.session_id){           // 단일 형식
    out.push({pid: obj.athlete_external_id, sid: obj.session_id, body: obj});
  }
  return out;
}

function validateRecord(rec){
  const errs = [];
  if(!rec.pid) errs.push('athlete_external_id 누락');
  if(rec.sid==null) errs.push('session_id 누락');
  if(rec.pid && !PLAYERS.find(p=>p.id===rec.pid)) errs.push(`PLAYERS에 ${rec.pid} 없음 (선수 명단 먼저 추가 필요)`);
  if(rec.sid && !SESSIONS.find(s=>s.id===rec.sid)) errs.push(`SESSIONS에 id ${rec.sid} 없음 (1·2·3·4만 가능)`);
  return errs;
}

function applyTheiaRecord(rec){
  const b = rec.body;
  const session = SESSIONS.find(s=>s.id===rec.sid);
  // 기존 DATA[pid][sid]를 덮어쓰되, 누락된 섹션은 기존값 유지
  const cur = DATA[rec.pid][rec.sid] || {};
  const merged = {
    ...cur,
    protocol: b.protocol ?? session.protocol,
    date: b.test_date ?? session.date,
    velocity: b.velocity ? {...cur.velocity, ...b.velocity} : cur.velocity,
    sequence: b.sequence ? {...cur.sequence, ...b.sequence} : cur.sequence,
    energy:   b.energy   ? mergeEnergy(cur.energy, b.energy) : cur.energy,
    grf:      b.grf      ? {...(cur.grf||{}), ...b.grf}      : cur.grf,
    faults:   b.faults   ? {...cur.faults, ...b.faults}   : cur.faults,
    fitness:  b.fitness  ? mergeFitness(cur.fitness, b.fitness) : cur.fitness,
  };
  // analytics.js — 실측 데이터를 통계 모듈로 재계산
  enrichWithAnalytics(merged);
  DATA[rec.pid][rec.sid] = merged;
  REAL_DATA_KEYS.add(`${rec.pid}:${rec.sid}`);
}

/**
 * 실측 데이터에 analytics.js 적용 — 잠재구속 + ELI 자동 재계산
 * (potential_kmh / ELI score가 명시된 경우에만 덮어쓰지 않음)
 */
function enrichWithAnalytics(m){
  if(typeof ANALYTICS === 'undefined') return;
  // 1) 잠재구속 — 측정 구속 + 가용한 biomechanics 변수 (학년별 임계치 적용 v3.0)
  const v = m.velocity;
  // 선수 학년 찾기 (PLAYERS lookup) — pid 추적
  const pid = Object.keys(DATA).find(k => DATA[k][m.sid] === m || Object.values(DATA[k]).includes(m));
  const grade = pid ? PLAYERS.find(p => p.id === pid)?.grade : null;
  if(v && v.measured_kmh != null){
    const bio = {
      trunk_peak_dps:     m.sequence?.trunk_dps,
      pelvis_peak_dps:    m.sequence?.pelvis_dps,
      shoulder_er_deg:    m.faults?.shoulder_er_max_deg,
      stride_pct_height:  m.faults?.stride_pct_height,
      front_grf_bm:       m.grf?.lead_force_bm
    };
    const fit = {
      cmj_pp_bm:  m.fitness?.cmj?.peak_power_bm_w_kg,
      imtp_pf_bm: m.fitness?.imtp?.peak_force_bm_n_kg
    };
    const lat = ANALYTICS.latentVelocity(v.measured_kmh, bio, fit, grade);
    if(lat.potential_kmh != null){
      v.potential_kmh = lat.potential_kmh;
      v.gap_kmh       = lat.gap_kmh;
      v.contributions = lat.contributions;
      v.model         = lat.model;
    }
  }
  // v3.0-B 제구 통합 (Theia + Rapsodo)
  if(m.faults){
    const cc = ANALYTICS.commandComposite({
      release_height_sd_cm: m.faults.release_height_sd_cm,
      wrist_pos_sd_cm:      m.faults.wrist_pos_sd_cm,
      trunk_tilt_sd_deg:    m.faults.trunk_tilt_sd_deg
    }, m.rapsodo?.fastball || {});
    if(cc.composite != null){
      m.faults.command_composite = cc.composite;
      m.faults.command_theia     = cc.theia_score;
      m.faults.command_rapsodo   = cc.rapsodo_score;
      m.faults.command_agreement = cc.agreement;
      m.faults.command_warnings  = cc.warnings;
    }
  }
  // v3.2 fitness — 학년 percentile + VALD College Baseball percentile + composite
  if(m.fitness && grade){
    const cmjPctl  = ANALYTICS.gradePercentile(m.fitness.cmj?.peak_power_bm_w_kg, grade, 'cmj_pp_bm');
    const imtpPctl = ANALYTICS.gradePercentile(m.fitness.imtp?.peak_force_bm_n_kg, grade, 'imtp_pf_bm');
    const cmjVald  = ANALYTICS.valdMultiTier(m.fitness.cmj?.peak_power_bm_w_kg, 'cmj', 'conc_pp_bm');
    const cmjJhVald = ANALYTICS.valdMultiTier(m.fitness.cmj?.jump_height_cm, 'cmj', 'jump_height_cm');
    const cmjRsiVald = ANALYTICS.valdMultiTier(m.fitness.cmj?.rsi_modified_ms, 'cmj', 'rsi_modified');
    const asym = m.fitness.imtp?.asymmetry_pct;
    const asymScore = asym != null ? Math.max(0, Math.min(100, 100 - Math.max(0, asym - 5) * 8)) : null;
    // v3.5-2: 추가 fitness 변수 percentile (RSI-Mod, Pogo, IMTP RFD)
    const rsiModP = ANALYTICS.valdPercentile(m.fitness.cmj?.rsi_modified_ms, 'cmj', 'rsi_modified', 'mlb');
    const pogoRsiP = m.fitness.pogo?.rsi_ms != null ? ANALYTICS.valdPercentile(m.fitness.pogo.rsi_ms, 'hop', 'best_rsi', 'mlb') : null;
    const imtpRfdP = m.fitness.imtp?.rfd_0_100ms_n_s != null ? ANALYTICS.valdPercentile(m.fitness.imtp.rfd_0_100ms_n_s, 'squat_jump', 'conc_rfd', 'college') : null;
    const cs = ANALYTICS.compositeScore(ANALYTICS.COMPOSITE_WEIGHTS.fitness, {
      cmj_pp:        cmjPctl?.percentile,
      imtp_pf:       imtpPctl?.percentile,
      rsi_modified:  rsiModP?.percentile,
      pogo_rsi:      pogoRsiP?.percentile,
      imtp_rfd:      imtpRfdP?.percentile,
      asymmetry:     asymScore
    });
    if(cs.score != null){
      m.fitness.score = cs.score;
      m.fitness.score_breakdown = cs.breakdown;
      m.fitness.cmj_pctl_in_grade  = cmjPctl?.percentile ?? null;
      m.fitness.imtp_pctl_in_grade = imtpPctl?.percentile ?? null;
      m.fitness.vald_cmj_pp        = cmjVald;
      m.fitness.vald_cmj_jh        = cmjJhVald;
      m.fitness.vald_cmj_rsi       = cmjRsiVald;
    }
  }
  // v3.2 부상위험도 — 정식 산출
  if(m.faults && (m.faults.x_factor_deg != null || m.faults.lead_knee_change != null)){
    const ir = ANALYTICS.injuryRisk({
      x_factor_max_deg:        m.faults.x_factor_deg,
      lead_knee_change_deg:    m.faults.lead_knee_change,
      trunk_lat_tilt_deg:      m.faults.trunk_lat_tilt_deg,
      pelvis_to_trunk_lag_ms:  m.energy?.transfer?.pelvis_to_trunk_lag_ms,
      shoulder_er_max_deg:     m.faults.shoulder_er_max_deg,
      imtp_asymmetry_pct:      m.fitness?.imtp?.asymmetry_pct
    });
    m.faults.injury_risk = ir.risk_level;
    m.faults.injury_score = ir.risk_score;
    m.faults.injury_contributors = ir.contributors;
    m.faults.injury_recommendations = ir.recommendations;
  }
  // v5.5: 힘 전달 점수 재계산 — kinematic + kinetic ETE (mech_energy_pelvis_J / humerus_J 사용)
  if(m.energy?.transfer && m.energy?.generation && ANALYTICS.transferScoreV2){
    const tsv2 = ANALYTICS.transferScoreV2({
      ete_pct:               m.energy.transfer.ete_pct,
      speed_gain_pt:         m.energy.transfer.speed_gain_pt,
      speed_gain_ta:         m.energy.transfer.speed_gain_ta,
      mech_energy_pelvis_J:  m.energy.generation.mech_energy_pelvis_J,
      mech_energy_trunk_J:   m.energy.generation.mech_energy_trunk_J,
      mech_energy_humerus_J: m.energy.generation.mech_energy_humerus_J
    });
    if(tsv2.score != null){
      m.energy.transfer.score                       = tsv2.score;
      m.energy.transfer.score_kinematic             = tsv2.kinematic;
      m.energy.transfer.score_kinetic_ete           = tsv2.kinetic_ete;
      m.energy.transfer.ratio_humerus_to_pelvis_pct = tsv2.ratio_humerus_to_pelvis_pct;
      m.energy.transfer.basis                       = tsv2.basis;
    }
  }

  // 2) ELI — Theia+GRF 회차에만 (필요 변수가 있을 때)
  if(m.protocol === 'Theia+GRF' && m.energy && m.faults){
    const elInput = {
      pelvis_to_trunk_lag_ms: m.energy.transfer?.pelvis_to_trunk_lag_ms,
      trunk_to_arm_lag_ms:    m.energy.transfer?.trunk_to_arm_lag_ms,
      x_factor_max_deg:       m.faults.x_factor_deg,
      lead_knee_change_deg:   m.faults.lead_knee_change,
      trunk_tilt_at_fc_deg:   m.faults.trunk_tilt_at_fc_deg,
      trunk_lat_tilt_deg:     m.faults.trunk_lat_tilt_deg,
      shoulder_er_max_deg:    m.faults.shoulder_er_max_deg,
      pelvis_brake_ratio:     m.faults.pelvis_brake_ratio
    };
    // 핵심 입력이 1개 이상 있을 때만 재계산 (전부 null 이면 기존 leakage 유지)
    const hasInput = Object.values(elInput).some(x => x != null);
    if(hasInput){
      const eli = ANALYTICS.eliScoresFromTheia(elInput);
      // 기존 leakage 가 있으면 부분 갱신 (수동 입력 보존)
      m.energy.leakage = { ...(m.energy.leakage || {}), ...eli };
    }
  }
}
function mergeFitness(cur, n){
  if(!cur) return n;
  return {
    cmj:  n.cmj  ? {...cur.cmj,  ...n.cmj}  : cur.cmj,
    sj:   n.sj   ? {...cur.sj,   ...n.sj}   : cur.sj,
    eur:  n.eur  ?? cur.eur,
    pogo: n.pogo ? {...cur.pogo, ...n.pogo} : cur.pogo,
    imtp: n.imtp ? {...cur.imtp, ...n.imtp} : cur.imtp,
    score: n.score ?? cur.score
  };
}
function mergeEnergy(cur, n){
  if(!cur) return n;
  return {
    generation: n.generation ? {...cur.generation, ...n.generation} : cur.generation,
    transfer:   n.transfer   ? {...cur.transfer,   ...n.transfer}   : cur.transfer,
    leakage:    n.leakage    ? {...(cur.leakage||{}), ...n.leakage} : cur.leakage,
  };
}

function refreshAllAfterImport(){
  renderM1KPI(); renderProgressGrid(); buildM1Table();
  renderM1Heatmap(); renderM1Charts();
  renderPlayerView(document.getElementById('player-select').value);
  renderRoster();
  // 장기 추적 탭 비교 분석도 갱신 (탭이 active 아니어도 갱신해 두기)
  if(document.getElementById('hc-metric')) renderHalfComparison();
  // localStorage에 자동 저장
  if(typeof saveToStorage === 'function') saveToStorage();
  // 데이터 상태 헤더 갱신
  const realCount = REAL_DATA_KEYS.size;
  const total = PLAYERS.length * SESSIONS.length;
  const el = document.getElementById('data-status');
  if(realCount === 0){
    el.textContent = '샘플 데이터 (실측 데이터 미입력)';
    el.style.color = 'var(--muted)';
  } else {
    el.innerHTML = `실측 ${realCount}/${total} 셀 + 샘플 ${total-realCount}`;
    el.style.color = 'var(--good)';
  }
}

async function handleJsonFiles(fileList){
  const result = document.getElementById('theia-json-result');
  const all = [];
  const messages = [];

  // v5.1: c3d.txt 원본과 가공 JSON 분리 처리 (사용자가 raw 끌어놓는 경우 graceful)
  const c3dFiles  = [...fileList].filter(f => /\.c3d\.txt$/i.test(f.name));
  const jsonFiles = [...fileList].filter(f => !/\.c3d\.txt$/i.test(f.name));

  if(c3dFiles.length){
    const cr = await handleC3DTxtFiles(c3dFiles);
    messages.push(...cr.messages);
    all.push(...cr.applied);
  }

  for(const file of jsonFiles){
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const recs = parseTheiaJson(obj);
      if(!recs.length){ messages.push(`⚠ ${file.name}: 인식 가능한 레코드 없음`); continue; }
      let ok = 0;
      recs.forEach(rec => {
        const errs = validateRecord(rec);
        if(errs.length){ messages.push(`✗ ${file.name} [${rec.pid||'?'} · S${rec.sid||'?'}]: ${errs.join(', ')}`); }
        else { applyTheiaRecord(rec); ok++; all.push(rec); }
      });
      if(ok) messages.push(`✓ ${file.name}: ${ok}개 레코드 적용`);
    } catch(e){
      messages.push(`✗ ${file.name}: JSON 파싱 실패 — ${e.message}`);
    }
  }
  if(all.length) refreshAllAfterImport();
  result.innerHTML = messages.map(m=>{
    const cls = m.startsWith('✓') ? 'good' : m.startsWith('⚠') ? 'warn' : m.startsWith('  ') ? '' : 'bad';
    return cls
      ? `<div class="pill ${cls}" style="display:block;padding:6px 10px;margin:3px 0;font-weight:500">${m}</div>`
      : `<div style="padding:2px 18px;color:var(--muted);font-size:11px">${m}</div>`;
  }).join('');
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  8a. v5.1 — Visual3D ASCII (.c3d.txt) 인-브라우저 파서        ║
   ║      process_pitching_session.py를 거치지 않고 바로 인식       ║
   ╚══════════════════════════════════════════════════════════╝ */

// 단일 c3d.txt → trial summary dict
function parseC3DTxtTrial(text){
  const lines = text.split(/\r?\n/);
  if(lines.length < 6) return {error: '파일 줄 수 부족 (<6)'};

  const var_names  = lines[1].split('\t');
  const components = lines[4].split('\t');
  const colMap = {};
  for(let i = 0; i < var_names.length; i++){
    const n = (var_names[i] || '').trim();
    const c = (components[i] || '').trim();
    if(n){
      const key = c ? `${n}_${c}` : n;
      if(!(key in colMap)) colMap[key] = i;
    }
  }

  const dataRows = [];
  for(let i = 5; i < lines.length; i++){
    if(!lines[i].trim()) continue;
    dataRows.push(lines[i].split('\t'));
  }
  if(!dataRows.length) return {error: '데이터 행 없음'};

  const safeFloat = v => { const n = parseFloat(String(v).trim()); return isNaN(n) ? null : n; };
  const colByName = name => {
    const idx = colMap[name];
    if(idx === undefined) return [];
    return dataRows.map(r => idx < r.length ? safeFloat(r[idx]) : null);
  };
  const safeMaxAbs = arr => {
    let m = null;
    for(const x of arr){ if(x !== null){ const a = Math.abs(x); if(m === null || a > m) m = a; } }
    return m;
  };
  // v5.7: EVENT_LABEL = 발생 시각(초)을 frame=0에 저장하는 sparse 형식
  // component 자동 시도 + TIME 컬럼과 매칭해 frame index로 변환
  const findEventFrame = name => {
    let idx;
    for(const cand of [name, name+'_X', name+'_0', name+'_ITEM']){
      if(cand in colMap){ idx = colMap[cand]; break; }
    }
    if(idx === undefined) return null;
    // 1) 첫 번째 0이 아닌 값 = 이벤트 시각(초)
    let eventTimeSec = null;
    for(const r of dataRows){
      if(idx < r.length){
        const v = safeFloat(r[idx]);
        if(v !== null && v !== 0){ eventTimeSec = v; break; }
      }
    }
    if(eventTimeSec === null) return null;
    // 2) TIME 컬럼 가장 가까운 frame
    const timeArr = colByName('TIME_X').length ? colByName('TIME_X')
                  : colByName('TIME').length   ? colByName('TIME')
                  : colByName('TIME_0');
    if(timeArr.length){
      let bestI = null, bestDiff = Infinity;
      for(let i = 0; i < timeArr.length; i++){
        if(timeArr[i] === null) continue;
        const d = Math.abs(timeArr[i] - eventTimeSec);
        if(d < bestDiff){ bestDiff = d; bestI = i; }
      }
      return bestI;
    }
    // TIME 없으면 240Hz fallback
    return Math.round(eventTimeSec * 240);
  };

  // v5.7: Theia 마커리스 골반 추적 jerk noise 완화 — FC~BR 분석 구간 제한
  // Naito (2014), Werner (2008) 표준. event 없으면 전체 구간 fallback
  const fcEvent = findEventFrame('Footstrike');
  const brEvent = findEventFrame('Release');
  let winStart = 0, winEnd = dataRows.length;
  if(fcEvent !== null && brEvent !== null && brEvent > fcEvent){
    winStart = Math.max(0, fcEvent - 5);
    winEnd   = Math.min(dataRows.length, brEvent + 10);
  }
  const colByNameWindow = name => {
    const arr = colByName(name);
    return arr.length ? arr.slice(winStart, winEnd) : [];
  };
  // v5.24: frame-specific 추출 (Driveline의 "at FP/MER/BR")
  const valueAtFrame = (name, frameIdx) => {
    if(frameIdx === null || frameIdx === undefined) return null;
    const arr = colByName(name);
    if(!arr.length || frameIdx >= arr.length) return null;
    return arr[frameIdx];
  };
  // MER frame 찾기 (max external rotation)
  let merFrame = null;
  {
    const arr = colByName('Pitching_Shoulder_Angle_Z');
    if(arr.length){
      const sub = arr.slice(winStart, winEnd);
      let maxAbs = -1, maxI = null;
      for(let i = 0; i < sub.length; i++){
        if(sub[i] === null) continue;
        if(Math.abs(sub[i]) > maxAbs){ maxAbs = Math.abs(sub[i]); maxI = i; }
      }
      merFrame = maxI !== null ? winStart + maxI : null;
    }
  }
  // v5.25: CoG metrics (COM_displacement_Y = mound 방향, 전후방 시계열 미분)
  // Theia 좌표계: X=lateral, Y=anterior-posterior(mound), Z=vertical
  let maxCogVelo = null, cogDecel = null;
  {
    const comY = colByNameWindow('COM_displacement_Y');
    const timeArr = colByNameWindow('TIME_X') || colByNameWindow('TIME');
    if(comY.length >= 5 && timeArr.length >= 5){
      const velos = [];
      for(let i = 1; i < comY.length - 1; i++){
        if(comY[i+1] === null || comY[i-1] === null) continue;
        if(timeArr[i+1] === null || timeArr[i-1] === null) continue;
        const dt = timeArr[i+1] - timeArr[i-1];
        if(dt <= 0) continue;
        velos.push((comY[i+1] - comY[i-1]) / dt);
      }
      if(velos.length){
        maxCogVelo = Math.max(...velos.map(v => Math.abs(v)));
        const maxIdx = velos.findIndex(v => Math.abs(v) === maxCogVelo);
        if(maxIdx !== -1 && maxIdx < velos.length - 1){
          const after = velos.slice(maxIdx);
          const minAfter = Math.min(...after);
          cogDecel = Math.abs(maxCogVelo - minAfter);
        }
      }
    }
  }

  const fp1z = safeMaxAbs(colByNameWindow('FP1_Z'));
  const fp2z = safeMaxAbs(colByNameWindow('FP2_Z'));
  const humZ = safeMaxAbs(colByNameWindow('Pitching_Humerus_Ang_Vel_Z'));

  return {
    n_frames:        dataRows.length,
    analysis_window: [winStart, winEnd],   // v5.7 디버그용
    fc_frame:        fcEvent,
    br_frame:        brEvent,
    peak_pelvis_v:   safeMaxAbs(colByNameWindow('Pelvis_Ang_Vel_Z')),
    peak_trunk_v:    safeMaxAbs(colByNameWindow('Thorax_Ang_Vel_Z')),
    // v5.8: peak_arm_v도 -490 bias 보정 (Theia humerus_z bias, 프로/대학 cohort 검증)
    peak_humerus_v:  humZ != null ? humZ - 490 : null,
    peak_arm_v:      humZ != null ? humZ - 490 : null,
    peak_shoulder_v: safeMaxAbs(colByNameWindow('Pitching_Shoulder_Ang_Vel_Z')),
    peak_elbow_v:    safeMaxAbs(colByNameWindow('Pitching_Elbow_Ang_Vel_X')),
    max_x_factor:    safeMaxAbs(colByNameWindow('Trunk_wrt_Pelvis_Angle_Z')),
    fp1_z_peak:      fp1z,
    fp2_z_peak:      fp2z,
    // v5.10: STRIDE_LENGTH는 single-value sparse (event-like) → window 무관 전체 frame
    stride_length:   safeMaxAbs(colByName('STRIDE_LENGTH_X')),
    stride_pct:      safeMaxAbs(colByName('STRIDE_LENGTH_MEAN_PERCENT_X')),
    lead_knee_max:   safeMaxAbs(colByNameWindow('Lead_Knee_Angle_X')),
    trunk_lateral_tilt: safeMaxAbs(colByNameWindow('Trunk_Angle_Y')),
    trunk_forward_tilt: safeMaxAbs(colByNameWindow('Trunk_Angle_X')),
    // v5.6 + v5.7: Joint Power Scalar 8 (W) · FC~BR 구간만
    pow_r_shoulder:  safeMaxAbs(colByNameWindow('R_Shoulder_Power_Scalar_X')),
    pow_l_shoulder:  safeMaxAbs(colByNameWindow('L_Shoulder_Power_Scalar_X')),
    pow_r_elbow:     safeMaxAbs(colByNameWindow('R_Elbow_Power_Scalar_X')),
    pow_l_elbow:     safeMaxAbs(colByNameWindow('L_Elbow_Power_Scalar_X')),
    pow_r_hip:       safeMaxAbs(colByNameWindow('R_Hip_Power_Scalar_X')),
    pow_l_hip:       safeMaxAbs(colByNameWindow('L_Hip_Power_Scalar_X')),
    pow_r_knee:      safeMaxAbs(colByNameWindow('R_Knee_Power_Scalar_X')),
    pow_l_knee:      safeMaxAbs(colByNameWindow('L_Knee_Power_Scalar_X')),
    // v5.6 + v5.7: Mechanical Energy 3 (J) · FC~BR 구간만
    pelvis_me_peak:  safeMaxAbs(colByNameWindow('Pelvis_Mechanical_Energy_X')),
    trunk_me_peak:   safeMaxAbs(colByNameWindow('Trunk_Mechanical_Energy_X')),
    humerus_me_peak: safeMaxAbs(colByNameWindow('R_Humerus_ME_X')),
    // v5.24: Driveline 5 모델 frame-specific 변인
    mer_frame:              merFrame,
    layback_deg:            safeMaxAbs(colByNameWindow('Pitching_Shoulder_Angle_Z')),
    shoulder_abd_at_fp:     valueAtFrame('Pitching_Shoulder_Angle_Y', fcEvent),
    elbow_flex_at_fp:       valueAtFrame('Pitching_Elbow_Angle_X', fcEvent),
    hip_shoulder_sep_at_fp: valueAtFrame('Trunk_wrt_Pelvis_Angle_Z', fcEvent),
    torso_counter_rot:      (() => { const arr = colByNameWindow('Trunk_wrt_Pelvis_Angle_Z').filter(v => v !== null); return arr.length ? Math.min(...arr) : null; })(),
    torso_fwd_tilt_at_fp:   valueAtFrame('Trunk_Angle_X', fcEvent),
    torso_rot_at_fp:        valueAtFrame('Trunk_Angle_Z', fcEvent),
    torso_side_bend_at_mer: valueAtFrame('Trunk_Angle_Y', merFrame),
    torso_rot_at_br:        valueAtFrame('Trunk_Angle_Z', brEvent),
    lead_knee_at_fp:        valueAtFrame('Lead_Knee_Angle_X', fcEvent),
    lead_knee_at_br:        valueAtFrame('Lead_Knee_Angle_X', brEvent),
    max_cog_velo_m_s:       maxCogVelo,
    cog_decel_m_s:          cogDecel
  };
}

// trials 배열 → DATA[pid][sid] body (process_pitching_session.py synthesize_player_summary 포팅)
function synthesizeRecordFromTrials(pid, trials, sid){
  const median = (arr, lo, hi, fb) => {
    const vs = arr.filter(v => v != null && (lo == null || v >= lo) && (hi == null || v <= hi))
                  .sort((a, b) => a - b);
    return vs.length ? vs[Math.floor(vs.length / 2)] : fb;
  };
  const norm = (v, base, mult) => Math.max(20, Math.min(98, 50 + (v - base) * mult));

  // v5.8: cohort 검증 후 임계 확대
  //   peak_arm_v는 humerus_z(-490 보정)이라 한국 고1 + 프로/대학 cohort에서 4000-5500 범위
  //   기존 1500-2200은 다른 정의(humerus_z 평면 회전 등) 가정이라 깎임 → 2500-7000으로 확대
  const peakPelvis = median(trials.map(t => t.peak_pelvis_v),  200, 1300, 600);
  const peakTrunk  = median(trials.map(t => t.peak_trunk_v),   600, 1300, 900);
  const peakArm    = median(trials.map(t => t.peak_arm_v),    2500, 7000, 4500);
  const xFactor    = median(trials.map(t => t.max_x_factor),  30, 180, 50);
  const fp1Peak    = median(trials.map(t => t.fp1_z_peak),    500, 2000, 1100);
  const fp2Peak    = median(trials.map(t => t.fp2_z_peak),    500, 1500, 750);

  // v5.6: Joint Power Scalar 8개 + Mechanical Energy 3개 — 실측 c3d.txt에서
  const powRSho = median(trials.map(t => t.pow_r_shoulder),  50,  5000, 800);
  const powLSho = median(trials.map(t => t.pow_l_shoulder),  10,  5000, 100);
  const powREl  = median(trials.map(t => t.pow_r_elbow),    100,  12000, 1800);
  const powLEl  = median(trials.map(t => t.pow_l_elbow),     10,  12000, 100);
  const powRHi  = median(trials.map(t => t.pow_r_hip),       50,  5000, 600);
  const powLHi  = median(trials.map(t => t.pow_l_hip),       50,  5000, 600);
  const powRKn  = median(trials.map(t => t.pow_r_knee),      50,  5000, 700);
  const powLKn  = median(trials.map(t => t.pow_l_knee),      50,  5000, 700);
  let pelvisJ  = median(trials.map(t => t.pelvis_me_peak),  10, 1500, null);
  let trunkJ   = median(trials.map(t => t.trunk_me_peak),   10, 1500, null);
  let humerusJ = median(trials.map(t => t.humerus_me_peak), 10, 1500, null);
  let meBasis  = (pelvisJ != null && humerusJ != null) ? 'V3D' : null;

  const player = PLAYERS.find(p => p.id === pid);
  const weight = player?.weight || 91;
  const heightM = (player?.height || 180) / 100;

  // v5.8: V3D ME가 비어 있으면 De Leva 자체 계산 (KE_rot)
  // 학술적 일관성: V3D ME는 KE_total 정의가 모호 → KE_rot proxy로 통일 비교 가능
  if(typeof ANALYTICS !== 'undefined' && ANALYTICS.selfCalcSegmentKE){
    if(pelvisJ == null){
      pelvisJ = ANALYTICS.selfCalcSegmentKE('pelvis', weight, heightM, peakPelvis);
      meBasis = 'self_calc_KE_rot';
    }
    if(trunkJ == null){
      trunkJ  = ANALYTICS.selfCalcSegmentKE('trunk', weight, heightM, peakTrunk);
    }
    if(humerusJ == null){
      humerusJ = ANALYTICS.selfCalcSegmentKE('humerus', weight, heightM, peakArm);
      meBasis = meBasis ?? 'self_calc_KE_rot';
    }
  }

  const genScore = Math.round(norm(peakArm, 1900, 0.05)*0.3 + norm(800, 800, 0.04)*0.3
                  + norm(peakTrunk, 850, 0.04)*0.2 + norm(400, 350, 0.05)*0.2);
  const speedGainPt = Math.round((peakTrunk / peakPelvis) * 100) / 100;
  const speedGainTa = Math.round((peakArm / peakTrunk) * 100) / 100;
  const etePct = 80;
  // v5.6 + v5.8: power-based ETE — V3D ME 우선, 없으면 self-calc KE_rot (de Leva 1996)
  const tsv2 = (typeof ANALYTICS !== 'undefined' && ANALYTICS.transferScoreV2)
    ? ANALYTICS.transferScoreV2({
        ete_pct: etePct, speed_gain_pt: speedGainPt, speed_gain_ta: speedGainTa,
        mech_energy_pelvis_J:  pelvisJ,
        mech_energy_trunk_J:   trunkJ,
        mech_energy_humerus_J: humerusJ,
        me_basis: meBasis || 'V3D'
      })
    : null;
  const trfScore = tsv2?.score ?? Math.round(
    norm(etePct, 75, 1.5)*0.4 + norm(speedGainPt*100, 150, 0.4)*0.3
    + norm(speedGainTa*100, 200, 0.3)*0.3);

  const zones = [
    ['zone1','골반→몸통→팔 시퀀스', '분절 가속 순서 결함', 88],
    ['zone2','골반-상체 분리 (X-팩터)', 'X-factor 미달', Math.round(norm(xFactor, 60, 1.0))],
    ['zone3','앞발 받쳐주기 (블로킹)', 'Lead knee collapse', Math.round(norm(fp2Peak/weight*100, 110, 0.4))],
    ['zone4','앞발 착지 시 몸통 자세', 'FC 시 트렁크 기울기 부적절', 78],
    ['zone5','어깨 정렬 (외전·외회전)', 'Shoulder alignment 결함', 84],
    ['zone6','골반 감속 (브레이크)', 'Pelvis braking 부족', 72]
  ];
  const eliScore = Math.round(zones.reduce((a, z) => a + z[3], 0) / 6);
  const causal = [...zones].sort((a, b) => a[3] - b[3]).slice(0, 3).map(z => ({
    zone: z[0], zone_label: z[1], defect: z[2],
    impact_kmh: Math.round((-((100 - z[3]) / 12 + 0.4)) * 10) / 10
  }));

  const sessionMeta = SESSIONS.find(s => s.id === sid) || {date: '2026-05-15', protocol: 'Theia+GRF'};

  return {
    athlete_external_id: pid,
    session_id: sid,
    test_date: sessionMeta.date,
    protocol: 'Theia+GRF',
    sequence: {
      pelvis_dps: Math.round(peakPelvis),
      trunk_dps:  Math.round(peakTrunk),
      arm_dps:    Math.round(peakArm),
      ete_pct: etePct, speed_gain: speedGainPt,
      proper_seq: true, score: trfScore
    },
    energy: {
      generation: {
        // v5.6: 실측 c3d.txt power scalar (median across trials) — fallback 기본값 OK
        hip_R_W:    Math.round(powRHi),  hip_L_W:   Math.round(powLHi),
        knee_R_W:   Math.round(powRKn),  knee_L_W:  Math.round(powLKn),
        shoulder_W: Math.round(powRSho), elbow_W:   Math.round(powREl),
        total_W:    Math.round(powRHi + powLHi + powRKn + powLKn + powRSho + powREl),
        // v5.6: 실측 mech_energy J (없을 때만 fallback)
        mech_energy_pelvis_J:  pelvisJ  != null ? Math.round(pelvisJ)  : 400,
        mech_energy_trunk_J:   trunkJ   != null ? Math.round(trunkJ)   : 600,
        mech_energy_humerus_J: humerusJ != null ? Math.round(humerusJ) : 590,
        score: genScore
      },
      transfer: {
        ete_pct: etePct, speed_gain_pt: speedGainPt, speed_gain_ta: speedGainTa,
        proper_seq: true, pelvis_to_trunk_lag_ms: 50, trunk_to_arm_lag_ms: 35,
        score: trfScore,
        // v5.6: transferScoreV2 분해 결과 (combined / kinematic_only)
        score_kinematic:             tsv2?.kinematic ?? null,
        score_kinetic_ete:           tsv2?.kinetic_ete ?? null,
        ratio_humerus_to_pelvis_pct: tsv2?.ratio_humerus_to_pelvis_pct ?? null,
        basis:                       tsv2?.basis ?? 'kinematic_only'
      },
      leakage: {
        zone1_sequence: zones[0][3], zone2_x_factor: zones[1][3],
        zone3_lead_block: zones[2][3], zone4_trunk_at_fc: zones[3][3],
        zone5_shoulder_align: zones[4][3], zone6_pelvis_brake: zones[5][3],
        eli_score: eliScore, causal_chains: causal
      }
    },
    grf: {
      lhei: Math.min(98, Math.round(zones[2][3]*0.3 + zones[5][3]*0.2
              + norm(fp1Peak/weight*100, 80, 0.5)*0.25
              + norm(fp2Peak/weight*100, 110, 0.4)*0.25)),
      rear_force_pct: Math.round(fp1Peak / (weight * 9.81) * 100 * 100) / 100,
      lead_force_pct: Math.round(fp2Peak / (weight * 9.81) * 100 * 100) / 100,
      type: '균형형'
    },
    faults: {
      x_factor_deg: Math.round(xFactor * 10) / 10,
      lead_knee_change: 12,
      release_height_sd_cm: 4.0,
      wrist_pos_sd_cm: 2.5, trunk_tilt_sd_deg: 1.8,
      consistency_score: 88, fault_score: 85,
      injury_risk: 'low', fault_count: 1
    }
  };
}

// 끌어놓은 c3d.txt 파일들 → 1명의 record 합성·적용
async function handleC3DTxtFiles(files){
  const messages = [`▶ Visual3D ASCII (.c3d.txt) ${files.length}개 감지 — 인-브라우저 처리`];
  const applied = [];

  // 모든 파일 텍스트 비동기 로드
  const fileTexts = await Promise.all(files.map(async f => ({
    name: f.name, text: await f.text()
  })));

  // PID 자동 감지: 파일 첫 1KB에서 \P##_ 또는 /P##_ 패턴 (Visual3D 경로 헤더)
  let detectedPID = null;
  for(const ft of fileTexts){
    const head = ft.text.slice(0, 1500);
    const m = head.match(/[\\\/](P\d{2})[_\s\\\/]/);
    if(m){ detectedPID = m[1]; break; }
    // 백슬래시 escape 환경에 따라 다른 패턴도 시도
    const m2 = head.match(/(P\d{2})_[A-Z]+/);
    if(m2){ detectedPID = m2[1]; break; }
  }

  if(!detectedPID){
    const opts = PLAYERS.map(p => `${p.id} ${p.name}`).join(', ');
    const ans = window.prompt(
      `c3d.txt에서 선수 PID를 자동 감지하지 못했습니다.\n어느 선수의 데이터인가요? (예: P01)\n\n선수 목록: ${opts}`,
      'P01'
    );
    if(!ans){ messages.push('✗ PID 입력 취소 — 처리 중단'); return {messages, applied}; }
    detectedPID = ans.trim().toUpperCase();
  }

  if(!PLAYERS.find(p => p.id === detectedPID)){
    messages.push(`✗ PID ${detectedPID} 가 PLAYERS 명단에 없음`);
    return {messages, applied};
  }
  messages.push(`  · 선수 PID: ${detectedPID} ${PLAYERS.find(p => p.id === detectedPID).name}`);

  // 파일별 trial summary 추출
  const trials = [];
  for(const ft of fileTexts){
    const summary = parseC3DTxtTrial(ft.text);
    if(summary.error){
      messages.push(`  ⚠ ${ft.name}: ${summary.error}`);
      continue;
    }
    trials.push(summary);
  }
  if(!trials.length){
    messages.push('✗ 파싱 가능한 trial 없음 — 처리 중단');
    return {messages, applied};
  }

  // 어느 세션에 적용? 기본 1차 (Theia+GRF). 수동 변경은 추후 dropdown으로.
  const sid = 1;
  const body = synthesizeRecordFromTrials(detectedPID, trials, sid);
  const rec  = {pid: detectedPID, sid, body};
  applyTheiaRecord(rec);
  applied.push(rec);
  messages.push(`✓ ${detectedPID} S${sid} 적용 완료 (${trials.length} trials median 합성)`);
  messages.push(`  · 골반/몸통/팔 peak: ${body.sequence.pelvis_dps}/${body.sequence.trunk_dps}/${body.sequence.arm_dps} dps · X-factor ${body.faults.x_factor_deg}° · ELI ${body.energy.leakage.eli_score}`);

  return {messages, applied};
}

// 드래그 & 클릭 둘 다 지원
function setupJsonZone(){
  const zone = document.getElementById('theia-json-zone');
  const input = document.getElementById('theia-json-input');
  zone?.addEventListener('click', ()=>input.click());
  input?.addEventListener('change', e=>{
    if(e.target.files.length) handleJsonFiles([...e.target.files]);
  });
  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev, e=>{
    e.preventDefault(); zone.style.borderColor='var(--accent)'; zone.style.background='var(--accent-bg)';
  }));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev, e=>{
    e.preventDefault(); zone.style.borderColor=''; zone.style.background='';
  }));
  zone?.addEventListener('drop', e=>{
    if(e.dataTransfer.files.length) handleJsonFiles([...e.dataTransfer.files]);
  });
}

// 템플릿 다운로드 (단일·배치 두 가지)
function downloadTemplate(kind){
  const single = {
    athlete_external_id: PLAYERS[0]?.id || 'P01',
    session_id: 1,
    test_date: SESSIONS[0]?.date || '2026-05-15',
    protocol: 'Theia+GRF',
    velocity: { measured_kmh: 132.5, potential_kmh: 138.0, score: 75 },
    sequence: { pelvis_dps: 510, trunk_dps: 850, arm_dps: 1380, ete_pct: 78, speed_gain: 1.65, proper_seq: true, score: 80 },
    // ⚡ 에너지 프레임워크 (1차 측정 헤드라인) — Theia+GRF 리포트의 핵심
    energy: {
      generation: {
        hip_R_W: 280, hip_L_W: 260, knee_R_W: 360, knee_L_W: 340,
        shoulder_W: 420, elbow_W: 240, total_W: 1900,
        mech_energy_pelvis_J: 460, mech_energy_trunk_J: 720, mech_energy_humerus_J: 290,
        score: 78
      },
      transfer: {
        ete_pct: 78, speed_gain_pt: 1.65, speed_gain_ta: 1.45, proper_seq: true,
        pelvis_to_trunk_lag_ms: 65, trunk_to_arm_lag_ms: 50, score: 80
      },
      leakage: {
        zone1_sequence: 85, zone2_x_factor: 70, zone3_lead_block: 65,
        zone4_trunk_at_fc: 78, zone5_shoulder_align: 82, zone6_pelvis_brake: 68,
        eli_score: 75,
        causal_chains: [
          { zone:'zone3', zone_label:'앞발 받쳐주기 (블로킹) 약함', defect:'Lead knee collapse',  impact_kmh: -2.9 },
          { zone:'zone6', zone_label:'골반 감속 (브레이크) 부족',   defect:'Pelvis braking 부족', impact_kmh: -2.7 },
          { zone:'zone2', zone_label:'골반-상체 분리 (X-팩터) 부족', defect:'X-factor 미달',     impact_kmh: -2.5 }
        ]
      }
    },
    grf: { lhei: 72, rear_force_pct: 88, lead_force_pct: 92, type: '균형형' },
    faults: { x_factor_deg: 38, lead_knee_change: -8, release_height_sd_cm: 4.2,
              wrist_pos_sd_cm: 5.1, trunk_tilt_sd_deg: 1.8,
              consistency_score: 82, fault_score: 75, injury_risk: 'low', fault_count: 2 },
    fitness: {
      cmj:  { jump_height_cm: 41.0, peak_power_w: 3460, peak_power_bm_w_kg: 42.0,
              rsi_modified_ms: 0.50, conc_peak_force_bm_n_kg: 40.5, ecc_conc_force_ratio: 1.05 },
      sj:   { jump_height_cm: 39.3, peak_power_bm_w_kg: 32.7, conc_peak_force_bm_n_kg: 35.2 },
      eur: 1.04,
      pogo: { rsi_ms: 1.85, mean_contact_time_ms: 148, mean_jump_height_cm: 26.5 },
      imtp: { peak_force_n: 2117, peak_force_bm_n_kg: 25.71,
              rfd_0_100ms_n_s: 8240, force_at_100ms_bm_n_kg: 21.8, asymmetry_pct: 3.2 }
    }
  };
  const batch = {
    session: { id: 1, date: SESSIONS[0]?.date || '2026-05-15', protocol: 'Theia+GRF' },
    results: PLAYERS.slice(0,3).map((p,i)=>({
      athlete_external_id: p.id,
      velocity: { measured_kmh: 130 + i*2, potential_kmh: 138 + i*2, score: 70 + i*3 },
      sequence: { pelvis_dps: 500 + i*10, trunk_dps: 830 + i*10, arm_dps: 1350 + i*15,
                  ete_pct: 75 + i, speed_gain: 1.6 + i*0.05, proper_seq: true, score: 75 + i*2 },
      grf: { lhei: 70 + i*3, rear_force_pct: 85, lead_force_pct: 90, type: '균형형' },
      faults: { x_factor_deg: 36 + i, lead_knee_change: -5,
                release_height_sd_cm: 4.0, wrist_pos_sd_cm: 5.0, trunk_tilt_sd_deg: 1.5,
                consistency_score: 80, fault_score: 75, injury_risk: 'low', fault_count: 1 }
    }))
  };
  const data = kind === 'single' ? single : batch;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = kind === 'single' ? 'theia_grf_template_single.json' : 'theia_grf_template_batch.json';
  a.click();
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  8b. CSV 파서 — ForceDecks + Rapsodo 자동 인입 (v1.16)        ║
   ╚══════════════════════════════════════════════════════════╝ */

// 가벼운 RFC4180 CSV 파서 (인용부호 안 콤마/줄바꿈 처리)
function parseCSV(text){
  const rows = []; let row = []; let cur = ''; let inQ = false;
  text = text.replace(/﻿/, '');  // BOM 제거
  for(let i=0; i<text.length; i++){
    const c = text[i], n = text[i+1];
    if(inQ){
      if(c === '"' && n === '"'){ cur += '"'; i++; }
      else if(c === '"'){ inQ = false; }
      else { cur += c; }
    } else {
      if(c === '"'){ inQ = true; }
      else if(c === ','){ row.push(cur); cur = ''; }
      else if(c === '\n' || c === '\r'){
        if(cur !== '' || row.length){ row.push(cur); rows.push(row); row = []; cur = ''; }
        if(c === '\r' && n === '\n') i++;
      } else { cur += c; }
    }
  }
  if(cur !== '' || row.length){ row.push(cur); rows.push(row); }
  if(!rows.length) return {header:[], rows:[]};
  const header = rows[0].map(h => h.trim());
  const data = rows.slice(1).filter(r => r.length === header.length || r.length>1)
    .map(r => Object.fromEntries(header.map((h,i) => [h, (r[i]||'').trim()])));
  return {header, rows: data};
}
function num(v){ if(v==null||v==='') return null; const n = parseFloat(v); return isNaN(n)?null:n; }

// ForceDecks CSV → DATA[pid][1].fitness 자동 매핑
function importValdCSV(text){
  const {header, rows} = parseCSV(text);
  const required = ['athlete_external_id','test_date'];
  const missing = required.filter(c => !header.includes(c));
  if(missing.length) return {ok:0, errors:[`필수 컬럼 누락: ${missing.join(', ')}`], applied:[]};

  const errors = [], applied = [];
  rows.forEach((r,i) => {
    const pid = r.athlete_external_id;
    if(!pid){ errors.push(`행 ${i+2}: athlete_external_id 비어있음`); return; }
    const player = PLAYERS.find(p => p.id === pid);
    if(!player){ errors.push(`행 ${i+2}: PLAYERS에 ${pid} 없음 (스킵)`); return; }

    // 회차 결정 — test_date가 SESSIONS 중 어느 것과 매칭되는지
    let sid = 1;
    const matchSes = SESSIONS.find(s => s.date === r.test_date);
    if(matchSes) sid = matchSes.id;

    if(!DATA[pid][sid]) DATA[pid][sid] = {protocol: SESSIONS.find(s=>s.id===sid).protocol, date: r.test_date};

    const fitness = {
      cmj: {
        jump_height_cm:           num(r.cmj_jump_height_cm),
        peak_power_w:             num(r.cmj_peak_power_w),
        peak_power_bm_w_kg:       num(r.cmj_peak_power_bm_w_kg),
        rsi_modified_ms:          num(r.cmj_rsi_modified_ms),
        conc_peak_force_bm_n_kg:  num(r.cmj_concentric_peak_force_bm_n_kg),
        ecc_conc_force_ratio:     num(r.cmj_eccentric_concentric_force_ratio),
      },
      sj: {
        jump_height_cm:           num(r.sj_jump_height_cm),
        peak_power_bm_w_kg:       num(r.sj_peak_power_bm_w_kg),
        conc_peak_force_bm_n_kg:  num(r.sj_concentric_peak_force_bm_n_kg),
      },
      eur: num(r.eur),
      pogo: {
        rsi_ms:                   num(r.pogo_rsi_ms),
        mean_contact_time_ms:     num(r.pogo_mean_contact_time_ms),
        mean_jump_height_cm:      num(r.pogo_mean_jump_height_cm),
      },
      imtp: {
        peak_force_n:             num(r.imtp_peak_vertical_force_n),
        peak_force_bm_n_kg:       num(r.imtp_peak_vertical_force_bm_n_kg),
        rfd_0_100ms_n_s:          num(r.imtp_rfd_0_100ms_n_s),
        force_at_100ms_bm_n_kg:   num(r.imtp_force_at_100ms_bm_n_kg),
        asymmetry_pct:            num(r.imtp_asymmetry_pct),
      },
      // v5.0 — Plyo Push Up (Driveline HP 6축 호환) · 32컬럼 wide CSV 신규
      // 29컬럼 legacy CSV 시 모두 null (graceful degradation)
      pp: {
        peak_takeoff_force_bm_n_kg:    num(r.pp_peak_takeoff_force_bm_n_kg),
        peak_eccentric_force_bm_n_kg:  num(r.pp_peak_eccentric_force_bm_n_kg),
        asymmetry_pct:                 num(r.pp_asymmetry_pct),
      },
    };
    // 체력 종합 점수 — CMJ JH(25cm 기준 0, 50cm 만점) + IMTP PF/BM(15 기준 0, 35 만점)
    const cmjN  = fitness.cmj.jump_height_cm  != null ? Math.max(0,Math.min(100,(fitness.cmj.jump_height_cm-25)/25*100)) : null;
    const imtpN = fitness.imtp.peak_force_bm_n_kg != null ? Math.max(0,Math.min(100,(fitness.imtp.peak_force_bm_n_kg-15)/20*100)) : null;
    const parts = [cmjN, imtpN].filter(v => v != null);
    fitness.score = parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length) : null;

    DATA[pid][sid].fitness = fitness;
    REAL_DATA_KEYS.add(`${pid}:${sid}`);
    applied.push({pid, sid});
  });
  return {ok: applied.length, errors, applied};
}

// 원본 Rapsodo 2.0 CSV (45컬럼 메타 헤더 형식) 자동 감지 및 정규화
function detectAndNormalizeRapsodoV2(text){
  // 첫 5줄에 'Player ID:', 'Player Name:', '"No"' 패턴이 있으면 원본 v2.0
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex(l => l.startsWith('"No"') || l.startsWith('No,'));
  if(headerIdx < 0 || headerIdx > 6) return null;  // 표준 형식
  // 메타 추출
  let playerName = '';
  for(let i = 0; i < headerIdx; i++){
    if(lines[i].startsWith('"Player Name:"')){
      playerName = (lines[i].split(',')[1] || '').replace(/"/g,'').trim();
    }
  }
  // PID 추출 (P 01 → P01, P01 → P01)
  const pidMatch = playerName.match(/P\s*(\d+)/i);
  const pid = pidMatch ? `P${pidMatch[1].padStart(2,'0')}` : 'P01';
  // 헤더부터 끝까지 파싱
  const csvBody = lines.slice(headerIdx).join('\n');
  const {header, rows} = parseCSV(csvBody);
  // 표준 컬럼으로 매핑
  const out = ['athlete_external_id,athlete_name,test_date,session_id,pitch_type,pitch_no,'+
               'velocity_kmh,plate_velocity_kmh,velocity_loss_pct,'+
               'spin_rpm,true_spin_rpm,spin_efficiency_pct,spin_axis_clock,spin_axis_deg,gyro_degree,'+
               'ivb_cm,hb_cm,vb_total_cm,'+
               'release_height_m,release_side_m,release_extension_m,release_angle_deg,'+
               'vaa_deg,haa_deg,plate_height_cm,plate_side_cm,in_zone,bauer_units'];
  function clkToDeg(s){
    const m = (s||'').match(/(\d+):(\d+)/); if(!m) return '';
    return Math.round(((+m[1]) % 12) * 30 + (+m[2]) / 2 * 10) / 10;
  }
  function n(v){ const x = parseFloat(v); return (isNaN(x) || v==='-' || v==='') ? '' : x; }
  rows.forEach((r, i) => {
    const vel = n(r['Velocity']);
    const spin = n(r['Total Spin']);
    const ext_ft = n(r['Release Extension (ft)']);
    const ext_m = (ext_ft !== '') ? Math.round(ext_ft * 0.3048 * 100) / 100 : '';
    const plate_vel = (vel !== '') ? Math.round(vel * 0.93 * 10) / 10 : '';
    const velo_loss = (vel !== '' && plate_vel !== '') ? Math.round((vel - plate_vel) / vel * 100 * 10) / 10 : '';
    const bauer = (vel !== '' && spin !== '') ? Math.round(spin / (vel * 0.621371) * 10) / 10 : '';
    const inZone = r['Is Strike'] === 'Y' ? 1 : 0;
    const pType = (r['Pitch Type'] || '').includes('Fastball') ? 'FB' : (r['Pitch Type'] || '');
    out.push([pid, playerName, r['Date'] || '2026-05-15', `SES_${pid}`,
              pType, i + 1,
              vel, plate_vel, velo_loss,
              spin, n(r['True Spin (release)']), n(r['Spin Efficiency (release)']),
              r['Spin Direction'] || '', clkToDeg(r['Spin Direction']), n(r['Gyro Degree (deg)']),
              n(r['VB (trajectory)']), n(r['HB (trajectory)']),
              (n(r['VB (trajectory)']) !== '') ? Math.round((n(r['VB (trajectory)']) - 30)*10)/10 : '',
              n(r['Release Height']), n(r['Release Side']), ext_m, n(r['Release Angle']),
              n(r['Vertical Approach Angle']), n(r['Horizontal Approach Angle']),
              n(r['Strike Zone Height']), n(r['Strike Zone Side']),
              inZone, bauer].join(','));
  });
  return out.join('\n');
}

// Rapsodo 2.0 통계 헬퍼
function _stat(arr){
  const v = arr.filter(x => x != null && !isNaN(x));
  if(!v.length) return {n:0, avg:null, sd:null, min:null, max:null};
  const avg = v.reduce((a,b)=>a+b,0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((s,x) => s + (x-avg)**2, 0) / (v.length-1)) : 0;
  return {n: v.length, avg, sd, min: Math.min(...v), max: Math.max(...v)};
}
function _rd(x, dec=1){ return x==null||isNaN(x) ? null : Math.round(x * 10**dec) / 10**dec; }

// KBO/HS 코호트 평균 — 비교 평가용
const RAPSODO_BENCHMARKS = {
  KBO: {velo:142.0, spin:2200, eff:88, ivb:42, bauer:25.5, vaa:-5.0, ext:1.95},
  HS:  {velo:128.0, spin:2050, eff:82, ivb:35, bauer:25.0, vaa:-5.5, ext:1.85},
};

// Rapsodo CSV → 선수별 FB 풀 분석 + velocity·release SD 매핑
function importRapsodoCSV(text){
  // 원본 Rapsodo 2.0 형식이면 자동 정규화
  const normalized = detectAndNormalizeRapsodoV2(text);
  if(normalized) text = normalized;

  const {header, rows} = parseCSV(text);
  const required = ['athlete_external_id','pitch_type','velocity_kmh'];
  const missing = required.filter(c => !header.includes(c));
  if(missing.length) return {ok:0, errors:[`필수 컬럼 누락: ${missing.join(', ')}`], applied:[]};

  // 선수별 그룹화
  const byPid = {};
  rows.forEach(r => {
    const pid = r.athlete_external_id; if(!pid) return;
    if(!byPid[pid]) byPid[pid] = [];
    byPid[pid].push(r);
  });

  const errors = [], applied = [];
  Object.entries(byPid).forEach(([pid, throws]) => {
    const player = PLAYERS.find(p => p.id === pid);
    if(!player){ errors.push(`${pid}: PLAYERS에 없음 (스킵)`); return; }
    const fb = throws.filter(t => t.pitch_type === 'FB' || t.pitch_type === 'Fastball');
    if(!fb.length){ errors.push(`${pid}: FB throw 없음 — 첫 throw 사용`); fb.push(throws[0]); }

    // ── 변수별 통계 ──
    const stats = {
      velocity:        _stat(fb.map(t => num(t.velocity_kmh))),
      plate_velocity:  _stat(fb.map(t => num(t.plate_velocity_kmh))),
      velo_loss:       _stat(fb.map(t => num(t.velocity_loss_pct))),
      spin:            _stat(fb.map(t => num(t.spin_rpm))),
      true_spin:       _stat(fb.map(t => num(t.true_spin_rpm))),
      spin_eff:        _stat(fb.map(t => num(t.spin_efficiency_pct))),
      spin_axis_deg:   _stat(fb.map(t => num(t.spin_axis_deg))),
      gyro:            _stat(fb.map(t => num(t.gyro_degree))),
      ivb:             _stat(fb.map(t => num(t.ivb_cm))),
      hb:              _stat(fb.map(t => num(t.hb_cm))),
      vb_total:        _stat(fb.map(t => num(t.vb_total_cm))),
      release_height:  _stat(fb.map(t => num(t.release_height_m))),
      release_side:    _stat(fb.map(t => num(t.release_side_m))),
      release_ext:     _stat(fb.map(t => num(t.release_extension_m))),
      release_angle:   _stat(fb.map(t => num(t.release_angle_deg))),
      vaa:             _stat(fb.map(t => num(t.vaa_deg))),
      haa:             _stat(fb.map(t => num(t.haa_deg))),
      plate_height:    _stat(fb.map(t => num(t.plate_height_cm))),
      plate_side:      _stat(fb.map(t => num(t.plate_side_cm))),
      bauer:           _stat(fb.map(t => num(t.bauer_units))),
    };
    if(!stats.velocity.n){ errors.push(`${pid}: velocity_kmh 모두 빈 값`); return; }
    const inZone = fb.filter(t => num(t.in_zone) === 1).length;

    // ── 합성지표 — v3.1: ANALYTICS.stuffScore 사용 (학년 코호트 자동) ──
    const COH = RAPSODO_BENCHMARKS.KBO;
    let stuff_score, stuff_components, stuff_cohort;
    if(typeof ANALYTICS !== 'undefined'){
      // 학년별 코호트 자동 선택
      const playerCohort = player.grade ? `HS-${player.grade}` : 'HS';
      const ss = ANALYTICS.stuffScore({
        velocity_kmh:        stats.velocity.avg,
        spin_rpm:            stats.spin.avg,
        ivb_cm:              stats.ivb.avg,
        hb_cm:               stats.hb.avg,
        spin_efficiency_pct: stats.spin_eff.avg
      }, playerCohort);
      stuff_score      = ss.stuff_score;
      stuff_components = ss.components;
      stuff_cohort     = ss.cohort;
    } else {
      // fallback: 기존 단순 식
      const sv = Math.max(0, Math.min(100, 50 + (stats.velocity.avg - COH.velo) * 4));
      const ss = Math.max(0, Math.min(100, 50 + (stats.spin.avg - COH.spin) / 10));
      stuff_score = Math.round(sv*0.5 + ss*0.5);
    }
    // Command (제구) = release SD (height·side·ext), in_zone% 가중
    const rh_sd_cm = (stats.release_height.sd || 0) * 100;
    const rs_sd_cm = (stats.release_side.sd || 0) * 100;
    const cmd_rh = Math.max(0, Math.min(100, 100 - rh_sd_cm * 12));
    const cmd_rs = Math.max(0, Math.min(100, 100 - rs_sd_cm * 12));
    const cmd_zone = stats.velocity.n ? (inZone / stats.velocity.n) * 100 : 0;
    const command_score = Math.round(cmd_rh*0.35 + cmd_rs*0.35 + cmd_zone*0.30);

    // 회차 — test_date 매칭 (없으면 1차)
    const td = fb[0].test_date;
    const matchSes = SESSIONS.find(s => s.date === td);
    const sid = matchSes ? matchSes.id : 1;
    if(!DATA[pid][sid]) DATA[pid][sid] = {protocol: SESSIONS.find(s=>s.id===sid).protocol, date: td};
    const cur = DATA[pid][sid];

    // velocity 핵심 — 기존 필드 유지하면서 채움
    cur.velocity = {
      ...(cur.velocity || {}),
      measured_kmh:     _rd(stats.velocity.max, 1),
      measured_avg_kmh: _rd(stats.velocity.avg, 1),
      measured_sd:      _rd(stats.velocity.sd, 2),
      n_throws:         stats.velocity.n,
    };
    cur.faults = {
      ...(cur.faults || {}),
      release_height_sd_cm: _rd(rh_sd_cm, 1),
      wrist_pos_sd_cm:      _rd(rs_sd_cm, 1),
    };

    // ── Rapsodo 풀 블록 (구질별 — 현재는 FB 만, 추후 SL/CB/CH 확장) ──
    cur.rapsodo = {
      ...(cur.rapsodo || {}),
      fb: {
        n_throws: stats.velocity.n,
        velocity:  {max:_rd(stats.velocity.max,1), avg:_rd(stats.velocity.avg,1),
                    min:_rd(stats.velocity.min,1), sd:_rd(stats.velocity.sd,2)},
        plate_velocity: {avg:_rd(stats.plate_velocity.avg,1), sd:_rd(stats.plate_velocity.sd,2)},
        velo_loss_pct:  _rd(stats.velo_loss.avg,1),
        spin:           {avg:Math.round(stats.spin.avg||0), sd:_rd(stats.spin.sd,0)},
        true_spin_avg:  Math.round(stats.true_spin.avg||0),
        spin_eff:       {avg:_rd(stats.spin_eff.avg,1), sd:_rd(stats.spin_eff.sd,1)},
        spin_axis_deg:  _rd(stats.spin_axis_deg.avg,0),
        gyro_avg:       _rd(stats.gyro.avg,1),
        bauer_units:    _rd(stats.bauer.avg,1),
        ivb:            {avg:_rd(stats.ivb.avg,1), sd:_rd(stats.ivb.sd,1)},
        hb:             {avg:_rd(stats.hb.avg,1), sd:_rd(stats.hb.sd,1)},
        vb_total_avg:   _rd(stats.vb_total.avg,1),
        release: {
          height_avg: _rd(stats.release_height.avg,2),
          height_sd_cm: _rd(rh_sd_cm,1),
          side_avg:   _rd(stats.release_side.avg,2),
          side_sd_cm: _rd(rs_sd_cm,1),
          extension_avg: _rd(stats.release_ext.avg,2),
          extension_sd: _rd((stats.release_ext.sd||0)*100,1),
          angle_avg:  _rd(stats.release_angle.avg,1),
        },
        vaa_avg: _rd(stats.vaa.avg,2),
        haa_avg: _rd(stats.haa.avg,2),
        plate: {
          height_avg: _rd(stats.plate_height.avg,1),
          side_avg:   _rd(stats.plate_side.avg,1),
        },
        in_zone_pct: Math.round(cmd_zone),
        // 합성 (v3.1: 학년 코호트 기반)
        stuff_score,
        stuff_components: stuff_components || null,
        stuff_cohort:     stuff_cohort || 'KBO',
        command_score,
        // 원본 throws (선수별 산점도용 — 첫 5개만 보존)
        throws: fb.slice(0, 30).map(t => ({
          pitch_no: num(t.pitch_no), velocity: num(t.velocity_kmh),
          spin: num(t.spin_rpm), spin_eff: num(t.spin_efficiency_pct),
          ivb: num(t.ivb_cm), hb: num(t.hb_cm),
          rh: num(t.release_height_m), rs: num(t.release_side_m),
          ext: num(t.release_extension_m), vaa: num(t.vaa_deg),
          plate_h: num(t.plate_height_cm), plate_s: num(t.plate_side_cm),
          in_zone: num(t.in_zone)===1
        }))
      }
    };
    REAL_DATA_KEYS.add(`${pid}:${sid}`);
    applied.push({pid, sid, ...stats.velocity, stuff_score, command_score});
  });
  return {ok: applied.length, errors, applied};
}

async function handleCSVFiles(fileList, kind){
  const wrapId = kind === 'vald' ? 'vald-csv-result' : 'rapsodo-csv-result';
  const wrap = document.getElementById(wrapId);
  const messages = [];
  for(const file of fileList){
    try {
      const text = await file.text();
      const result = (kind === 'vald' ? importValdCSV : importRapsodoCSV)(text);
      if(result.ok) messages.push(`✓ ${file.name}: ${result.ok}명 인입 완료`);
      else messages.push(`⚠ ${file.name}: 인입 0건`);
      result.errors.slice(0, 5).forEach(e => messages.push(`  · ${e}`));
      if(result.errors.length > 5) messages.push(`  · ... 외 ${result.errors.length - 5}건`);
    } catch(e){
      messages.push(`✗ ${file.name}: 파싱 실패 — ${e.message}`);
    }
  }
  wrap.innerHTML = messages.map(m => {
    const cls = m.startsWith('✓') ? 'good' : m.startsWith('⚠') ? 'warn' : m.startsWith('  ') ? '' : 'bad';
    return cls
      ? `<div class="pill ${cls}" style="display:block;padding:6px 10px;margin:3px 0;font-weight:500">${m}</div>`
      : `<div style="padding:2px 18px;color:var(--muted);font-size:11px">${m}</div>`;
  }).join('');
  refreshAllAfterImport();
}

function setupCSVZone(kind){
  const ids = kind === 'vald'
    ? {zone: 'vald-csv-zone', input: 'vald-csv-input'}
    : {zone: 'rapsodo-csv-zone', input: 'rapsodo-csv-input'};
  const zone = document.getElementById(ids.zone);
  const input = document.getElementById(ids.input);
  if(!zone || !input) return;
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    if(e.target.files.length) handleCSVFiles([...e.target.files], kind);
  });
  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.style.borderColor = 'var(--accent)'; zone.style.background = 'var(--accent-bg)';
  }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.style.borderColor = ''; zone.style.background = '';
  }));
  zone.addEventListener('drop', e => {
    if(e.dataTransfer.files.length) handleCSVFiles([...e.dataTransfer.files], kind);
  });
}

function resetToSampleData(){
  if(!confirm('실측 데이터 인입분을 모두 버리고 샘플로 되돌립니다.\n저장된 localStorage도 함께 삭제됩니다. 진행할까요?')) return;
  // 새 샘플 데이터 생성
  Object.keys(DATA).forEach(k => delete DATA[k]);
  Object.assign(DATA, genMeasurements());
  REAL_DATA_KEYS.clear();
  clearStorage();
  refreshAllAfterImport();
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  8b. localStorage 자동 저장/복원 (v1.6)                       ║
   ╚══════════════════════════════════════════════════════════╝ */

const STORAGE_KEY = 'sangdong_dashboard_v1';
let __saveTimer = null;

function saveToStorage(){
  // 디바운스 — 짧은 시간 내 여러 변경은 한 번만 저장
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(()=>{
    try {
      // REAL_DATA_KEYS만 있는 셀(실측)만 저장. 샘플은 페이지 reload 시 재생성.
      const realData = {};
      REAL_DATA_KEYS.forEach(key=>{
        const [pid, sid] = key.split(':');
        if(!realData[pid]) realData[pid] = {};
        realData[pid][sid] = DATA[pid][sid];
      });
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        players: PLAYERS,
        realData,
        realKeys: [...REAL_DATA_KEYS]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      updateStorageBadge('saved');
    } catch(e){
      console.warn('localStorage 저장 실패:', e);
      updateStorageBadge('error');
    }
  }, 400);
}

function loadFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const payload = JSON.parse(raw);
    // 선수 명단 복원 (저장된 게 더 최신이라 가정)
    if(Array.isArray(payload.players) && payload.players.length){
      PLAYERS.length = 0;
      payload.players.forEach(p=>PLAYERS.push(p));
    }
    // 샘플 데이터 먼저 생성
    Object.keys(DATA).forEach(k=>delete DATA[k]);
    Object.assign(DATA, genMeasurements());
    // 실측 셀만 덮어쓰기
    if(payload.realData){
      Object.entries(payload.realData).forEach(([pid, sessions])=>{
        if(!DATA[pid]) return;
        Object.entries(sessions).forEach(([sid, body])=>{
          DATA[pid][sid] = body;
        });
      });
    }
    if(Array.isArray(payload.realKeys)){
      payload.realKeys.forEach(k=>REAL_DATA_KEYS.add(k));
    }
    return true;
  } catch(e){
    console.warn('localStorage 복원 실패:', e);
    return false;
  }
}

function clearStorage(){
  try { localStorage.removeItem(STORAGE_KEY); updateStorageBadge('cleared'); }
  catch(e){ console.warn(e); }
}

function updateStorageBadge(state){
  const el = document.getElementById('storage-badge');
  if(!el) return;
  const map = {
    saved:   {txt:'💾 자동 저장됨', cls:'good'},
    cleared: {txt:'저장소 비움', cls:'warn'},
    error:   {txt:'⚠ 저장 실패', cls:'bad'},
    loaded:  {txt:'💾 저장된 데이터 복원됨', cls:'good'},
    none:    {txt:'저장된 데이터 없음', cls:'warn'}
  };
  const m = map[state] || map.none;
  el.textContent = m.txt;
  el.className = 'pill ' + m.cls;
}

/* refreshAllAfterImport()의 마지막 줄에서 saveToStorage()가 호출됨 (아래 함수 정의 참고) */

