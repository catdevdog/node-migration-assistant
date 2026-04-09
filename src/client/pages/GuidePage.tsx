import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  Zap,
  Package,
  FileCode,
  Terminal,
} from 'lucide-react';
import { NODE_VERSION_INFO, TARGET_NODE_VERSIONS } from '@shared/constants';

/* ------------------------------------------------------------------ */
/*  마이그레이션 7단계 데이터                                            */
/* ------------------------------------------------------------------ */
interface MigrationStep {
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
  color: string;
}

const MIGRATION_STEPS: MigrationStep[] = [
  {
    title: '현재 상태 파악',
    description: '프로젝트가 사용 중인 Node.js 버전을 정확히 확인합니다.',
    details: [
      '.nvmrc 또는 .node-version 파일 확인',
      'package.json의 engines 필드 확인',
      'node -v 및 npm -v 로 실제 런타임 버전 확인',
      'CI/CD 파이프라인의 Node 버전 확인',
    ],
    icon: <Info size={20} />,
    color: 'text-blue-400',
  },
  {
    title: '타겟 버전 선정',
    description: 'LTS 버전을 기준으로 마이그레이션 목표를 설정합니다.',
    details: [
      'Active LTS 버전 선택 권장 (현재: ' + TARGET_NODE_VERSIONS.join(', ') + ')',
      'EOL(End of Life) 버전 사용 여부 확인',
      '한 번에 2개 이상 메이저 버전을 건너뛰지 않는 것을 권장',
      '팀 및 인프라 호환성 고려',
    ],
    icon: <Zap size={20} />,
    color: 'text-yellow-400',
  },
  {
    title: '의존성 호환성 검사',
    description: '프로젝트의 모든 의존성이 타겟 버전과 호환되는지 확인합니다.',
    details: [
      'npm outdated 로 업데이트 가능 패키지 확인',
      '각 의존성의 engines 필드에서 Node 버전 제약 확인',
      'native addon (node-gyp) 패키지 특별 주의',
      'npm audit 로 보안 취약점 동시 점검',
    ],
    icon: <Package size={20} />,
    color: 'text-orange-400',
  },
  {
    title: '코드 호환성 분석',
    description: 'deprecated 또는 제거된 API 사용을 찾아냅니다.',
    details: [
      'Buffer() 생성자 -> Buffer.from() / Buffer.alloc() 전환',
      'url.parse() -> new URL() 전환',
      '__dirname / __filename -> import.meta (ESM)',
      'fs.exists() -> fs.existsSync() / fs.access() 전환',
      'require() -> import (ESM 마이그레이션 시)',
    ],
    icon: <FileCode size={20} />,
    color: 'text-purple-400',
  },
  {
    title: '점진적 수정',
    description: '자동 수정 -> AI 보조 수정 -> 수동 수정 순서로 진행합니다.',
    details: [
      '규칙 기반 자동 수정: 패턴이 명확한 변환을 일괄 적용',
      'AI 보조 수정: 컨텍스트가 필요한 복잡한 변환을 AI가 제안',
      '수동 수정: 비즈니스 로직 변경이 필요한 부분을 직접 수정',
      '각 단계마다 테스트를 실행하여 회귀 확인',
    ],
    icon: <ArrowRight size={20} />,
    color: 'text-emerald-400',
  },
  {
    title: '테스트 및 검증',
    description: '수정된 코드가 정상적으로 동작하는지 검증합니다.',
    details: [
      'npm test 로 유닛 테스트 실행',
      'npm run build 로 빌드 성공 확인',
      '통합 테스트 및 E2E 테스트 실행',
      '런타임 동작 테스트 (API 응답, 성능 등)',
    ],
    icon: <CheckCircle2 size={20} />,
    color: 'text-green-400',
  },
  {
    title: '배포 및 모니터링',
    description: '새로운 버전으로 안전하게 배포하고 모니터링합니다.',
    details: [
      'CI/CD 파이프라인의 Node 버전 업데이트',
      'Docker 이미지 베이스 이미지 변경 (e.g., node:20-alpine)',
      '.nvmrc / engines 필드 업데이트',
      '배포 후 에러율, 성능 메트릭 모니터링',
    ],
    icon: <Terminal size={20} />,
    color: 'text-cyan-400',
  },
];

/* ------------------------------------------------------------------ */
/*  브레이킹 체인지 퀵 레퍼런스                                          */
/* ------------------------------------------------------------------ */
interface BreakingChange {
  from: string;
  to: string;
  highlights: string[];
}

const BREAKING_CHANGES: BreakingChange[] = [
  {
    from: '14',
    to: '16',
    highlights: [
      'V8 엔진 9.4로 업그레이드',
      'npm 8 기본 탑재 (lockfile v2)',
      'OpenSSL 3.0 전환 — 일부 crypto 동작 변경',
      'Corepack 도입 (yarn/pnpm 통합 관리)',
      'Apple Silicon 네이티브 지원',
    ],
  },
  {
    from: '16',
    to: '18',
    highlights: [
      'fetch API 내장 (--experimental-fetch 불필요)',
      'Test runner 모듈 도입 (node:test)',
      'V8 10.1 — Intl.Locale, Array.findLast 등',
      'Watch 모드 (--watch) 내장',
      'import.meta.resolve() 지원',
    ],
  },
  {
    from: '18',
    to: '20',
    highlights: [
      'import.meta.dirname / import.meta.filename 추가',
      '안정화된 Test runner (node:test)',
      'V8 11.3 — Array.fromAsync, 정규식 v 플래그',
      '.env 파일 내장 지원 (--env-file)',
      'Permission 모델 실험적 도입',
    ],
  },
  {
    from: '20',
    to: '22',
    highlights: [
      'require(ESM) 지원 — CJS에서 ESM 모듈 로드 가능',
      'WebSocket 클라이언트 내장',
      'V8 12.4 — Iterator helpers, Promise.withResolvers',
      'glob / globSync 내장 (node:fs)',
      'node --run 명령어 (package.json scripts 직접 실행)',
    ],
  },
  {
    from: '22',
    to: '24',
    highlights: [
      'URLPattern API 안정화',
      'V8 13.6 업그레이드',
      'Permission 모델 안정화',
      'Web Crypto API 확장',
      'AsyncLocalStorage 성능 대폭 개선',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  공통 이슈 체크리스트                                                */
/* ------------------------------------------------------------------ */
interface ChecklistItem {
  title: string;
  icon: React.ReactNode;
  items: string[];
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    title: 'ESM vs CommonJS 마이그레이션',
    icon: <FileCode size={16} className="text-blue-400" />,
    items: [
      'package.json에 "type": "module" 추가',
      'require() -> import 구문 변환',
      'module.exports -> export / export default 변환',
      '__dirname -> import.meta.dirname (Node 20+) 또는 fileURLToPath 사용',
      '__filename -> import.meta.filename (Node 20+)',
      '.js 확장자 명시 필수 (ESM은 확장자 생략 불가)',
      'JSON 파일은 import assertion 또는 createRequire 사용',
    ],
  },
  {
    title: 'Native addon 재빌드',
    icon: <Package size={16} className="text-orange-400" />,
    items: [
      'node-gyp 기반 패키지는 새 Node 버전에서 재빌드 필요',
      'npm rebuild 또는 node_modules 삭제 후 npm install 실행',
      'bcrypt, sharp, canvas 등 인기 native addon 호환성 확인',
      'node-pre-gyp 사용 패키지는 미리 빌드된 바이너리 확인',
      'Python 및 C++ 빌드 도구 버전 확인',
    ],
  },
  {
    title: 'Deprecated crypto API 교체',
    icon: <Shield size={16} className="text-red-400" />,
    items: [
      'crypto.createCipher() -> crypto.createCipheriv() 전환',
      'crypto.createDecipher() -> crypto.createDecipheriv() 전환',
      'OpenSSL 3.0 (Node 18+) 에서 레거시 알고리즘 기본 비활성화',
      '--openssl-legacy-provider 플래그는 임시 조치로만 사용',
      'crypto.DEFAULT_ENCODING 제거됨 — 명시적 인코딩 지정',
    ],
  },
  {
    title: 'fs callback -> fs/promises 전환',
    icon: <FileCode size={16} className="text-emerald-400" />,
    items: [
      'fs.readFile(path, cb) -> await fs.promises.readFile(path)',
      'fs.writeFile(path, data, cb) -> await fs.promises.writeFile(path, data)',
      'fs.exists() 완전 제거됨 — fs.existsSync() 또는 fs.access() 사용',
      'fs.stat() 콜백 패턴 -> await fs.promises.stat()',
      'import { readFile } from "node:fs/promises" 패턴 권장',
    ],
  },
  {
    title: '환경변수 처리 변경사항',
    icon: <Terminal size={16} className="text-cyan-400" />,
    items: [
      'Node 20+: --env-file 플래그로 .env 파일 내장 지원',
      'dotenv 패키지 대체 가능 (단순 사용 케이스)',
      'NODE_OPTIONS 환경변수 동작 변경 확인',
      '--experimental-* 플래그가 안정화되면서 불필요해진 항목 정리',
      'process.env 타입 안전성 고려 (TypeScript 프로젝트)',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  GuidePage 컴포넌트                                                 */
/* ------------------------------------------------------------------ */
export function GuidePage() {
  const [expandedChecklist, setExpandedChecklist] = useState<Set<number>>(new Set());

  const toggleChecklist = (index: number) => {
    setExpandedChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar bg-gray-900">
      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-10">
        {/* ============================================================ */}
        {/*  헤더                                                         */}
        {/* ============================================================ */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <BookOpen size={28} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">
                Node.js 마이그레이션 가이드
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                버전 업그레이드를 위한 단계별 절차와 주요 변경사항 레퍼런스
              </p>
            </div>
          </div>
        </header>

        {/* ============================================================ */}
        {/*  1. 마이그레이션 7단계 프로세스                                  */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <SectionTitle
            icon={<ArrowRight size={18} className="text-blue-400" />}
            title="마이그레이션 프로세스"
            subtitle="7단계 순서로 안전하게 진행합니다"
          />

          <div className="space-y-3">
            {MIGRATION_STEPS.map((step, i) => (
              <div
                key={i}
                className="flex gap-4 p-4 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-gray-600/60 transition-colors"
              >
                {/* 번호 뱃지 */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-200">
                    {i + 1}
                  </div>
                  {i < MIGRATION_STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-gray-700 mt-2" />
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={step.color}>{step.icon}</span>
                    <h3 className="text-base font-semibold text-gray-100">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{step.description}</p>
                  <ul className="space-y-1.5">
                    {step.details.map((detail, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle2
                          size={14}
                          className="flex-shrink-0 mt-0.5 text-gray-500"
                        />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/*  2. 버전 비교 테이블                                            */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <SectionTitle
            icon={<Info size={18} className="text-cyan-400" />}
            title="Node.js 버전 비교표"
            subtitle="모든 버전의 주요 정보를 한눈에 비교합니다"
          />

          <div className="overflow-x-auto rounded-xl border border-gray-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/80 border-b border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">버전</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">코드네임</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">V8</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">LTS 시작</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">EOL</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">주요 기능</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(NODE_VERSION_INFO).map(([version, info]) => (
                  <tr
                    key={version}
                    className="border-b border-gray-700/50 hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-gray-100">
                      Node {version}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{info.codename}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">{info.v8Version}</td>
                    <td className="px-4 py-3 text-gray-400">{info.ltsStart}</td>
                    <td className="px-4 py-3 text-gray-400">{info.eol}</td>
                    <td className="px-4 py-3">
                      {info.isEOL ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                          <AlertTriangle size={10} />
                          EOL
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
                          <CheckCircle2 size={10} />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {info.features.slice(0, 3).map((feature, i) => (
                          <span
                            key={i}
                            className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-700/60 text-gray-300"
                          >
                            {feature}
                          </span>
                        ))}
                        {info.features.length > 3 && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-700/40 text-gray-500">
                            +{info.features.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  3. 브레이킹 체인지 퀵 레퍼런스                                  */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <SectionTitle
            icon={<Zap size={18} className="text-amber-400" />}
            title="브레이킹 체인지 퀵 레퍼런스"
            subtitle="메이저 버전 간 주요 변경사항을 빠르게 확인합니다"
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BREAKING_CHANGES.map((bc) => (
              <div
                key={`${bc.from}-${bc.to}`}
                className="rounded-xl bg-gray-800/60 border border-gray-700/50 p-4 space-y-3 hover:border-gray-600/60 transition-colors"
              >
                {/* 버전 전환 헤더 */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-red-400/80">
                    Node {bc.from}
                  </span>
                  <ArrowRight size={14} className="text-gray-500" />
                  <span className="font-mono text-sm font-bold text-green-400">
                    Node {bc.to}
                  </span>
                </div>

                {/* 변경사항 목록 */}
                <ul className="space-y-1.5">
                  {bc.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <Zap size={11} className="flex-shrink-0 mt-0.5 text-amber-400/60" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/*  4. 공통 이슈 체크리스트 (접기/펼치기)                            */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <SectionTitle
            icon={<AlertTriangle size={18} className="text-rose-400" />}
            title="공통 이슈 체크리스트"
            subtitle="마이그레이션 시 자주 발생하는 문제와 해결 방법입니다"
          />

          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((item, index) => {
              const isExpanded = expandedChecklist.has(index);
              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-700/50 overflow-hidden transition-colors hover:border-gray-600/60"
                >
                  {/* 헤더 (클릭으로 토글) */}
                  <button
                    type="button"
                    onClick={() => toggleChecklist(index)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/60 hover:bg-gray-800/80 transition-colors text-left"
                  >
                    <span className="text-gray-400">
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </span>
                    {item.icon}
                    <span className="text-sm font-medium text-gray-200">{item.title}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {item.items.length}개 항목
                    </span>
                  </button>

                  {/* 펼침 내용 */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700/30">
                      <ul className="space-y-2">
                        {item.items.map((detail, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2.5 text-sm text-gray-300"
                          >
                            <CheckCircle2
                              size={14}
                              className="flex-shrink-0 mt-0.5 text-gray-500"
                            />
                            <span className="font-mono text-xs leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 하단 여백 */}
        <div className="pb-4" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  공용 섹션 타이틀 컴포넌트                                            */
/* ------------------------------------------------------------------ */
function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <h2 className="text-lg font-bold text-gray-100">{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
