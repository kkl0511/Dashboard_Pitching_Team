# SPLIT_WORKFLOW — 큰 모듈 안전 분리 표준 절차

v5.26 (render.js → 5개), v5.27 (analytics.js → 3개, io.js → 4개) 분리 작업에서 검증된 패턴.

> **언제 쓸까**: 단일 src/js 파일이 1,000줄을 넘고, 기능이 명확하게 그룹화될 때.
> **목표**: 0개의 함수 손실, 0개의 동작 변경, 빌드 결과(dashboard.html) 사실상 동일.

## 핵심 원칙

1. **단순 텍스트 분할만 한다** — `sed -n 'A,Bp'` 로 라인 범위만 자른다. 함수 본문 수정 금지.
2. **함수 경계에서만 자른다** — 분리점은 `}` 직후 + 빈 줄 + 다음 섹션 배너여야 한다.
3. **build_dashboard.js는 단일 `<script>` blob에 concat한다** — 따라서 scope 격리 없음. `const`/`let`/`function` 모두 그대로 보존된다 (IIFE 도입 금지).
4. **원본은 백업한다** — `mv original.js original.js.bak_v5.XX`. 빌드 정상 확인 후 다음 라운드에서 삭제.
5. **export object는 마지막 모듈에 둔다** — 예: `ANALYTICS = {...}`는 `analytics_mechanic.js` 끝에. 모든 의존 함수가 먼저 정의되어야 export 가능.

## 6단계 절차

### Step 1: 함수/배너 grep으로 경계 매핑

```bash
cd "/sessions/.../Dashboard_Pitching_Team/src/js"

# 함수 정의 라인
grep -nE "^(function|const|let|var)\s+\w+" target.js

# 섹션 배너 (긴 시각적 구분선)
grep -nE "^/\*\s*[╔━═─]{3,}|^//\s*[━═─]{3,}" target.js

# 배너 직후 한 줄 (섹션 제목 확인)
for ln in 16 680 891 1379 ...; do
  echo "--- line $ln ---"
  sed -n "${ln},$((ln+3))p" target.js
done
```

이 결과로 자연스러운 분리 후보(섹션 배너)와 후보 라인 범위를 결정한다.

### Step 2: 사용자 승인 (분리 범위)

- **AskUserQuestion 도구로 옵션 제시** — "안전 (5개) / 보수 (3개) / 공격 (8개)" 식으로.
- 사용자가 코딩 초보임을 고려해 **추천안을 첫 옵션** + (Recommended) 표기.
- 의존성·risk 평가를 옵션 description에 명시.

### Step 3: sed 분할 + 합계 검증

분리 경계가 깔끔한지 먼저 확인:

```bash
# 분리 후보 라인 직전·직후 5줄 보기
echo "--- A↔B 경계 ---"
sed -n "$((A-2)),$((A+3))p" target.js
# 기대: "}" + 빈 줄 + "/* ────" 배너
```

OK이면 분할 실행:

```bash
sed -n '1,A p'      target.js > target_part1.js
sed -n '$((A+1)),B p' target.js > target_part2.js
# ...

# 합계 라인 수 검증 (원본과 정확히 같아야 함)
wc -l target_part*.js
echo "합계: $(cat target_part*.js | wc -l) (원본: $(wc -l < target.js))"
# 두 숫자가 일치해야 OK
```

### Step 4: 원본 백업

```bash
mv target.js target.js.bak_v5.XX
```

이렇게 하면 build_dashboard.js의 `JS_MODULES.every(exists)` 가 false가 되어 fallback 경로로 빠지지 않게 모듈 등록을 마쳐야 한다.

### Step 5: build_dashboard.js의 JS_MODULES 등록 + 빌드

```js
// scripts/build_dashboard.js
const JS_MODULES = [
  'js/driveline.js',
  'js/target_part1.js',  // 추가
  'js/target_part2.js',  // 추가
  // 기존 'js/target.js' 제거
  ...
];
```

**의존성 순서가 중요**:
- export object를 만드는 모듈은 의존하는 모든 함수가 정의된 **다음**에 와야 함
- ANALYTICS export는 `analytics_mechanic.js` 끝에 있고, 그 안의 함수들은 같은 파일에 모두 정의되어 있음 → OK
- driveline.js의 함수를 ANALYTICS export가 참조 → driveline.js를 analytics보다 먼저 로드

빌드:
```bash
node scripts/build_dashboard.js
```

### Step 6: verify_build.sh로 무결성 검증

```bash
bash skills/sangdong-dashboard/scripts/verify_build.sh
```

이 스크립트는:
- 핵심 함수가 dashboard.html에 정확히 1회 등장하는지 (누락·중복 0)
- 핵심 const/let 객체 1회 등장
- `window.ANALYTICS` 등록 1회
- 모듈 banner 개수 = JS_MODULES 배열 길이
- dashboard.html 크기 450-500KB 범위

→ 모두 ✓ 면 분리 성공. 사용자에게 브라우저 콘솔 에러 없는지 확인 요청.

## 자주 만나는 함정

### 함정 1: 함수 중간에서 절단
경계 후보가 함수 중간이면 그 함수 전체가 다음 모듈로 이동해야 함. 절대 함수를 둘로 쪼개지 말 것.

### 함정 2: top-level 코드를 분산
`document.querySelectorAll('.tab-btn').forEach(...)` 같은 top-level 이벤트 등록은 같은 파일의 의존 함수 (예: `switchTab`) 정의 **이후**에 와야 함. 분리 시 의존 함수와 같은 모듈에 두는 게 안전.

### 함정 3: export object의 의존성
`const ANALYTICS = { funcA, funcB, ... }` 가 analytics_mechanic.js에 있다면, funcA·funcB가 **같거나 더 앞선 모듈**에 정의되어 있어야 함. JS_MODULES 순서로 실행되므로 export object 모듈이 마지막이 되도록 배치.

### 함정 4: 백업 파일이 모듈로 인식
`render.js.bak_v5.25` 같은 백업이 `JS_MODULES`의 glob 패턴에 걸리지 않도록 주의. 현재 build script는 명시적 배열이라 안전, 하지만 glob을 쓸 경우 `.bak_*` 제외 필요.

## 분리 후 다음 라운드 후보 식별

분리 직후 src/js의 줄 수를 다시 확인:
```bash
wc -l src/js/*.js | sort -rn
```

여전히 1,000줄 넘는 파일은 다음 라운드 후보로 HANDOFF의 §7 다음 작업 후보에 명시한다 (현재 v5.27 기준 후보: `render_player_cards.js` 1,134줄).

## 검증된 분리 사례

| 라운드 | 원본 | 분리 결과 |
|---|---|---|
| v5.25 | analytics.js (2,575) → analytics(2,228) + driveline(369) | driveline framework 추출 |
| v5.26 | render.js (2,458) | render_m1(289) / render_player(579) / render_player_cards(1,134) / render_long(263) / render_common(193) |
| v5.27 | analytics.js (2,233) | analytics_velocity(890) / analytics_fitness(488) / analytics_mechanic(855, +ANALYTICS export) |
| v5.27 | io.js (1,248) | io_apply(279) / io_c3d(490) / io_csv(390) / io_storage(89) |

모두 무결성 검증 PASS, dashboard.html 동작 차이 없음.
