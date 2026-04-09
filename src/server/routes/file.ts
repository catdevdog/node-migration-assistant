import { Router } from 'express';
import { readFile } from '../services/fileService.js';
import { analyzeFile } from '../services/ruleEngine.js';
import { getAllRules } from '../rules/registry.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { FileContent } from '../../shared/types/project.js';
import type { FileAnalysisResult } from '../../shared/types/analysis.js';

const router = Router();

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

export default router;
