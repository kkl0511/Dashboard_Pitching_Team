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

