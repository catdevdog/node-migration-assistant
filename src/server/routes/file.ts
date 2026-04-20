import { Router } from 'express';
import { readFile, writeFile } from '../services/fileService.js';
import { analyzeFile } from '../services/ruleEngine.js';
import { getAllRules } from '../rules/registry.js';
import { logger } from '../utils/logger.js';
import { ANALYZABLE_EXTENSIONS } from '../../shared/constants.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { FileContent } from '../../shared/types/project.js';
import type { FileAnalysisResult } from '../../shared/types/analysis.js';

const router = Router();

/**
 * 사용자 입력 패턴을 파일 glob 패턴으로 정규화
 * - "src"        → "src/** /*${ext}"
 * - "src/"       → "src/** /*${ext}"
 * - "src/*"      → "src/** /*${ext}"
 * - "src/**"     → "src/** /*${ext}"
 * - "src/** /*"  → 그대로
 * - "src/foo.ts" → 그대로 (확장자 있는 경우)
 */
function buildGlobPattern(pattern: string, ext: string): string {
  // 후행 슬래시 / 와일드카드 제거하여 베이스 경로 추출
  const base = pattern.replace(/[/*]+$/, '');

  // 이미 파일 확장자가 명시된 패턴은 그대로 사용
  if (/\.\w{1,5}$/.test(base)) return pattern;

  // 디렉토리 패턴 → 하위 전체 재귀 검색
  return base ? `${base}/**/*${ext}` : `**/*${ext}`;
}

/** GET /api/file/read — 파일 읽기 */
router.get('/read', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).json({
        error: { code: 'MISSING_PATH', message: '파일 경로가 필요합니다.' },
      });
      return;
    }

    const start = Date.now();
    const fileContent = await readFile(projectPath, filePath);

    const response: ApiResponse<FileContent> = {
      data: fileContent,
      meta: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/** POST /api/file/analyze — 단일 파일 분석 */
router.post('/analyze', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const { filePath, currentNodeVersion, targetNodeVersion } = req.body as {
      filePath: string;
      currentNodeVersion?: string;
      targetNodeVersion?: string;
    };

    if (!filePath) {
      res.status(400).json({
        error: { code: 'MISSING_PATH', message: '분석할 파일 경로가 필요합니다.' },
      });
      return;
    }

    const start = Date.now();
    const result = await analyzeFile(
      projectPath,
      filePath,
      currentNodeVersion ?? null,
      targetNodeVersion ?? '20',
    );

    const response: ApiResponse<FileAnalysisResult> = {
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/** POST /api/file/write — 파일 쓰기 (수정 적용) */
router.post('/write', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const { filePath, content } = req.body as { filePath: string; content: string };

    if (!filePath || content === undefined) {
      res.status(400).json({
        error: { code: 'MISSING_PARAMS', message: '파일 경로와 내용이 필요합니다.' },
      });
      return;
    }

    const start = Date.now();
    await writeFile(projectPath, filePath, content);

    const response: ApiResponse<{ written: true }> = {
      data: { written: true },
      meta: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/** GET /api/file/rules — 등록된 규칙 목록 조회 */
router.get('/rules', (_req, res) => {
  const rules = getAllRules().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    severity: r.severity,
    fileExtensions: r.fileExtensions,
  }));

  const response: ApiResponse<typeof rules> = {
    data: rules,
    meta: { timestamp: new Date().toISOString() },
  };

  res.json(response);
});

/** POST /api/file/analyze-all — 파일 일괄 분석 (SSE 진행률, scopePatterns으로 범위 제한 가능) */
router.post('/analyze-all', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const { targetNodeVersion, currentNodeVersion, scopePatterns } = req.body as {
      targetNodeVersion?: string;
      currentNodeVersion?: string;
      /** 쉼표 구분 glob 패턴 (예: "src/auth/**,src/api/**"). 빈 문자열이면 전체 */
      scopePatterns?: string;
    };

    // SSE 헤더
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // glob으로 분석 대상 파일 수집 — scopePatterns가 있으면 범위 제한
    const { glob: globFn } = await import('glob');
    const ignore = ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**'];
    // ANALYZABLE_EXTENSIONS에서 동적 생성 (예: '.{js,jsx,ts,tsx,mjs,cjs,mts,cts}')
    const extList = ANALYZABLE_EXTENSIONS.map((e) => e.slice(1)).join(',');
    const ext = `.{${extList}}`;

    let files: string[];
    if (scopePatterns && scopePatterns.trim()) {
      // 쉼표 구분 패턴을 개별 glob으로 실행 후 합침 (중복 제거)
      const patterns = scopePatterns.split(',').map((p) => p.trim()).filter(Boolean);
      const fileSet = new Set<string>();
      for (const pattern of patterns) {
        const fullPattern = buildGlobPattern(pattern, ext);
        const matched = await globFn(fullPattern, { cwd: projectPath, ignore });
        for (const f of matched) fileSet.add(f);
      }
      files = Array.from(fileSet);
    } else {
      files = await globFn(`**/*${ext}`, { cwd: projectPath, ignore });
    }

    const results: FileAnalysisResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        current: i + 1,
        total,
        currentFile: filePath,
      })}\n\n`);

      try {
        const result = await analyzeFile(
          projectPath,
          filePath,
          currentNodeVersion ?? null,
          targetNodeVersion ?? '20',
        );
        results.push(result);
      } catch (err) {
        // 개별 파일 분석 실패는 스킵
        logger.warn(`파일 분석 스킵: ${filePath} — ${(err as Error).message}`);
      }
    }

    // 전체 결과 전송
    const summary = {
      totalFiles: total,
      analyzedFiles: results.length,
      totalIssues: results.reduce((sum, r) => sum + r.summary.total, 0),
      totalFixable: results.reduce((sum, r) => sum + r.summary.fixable, 0),
      totalErrors: results.reduce((sum, r) => sum + r.summary.errors, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.summary.warnings, 0),
      totalInfos: results.reduce((sum, r) => sum + r.summary.infos, 0),
    };

    res.write(`data: ${JSON.stringify({ type: 'done', results, summary })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
