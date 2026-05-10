#!/usr/bin/env node
/**
 * build_dashboard.js — src/ 모듈 → dashboard.html 합성
 * 사용: node scripts/build_dashboard.js
 *
 * 입력 (src/):
 *   index.html       HTML 골격 (placeholder: <!-- MAIN_SCRIPTS -->, <link href="style.css">)
 *   style.css        분리된 CSS
 *   js/data.js       데이터 스키마 + 헬퍼 (PLAYERS, SESSIONS, genMeasurements)
 *   js/render.js     탭별 렌더링 (TAB1-4, 차트, 비교)
 *   js/io.js         JSON/CSV 파싱 + localStorage
 *   js/reports_init.js 리포트 + 초기 와이어업
 *
 * 출력:
 *   dashboard.html       데스크탑 풀 기능 (Chart.js CDN)
 *   dashboard_mobile.html 모바일 SVG 차트 lite
 *
 * 폴백: js/main.js (단일파일) 가 있으면 모듈 대신 그것을 사용 (마이그레이션 호환)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const SRC = path.join(ROOT, 'src');

// 모듈 합성 순서 (의존성 순):  driveline → analytics → data → render → io → reports_init
// v5.25: driveline.js를 analytics.js보다 먼저 로드 (ANALYTICS export에 통합되도록)
const JS_MODULES = ['js/driveline.js', 'js/analytics.js', 'js/data.js', 'js/render.js', 'js/io.js', 'js/reports_init.js'];

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(SRC, rel));
}

function readAllJS() {
  // 모듈 분할이 완료된 경우 모듈 합성, 아니면 단일 main.js
  const allModulesExist = JS_MODULES.every(exists);
  if (allModulesExist) {
    const banner = (m) => `\n/* ===== ${m} ===== */\n`;
    return JS_MODULES.map(m => banner(m) + read(m)).join('\n');
  }
  if (exists('js/main.js')) {
    console.log('  ⚠ 모듈 일부 누락 — js/main.js 단일파일 사용');
    return read('js/main.js');
  }
  throw new Error('src/js/ 에 모듈도 main.js도 없습니다.');
}

function buildHTML({ chartScript, mobileMode = false }) {
  const css = read('style.css');
  const js = readAllJS();
  let html = read('index.html');

  // CSS 인라인 (별도 파일 필요 없게)
  html = html.replace('<link rel="stylesheet" href="style.css">',
    `<style>\n${css}\n</style>`);

  // <!-- MAIN_SCRIPTS --> 자리에 Chart.js + 합성 JS
  html = html.replace('<!-- MAIN_SCRIPTS -->',
    `${chartScript}\n<script>\n${js}\n</script>`);

  // 모바일 모드 표시
  if (mobileMode) {
    html = html.replace('v1.1 · 상반기 1차 측정 중심', 'v2.0 · 📱 모바일 (SVG 차트)');
  } else {
    html = html.replace('v1.1 · 상반기 1차 측정 중심', 'v2.0 · 데스크탑');
  }

  return html;
}

// 데스크탑: Chart.js CDN
const desktopChartCDN =
  '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>';

// 모바일: Chart 객체를 SVG 렌더러 stub으로 대체 (이미 dashboard_mobile.html v1.12에서 검증됨)
const mobileSvgStub = fs.existsSync(path.join(ROOT, 'src/js/svg_chart_stub.js'))
  ? '<script>\n' + fs.readFileSync(path.join(ROOT, 'src/js/svg_chart_stub.js'), 'utf8') + '\n</script>'
  : desktopChartCDN; // fallback

// ── 빌드 ──
fs.writeFileSync(path.join(ROOT, 'dashboard.html'),
  buildHTML({ chartScript: desktopChartCDN, mobileMode: false }));
console.log('✓ dashboard.html       ', fs.statSync(path.join(ROOT, 'dashboard.html')).size, 'bytes');

if (fs.existsSync(path.join(ROOT, 'src/js/svg_chart_stub.js'))) {
  fs.writeFileSync(path.join(ROOT, 'dashboard_mobile.html'),
    buildHTML({ chartScript: mobileSvgStub, mobileMode: true }));
  console.log('✓ dashboard_mobile.html', fs.statSync(path.join(ROOT, 'dashboard_mobile.html')).size, 'bytes');
} else {
  console.log('  (svg_chart_stub.js 없음 — 모바일 빌드 스킵)');
}

console.log('\n빌드 완료. src/ 편집 후 이 스크립트 다시 실행 → dashboard.html 자동 갱신');
