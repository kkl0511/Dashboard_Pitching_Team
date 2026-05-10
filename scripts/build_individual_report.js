#!/usr/bin/env node
/**
 * 선수별 1차 리포트 docx 생성
 * 입력: theia_TEST_9trial_single.json (단일 record) 또는 batch json의 첫 record
 * 출력: TestPlayer_pitching_report_v5.38.docx
 */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType } = require('docx');

// driveline.js 로직 사용 — eval 로 import (browser용 설계라 module export 없음)
const drivelineCode = fs.readFileSync(path.join(__dirname, '..', 'src/js/driveline.js'), 'utf8');
eval(drivelineCode);

// ─── 입력 ───
const recPath = process.argv[2] || path.join(__dirname, '..', 'sample_data/theia_TEST_9trial_single.json');
const outPath = process.argv[3] || 'TestPlayer_pitching_report_v5.38.docx';
const m = JSON.parse(fs.readFileSync(recPath, 'utf8'));   // 단일 record

// ─── helpers ───
const F = (n, d=1) => n == null ? '—' : Number(n).toFixed(d);
const border = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargin = { top: 80, bottom: 80, left: 120, right: 120 };

function cell(text, opts={}) {
  return new TableCell({
    borders, width: { size: opts.width || 1500, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargin,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: opts.bold, color: opts.color, size: opts.size || 18 })]
    })]
  });
}
function P(text, opts={}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 100 },
    heading: opts.heading,
    children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size, italics: opts.italic })]
  });
}
function H1(t) { return P(t, { heading: HeadingLevel.HEADING_1, before: 240, after: 120 }); }
function H2(t) { return P(t, { heading: HeadingLevel.HEADING_2, before: 180, after: 100 }); }
function H3(t) { return P(t, { heading: HeadingLevel.HEADING_3, before: 120, after: 60 }); }

const HFILL = "2E75B6";
function hdrCell(t, w=1500) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: { fill: HFILL, type: ShadingType.CLEAR },
    margins: cellMargin,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: t, bold: true, color: "FFFFFF", size: 18 })] })]
  });
}

function tableSimple(headers, rows, widths) {
  return new Table({
    width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => hdrCell(h, widths[i])) }),
      ...rows.map(r => new TableRow({
        children: r.map((v, i) => cell(v, {
          width: widths[i],
          align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          bold: i === 0,
        }))
      }))
    ]
  });
}

// 점수 색상 helper
function scoreColor(s) {
  if (s == null) return null;
  if (s >= 80) return "1A7F37";
  if (s >= 60) return "BC4C00";
  return "CF222E";
}

// ─── 분석 (driveline.js 로직) ───
const dvl5 = drivelineFiveModelDiagnosis({
  shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
  peak_shoulder_v: m.sequence?.peak_shoulder_v,
  peak_elbow_v: m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
  arm_dps: m.sequence?.arm_dps,
  shoulder_abd_fp_deg: m.faults?.shoulder_abd_fp_deg,
  scap_load_fp_deg: m.faults?.scap_load_fp_deg,
  elbow_flex_fp_deg: m.faults?.elbow_flex_fp_deg,
  x_factor: m.faults?.x_factor_deg,
  trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg,
  trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
  torso_counter_rot_deg: m.faults?.torso_counter_rot_deg,
  torso_rot_fp_deg: m.faults?.torso_rot_fp_deg,
  torso_rot_br_deg: m.faults?.torso_rot_br_deg,
  trunk_dps: m.sequence?.trunk_dps, pelvis_dps: m.sequence?.pelvis_dps,
  lead_knee_change: m.faults?.lead_knee_change,
  stride_length: m.faults?.stride_length_m,
  lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
  cog_decel: m.cog?.decel, cog_decel_ae: m.cog?.decel,
  max_cog_velo: m.cog?.max_velo
});

const trans = segmentTransitionETE({
  peak_pelvis_v: m.sequence?.pelvis_dps, peak_trunk_v: m.sequence?.trunk_dps,
  peak_humerus_v: m.sequence?.arm_dps, peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
  peak_hand_v: m.sequence?.peak_hand_v ?? m.sequence?.peak_forearm_v,
  pelvis_to_trunk_lag_ms: m.energy?.transfer?.pelvis_to_trunk_lag_ms,
  trunk_to_humerus_lag_ms: m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
  humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
  forearm_to_hand_lag_ms: m.energy?.transfer?.forearm_to_hand_lag_ms
});

const grfH = grfHorizontalAnalysis({
  drive_propulsive_peak_pct_bw: m.grf?.drive_propulsive_peak_pct_bw,
  drive_propulsive_impulse_pct_bw_s: m.grf?.drive_propulsive_impulse_pct_bw_s,
  lead_braking_peak_pct_bw: m.grf?.lead_braking_peak_pct_bw,
  lead_braking_impulse_pct_bw_s: m.grf?.lead_braking_impulse_pct_bw_s,
  lead_block_duration_ms: m.grf?.lead_block_duration_ms,
  lead_braking_peak_ms_after_fc: m.grf?.lead_braking_peak_ms_after_fc,
  drive_propulsive_peak_time_pct: m.grf?.drive_propulsive_peak_time_pct,
  horizontal_to_vertical_ratio: m.grf?.horizontal_to_vertical_ratio
});

// ─── 본문 ───
const v = m.velocity || {};
const seq = m.sequence || {};
const f = m.faults || {};
const cog = m.cog || {};
const grf = m.grf || {};
const trf = m.energy?.transfer || {};

const children = [
  // ─── Title ───
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "투구 분석 1차 리포트", size: 44, bold: true })],
    spacing: { after: 60 }}),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${m.athlete_name || m.athlete_external_id} · 192 cm · 91 kg`, size: 22, color: "666666" })],
    spacing: { after: 40 }}),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `측정일 2026-05-15 · Theia markerless + AMTI Force plate · v5.38 algorithm`, size: 18, color: "999999", italics: true })],
    spacing: { after: 320 }}),

  // ─── §1 종합 KPI ───
  H1("§1. 종합 KPI"),
  tableSimple(
    ["KPI", "값", "기준", "평가"],
    [
      ["측정 구속 (max)",   `${F(v.measured_kmh,1)} km/h`,  "한국 고1 elite 135+", v.measured_kmh >= 135 ? "✅ Elite" : "⚠️"],
      ["평균 구속",         `${F(v.measured_avg_kmh,1)} km/h`, "—", "—"],
      ["구속 SD",            `${F(v.measured_sd,2)} km/h`,    "낮을수록 일관", "✅ 매우 안정"],
      ["잠재 구속 (Mech Ceiling)", `${F(v.potential_kmh,1)} km/h`, "현재 +5", v.potential_kmh > v.measured_kmh ? "↑ 향상 여지" : "—"],
      ["메카닉 점수 (Composite)", `${v.score ?? '—'} / 100`, "80+ Elite", v.score >= 80 ? "✅" : (v.score >= 60 ? "⚠" : "❌")],
    ],
    [3000, 1900, 2200, 1700]),

  // ─── §3 메카닉 ───
  H1("§3. 메카닉"),
  H2("§3-1. Driveline 5 모델 라디아 점수"),
  P("Mechanical Composite Score — 5 영역의 점수 가중 평균. 100 = Median Elite (90+ mph cohort), 150 = Mechanical Ceiling.", { italic: true, size: 20 }),
  tableSimple(
    ["모델", "점수", "주요 변인", "평가"],
    ['arm_action', 'posture', 'rotation', 'block', 'cog'].map(k => {
      const md = dvl5[k]; if (!md) return [k, '—', '—', '—'];
      const label = { arm_action: '🚀 Arm Action', posture: '🛡 Posture', rotation: '🔄 Rotation', block: '🦵 Block', cog: '🎯 CoG' }[k];
      return [label, md.score?.toFixed(0) ?? '—',
        Object.entries(md.metrics).filter(([_, v]) => v.value != null).map(([_, v]) => v.label).join(', ').slice(0, 60) || '—',
        md.score >= 100 ? "✅ Elite" : (md.score >= 80 ? "🟦 양호" : (md.score >= 60 ? "⚠ 발달 필요" : "❌ 약점"))];
    }),
    [2200, 1200, 4500, 1900]),

  H3("§3-1.1 5 모델 변인 상세"),
  tableSimple(
    ["모델", "변인", "본인", "Median Elite", "Per 1km/h", "차이 (km/h)"],
    (() => {
      const out = [];
      ['arm_action', 'posture', 'rotation', 'block', 'cog'].forEach(k => {
        const md = dvl5[k]; if (!md) return;
        const label = { arm_action: '🚀', posture: '🛡', rotation: '🔄', block: '🦵', cog: '🎯' }[k];
        Object.entries(md.metrics).forEach(([vk, vv], i) => {
          if (vv.value == null) return;
          const diff_mph = vv.median_elite != null && vv.per_1mph ? (vv.value - vv.median_elite) / vv.per_1mph : null;
          const diff_kmh = diff_mph == null ? null : diff_mph * 1.609;
          const per_1kmh = vv.per_1mph * 0.621;
          out.push([
            i === 0 ? label : '',
            vv.label,
            F(vv.value, vv.unit === 'deg' || vv.unit === 'deg/s' || vv.unit === 'in' ? 0 : 2) + ' ' + vv.unit,
            F(vv.median_elite, vv.unit === 'deg' || vv.unit === 'deg/s' || vv.unit === 'in' ? 0 : 2),
            F(per_1kmh, 2),
            diff_kmh == null ? '—' : ((diff_kmh >= 0 ? '+' : '') + F(diff_kmh, 1) + ' km/h')
          ]);
        });
      });
      return out;
    })(),
    [800, 3200, 1500, 1300, 1200, 1800]),

  // ─── §3-2 시간축 분석 ───
  H2("§3-2. 시간축 분석 — 분절간 ETE (proximal-to-distal sequence)"),
  P("Pelvis → Trunk → Humerus → Forearm → Hand 4 transition. 각 transition은 lag (시간차) + speed gain (속도 증폭) 결합 점수.", { italic: true, size: 20 }),
  tableSimple(
    ["Transition", "Lag (ms)", "Lag 이상범위", "Speed Gain", "이상범위", "점수"],
    (() => {
      const out = [];
      ['pelvis_to_trunk', 'trunk_to_humerus', 'humerus_to_forearm', 'forearm_to_hand'].forEach(k => {
        const t = trans[k]; if (!t) return;
        out.push([
          t.label_kr,
          F(t.lag_ms, 1),
          t.lag_ideal_ms ? `${t.lag_ideal_ms[0]}–${t.lag_ideal_ms[1]}` : '—',
          t.speed_gain != null ? F(t.speed_gain, 2) + '×' : '—',
          t.speed_gain_ideal ? `${F(t.speed_gain_ideal[0],1)}–${F(t.speed_gain_ideal[1],1)}` : '—',
          t.score != null ? `${t.score} / 100` : '—',
        ]);
      });
      return out;
    })(),
    [2000, 1200, 1500, 1500, 1500, 1500]),
  P(`📌 종합 점수 (markerless 골반 weight 0.5 적용): ${trans.overall_score ?? '—'} / 100`,
    { bold: true, color: scoreColor(trans.overall_score) }),
  trans.bottleneck_label ? P(`📌 가장 큰 누수 (Bottleneck): ${trans.bottleneck_label} (점수 ${trans.bottleneck_score})`, { bold: true, color: "CF222E" }) : null,

  // ─── §3-4 GRF ───
  H2("§3-4. 지면반력 — 수평 + 임펄스 + 타이밍"),
  P("운동량 변화의 본질은 Impulse(∫F·dt). 수직보다 수평 성분이 추진+블록의 본질.", { italic: true, size: 20 }),
  tableSimple(
    ["변인", "본인 (%BW)", "Elite 범위", "점수", "평가"],
    [
      ["🦶 Drive Propulsive Peak",  F(grf.drive_propulsive_peak_pct_bw, 1),  "55–80",   grfH?.drive?.drive_propulsive_peak_pct_bw?.score ?? '—',  grf.drive_propulsive_peak_pct_bw >= 55 && grf.drive_propulsive_peak_pct_bw <= 80 ? '✅' : '⚠'],
      ["🦶 Drive Propulsive Impulse",`${F(grf.drive_propulsive_impulse_pct_bw_s, 2)} %BW·s`, "18–28",  grfH?.drive?.drive_propulsive_impulse_pct_bw_s?.score ?? '—', '—'],
      ["🦵 Lead Braking Peak",       F(grf.lead_braking_peak_pct_bw, 1),       "100–145", grfH?.lead?.lead_braking_peak_pct_bw?.score ?? '—',  grf.lead_braking_peak_pct_bw >= 100 ? '✅' : '⚠'],
      ["🦵 Lead Braking Impulse",   `${F(grf.lead_braking_impulse_pct_bw_s, 2)} %BW·s`, "18–28", grfH?.lead?.lead_braking_impulse_pct_bw_s?.score ?? '—', '—'],
      ["📊 Rear Z (Vertical)",       F(grf.rear_force_pct, 1) + ' %BW', "135–165", '—', '—'],
      ["📊 Lead Z (Vertical)",       F(grf.lead_force_pct, 1) + ' %BW', "195–240", '—', '—'],
      ["📊 LHEI (종합)",              `${grf.lhei ?? '—'} / 100`,        "80+ Elite", '—', grf.lhei >= 80 ? '✅' : '⚠'],
      ["⚙️ Time of Transfer",         grf.newtforce_time_of_transfer_ms ? F(grf.newtforce_time_of_transfer_ms, 0) + ' ms' : '— (clip 후 None)', "240–320", '—', '—'],
    ],
    [3200, 2300, 1500, 1100, 1200]),

  // ─── §3-5 ELI 6 zone ───
  H2("§3-5. ELI 6 Zone — 누수 영역"),
  P("학술적 6개 누수 영역(Energy Leakage Index). 각 zone 100 = 손실 없음, 60 미만 = 명확한 누수.", { italic: true, size: 20 }),
  tableSimple(
    ["Zone", "영역", "점수", "주요 결함"],
    (() => {
      const z = m.energy?.leakage || {};
      return [
        ["1", "분절 시퀀싱 timing", z.zone1_sequence ?? '—', '—'],
        ["2", "X-factor 분리",      z.zone2_x_factor  ?? '—', '—'],
        ["3", "Lead leg 블록",      z.zone3_lead_block ?? '—', '—'],
        ["4", "Trunk at FC",         z.zone4_trunk_at_fc ?? '—', '—'],
        ["5", "어깨 정렬 (ER)",     z.zone5_shoulder_align ?? '—', '—'],
        ["6", "Pelvis 감속",         z.zone6_pelvis_brake ?? '—', '—'],
      ];
    })(),
    [800, 3200, 1500, 4000]),
  P(`📌 ELI 종합 점수: ${m.energy?.leakage?.eli_score ?? '—'} / 100`, { bold: true, color: scoreColor(m.energy?.leakage?.eli_score) }),

  // ─── §4 결과 ───
  H1("§4. 향상 시나리오"),
  P(`현재: ${F(v.measured_kmh,1)} km/h → 메카닉 천장 도달 시: ${F(v.potential_kmh,1)} km/h (+${F(v.potential_kmh - v.measured_kmh, 1)} km/h)`),
  P("권장 향상 영역 (현재 점수 낮은 순):"),
  ['arm_action', 'posture', 'rotation', 'block', 'cog']
    .map(k => ({ k, m: dvl5[k] }))
    .filter(x => x.m && x.m.score != null)
    .sort((a, b) => a.m.score - b.m.score)
    .slice(0, 3)
    .map((x, i) => P(`  ${i+1}. ${x.m.label} (점수 ${x.m.score?.toFixed(0)} → 100 도달 시 +X km/h)`)),

  // ─── §5 종합 권장 ───
  H1("§5. 종합 권장사항"),
  P("향후 측정·훈련에서 우선 점검할 영역 (자동 도출):", { bold: true }),
  // Scap Load 부호 caveat
  m.faults?.scap_load_fp_deg < 0 ? P("• ⚠️ Scap Load at FP 부호가 음수 — markerless Theia 좌표계 정의가 Driveline (양수) 와 반대일 수 있음. 절댓값(|" + F(Math.abs(m.faults.scap_load_fp_deg), 1) + "°|) 기준 평가 권장.", { italic: true, color: "BC4C00" }) : null,
  // 분절 lag bottleneck
  trans.bottleneck ? P(`• 🔗 분절간 흐름 bottleneck: ${trans.bottleneck_label} — ${trans[trans.bottleneck]?.lag_fault || trans[trans.bottleneck]?.gain_fault || '점검'}`, { color: "CF222E" }) : null,
  // GRF Lead 강함
  grf.lead_braking_peak_pct_bw >= 100 ? P(`• ✅ Lead leg block 우수 (${F(grf.lead_braking_peak_pct_bw, 0)} %BW)`, { color: "1A7F37" }) : null,
  // CoG decel
  cog.decel != null && cog.decel >= 1.5 ? P(`• ✅ CoG deceleration 우수 (${F(cog.decel, 2)} m/s) — block + trunk 활용 좋음`, { color: "1A7F37" }) : null,
  // X-factor
  f.x_factor_deg >= 30 ? P(`• ✅ X-factor 분리 (${F(f.x_factor_deg, 0)}°) — Posture 적정`, { color: "1A7F37" }) : null,

  // ─── 메서드 ───
  H1("📋 분석 방법"),
  P("• 데이터: c3d.txt 9 trial (event 잘못된 trial 6, 10 제외)"),
  P("• 처리 알고리즘: process_pitching_session.py v5.38 (event-free GRF detection)"),
  P("• 분절 ω peak: median across trials"),
  P("• Reference: Driveline Pitching Assessment 표준 (90+ mph cohort) + KR markerless 보정 (markerless 골반 인식 한계 weight 0.5)"),
  P("• 학술 문헌: Aguinaldo 2007/2019, Naito 2008, Howenstein 2020, Werner 2008, MacWilliams 1998, Kageyama 2014"),

  // ─── footnote ───
  P("", { before: 240 }),
  P("⚠ 주의사항", { bold: true }),
  P("1. Theia markerless는 marker-based 시스템 대비 Pelvis ω(-15%), X-factor(-40%) 작게 측정됨 (driveline.js MARKERLESS_CALIBRATION_FACTORS 1.15, 1.65 환산 권장)", { size: 18, color: "888888" }),
  P("2. Scap Load 부호: 우리 측정 negative, Driveline standard positive (절댓값 기준 평가)", { size: 18, color: "888888" }),
  P("3. 일부 GRF 변인 (lead_block_duration, time_of_transfer)은 clip 함수가 outlier 제거 후 None — 다음 라운드 알고리즘 정밀화", { size: 18, color: "888888" }),
];

// null 제거
const finalChildren = children.filter(c => c != null);

// ─── Document ───
const doc = new Document({
  creator: "Sangdong Pitching Lab",
  title: `${m.athlete_name || 'Player'} 1차 투구 리포트`,
  styles: {
    default: { document: { run: { font: "맑은 고딕", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "맑은 고딕", color: "2E75B6" },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 }},
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "맑은 고딕", color: "1F3864" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }},
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "맑은 고딕", color: "2E75B6" },
        paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2 }},
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },   // A4
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: finalChildren
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${outPath} (${buf.length} bytes, ${finalChildren.length} elements)`);
}).catch(e => { console.error(e); process.exit(1); });
