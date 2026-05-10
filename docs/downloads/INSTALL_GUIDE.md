# 상동고 투구 리포트 — Electron 데스크탑 앱 설치 가이드 (Windows PC)

**대상:** 측정실 / 코칭 현장 윈도우 PC 운영자
**소요 시간:** 약 30분 (한 번만)
**버전:** v5.40 (2026-05)

---

## 📦 다운로드 (3가지)

| 파일 | 크기 | 용도 |
|---|---:|---|
| **Setup.exe** (배포 전용) | ~80 MB | 윈도우 PC 한 번 설치하면 끝 |
| `Dashboard_Electron_source_v5.40.zip` | 2.5 MB | 직접 빌드 시 (개발자 또는 자체 커스터마이징) |
| `TestPlayer_10trial_c3d.zip` | 6.9 MB | 검증용 c3d.txt 샘플 10 trial |
| `rapsodo_TEST_10trial.csv` | 1 KB | 검증용 Rapsodo CSV 샘플 |

> ⚠ Setup.exe 는 GitHub Releases 에서 받습니다 — `https://github.com/kkl0511/Dashboard_Pitching_Team/releases`

---

## A. 빠른 설치 (Setup.exe 사용 — 권장)

### 1단계: 다운로드

1. 인터넷 연결된 PC 에서 https://github.com/kkl0511/Dashboard_Pitching_Team/releases 접속
2. 최신 버전의 **`상동고-투구-리포트-Setup-5.40.0.exe`** 다운로드
3. 측정실 PC 로 USB 또는 OneDrive 로 복사

### 2단계: 설치

1. `Setup.exe` 더블클릭
2. SmartScreen 경고 시 → **추가 정보** 클릭 → **실행** 클릭 (코드사이닝 미적용 빌드의 경우)
3. 설치 위치 선택 (기본값: `C:\Program Files\상동고 투구 리포트\`)
4. **다음 → 설치 → 완료** 진행
5. 데스크탑 + 시작 메뉴에 **🏟 상동고 투구 리포트** 아이콘 자동 생성

### 3단계: 첫 실행 + 검증

1. 데스크탑 아이콘 더블클릭
2. 첫 실행 시 Windows Defender → **차단 해제 / 항상 허용** 클릭
3. 앱 화면 표시되면 메뉴 → **도움말 > 버전 정보** 에서 v5.40 확인
4. 메뉴 → **파일 > c3d.txt 파일 가져오기** 로 샘플 10 trial 업로드 → 5 모델 라디아 표시되면 ✓ 정상

---

## B. 직접 빌드 (개발자, 또는 .exe 안 받고 싶을 때)

### 사전 준비 (일회)

**Node.js 18+ 설치:**
- https://nodejs.org → LTS 버전 다운로드 → 설치
- PowerShell에서 `node --version` 실행 → `v18.x` 또는 그 이상 확인

**Git 설치 (선택):**
- https://git-scm.com/download/win → 설치 → 기본 옵션 진행

### 빌드 절차

**1) 소스 다운로드:**
```powershell
# Option A — Git clone
git clone https://github.com/kkl0511/Dashboard_Pitching_Team.git
cd Dashboard_Pitching_Team

# Option B — ZIP 다운로드 후 압축 해제
# Dashboard_Electron_source_v5.40.zip → C:\BBL_Dashboard\
cd C:\BBL_Dashboard
```

**2) 의존성 설치 (~5분, ~150 MB):**
```powershell
cd electron
npm install
```

**3) 로컬 실행 (테스트):**
```powershell
npm start
# → Electron 창 자동 열림 → dashboard.html 표시되면 정상
```

**4) 윈도우 .exe 빌드 (~10분):**
```powershell
npm run dist:win
```

**결과 — `electron/dist/` 폴더에 2개 파일 생성:**
- `상동고-투구-리포트-Setup-5.40.0.exe` — NSIS 설치본 (사용자 배포용)
- `상동고-투구-리포트-5.40.0.exe` — Portable (설치 불요, USB 실행 가능)

---

## C. 첫 측정 — 샘플 데이터로 워크플로우 연습

### 다운로드한 샘플 파일

1. `TestPlayer_10trial_c3d.zip` 압축 해제 → `TestPlayer_c3d_samples/` 폴더 (10 .c3d.txt)
2. `rapsodo_TEST_10trial.csv` (1 KB) — 옵션

### 앱에서 가져오기

**옵션 1: 폴더 한 번에 (권장 — 운영자 작업 0초):**
1. 메뉴 **파일 > 📂 측정 폴더 가져오기** (Ctrl+O)
2. `TestPlayer_c3d_samples/` 상위 폴더 선택
3. 자동으로 c3d.txt × 10 trial 처리 → 5 모델 라디아 + 시퀀스 + 마네킹 자동 표시

**옵션 2: 파일 직접 선택:**
1. 메뉴 **파일 > 🗃 c3d.txt 파일 가져오기** (Ctrl+Shift+O)
2. `TestPlayer_c3d_samples/` 의 .c3d.txt 10개 모두 선택
3. 자동 분석

### 결과 검증

- **메카닉 5 모델 점수**: 모두 — 가 아니라 숫자 표시
- **마네킹 SVG**: 본인 데이터 기반 색깔 (4 transition score)
- **에너지 손실 Top 3**: 큰 음의 차이 변인 3개
- **GRF**: Drive AP / Lead AP / LHEI 모두 산출

### PDF 출력 테스트

1. 메뉴 **파일 > 🖨 선수별 PDF 일괄 출력** (Ctrl+P)
2. 저장 폴더 선택 → `Documents\BBL_Reports\` 권장
3. PDF 파일 자동 생성됨 (선수당 1 PDF)

---

## D. 현장 사용 시 일상 워크플로우

```
[측정 종료]
  ↓
[데스크탑 아이콘 더블클릭]
  ↓
[Ctrl+O] 측정 폴더 선택
  → 자동: c3d.txt 분석 + Rapsodo CSV 갭분석 매칭 + 5 모델 산출
  ↓
[검토] 1차 측정 결과 종합 테이블 + 4분면 차트
  → 이상치 선수 클릭 → 선수별 리포트 상세 분석
  ↓
[Ctrl+P] 선수별 PDF 일괄 출력
  → Documents\BBL_Reports\선수별_리포트_P01_정예준.pdf 등 20개
  ↓
[Ctrl+Shift+P] 코치 종합 PDF 출력
  → Documents\BBL_Reports\코치_종합리포트_2026-05-15.pdf
  ↓
[메뉴 > 파일 > 💾 백업]
  → USB 또는 OneDrive 자동 복사
```

---

## E. 자주 발생하는 문제

### Q1. SmartScreen "Windows PC 보호" 경고

**A.** 코드사이닝 (유료 인증서) 미적용 빌드라 발생. **추가 정보 → 실행** 클릭으로 해결. 보안상 안전 (소스 공개됨).

### Q2. 앱이 시작 안 됨

**A.** 다음 순서로 점검:
1. `%AppData%/상동고 투구 리포트/logs/` 의 로그 파일 확인
2. **메뉴 > 보기 > 개발자 도구** (Ctrl+Shift+I) 로 콘솔 에러 확인
3. **Windows Defender > 바이러스 보호 > 차단된 위협** 검토 → 허용 추가

### Q3. c3d.txt 가져왔는데 — 표시가 많음

**A.** V3D Export 시 컬럼 누락. 매뉴얼 §3 (필수 컬럼) 참조:
- `docs/V3D_Export_Manual_상동고_v1.0.docx` 의 §3 + §9 (자주 발생하는 컬럼 누락)

### Q4. PDF 인쇄 시 한글 깨짐

**A.** 윈도우 시스템 폰트 (Malgun Gothic, 맑은 고딕) 설치 확인. 기본 윈도우 10/11 에 포함.

### Q5. 데이터를 다른 PC 로 옮기려면?

**A.** 메뉴 **파일 > 💾 백업** → 백업 폴더 USB 복사 → 다른 PC 에서 메뉴 **파일 > 🔄 백업 복원** → 백업 폴더 선택.

### Q6. 자동 업데이트 받으려면?

**A.** 새 버전 출시 시 GitHub Releases 페이지에서 새 Setup.exe 다운로드 → 기존 앱 위에 설치 (데이터 유지됨). 자동 업데이트는 v5.41 부터 지원 예정.

---

## F. 데이터 + 리포트 저장 위치 (윈도우)

```
C:\Users\{사용자}\AppData\Roaming\상동고 투구 리포트\
└── data\
    ├── current.json                ← 현재 측정 데이터 (자동 저장)
    ├── theia_batch_2026-05-15.json ← 회차별 백업
    └── ...

C:\Users\{사용자}\Documents\BBL_Reports\
├── 선수별_리포트_P01_정예준.pdf
├── 선수별_리포트_P02_김강대.pdf
├── ...
├── 코치_종합리포트_2026-05-15.pdf
└── BBL_Backup_2026-05-15\           ← 백업 폴더
```

> 💡 OneDrive 와 동기화하려면 `Documents\BBL_Reports\` 폴더를 OneDrive 안에 위치 → 자동 클라우드 백업.

---

## G. 메뉴 단축키 요약

| 단축키 | 동작 |
|---|---|
| **Ctrl+O** | 측정 폴더 가져오기 (선수당 1폴더 자동 처리) |
| **Ctrl+Shift+O** | c3d.txt 파일 직접 선택 |
| **Ctrl+P** | 선수별 PDF 일괄 출력 |
| **Ctrl+Shift+P** | 코치 종합 PDF 출력 |
| Ctrl+R | 새로 고침 |
| Ctrl++ / Ctrl+- | 확대 / 축소 |
| F11 | 전체 화면 |
| Ctrl+Shift+I | 개발자 도구 (디버깅) |

---

## H. 매뉴얼 + 참고 자료

| 문서 | 위치 | 내용 |
|---|---|---|
| V3D Export Manual | `docs/V3D_Export_Manual_상동고_v1.0.docx` | c3d.txt 후작업 0건 업로드 사양 |
| V3D 분석 매뉴얼 | `docs/V3D_Manual_상동고_v1.0.docx` | 측정 + 캘리브레이션 + 변인 산출 절차 |
| Rapsodo 매칭 프로토콜 | V3D Export Manual §10 | 20초 간격 + 갭 분석 자동 매칭 |
| 정적 HTML 리포트 예시 | `docs/TestPlayer_static_report.html` | 분석 결과 미리보기 |

---

## 문의

**개발자:** 국민대학교 스포츠과학과 / kklee@kookmin.ac.kr
**GitHub:** https://github.com/kkl0511/Dashboard_Pitching_Team
**대시보드 (웹):** https://kkl0511.github.io/Dashboard_Pitching_Team/
