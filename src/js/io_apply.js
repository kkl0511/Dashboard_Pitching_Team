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
  // v5.35: PLAYERS에 없는 신규 PID 자동 추가 (외부 cohort import 지원)
  if(!PLAYERS.find(p => p.id === rec.pid)){
    PLAYERS.push({
      id: rec.pid,
      name: b.athlete_name || rec.pid,
      arm: (b.handedness || b.dom || 'R').toUpperCase().replace(/[^RL]/g,'').slice(0,1) || 'R',
      height: b.height_cm ?? 178,
      weight: b.mass_kg ?? b.body_mass_kg ?? 75,
      dob: '2008-01-01',
      grade: b.grade ?? 1,
      _auto_added: true
    });
    // DATA에도 신규 PID 추가
    if(!DATA[rec.pid]){
      DATA[rec.pid] = {};
      SESSIONS.forEach(s => DATA[rec.pid][s.id] = {});
    }
  }
  // 기존 DATA[pid][sid]를 덮어쓰되, 누락된 섹션은 기존값 유지
  const cur = (DATA[rec.pid] && DATA[rec.pid][rec.sid]) || {};
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

  // ─── v5.28: 분절간 ETE + lag (proximal-to-distal sequence) ───
  // process_pitching_session.py가 추출한 lag/peak를 m.energy.transitions로 매핑
  if(m.energy?.transfer && typeof segmentTransitionETE === 'function'){
    const t = m.energy.transfer;
    const g = m.energy.generation || {};
    // peak ω 출처: m.sequence (pelvis_dps/trunk_dps/arm_dps) + m.energy.transfer.peak_forearm_v + m.energy.transfer.peak_hand_v
    const segInput = {
      peak_pelvis_v:                m.sequence?.pelvis_dps,
      peak_trunk_v:                 m.sequence?.trunk_dps,
      peak_humerus_v:               m.sequence?.arm_dps,
      peak_forearm_v:               t.peak_forearm_v,
      peak_hand_v:                  t.peak_hand_v ?? m.sequence?.hand_dps,
      pelvis_to_trunk_lag_ms:       t.pelvis_to_trunk_lag_ms,
      trunk_to_humerus_lag_ms:      t.trunk_to_humerus_lag_ms ?? t.trunk_to_arm_lag_ms,
      humerus_to_forearm_lag_ms:    t.humerus_to_forearm_lag_ms,
      forearm_to_hand_lag_ms:       t.forearm_to_hand_lag_ms
    };
    const hasSegInput = Object.values(segInput).some(x => x != null);
    if(hasSegInput){
      const tr = segmentTransitionETE(segInput);
      if(tr){
        m.energy.transitions = tr;   // 카드에서 직접 사용
      }
    }
  }

  // ─── v5.28: GRF 수평 + 임펄스 + 타이밍 분석 ───
  if(m.protocol === 'Theia+GRF' && m.grf && typeof grfHorizontalAnalysis === 'function'){
    const g = m.grf;
    const grfHInput = {
      drive_propulsive_peak_pct_bw:      g.drive_propulsive_peak_pct_bw,
      drive_propulsive_impulse_pct_bw_s: g.drive_propulsive_impulse_pct_bw_s,
      drive_propulsive_peak_time_pct:    g.drive_propulsive_peak_time_pct,
      lead_braking_peak_pct_bw:          g.lead_braking_peak_pct_bw,
      lead_braking_impulse_pct_bw_s:     g.lead_braking_impulse_pct_bw_s,
      lead_braking_peak_ms_after_fc:     g.lead_braking_peak_ms_after_fc,
      lead_block_duration_ms:            g.lead_block_duration_ms,
      horizontal_to_vertical_ratio:      g.horizontal_to_vertical_ratio
    };
    const hasGrfH = Object.values(grfHInput).some(x => x != null);
    if(hasGrfH){
      const grfH = grfHorizontalAnalysis(grfHInput);
      if(grfH) m.grf.horizontal = grfH;   // 카드에서 직접 사용
    }
  }

  // ─── v5.29: NewtForce 핵심 8 변인 분석 (Florida Baseball Armory 표준) ───
  if(m.protocol === 'Theia+GRF' && m.grf && typeof newtforceCoreAnalysis === 'function'){
    const nfInput = m.grf;   // m.grf 전체를 넘김 (alias_v528으로 자동 매핑)
    // 핵심 입력 1개 이상 있을 때만
    const hasNF = ['drive_propulsive_impulse_pct_bw_s','rear_force_pct','lead_force_pct',
                   'drive_propulsive_peak_pct_bw','lead_braking_peak_pct_bw',
                   'newtforce_turning_point_z_pct_bw','newtforce_lead_negative_y_pct_bw',
                   'newtforce_time_of_transfer_ms']
                  .some(k => nfInput[k] != null);
    if(hasNF){
      const nf = newtforceCoreAnalysis(nfInput);
      if(nf) m.grf.newtforce = nf;   // 카드에서 직접 사용
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

