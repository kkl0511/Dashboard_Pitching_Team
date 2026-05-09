/* ─────────────────────────────────────────────────────────────────
 * Theia+GRF Pitching Report → 상동고 통합 대시보드 JSON 저장 스니펫
 * v1.0 · 2026-05-09
 *
 * 적용 위치: https://github.com/kkl0511/Theia_GRF_Pitching_Report
 * 파일: index.html (또는 index_theia.html) 의 <body> 끝, </body> 직전
 *
 * 사용법:
 *   1. 이 파일 전체를 복사
 *   2. Theia+GRF 리포트의 index.html 맨 아래 </body> 바로 위에
 *      <script>...</script> 안에 붙여넣기
 *   3. 분석을 1회 실행하면 화면 우상단에 "💾 대시보드 JSON 저장" 플로팅 버튼 등장
 *   4. 클릭 시 athlete_id_<날짜>.json 파일 다운로드
 *   5. 상동고 대시보드의 데이터 관리 탭에 끌어놓기
 *
 * 동작 원리: 기존 리포트의 분석 결과(전역 변수 또는 DOM)를 읽어
 * 대시보드 스키마에 맞게 변환. 핵심 결과는 보통 theia_app.js 내
 * 전역 객체(window.lastResult, window.computed 등)에 저장됨 — 정확한
 * 변수명은 v0.41 코드 기준이며, 코드 변경 시 GETTERS 함수만 수정.
 * ──────────────────────────────────────────────────────────────── */

(function(){
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // 1. 리포트 결과 추출 — 실제 변수명에 맞게 수정 필요
  //    아래 GETTERS는 Theia+GRF v0.41 기준 추정. 실제 동작 확인 후
  //    각 함수가 올바른 값을 반환하도록 변수명만 바꾸면 됨.
  // ═══════════════════════════════════════════════════════════════

  function getReport(){
    // theia_app.js 가 분석 결과를 어디 저장하는지에 따라 후보 시도
    return window.__report__ || window.report || window.computed
        || window.lastAnalysis || window.analysisResult || null;
  }

  // 텍스트 셀렉터 헬퍼 — DOM에서 화면에 표시된 값을 직접 긁기
  function txt(sel){
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  }
  function num(sel){
    const t = txt(sel);
    if(t == null) return null;
    const m = t.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  const GETTERS = {
    velocity: function(){
      const r = getReport();
      // 우선 전역 객체에서, 실패 시 화면 카드에서
      const measured = r?.velocity_measured ?? r?.measuredVelocity
                    ?? num('[data-field="measured_velocity"]')
                    ?? num('.velocity-card .measured');
      const potential = r?.velocity_potential ?? r?.potentialVelocity
                     ?? num('[data-field="potential_velocity"]')
                     ?? num('.velocity-card .potential');
      const score = r?.velocity_score ?? r?.compositeScore ?? r?.totalScore
                 ?? num('[data-field="composite_score"]');
      return { measured_kmh: measured, potential_kmh: potential, score: score };
    },

    sequence: function(){
      const r = getReport();
      return {
        pelvis_dps: r?.peak_pelvis_av ?? r?.pelvisPeakVel ?? num('[data-field="pelvis_peak_vel"]'),
        trunk_dps:  r?.peak_trunk_av  ?? r?.trunkPeakVel  ?? num('[data-field="trunk_peak_vel"]'),
        arm_dps:    r?.peak_arm_av    ?? r?.armPeakVel    ?? num('[data-field="arm_peak_vel"]'),
        ete_pct:    r?.ete_pct ?? r?.transferEfficiency ?? num('[data-field="ete"]'),
        speed_gain: r?.pelvis_trunk_speedup ?? r?.speedGain ?? num('[data-field="speed_gain"]'),
        proper_seq: r?.proper_sequence ?? r?.properSequence ?? null,
        score:      r?.sequence_score ?? r?.kineticScore ?? num('[data-field="sequence_score"]')
      };
    },

    // ⚡ 에너지 분석 — Theia+GRF 리포트의 v0.36+ 핵심 출력
    energy: function(){
      const r = getReport();
      // 생성 (Output) — Joint Power Scalar 8개 + Mechanical Energy 3 분절
      const generation = {
        hip_R_W:        r?.joint_power?.hip_R   ?? r?.jointPowerScalar?.hip_R   ?? num('[data-field="hip_R_power"]'),
        hip_L_W:        r?.joint_power?.hip_L   ?? r?.jointPowerScalar?.hip_L   ?? num('[data-field="hip_L_power"]'),
        knee_R_W:       r?.joint_power?.knee_R  ?? num('[data-field="knee_R_power"]'),
        knee_L_W:       r?.joint_power?.knee_L  ?? num('[data-field="knee_L_power"]'),
        shoulder_W:     r?.joint_power?.shoulder_pitching ?? num('[data-field="shoulder_pitching_power"]'),
        elbow_W:        r?.joint_power?.elbow_pitching ?? num('[data-field="elbow_pitching_power"]'),
        mech_energy_pelvis_J:   r?.mech_energy_pelvis  ?? num('[data-field="mech_energy_pelvis"]'),
        mech_energy_trunk_J:    r?.mech_energy_trunk   ?? num('[data-field="mech_energy_trunk"]'),
        mech_energy_humerus_J:  r?.mech_energy_humerus ?? num('[data-field="mech_energy_humerus"]'),
        score:          r?.output_score ?? r?.generation_score ?? num('[data-field="output_score"]')
      };
      // total_W 자동 합산
      generation.total_W = ['hip_R_W','hip_L_W','knee_R_W','knee_L_W','shoulder_W','elbow_W']
        .reduce((s,k)=>s + (generation[k]||0), 0) || null;

      // 전달 (Transfer)
      const transfer = {
        ete_pct:                r?.ete_pct ?? num('[data-field="ete"]'),
        speed_gain_pt:          r?.pelvis_trunk_speedup ?? num('[data-field="speed_gain_pt"]'),
        speed_gain_ta:          r?.trunk_arm_speedup    ?? num('[data-field="speed_gain_ta"]'),
        proper_seq:             r?.proper_sequence ?? null,
        pelvis_to_trunk_lag_ms: r?.pelvis_to_trunk_lag_ms ?? num('[data-field="pt_lag"]'),
        trunk_to_arm_lag_ms:    r?.trunk_to_arm_lag_ms    ?? num('[data-field="ta_lag"]'),
        score:                  r?.transfer_score ?? num('[data-field="transfer_score"]')
      };

      // 누수 (Leakage / ELI 6 zones)
      const eli = r?.eli ?? r?.ELI ?? null;
      const leakage = (eli && (eli.score != null || eli.eli_score != null)) ? {
        zone1_sequence:       eli.zone1 ?? eli.zone1_sequence,
        zone2_x_factor:       eli.zone2 ?? eli.zone2_x_factor,
        zone3_lead_block:     eli.zone3 ?? eli.zone3_lead_block,
        zone4_trunk_at_fc:    eli.zone4 ?? eli.zone4_trunk_at_fc,
        zone5_shoulder_align: eli.zone5 ?? eli.zone5_shoulder_align,
        zone6_pelvis_brake:   eli.zone6 ?? eli.zone6_pelvis_brake,
        eli_score:            eli.score ?? eli.eli_score,
        causal_chains:        r?.causal_chains ?? eli.causal_chains ?? []
      } : null;

      return { generation, transfer, leakage };
    },

    grf: function(){
      const r = getReport();
      // GRF 분석이 있는 경우만 반환, 없으면 null
      const hasGRF = r?.has_grf ?? r?.grf_available ?? !!r?.LHEI;
      if(!hasGRF && !document.querySelector('.grf-section')) return null;
      return {
        lhei:           r?.LHEI ?? r?.lhei ?? num('[data-field="lhei"]'),
        rear_force_pct: r?.rear_force_pct ?? r?.fp2_max_pct ?? num('[data-field="rear_force_pct"]'),
        lead_force_pct: r?.lead_force_pct ?? r?.fp1_max_pct ?? num('[data-field="lead_force_pct"]'),
        type:           r?.pitcher_type ?? r?.grfDiagnosis ?? txt('[data-field="grf_type"]')
      };
    },

    faults: function(){
      const r = getReport();
      return {
        x_factor_deg:         r?.max_x_factor ?? r?.xFactor ?? num('[data-field="x_factor"]'),
        lead_knee_change:     r?.lead_knee_ext_change_fc_to_br ?? num('[data-field="lead_knee_change"]'),
        release_height_sd_cm: r?.release_height_sd_cm ?? num('[data-field="release_height_sd"]'),
        wrist_pos_sd_cm:      r?.wrist_3d_sd_cm ?? num('[data-field="wrist_pos_sd"]'),
        trunk_tilt_sd_deg:    r?.trunk_tilt_at_br_trial_sd ?? num('[data-field="trunk_tilt_sd"]'),
        consistency_score:    r?.consistency_score ?? num('[data-field="consistency_score"]'),
        fault_score:          r?.fault_score ?? r?.defectScore ?? num('[data-field="fault_score"]'),
        injury_risk:          r?.injury_risk ?? r?.injuryRisk ?? txt('[data-field="injury_risk"]') ?? 'low',
        fault_count:          r?.fault_count ?? r?.defectCount ?? null
      };
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. 메타 정보 — 입력 폼에서 가져오기
  //    Theia+GRF 리포트 Step 1 폼의 input id에 맞춰 수정 필요
  // ═══════════════════════════════════════════════════════════════

  function getMeta(){
    return {
      athlete_external_id: txt('#athlete_id') || txt('input[name="athlete_id"]') || prompt('athlete_external_id (예: P01)?', 'P01'),
      session_id:          parseInt(txt('#session_id') || prompt('session_id (1·2·3·4)?', '1'), 10) || 1,
      test_date:           txt('#test_date') || new Date().toISOString().slice(0,10),
      protocol:            'Theia+GRF'
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. JSON 빌드 + 다운로드
  // ═══════════════════════════════════════════════════════════════

  function buildJson(){
    const meta = getMeta();
    return {
      ...meta,
      velocity: GETTERS.velocity(),
      sequence: GETTERS.sequence(),
      energy:   GETTERS.energy(),     // ⚡ 1차 측정 헤드라인
      grf:      GETTERS.grf(),
      faults:   GETTERS.faults()
      // fitness는 ForceDecks 결과를 별도로 추가 (이 리포트에서는 채우지 않음)
    };
  }

  function downloadJson(){
    const data = buildJson();
    if(!data.athlete_external_id || !data.session_id){
      alert('athlete_external_id 또는 session_id가 비어있습니다. 입력 폼을 확인하세요.');
      return;
    }
    // 누락 필드 사용자에게 알림
    const missing = [];
    if(!data.velocity?.measured_kmh) missing.push('measured_kmh');
    if(!data.sequence?.pelvis_dps)   missing.push('peak_pelvis_av');
    if(!data.faults?.x_factor_deg)   missing.push('max_x_factor');
    if(missing.length){
      const ok = confirm(`다음 필드 추출 실패:\n  ${missing.join(', ')}\n\n그래도 다운로드 할까요? (대시보드는 누락 필드를 무시하고 부분 머지)`);
      if(!ok) return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.athlete_external_id}_S${data.session_id}_${data.test_date}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. 플로팅 버튼 UI
  // ═══════════════════════════════════════════════════════════════

  function injectButton(){
    if(document.getElementById('dash-export-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'dash-export-btn';
    btn.innerHTML = '💾 대시보드 JSON 저장';
    Object.assign(btn.style, {
      position: 'fixed', top: '14px', right: '14px', zIndex: '9999',
      padding: '10px 16px', background: '#0969da', color: '#fff',
      border: 'none', borderRadius: '6px', fontWeight: '600',
      cursor: 'pointer', fontSize: '13px',
      boxShadow: '0 2px 6px rgba(0,0,0,.2)', fontFamily: 'inherit'
    });
    btn.addEventListener('click', downloadJson);
    btn.addEventListener('mouseenter', ()=>btn.style.background='#0860c4');
    btn.addEventListener('mouseleave', ()=>btn.style.background='#0969da');
    document.body.appendChild(btn);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }

  // 콘솔에서 수동 호출도 가능
  window.exportDashboardJson = downloadJson;
  window.previewDashboardJson = ()=>console.log(JSON.stringify(buildJson(), null, 2));

  console.log('[Dashboard Export] 로드 완료. 우상단 버튼 클릭 또는 콘솔에서 exportDashboardJson() 호출.');
})();
