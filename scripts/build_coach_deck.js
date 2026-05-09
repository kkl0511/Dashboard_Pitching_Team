#!/usr/bin/env node
/**
 * build_coach_deck.js — 코치 미팅용 PPTX 자동 생성 (Phase 4 / v2.3)
 *
 * 사용:
 *   node scripts/build_coach_deck.js [--session 1]
 *
 * 결과:
 *   docs/코치미팅_{session}차_{date}.pptx
 *
 * 슬라이드 구성:
 *   1. 표지            (팀명·세션·날짜)
 *   2. 팀 종합          (KPI 카드 4개 + 상위/하위 선수)
 *   3. 선수별 (×N)      (4 KPI + 시퀀스 차트 + ELI 인과 + 권장 훈련)
 *   N+3. 방법론         (analytics v2.1 모델 + 문헌)
 *
 * 데이터 추출:
 *   src/js/analytics.js + src/js/data.js 를 Node.js 컨텍스트에 로드해 DATA, PLAYERS, SESSIONS 사용
 */

const fs   = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = path.dirname(__dirname);
const SRC  = path.join(ROOT, 'src/js');

// ── CLI 인자 ──
const argv = process.argv.slice(2);
const sessionIdx = argv.indexOf('--session');
const SESSION_ID = sessionIdx >= 0 ? parseInt(argv[sessionIdx+1], 10) : 1;

// ── analytics + data 모듈 로드 (브라우저 코드를 Node에서 평가) ──
function loadDataAndAnalytics(){
  // window mock — analytics.js 가 window.ANALYTICS = ANALYTICS 호출
  const win = {};
  global.window = win;
  // analytics.js 평가
  const aCode = fs.readFileSync(path.join(SRC, 'analytics.js'), 'utf8');
  eval(aCode);
  const ANALYTICS = win.ANALYTICS;
  // data.js 평가 — ANALYTICS 가 전역에 있어야 함
  const dCode = fs.readFileSync(path.join(SRC, 'data.js'), 'utf8');
  // PLAYERS, SESSIONS, DATA 를 추출하기 위해 wrap
  const wrap = `${dCode}\n; module.exports = { PLAYERS, SESSIONS, DATA };`;
  // ANALYTICS 를 전역에 노출 (data.js 가 typeof ANALYTICS !== 'undefined' 체크)
  global.ANALYTICS = ANALYTICS;
  // eval 로는 module.exports 사용이 어려우므로 임시 파일 require
  const tmp = path.join('/tmp', '_data_extract.js');
  fs.writeFileSync(tmp, wrap);
  const { PLAYERS, SESSIONS, DATA } = require(tmp);
  return { PLAYERS, SESSIONS, DATA, ANALYTICS };
}

const { PLAYERS, SESSIONS, DATA, ANALYTICS } = loadDataAndAnalytics();
const session = SESSIONS.find(s => s.id === SESSION_ID);
if(!session){ console.error('세션 ID 없음:', SESSION_ID); process.exit(1); }

console.log(`▶ 세션: ${session.label} (${session.date}) ${session.protocol}`);
console.log(`▶ 선수: ${PLAYERS.length}명`);

// ── 색상 팔레트: Ocean Gradient (스포츠과학 분위기) ──
const C = {
  primary:  '065A82',   // 깊은 청
  teal:     '1C7293',   // 보조 — 청록
  midnight: '21295C',   // 표지 배경
  bg:       'F4F7FA',   // 본문 배경
  white:    'FFFFFF',
  text:     '1F2328',
  muted:    '656D76',
  good:     '1A7F37',   // 양호 — 녹
  warn:     'BF8700',   // 주의 — 황
  bad:      'CF222E',   // 경고 — 적
  line:     'D0D7DE'
};

const scoreColor = s => s == null ? C.muted : s >= 80 ? C.good : s >= 60 ? C.warn : C.bad;

// ── PPTX 인스턴스 ──
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';   // 10" × 5.625"
pres.author = '국민대 BBL · 스포츠과학과';
pres.title  = `상동고 투수 ${session.label} 측정 코치 미팅`;
pres.company = '국민대학교 BBL';

const W = 10, H = 5.625;

// ════════════════════════════════════════════════════════
//   슬라이드 1 — 표지
// ════════════════════════════════════════════════════════
function addCoverSlide(){
  const s = pres.addSlide();
  s.background = { color: C.midnight };
  // 액센트 막대
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.4, w: 0.08, h: 1.7,
    fill: { color: C.teal }, line: { type: 'none' }
  });
  s.addText('상동고 투수 측정 리포트', {
    x: 0.8, y: 1.3, w: 8.5, h: 0.6,
    fontSize: 16, color: 'CADCFC', fontFace: 'Apple SD Gothic Neo',
    margin: 0
  });
  s.addText(`${session.label} 측정 — 코치 미팅`, {
    x: 0.8, y: 1.85, w: 8.8, h: 1.0,
    fontSize: 38, color: C.white, fontFace: 'Apple SD Gothic Neo', bold: true,
    margin: 0
  });
  s.addText(`${session.date}  ·  ${session.protocol}  ·  ${PLAYERS.length}명`, {
    x: 0.8, y: 2.85, w: 8.5, h: 0.5,
    fontSize: 18, color: 'CADCFC', fontFace: 'Apple SD Gothic Neo',
    margin: 0
  });
  // 푸터
  s.addText('국민대학교 스포츠과학과 BBL · analytics v2.1', {
    x: 0.5, y: H - 0.5, w: W - 1, h: 0.3,
    fontSize: 10, color: '8B95A1', fontFace: 'Apple SD Gothic Neo', align: 'right'
  });
}

// ════════════════════════════════════════════════════════
//   슬라이드 2 — 팀 종합
// ════════════════════════════════════════════════════════
function addTeamSummarySlide(){
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // 제목
  s.addText('팀 종합 — KPI 및 우수/주의 선수', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo',
    margin: 0
  });
  s.addText(`${session.label} 측정 (${session.date}) · N=${PLAYERS.length}`, {
    x: 0.5, y: 0.78, w: 9, h: 0.3,
    fontSize: 11, color: C.muted, fontFace: 'Apple SD Gothic Neo',
    margin: 0
  });

  // KPI 카드 4개
  const m = PLAYERS.map(p => DATA[p.id][SESSION_ID]).filter(x => x);
  const veloAvg  = m.reduce((a,x) => a + (x.velocity?.measured_kmh || 0), 0) / m.length;
  const veloMax  = Math.max(...m.map(x => x.velocity?.measured_kmh || 0));
  const scoreAvg = m.reduce((a,x) => a + (x.velocity?.score || 0), 0) / m.length;
  const eliAvg   = (function(){
    const v = m.map(x => x.energy?.leakage?.eli_score).filter(x => x != null);
    return v.length ? v.reduce((a,b) => a+b,0)/v.length : null;
  })();
  const cards = [
    { label: '평균 구속',  val: veloAvg.toFixed(1),  unit: 'km/h', sub: `최고 ${veloMax.toFixed(1)} km/h` },
    { label: '평균 종합점수', val: Math.round(scoreAvg), unit: '/100', sub: `${m.length}명 평균` },
    { label: '평균 ELI',  val: eliAvg != null ? Math.round(eliAvg) : '—', unit: '/100', sub: '에너지 누수 관리' },
    { label: '측정 완료', val: m.length,  unit: '명', sub: `세션 ${session.label}` }
  ];
  cards.forEach((c, i) => {
    const x = 0.5 + i * 2.35;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.2, w: 2.2, h: 1.3,
      fill: { color: C.white }, line: { color: C.line, width: 0.5 },
      shadow: { type: 'outer', blur: 8, offset: 2, angle: 90, color: '000000', opacity: 0.06 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.2, w: 0.06, h: 1.3,
      fill: { color: C.primary }, line: { type: 'none' }
    });
    s.addText(c.label, {
      x: x + 0.18, y: 1.28, w: 2.0, h: 0.3,
      fontSize: 11, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(c.val + '', {
      x: x + 0.18, y: 1.5, w: 1.55, h: 0.6,
      fontSize: 28, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(c.unit, {
      x: x + 1.7, y: 1.78, w: 0.5, h: 0.3,
      fontSize: 10, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(c.sub, {
      x: x + 0.18, y: 2.13, w: 2.0, h: 0.3,
      fontSize: 9, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
  });

  // 상위/하위 (구속 기준) 표
  const sorted = PLAYERS
    .map(p => ({ p, m: DATA[p.id][SESSION_ID] }))
    .filter(x => x.m && x.m.velocity)
    .sort((a,b) => b.m.velocity.measured_kmh - a.m.velocity.measured_kmh);
  const top3 = sorted.slice(0, 3);
  const bot3 = sorted.slice(-3).reverse();

  // 상위 3명 박스
  s.addText('상위 3명 (구속)', {
    x: 0.5, y: 2.7, w: 4.5, h: 0.3,
    fontSize: 12, bold: true, color: C.good, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const tableTop = top3.map((x, i) => [
    `${i+1}`,
    `${x.p.id} ${x.p.name}`,
    `${x.m.velocity.measured_kmh.toFixed(1)} km/h`,
    `종합 ${x.m.velocity.score}`
  ]);
  s.addTable(tableTop, {
    x: 0.5, y: 3.05, w: 4.5,
    fontSize: 11, fontFace: 'Apple SD Gothic Neo', color: C.text,
    border: { type: 'solid', pt: 0.5, color: C.line },
    colW: [0.4, 1.7, 1.4, 1.0],
    rowH: 0.36,
    fill: { color: C.white }
  });

  // 주의 3명 박스
  s.addText('주의 3명 (구속)', {
    x: 5.2, y: 2.7, w: 4.5, h: 0.3,
    fontSize: 12, bold: true, color: C.bad, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const tableBot = bot3.map((x, i) => [
    `${i+1}`,
    `${x.p.id} ${x.p.name}`,
    `${x.m.velocity.measured_kmh.toFixed(1)} km/h`,
    `종합 ${x.m.velocity.score}`
  ]);
  s.addTable(tableBot, {
    x: 5.2, y: 3.05, w: 4.5,
    fontSize: 11, fontFace: 'Apple SD Gothic Neo', color: C.text,
    border: { type: 'solid', pt: 0.5, color: C.line },
    colW: [0.4, 1.7, 1.4, 1.0],
    rowH: 0.36,
    fill: { color: C.white }
  });

  // 핵심 시사점
  s.addText('핵심 시사점', {
    x: 0.5, y: 4.4, w: 9, h: 0.28,
    fontSize: 12, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const insights = generateTeamInsights(m, session);
  s.addText(insights.map((t, i) => ({
    text: t, options: { bullet: true, breakLine: i < insights.length - 1 }
  })), {
    x: 0.5, y: 4.7, w: 9, h: 0.55,
    fontSize: 10, color: C.text, fontFace: 'Apple SD Gothic Neo', margin: 0,
    paraSpaceAfter: 1
  });

  addFooter(s);
}

function generateTeamInsights(measurements, session){
  const out = [];
  const valid = measurements.filter(x => x.velocity);
  const veloAvg = valid.reduce((a,x) => a + x.velocity.measured_kmh, 0) / valid.length;
  out.push(`팀 평균 구속 ${veloAvg.toFixed(1)} km/h — 동급 고교 평균(약 130 km/h) 대비 비교 필요`);
  // ELI < 60 인원
  const lowEli = valid.filter(x => x.energy?.leakage?.eli_score != null && x.energy.leakage.eli_score < 60);
  if(lowEli.length) out.push(`ELI 60 미만 ${lowEli.length}명 — 누수 zone 분석 우선 필요 (개별 슬라이드 참조)`);
  // 부상 위험 high
  const highRisk = valid.filter(x => x.faults?.injury_risk === 'high');
  if(highRisk.length) out.push(`부상 위험도 high ${highRisk.length}명 — 자세한 X-factor / lead knee 분석 필요`);
  return out;
}

// ════════════════════════════════════════════════════════
//   슬라이드 — 선수별 (1명당 1슬라이드)
// ════════════════════════════════════════════════════════
function addPlayerSlide(p){
  const m = DATA[p.id][SESSION_ID];
  if(!m){ return; }
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // 헤더 — 좌측 PID 배지 + 이름
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: W, h: 0.85,
    fill: { color: C.primary }, line: { type: 'none' }
  });
  s.addText(p.id, {
    x: 0.4, y: 0.18, w: 0.85, h: 0.5,
    fontSize: 22, bold: true, color: 'CADCFC', fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  s.addText(p.name, {
    x: 1.3, y: 0.18, w: 5, h: 0.5,
    fontSize: 24, bold: true, color: C.white, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  s.addText(
    `${p.arm === 'L' ? '좌투' : '우투'} · ${p.height}cm · ${p.weight}kg · ${session.label} (${session.date})`, {
    x: 0.4, y: 0.55, w: 6, h: 0.25,
    fontSize: 10.5, color: 'CADCFC', fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  // 우측 종합 점수
  s.addText(`종합 ${m.velocity.score}`, {
    x: 7.5, y: 0.2, w: 2.2, h: 0.5,
    fontSize: 22, bold: true, color: C.white, fontFace: 'Apple SD Gothic Neo', align: 'right', margin: 0
  });
  s.addText('/100', {
    x: 7.5, y: 0.55, w: 2.2, h: 0.25,
    fontSize: 10, color: 'CADCFC', fontFace: 'Apple SD Gothic Neo', align: 'right', margin: 0
  });

  // v4.1: 5 KPI 카드 (측정 / 체력 / 출력 / 전달 / 누수) + 부상·AE 인라인
  const eg = m.energy?.generation, et = m.energy?.transfer, el = m.energy?.leakage;
  const kpis = [
    { label: '측정 구속', val: m.velocity.measured_kmh.toFixed(1), unit: 'km/h', color: '#0969da',
      sub: m.velocity.velo_group ? `${m.velocity.velo_group} 그룹` : '' },
    { label: '체력 Ceiling', val: (m.velocity.predicted_kmh ?? m.velocity.potential_kmh).toFixed(1), unit: 'km/h', color: '#bc4c00',
      sub: 'Predicted Velo' },
    { label: '⚡ 힘 만들기', val: eg?.score ?? '—', unit: '/100', color: '#1a7f37',
      sub: '출력 (Output)' },
    { label: '🔗 힘 전달', val: et?.score ?? '—', unit: '/100', color: '#8250df',
      sub: '전달 (Transfer)' },
    { label: '💧 힘 보존', val: el?.eli_score ?? '—', unit: '/100', color: '#cf222e',
      sub: '누수 관리 (역 ELI)' }
  ];
  // 5개 카드: 폭 1.85, 간격 0.05 → 5*1.85 + 4*0.05 = 9.45 + 좌우 여백 0.275
  kpis.forEach((k, i) => {
    const x = 0.275 + i * 1.90;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w: 1.85, h: 0.95,
      fill: { color: C.white }, line: { color: C.line, width: 0.5 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w: 0.05, h: 0.95,
      fill: { color: k.color }, line: { type: 'none' }
    });
    s.addText(k.label, {
      x: x + 0.12, y: 1.10, w: 1.7, h: 0.22,
      fontSize: 9, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(k.val + '', {
      x: x + 0.12, y: 1.32, w: 1.4, h: 0.45,
      fontSize: 22, bold: true, color: k.color, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(k.unit, {
      x: x + 1.15, y: 1.50, w: 0.65, h: 0.25,
      fontSize: 9, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(k.sub, {
      x: x + 0.12, y: 1.78, w: 1.7, h: 0.20,
      fontSize: 8, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
  });

  // 부상위험 + AE 인라인 (5 KPI 아래 작은 박스)
  const aeColor = (m.velocity.ae_kmh ?? 0) >= 3 ? C.good : (m.velocity.ae_kmh ?? 0) >= -3 ? C.primary : C.bad;
  const riskTxt = ({low:'낮음',mid:'중간',high:'높음'})[m.faults.injury_risk] || '—';
  const aeText = m.velocity.ae_label
    ? `${m.velocity.ae_label}  (${m.velocity.ae_kmh >= 0 ? '+' : ''}${m.velocity.ae_kmh} km/h)`
    : '—';
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.275, y: 2.10, w: 9.45, h: 0.30,
    fill: { color: '#f6f8fa' }, line: { color: C.line, width: 0.4 }
  });
  s.addText([
    { text: '부상위험: ', options: { bold: true } },
    { text: riskTxt + '  |  ', options: { color: m.faults.injury_risk === 'high' ? C.bad : m.faults.injury_risk === 'mid' ? C.warn : C.good } },
    { text: '메카닉 효율 (AE): ', options: { bold: true } },
    { text: aeText, options: { color: aeColor, bold: true } }
  ], {
    x: 0.4, y: 2.13, w: 9.2, h: 0.25,
    fontSize: 10, color: C.text, fontFace: 'Apple SD Gothic Neo', margin: 0
  });

  // 좌측 — 시퀀스 차트 (y 위치 조정: 5 KPI + 부상/AE 인라인 아래)
  s.addText('관절 분절 시퀀스 (피크 회전속도)', {
    x: 0.4, y: 2.50, w: 4.6, h: 0.25,
    fontSize: 10.5, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  s.addChart(pres.charts.BAR, [{
    name: p.name,
    labels: ['골반', '몸통', '팔'],
    values: [m.sequence.pelvis_dps, m.sequence.trunk_dps, m.sequence.arm_dps]
  }], {
    x: 0.4, y: 2.78, w: 4.6, h: 1.55,
    barDir: 'col',
    chartColors: [C.primary, C.teal, '4D9DB8'],
    chartArea: { fill: { color: C.white }, roundedCorners: false },
    catAxisLabelColor: C.muted, catAxisLabelFontSize: 9,
    valAxisLabelColor: C.muted, valAxisLabelFontSize: 9,
    valGridLine: { color: 'EAEEF2', size: 0.5 },
    catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd',
    dataLabelColor: C.text, dataLabelFontSize: 9,
    showLegend: false
  });

  // v4.3-B: 자동 진단 (좌측 절반) + HP Assessment 5변수 (우측 절반) 통합 카드
  if(m.velocity.diagnosis){
    const d = m.velocity.diagnosis;
    // 큰 외곽 박스 (전체 너비 4.6, 높이 1.10)
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 4.40, w: 4.6, h: 1.10,
      fill: { color: '#fafbfc' }, line: { color: aeColor, width: 1.5 }
    });
    // 좌측 절반 — 자동 진단 텍스트
    s.addText('📊 자동 진단', {
      x: 0.5, y: 4.45, w: 2.0, h: 0.20,
      fontSize: 10, bold: true, color: aeColor, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText(d.primary_finding, {
      x: 0.5, y: 4.66, w: 2.0, h: 0.40,
      fontSize: 8.5, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
    s.addText('💡 ' + d.recommendation, {
      x: 0.5, y: 5.06, w: 2.0, h: 0.40,
      fontSize: 7.5, color: C.text, fontFace: 'Apple SD Gothic Neo', margin: 0
    });

    // 세로 구분선
    s.addShape(pres.shapes.LINE, {
      x: 2.65, y: 4.50, w: 0, h: 0.95,
      line: { color: C.line, width: 0.5, dashType: 'dash' }
    });

    // 우측 절반 — HP Assessment 5 변수 mini visualization
    s.addText('💪 체력 5 변수 (본인 ▼ vs Velo Group)', {
      x: 2.75, y: 4.45, w: 2.2, h: 0.18,
      fontSize: 8.5, bold: true, color: '#bc4c00', fontFace: 'Apple SD Gothic Neo', margin: 0
    });

    if(m.fitness){
      const vars = [
        { label: 'CMJ JH',   val: m.fitness.cmj?.jump_height_cm,        unit: 'cm',   range: [25, 50] },
        { label: 'CMJ PP',   val: m.fitness.cmj?.peak_power_bm_w_kg,    unit: 'W/kg', range: [20, 35] },
        { label: 'IMTP',     val: m.fitness.imtp?.peak_force_bm_n_kg,   unit: 'N/kg', range: [18, 35] },
        { label: 'Hop RSI',  val: m.fitness.pogo?.rsi_ms,                unit: '',     range: [1.5, 3.0] },
        { label: 'Grip',     val: 50 + 5,                                unit: 'kg',   range: [45, 70] }
      ];
      vars.forEach((v, vi) => {
        if(v.val == null) return;
        const yLine = 4.66 + vi * 0.16;
        const lineW = 1.20;
        const xStart = 3.40;
        const ratio = Math.max(0, Math.min(1, (v.val - v.range[0]) / (v.range[1] - v.range[0])));

        // 라벨
        s.addText(v.label, {
          x: 2.75, y: yLine - 0.02, w: 0.65, h: 0.13,
          fontSize: 7.5, color: C.text, fontFace: 'Apple SD Gothic Neo', margin: 0
        });
        // 4 그룹 색 그라데이션 라인
        ['7e57c2','e91e63','ff9800','ff6f00'].forEach((col, gi) => {
          s.addShape(pres.shapes.RECTANGLE, {
            x: xStart + gi * (lineW/4), y: yLine + 0.025, w: lineW/4 - 0.005, h: 0.06,
            fill: { color: col, transparency: 50 }, line: { type: 'none' }
          });
        });
        // 본인 위치 (▼ 진한 파란 막대)
        s.addShape(pres.shapes.RECTANGLE, {
          x: xStart + ratio * lineW - 0.025, y: yLine + 0.005, w: 0.05, h: 0.10,
          fill: { color: '0969da' }, line: { color: 'FFFFFF', width: 0.8 }
        });
        // 값
        s.addText(typeof v.val === 'number' ? v.val.toFixed(1) + (v.unit ? ' ' + v.unit : '') : v.val, {
          x: 4.65, y: yLine - 0.02, w: 0.30, h: 0.13,
          fontSize: 7.5, bold: true, color: '0969da', fontFace: 'Apple SD Gothic Neo',
          align: 'right', margin: 0
        });
      });
    } else {
      s.addText('체력 데이터 미입력', {
        x: 2.75, y: 4.85, w: 2.2, h: 0.20,
        fontSize: 9, italic: true, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
      });
    }
  }

  // 우측 — 인과 chains + 권장 (y 조정)
  s.addText('💧 누수 인과 분석 (Top 3) — Per 1 km/h', {
    x: 5.2, y: 2.50, w: 4.4, h: 0.25,
    fontSize: 10.5, bold: true, color: C.bad, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const causal = m.energy?.leakage?.causal_chains || [];
  const tipMap = {
    zone1: '분절 가속 타이밍 훈련 (medicine ball 회전)',
    zone2: 'X-factor 증대 — hip-shoulder 분리 stretch',
    zone3: 'Lead leg 강화 — 단일하지 박스점프, 제자리 깊은 스쿼트',
    zone4: 'Trunk control — anti-rotation core (palloff press)',
    zone5: 'Shoulder ER ROM — sleeper stretch + cuff 강화',
    zone6: 'Pelvis brake — 단일하지 RFE 스플릿 스쿼트, 디셀러레이션 드릴'
  };
  causal.slice(0, 3).forEach((c, i) => {
    const y = 2.78 + i * 0.85;
    const colr = i === 0 ? C.bad : i === 1 ? C.warn : C.primary;
    // 번호 박스
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y, w: 0.4, h: 0.75,
      fill: { color: colr }, line: { type: 'none' }
    });
    s.addText(`${i+1}`, {
      x: 5.2, y: y + 0.18, w: 0.4, h: 0.4,
      fontSize: 18, bold: true, color: C.white, fontFace: 'Apple SD Gothic Neo',
      align: 'center', margin: 0
    });
    // 본문 박스
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.6, y, w: 4, h: 0.75,
      fill: { color: C.white }, line: { color: C.line, width: 0.5 }
    });
    s.addText([
      { text: c.defect, options: { fontSize: 11, bold: true, color: C.midnight, breakLine: true } },
      { text: `${c.zone_label}  ·  손실 ${c.impact_kmh} km/h`, options: { fontSize: 9, color: C.muted, breakLine: true } },
      { text: `→ ${tipMap[c.zone] || '추가 분석 권장'}`, options: { fontSize: 10, color: C.primary, italic: true } }
    ], {
      x: 5.7, y: y + 0.05, w: 3.85, h: 0.7,
      fontFace: 'Apple SD Gothic Neo', margin: 0,
      paraSpaceAfter: 0, valign: 'top'
    });
  });

  if(causal.length === 0){
    s.addText('인과 chain 데이터 없음 (Uplift 회차)', {
      x: 5.2, y: 3, w: 4.4, h: 0.3,
      fontSize: 11, color: C.muted, italic: true, fontFace: 'Apple SD Gothic Neo', margin: 0
    });
  }

  addFooter(s);
}

// ════════════════════════════════════════════════════════
//   슬라이드 마지막 — 방법론
// ════════════════════════════════════════════════════════
function addMethodologySlide(){
  const s = pres.addSlide();
  s.background = { color: C.bg };
  s.addText('분석 방법론 (analytics v2.1)', {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: C.midnight, fontFace: 'Apple SD Gothic Neo', margin: 0
  });

  // 잠재구속 회귀
  s.addText('잠재 구속 회귀 — 7개 변수 가법 모델', {
    x: 0.5, y: 1.0, w: 9, h: 0.3,
    fontSize: 13, bold: true, color: C.primary, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const lvWeights = ANALYTICS.LATENT_VELOCITY_WEIGHTS;
  const lvRows = [
    [{ text: '변수', options: { bold: true, fill: { color: C.primary }, color: C.white } },
     { text: '임계치', options: { bold: true, fill: { color: C.primary }, color: C.white } },
     { text: '최대 기여 (km/h)', options: { bold: true, fill: { color: C.primary }, color: C.white } },
     { text: '문헌', options: { bold: true, fill: { color: C.primary }, color: C.white } }]
  ];
  Object.entries(lvWeights).forEach(([k, spec]) => {
    lvRows.push([k, spec.th + '', spec.max + '', spec.src]);
  });
  s.addTable(lvRows, {
    x: 0.5, y: 1.35, w: 5.7, fontSize: 9.5,
    fontFace: 'Apple SD Gothic Neo', color: C.text,
    border: { type: 'solid', pt: 0.5, color: C.line },
    colW: [2.0, 0.9, 1.4, 1.4],
    rowH: 0.27, fill: { color: C.white }
  });

  // ELI 6 zone
  s.addText('ELI 6 Zones', {
    x: 6.5, y: 1.0, w: 3.2, h: 0.3,
    fontSize: 13, bold: true, color: C.primary, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  const eliRows = [
    [{ text: 'Zone', options: { bold: true, fill: { color: C.primary }, color: C.white } },
     { text: '내용', options: { bold: true, fill: { color: C.primary }, color: C.white } }],
    ['Z1', 'Sequential timing'],
    ['Z2', 'X-factor 분리'],
    ['Z3', 'Lead leg block'],
    ['Z4', 'Trunk at FC'],
    ['Z5', 'Shoulder ER'],
    ['Z6', 'Pelvis braking']
  ];
  s.addTable(eliRows, {
    x: 6.5, y: 1.35, w: 3.2, fontSize: 9.5,
    fontFace: 'Apple SD Gothic Neo', color: C.text,
    border: { type: 'solid', pt: 0.5, color: C.line },
    colW: [0.6, 2.6], rowH: 0.27, fill: { color: C.white }
  });

  // 한계
  s.addText('한계 및 주의', {
    x: 0.5, y: 4.15, w: 9, h: 0.3,
    fontSize: 12, bold: true, color: C.bad, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  s.addText([
    { text: '회귀 계수는 문헌 기반 합의 추정값 — 우리 코호트(N=20)에 fit 된 값 아님', options: { bullet: true, breakLine: true } },
    { text: 'causal chain의 km/h 손실은 추정 — 단일 변수 한계 효과 해석', options: { bullet: true, breakLine: true } },
    { text: 'Uplift 회차는 GRF 없음 — Z3, Z4, Z6 제한', options: { bullet: true } }
  ], {
    x: 0.5, y: 4.5, w: 9, h: 1, fontSize: 10, color: C.text,
    fontFace: 'Apple SD Gothic Neo', margin: 0, paraSpaceAfter: 3
  });

  addFooter(s);
}

// ════════════════════════════════════════════════════════
//   푸터 (공통)
// ════════════════════════════════════════════════════════
function addFooter(s){
  s.addShape(pres.shapes.LINE, {
    x: 0.4, y: H - 0.35, w: W - 0.8, h: 0,
    line: { color: C.line, width: 0.5 }
  });
  s.addText(`상동고 투구 리포트 · ${session.label} 측정 (${session.date})`, {
    x: 0.4, y: H - 0.3, w: W - 0.8, h: 0.25,
    fontSize: 8, color: C.muted, fontFace: 'Apple SD Gothic Neo', margin: 0
  });
  s.addText('국민대 BBL · analytics v2.1', {
    x: 0.4, y: H - 0.3, w: W - 0.8, h: 0.25,
    fontSize: 8, color: C.muted, fontFace: 'Apple SD Gothic Neo',
    align: 'right', margin: 0
  });
}

// ════════════════════════════════════════════════════════
//   생성
// ════════════════════════════════════════════════════════
addCoverSlide();
addTeamSummarySlide();
PLAYERS.forEach(p => addPlayerSlide(p));
addMethodologySlide();

const outDir = path.join(ROOT, 'docs');
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `코치미팅_${session.label}_${session.date}.pptx`);
pres.writeFile({ fileName: outFile }).then(name => {
  const stat = fs.statSync(name);
  console.log(`✓ ${name}`);
  console.log(`  ${(stat.size/1024).toFixed(1)} KB · ${PLAYERS.length + 3}슬라이드`);
});
