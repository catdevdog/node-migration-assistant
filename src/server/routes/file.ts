import { Router } from 'express';
import { readFile } from '../services/fileService.js';
import type { ApiResponse } from '../../shared/types/api.js';
import type { FileContent } from '../../shared/types/project.js';

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

export default router;
