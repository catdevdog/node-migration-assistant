import { Router } from 'express';
import { loadProject, loadSubTree } from '../services/projectLoader.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { ProjectInfo, TreeNode } from '../../shared/types/project.js';

const router = Router();

/** POST /api/project/load — 프로젝트 로드 */
router.post('/load', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const start = Date.now();
    const { projectInfo, fileTree } = await loadProject(projectPath);

    const response: ApiResponse<{ projectInfo: ProjectInfo; fileTree: TreeNode[] }> = {
      data: { projectInfo, fileTree },
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

/** GET /api/project/info — 프로젝트 기본 정보 */
router.get('/info', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const { projectInfo } = await loadProject(projectPath);

    const response: ApiResponse<ProjectInfo> = {
      data: projectInfo,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/** GET /api/project/tree — 하위 디렉토리 lazy loading */
router.get('/tree', async (req, res, next) => {
  try {
    const projectPath = req.app.locals.projectPath as string;
    const dirPath = (req.query.path as string) ?? '';
    const children = await loadSubTree(projectPath, dirPath);

    const response: ApiResponse<TreeNode[]> = {
      data: children,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
