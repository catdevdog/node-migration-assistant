# Node Migration Assistant

## 프로젝트 개요
Node.js 프로젝트 마이그레이션을 자동화하는 로컬 웹 애플리케이션.
개발자 본인용 작업 도구 — 1차로 본인이 담당하는 리액트 프로젝트의 Node 마이그레이션 오류 수정/검토에 사용.
의존성 충돌 해결, 비호환 JS/TS 코드 리라이트, Claude AI 기반 지능형 분석을 핵심으로 한다.

## 실행 방법
```bash
# 개발 모드 (Vite + Express 동시 실행, --kill-others 로 동반 종료)
npm run dev

# 프로덕션 빌드
npm run build

# CLI 직접 실행
npx node-migrator ./my-project
```

## 기술 스택
- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS v3 (다크 테마)
- **상태 관리**: Zustand v5 (8개 독립 스토어, persist로 설정 저장)
- **에디터**: `@monaco-editor/react` (Editor + DiffEditor, 읽기 전용)
- **그래프**: `@xyflow/react` v12 (React Flow)
- **백엔드**: Express 5 (로컬 서버, 127.0.0.1 바인딩)
- **AST 분석**: `@typescript-eslint/parser` + `recast`
- **프로세스**: `execa`, `concurrently --kill-others`
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`, model: `claude-sonnet-4-20250514`)
- **통신**: REST + SSE (AI 스트리밍, 배치 분석 진행률)

## UI 구조 — 2페이지
```
TopBar: [프로젝트명] [Node 12 → 20] ──── [준비] [작업] [⚙]

페이지 1 — 준비 (SetupPage)
  glob 패턴 입력 → 범위 내 스캔 → 파일별 이슈 건수 리스트 → [작업 시작]

페이지 2 — 작업 (WorkPage)
  ┌───────┬──────────────┬──────────────┐
  │ 큐    │ Monaco 코드   │ 이슈 목록    │
  │       │ 또는 diff    │ 영향도       │
  │       │              │ AI 응답      │
  │       │              ├──────────────┤
  │       │              │ 하단 액션바   │
  └───────┴──────────────┴──────────────┘
```

## 디렉토리 구조
```
├── bin/cli.ts              # CLI 진입점
├── src/
│   ├── shared/
│   │   ├── types/          # project, api, dependency, rule, ai, analysis
│   │   └── constants.ts    # Node 버전 정보, 위험 등급, ignore 패턴
│   ├── server/
│   │   ├── index.ts        # Express 서버 팩토리
│   │   ├── middleware/     # errorHandler
│   │   ├── routes/         # project, file, dependency, ai
│   │   ├── services/
│   │   │   ├── projectLoader.ts     # 프로젝트 메타 로드
│   │   │   ├── fileService.ts       # 안전한 파일 R/W
│   │   │   ├── astService.ts        # recast 파싱
│   │   │   ├── ruleEngine.ts        # 규칙 실행 + 자동 수정
│   │   │   ├── dependencyAnalyzer.ts
│   │   │   ├── auditService.ts      # npm audit 래퍼
│   │   │   ├── importAnalyzer.ts    # import/require 그래프
│   │   │   ├── aiService.ts         # Claude SDK 래퍼 + SSE 스트림
│   │   │   └── gitService.ts
│   │   ├── rules/
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── node-api/   # buffer-constructor, crypto-deprecated,
│   │   │   │               # dirname-filename, fs-promises,
│   │   │   │               # process-binding, util-deprecated,
│   │   │   │               # url-parse, querystring-deprecated
│   │   │   └── es-syntax/  # cjs-to-esm, string-trim, module-exports
│   │   └── utils/          # pathResolver, logger
│   └── client/
│       ├── main.tsx
│       ├── App.tsx          # 2페이지 라우터 (SetupPage / WorkPage)
│       ├── api/             # client, project, file, dependency, ai
│       ├── stores/          # useProjectStore, useEditorStore, useAIStore,
│       │                    # useAnalysisStore, useDependencyStore,
│       │                    # useSettingsStore, useUIStore, useQueueStore
│       ├── components/
│       │   ├── layout/      # AppShell, TopBar, StatusBar
│       │   ├── onboarding/  # ApiKeyModal
│       │   ├── editor/      # MonacoEditor, MonacoDiffEditor
│       │   ├── analysis/    # AnalysisSummary, RuleMatchCard
│       │   └── shared/      # Button, Modal, Spinner, Badge, ErrorBoundary
│       ├── hooks/           # useShortcuts (전역 단축키)
│       ├── pages/           # SetupPage, WorkPage
│       └── styles/          # Tailwind CSS
└── test-project/            # 테스트용 레거시 Node 12 프로젝트
```

## 아키텍처 결정사항
1. **단일 패키지**: src/client + src/server 를 하나의 package.json으로 관리
2. **개발 모드**: Vite(5173) + Express API(3847) 프록시 패턴
3. **프로덕션**: Express가 빌드된 클라이언트 정적 파일 직접 서빙
4. **보안**: Express는 127.0.0.1에만 바인딩, pathResolver로 경로 순회 방지
5. **API 키**: 클라이언트 localStorage만 저장 (zustand persist → `node-migrator-settings` 키의 `state.apiKey`), 서버는 헤더를 Anthropic API로 전달만
6. **통신**: REST + SSE (AI 스트리밍, 명령 실행, 배치 분석)
7. **서버 실행**: `tsx` (watch 모드 X — Windows concurrently 행 이슈로 제거)
8. **클라이언트 재시도**: 프로젝트 로드 시 서버 기동 전이면 최대 10회, 1.5초 간격으로 재시도
9. **2페이지 UI**: 준비(SetupPage) + 작업(WorkPage) — 복잡한 다중 페이지/탭 대신 2화면으로 단순화

## 구현 단계
1. ✅ **Phase 1~6**: 스캐폴딩, 의존성 분석, 규칙 엔진, 에디터, AI 연동, 전체 스캔
2. ✅ **Phase 7**: 강제 온보딩 + 사전 분석 리포트 + git 경고 배너
3. ✅ **Phase 8**: 파일 처리 큐 + Monaco 읽기 전용 + 단축키
4. ✅ **Phase 8.5**: UI 2페이지 구조 전환 + 작업 범위(glob) 선택 + 영향도(범위 안/밖)
5. ✅ **Phase 9**: Cascade 파이프라인 + 의존성 AI 분석
6. ⬜ **Phase 10**: 마이그레이션 리포트 (Markdown + HTML)

## 구현된 규칙 (11개)
- **node-api**: buffer-constructor, crypto-deprecated, dirname-filename, fs-promises, process-binding, util-deprecated, url-parse, querystring-deprecated
- **es-syntax**: cjs-to-esm, string-trim, module-exports

## 워크플로우
```
① 프로젝트 열기 (npx node-migrator ./project)
② API 키 입력 (강제 온보딩)
③ 준비 화면 — glob 패턴으로 내 작업 범위 지정 → 스캔
   ├─ [의존성 분석] → 위험 패키지 표시 → [AI 호환성 분석]
④ "작업 시작" — 위험도 🔴/🟠 파일이 큐에 자동 투입
⑤ 작업 화면 — 파일별 처리:
   ├─ 규칙 자동수정 → [자동수정] 원클릭 즉시 적용 (diff 안 봄)
   ├─ AI 필요 → [AI 분석] → diff 확인 → [승인]
   ├─ 영향도 표시: 범위 안(✅) / 범위 밖(⚠️)
   └─ 승인 후 Cascade: 영향 파일 감지 → [큐 추가] / [AI 영향 분석]
⑥ 큐 완료 후 작업 종료
```

## 코딩 컨벤션
- 모든 UI 텍스트, 코드 코멘트, 에러 메시지는 **한국어**
- ESM (`"type": "module"`) 사용
- 서버 import에서 `.js` 확장자 필수 (NodeNext 모듈)
- 클라이언트는 `@shared/`, `@client/` 경로 별칭 사용
- Zustand 스토어는 독립적 — 스토어 간 직접 import 금지 (컴포넌트에서 조합)
- AI 응답 설명은 마크다운 허용 (볼드, 리스트, 인라인코드). 수정 코드는 응답 마지막에 전체 파일 코드블록 1개로만 제공 (중간 코드 조각 금지)

## 주요 패턴
- **규칙 엔진**: 플러그인 레지스트리 패턴 — `detect()` + `fix?()` 인터페이스, `minTargetVersion` 으로 적용 범위 필터링
- **파일 경로**: 항상 `pathResolver.resolveSafePath()`를 통해 접근
- **API 응답**: `ApiResponse<T>` 래퍼 사용 (`{ data, meta }`)
- **에러 응답**: `ApiError` 형식 (`{ error: { code, message } }`)
- **Monaco 읽기 전용 + 승인 워크플로우**: Monaco는 항상 `readOnly: true` + `domReadOnly: true`. 코드 변경은 `useEditorStore.approveSuggestion()` 단일 진입점만 허용.
- **자동수정 원클릭**: 규칙 기반 수정은 diff 없이 즉시 적용 → `approveSuggestion()` → 큐 완료 → 다음 파일
- **작업 범위**: `useSettingsStore.scopePatterns` (glob 패턴, persist) — 서버의 `/api/file/analyze-all`에 `scopePatterns` 파라미터로 전달
- **영향도 범위 구분**: importAnalyzer의 `reverseImports`에서 범위 안(✅)/밖(⚠️) 분류
- **처리 큐**: `useQueueStore`가 위험도(high/medium/low) + 상태 기준으로 자동 정렬
- **전역 단축키**: `useShortcuts` hook — Ctrl+S(승인), Ctrl+]/[(큐 이동), Ctrl+G(그래프)
- **SSE 스트리밍**: AI 응답 / 배치 분석 진행률 공통 패턴

## 제거된 기능 (의도적)
- Monaco 자유 편집 — 승인 워크플로우로 대체
- 저장 버튼 — 승인 버튼으로 대체
- git 자동 stash/commit — 경고 배너로만 안내
- 5페이지 UI (Dashboard/Editor/Dependencies/Guide/Settings) — 2페이지로 단순화
- Sidebar (FileTree + QueuePanel 분리) — WorkPage 3칸 레이아웃으로 통합
- 복잡도 등급, AI 비용 추산 카드 — 불필요한 정보 제거

## 알려진 환경 이슈 (Windows)
- `concurrently` 자식 프로세스가 Ctrl+C 후에도 잔존할 수 있음 → `--kill-others` + CLI shutdown 타임아웃(3s)로 완화
- 좀비 프로세스 정리: `netstat -ano | findstr :3847` → `taskkill /PID <PID> /F`
