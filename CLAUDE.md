# Node Migration Assistant

## 프로젝트 개요
Node.js 프로젝트 마이그레이션을 자동화하는 데스크톱급 로컬 웹 애플리케이션.
의존성 충돌 해결, 비호환 JS/TS 코드 리라이트, Claude AI 기반 지능형 분석을 핵심으로 한다.

## 실행 방법
```bash
# 개발 모드 (Vite + Express 동시 실행)
npm run dev

# 프로덕션 빌드
npm run build

# CLI 직접 실행
npx node-migrator ./my-project
```

## 기술 스택
- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS v3
- **상태 관리**: Zustand (7개 독립 스토어)
- **에디터**: Monaco Editor (diff 모드 + 읽기/쓰기)
- **그래프**: React Flow
- **백엔드**: Express (로컬 서버)
- **AST 분석**: @typescript-eslint/parser + recast
- **프로세스**: execa
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)

## 디렉토리 구조
```
├── bin/cli.ts              # CLI 진입점
├── src/
│   ├── shared/             # 공유 타입 + 상수
│   │   ├── types/          # project.ts, api.ts, dependency.ts, rule.ts, ai.ts, analysis.ts
│   │   └── constants.ts    # Node 버전 정보, 위험 등급, 기본 설정
│   ├── server/
│   │   ├── index.ts        # Express 서버 팩토리
│   │   ├── middleware/     # errorHandler
│   │   ├── routes/         # project, file, dependency, ai, git, runner, report
│   │   ├── services/       # projectLoader, fileService, ruleEngine, aiService 등
│   │   ├── rules/          # 규칙 기반 분석 플러그인 (node-api/, es-syntax/, dependency/, config/)
│   │   └── utils/          # pathResolver (경로 순회 방지), logger
│   └── client/
│       ├── main.tsx        # React 엔트리
│       ├── App.tsx         # 루트 컴포넌트
│       ├── api/            # API 클라이언트 (client.ts, project.ts 등)
│       ├── stores/         # Zustand 스토어 7개
│       ├── components/
│       │   ├── layout/     # AppShell, Sidebar, TopBar, StatusBar
│       │   ├── onboarding/ # ApiKeyModal
│       │   ├── file-tree/  # FileTree, FileTreeNode
│       │   ├── editor/     # EditorPanel, MonacoEditor 등 (Phase 4)
│       │   ├── dependency/ # RiskTable, DependencyGraph (Phase 2, 6)
│       │   ├── ai/         # AI 관련 컴포넌트 (Phase 5)
│       │   ├── dashboard/  # 대시보드 컴포넌트 (Phase 7)
│       │   └── shared/     # Button, Modal, Spinner, Badge, ErrorBoundary
│       ├── pages/          # EditorPage, DependencyPage, DashboardPage, SettingsPage
│       └── styles/         # Tailwind CSS
```

## 아키텍처 결정사항
1. **단일 패키지**: src/client + src/server 를 하나의 package.json으로 관리
2. **개발 모드**: Vite(5173) + Express API(3847) 프록시 패턴
3. **프로덕션**: Express가 빌드된 클라이언트 정적 파일 직접 서빙
4. **보안**: Express는 127.0.0.1에만 바인딩, pathResolver로 경로 순회 방지
5. **API 키**: 클라이언트 localStorage만 저장, 서버는 헤더를 Anthropic API로 전달만
6. **통신**: REST + SSE (AI 스트리밍, 명령 실행, 배치 분석)

## 8단계 구현 순서
1. ✅ **Phase 1**: 스캐폴딩 + CLI + 온보딩 + 파일트리
2. ✅ **Phase 2**: 의존성 분석기 + 위험도 테이블
3. ✅ **Phase 3**: 규칙 기반 파일 분석 엔진
4. ✅ **Phase 4**: 메인 파일 에디터 UI (Monaco Editor + diff)
5. ✅ **Phase 5**: Claude AI 연동 + 마이그레이션 가이드
6. ✅ **Phase 6**: 프로젝트 전체 스캔 + 사용처 분석 + 의존성 그래프
7. ⬜ **Phase 7**: 대시보드 + Git 안전망 + 리포트
8. ⬜ **Phase 8**: 추가 기능

## 코딩 컨벤션
- 모든 UI 텍스트, 코드 코멘트, 에러 메시지는 **한국어**
- ESM (`"type": "module"`) 사용
- 서버 import에서 `.js` 확장자 필수 (NodeNext 모듈)
- 클라이언트는 `@shared/`, `@client/` 경로 별칭 사용
- Zustand 스토어는 독립적 — 스토어 간 직접 import 금지 (컴포넌트에서 조합)
- 매 Phase 완료 시: 구현 요약, 가정 사항, 개선 제안, 보완 필요, 리스크 경고 필수 포함

## 주요 패턴
- **규칙 엔진**: 플러그인 레지스트리 패턴 — `detect()` + `fix?()` 인터페이스
- **파일 경로**: 항상 `pathResolver.resolveSafePath()`를 통해 접근
- **API 응답**: `ApiResponse<T>` 래퍼 사용 (`{ data, meta }`)
- **에러 응답**: `ApiError` 형식 (`{ error: { code, message } }`)
