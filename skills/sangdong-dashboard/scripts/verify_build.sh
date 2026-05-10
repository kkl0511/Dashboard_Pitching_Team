#!/usr/bin/env bash
# verify_build.sh — dashboard.html 빌드 결과물 무결성 검증
#
# 사용:
#   cd Dashboard_Pitching_Team
#   bash skills/sangdong-dashboard/scripts/verify_build.sh
#
# 검증 항목:
#   1. 파일 크기 합리적 (450-500KB)
#   2. 핵심 함수 27개 정확히 1회 등장 (누락·중복 0)
#   3. 핵심 const/let 객체 12개 정확히 1회 등장
#   4. window.ANALYTICS 등록 1회
#   5. 모듈 banner 개수 = JS_MODULES 배열 길이

set -e

DASHBOARD="dashboard.html"
BUILD_SCRIPT="scripts/build_dashboard.js"

if [ ! -f "$DASHBOARD" ]; then
  echo "❌ $DASHBOARD 가 없습니다. 먼저 'node $BUILD_SCRIPT' 실행하세요."
  exit 1
fi

PASS=0
FAIL=0

check() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf "  ✅  %-40s %s\n" "$label" "$actual"
    PASS=$((PASS+1))
  else
    printf "  ❌  %-40s %s (expected %s)\n" "$label" "$actual" "$expected"
    FAIL=$((FAIL+1))
  fi
}

check_range() {
  local label="$1"
  local actual="$2"
  local min="$3"
  local max="$4"
  if [ "$actual" -ge "$min" ] && [ "$actual" -le "$max" ]; then
    printf "  ✅  %-40s %s (range %s-%s)\n" "$label" "$actual" "$min" "$max"
    PASS=$((PASS+1))
  else
    printf "  ❌  %-40s %s (expected %s-%s)\n" "$label" "$actual" "$min" "$max"
    FAIL=$((FAIL+1))
  fi
}

echo "=== 1. 파일 크기 ==="
SIZE=$(stat -f%z "$DASHBOARD" 2>/dev/null || stat -c%s "$DASHBOARD")
check_range "$DASHBOARD bytes" "$SIZE" 400000 550000

echo ""
echo "=== 2. 핵심 함수 (정확히 1회 등장 보장) ==="
for fn in \
  predictVelocityOBP dualReferenceDiagnosis fiveAxisDiagnosis fourAxisDiagnosis \
  predictMaxVelocityKR valdPercentile gradePercentile pairedTTest \
  latentVelocity commandComposite eliScoresFromTheia injuryRisk grfScore stuffScore \
  compositeScore percentileRank \
  parseTheiaJson applyTheiaRecord enrichWithAnalytics \
  parseC3DTxtTrial synthesizeRecordFromTrials \
  importValdCSV importRapsodoCSV \
  saveToStorage loadFromStorage \
  renderPlayerView v514_renderMechanicTables switchTab; do
  count=$(grep -c "function $fn" "$DASHBOARD")
  check "function $fn" "$count" 1
done

echo ""
echo "=== 3. 핵심 const/let 객체 ==="
for v in \
  DRIVELINE_5_MODELS DRIVELINE_HP_6_MODELS \
  OBP_VELO_MODEL VALD_NORMS GRADE_BENCHMARKS \
  DE_LEVA_PARAMS GRF_BENCHMARKS COMPOSITE_WEIGHTS \
  ANALYTICS REAL_DATA_KEYS RAPSODO_BENCHMARKS STORAGE_KEY; do
  count=$(grep -cE "(const|let|var) $v\b" "$DASHBOARD")
  check "var $v" "$count" 1
done

echo ""
echo "=== 4. ANALYTICS 전역 등록 ==="
ana_count=$(grep -c "window.ANALYTICS = ANALYTICS" "$DASHBOARD")
check "window.ANALYTICS 등록" "$ana_count" 1

echo ""
echo "=== 5. 모듈 banner 개수 = JS_MODULES 배열 길이 ==="
banner_count=$(grep -c "===== js/" "$DASHBOARD")
js_modules_count=$(grep -E "^\s*'js/" "$BUILD_SCRIPT" | wc -l | tr -d ' ')
check "module banners" "$banner_count" "$js_modules_count"

echo ""
echo "================================="
printf "  PASS: %d  FAIL: %d\n" "$PASS" "$FAIL"
echo "================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
