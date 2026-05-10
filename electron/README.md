# 상동고 투구 리포트 — Electron 데스크탑 앱

윈도우 PC 에서 인터넷 없이 실행되는 데스크탑 앱. 측정 폴더 한 번 import → 자동 분석 → PDF 일괄 출력.

## 빠른 시작 (개발자)

```bash
# 한 번만 실행: 의존성 설치
cd electron
npm install

# 로컬 실행 (개발 + 검증)
npm start

# 윈도우 .exe 빌드 (~80 MB Setup.exe + portable.exe)
npm run dist:win
# → dist/상동고 투구 리포트 Setup 5.40.0.exe
# → dist/상동고 투구 리포트 5.40.0.exe (portable, 설치 불요)
```

## 빌드 전 준비

빌드 직전에 **dashboard.html 을 electron/ 으로 복사** + **icon.png 추가**:

```bash
# 상위 폴더의 dashboard.html 을 electron/ 으로 복사
cp ../dashboard.html electron/dashboard.html

# icon.png 추가 (256×256 PNG, BBL 로고)
# electron/icon.png
```

## 현장 사용자 워크플로우

1. **설치**: `Setup.exe` 더블클릭 → 다음·다음·완료. 데스크탑 + 시작메뉴에 아이콘 자동 생성.
2. **실행**: 데스크탑 아이콘 더블클릭. 인터넷 불요.
3. **데이터 입력 (한 번에)**:
   - 메뉴 → **파일 > 📂 측정 폴더 가져오기...** (Ctrl+O)
   - `2026-05-15_1차측정/` 폴더 선택
   - 자동으로 c3d.txt × 20명 처리 + Rapsodo CSV 갭 분석 매칭 + 5 모델 라디아 산출
4. **PDF 출력**:
   - 메뉴 → **파일 > 🖨 선수별 PDF 일괄 출력** (Ctrl+P) — 20명 PDF 한 번에
   - 메뉴 → **파일 > 📊 코치 종합 PDF 출력** (Ctrl+Shift+P)
5. **데이터 보관**:
   - 자동 저장 위치: `%AppData%/상동고 투구 리포트/data/*.json`
   - 메뉴 → **파일 > 💾 백업** — USB 또는 OneDrive 로 일괄 복사
   - 메뉴 → **파일 > 🔄 백업 복원** — 다른 PC 에서 백업 폴더 가져오기

## 파일 구조

```
electron/
├── main.js                ← Electron 메인 프로세스 (메뉴 + IPC + 폴더 import)
├── preload.js             ← Renderer 안전 API 브리지 (window.bblApp.*)
├── package.json           ← electron-builder 설정
├── dashboard.html         ← 빌드 직전 복사 (gitignored)
├── icon.png               ← 256×256 BBL 로고 (별도 추가)
├── scripts/               ← Python 통합 시 process_pitching_session.py 복사
└── README.md
```

## 메뉴 단축키

| 단축키 | 동작 |
|---|---|
| Ctrl+O | 측정 폴더 가져오기 (선수당 1폴더 자동 처리) |
| Ctrl+Shift+O | c3d.txt 파일 직접 선택 |
| Ctrl+P | 선수별 PDF 일괄 출력 |
| Ctrl+Shift+P | 코치 종합 PDF 출력 |
| Ctrl+R | 새로 고침 |
| F11 | 전체 화면 |
| Ctrl+Shift+I | 개발자 도구 (디버깅) |

## Python 통합 (선택 — 자동 c3d → JSON 변환)

`electron/scripts/` 폴더에 `process_pitching_session.py` 복사 후 빌드. 사용자 PC 에 Python 3.10+ 설치되어 있어야 함.

대체 옵션 — Python embedded:
```bash
# Windows Python embeddable 다운로드
# https://www.python.org/downloads/windows/ → Windows embeddable package (64-bit)
# electron/python-embed/ 압축 해제 (~30 MB)
# main.js 의 spawn('python', ...) → spawn('python-embed/python.exe', ...) 변경
```

## 자동 업데이트 (선택)

`electron-updater` 추가 후 GitHub Releases 에 새 .exe 업로드 → 사용자 자동 알림.
```bash
npm install electron-updater
```

## 문제 해결

- **앱 시작 안 됨**: `%AppData%/상동고 투구 리포트/logs/main.log` 확인
- **데이터 손실**: 백업 폴더에서 복원 (메뉴 → 파일 > 백업 복원)
- **Python 오류**: `electron/scripts/` 의 .py 가 같은 버전인지 확인
- **PDF 인쇄 깨짐**: 메뉴 → 보기 > 기본 크기 (Ctrl+0) 후 재시도
