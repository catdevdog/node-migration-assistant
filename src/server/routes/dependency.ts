import { Router } from 'express';
import { analyzeDependencies } from '../services/dependencyAnalyzer.js';
import { runAudit, buildVulnMap } from '../services/auditService.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { DependencyAnalysisResult, AuditResult } from '../../shared/types/dependency.js';

const router = Router();

/** POST /api/deps/analyze — 전체 의존성 분석 (npm audit 포함) */
router.post('/analyze', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const { targetNodeVersion } = req.body as { targetNodeVersion?: string };
    const target = targetNodeVersion ?? '20';
    const start = Date.now();

    // 1단계: npm audit 실행
    const audit = await runAudit(projectPath);
    const vulnMap = buildVulnMap(audit);

    // 2단계: 의존성 분석 (audit 결과 반영)
    const result = await analyzeDependencies(projectPath, target, vulnMap);
    result.audit = audit;

    const response: ApiResponse<DependencyAnalysisResult> = {
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

/** GET /api/deps/audit — npm audit만 단독 실행 */
router.get('/audit', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const start = Date.now();
    const audit = await runAudit(projectPath);

    const response: ApiResponse<AuditResult> = {
      data: audit,
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

export default router;
