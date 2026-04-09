import { execa } from 'execa';
import path from 'path';
import { logger } from '../utils/logger.js';

/** Git 상태 정보 */
export interface GitStatus {
  isRepo: boolean;
  currentBranch: string | null;
  hasUncommittedChanges: boolean;
  migratorBranch: string | null;
}

/** Git 커밋 정보 */
export interface GitCommitInfo {
  hash: string;
  message: string;
  branch: string;
}

const BRANCH_PREFIX = 'node-migrator';

/** 대상 프로젝트가 git 저장소인지 확인 */
export async function isGitRepo(projectPath: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectPath });
    return true;
  } catch {
    return false;
  }
}

/** 현재 브랜치 이름 조회 */
export async function getCurrentBranch(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: projectPath });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** 커밋되지 않은 변경사항 존재 여부 */
export async function hasUncommittedChanges(projectPath: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: projectPath });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Git 전체 상태 조회 */
export async function getGitStatus(projectPath: string): Promise<GitStatus> {
  const isRepo = await isGitRepo(projectPath);
  if (!isRepo) {
    return { isRepo: false, currentBranch: null, hasUncommittedChanges: false, migratorBranch: null };
  }

  const [branch, dirty, migratorBranch] = await Promise.all([
    getCurrentBranch(projectPath),
    hasUncommittedChanges(projectPath),
    findMigratorBranch(projectPath),
  ]);

  return {
    isRepo: true,
    currentBranch: branch,
    hasUncommittedChanges: dirty,
    migratorBranch: migratorBranch,
  };
}

/** node-migrator 전용 브랜치가 이미 있는지 확인 */
async function findMigratorBranch(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['branch', '--list', `${BRANCH_PREFIX}/*`], { cwd: projectPath });
    const branches = stdout.trim().split('\n').filter(Boolean).map((b) => b.trim().replace(/^\*\s*/, ''));
    return branches.length > 0 ? branches[branches.length - 1] : null;
  } catch {
    return null;
  }
}

/** 수정 적용 전 안전 브랜치 생성 */
export async function createSafetyBranch(projectPath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `${BRANCH_PREFIX}/fix-${timestamp}`;

  // 커밋되지 않은 변경사항이 있으면 먼저 stash
  const dirty = await hasUncommittedChanges(projectPath);
  if (dirty) {
    await execa('git', ['stash', 'push', '-m', `node-migrator: 마이그레이션 전 백업`], { cwd: projectPath });
    logger.info('기존 변경사항을 stash에 백업했습니다.');
  }

  // 새 브랜치 생성 및 체크아웃
  await execa('git', ['checkout', '-b', branchName], { cwd: projectPath });
  logger.info(`안전 브랜치 생성: ${branchName}`);

  // stash 복원
  if (dirty) {
    try {
      await execa('git', ['stash', 'pop'], { cwd: projectPath });
    } catch {
      logger.warn('stash 복원 시 충돌이 발생했습니다. 수동 확인이 필요합니다.');
    }
  }

  return branchName;
}

/** 규칙별 수정 커밋 생성 */
export async function commitFix(
  projectPath: string,
  filePaths: string[],
  ruleId: string,
  message: string,
): Promise<GitCommitInfo> {
  // 변경된 파일들 스테이징
  for (const fp of filePaths) {
    await execa('git', ['add', fp], { cwd: projectPath });
  }

  // 커밋 메시지 생성
  const commitMessage = `fix(${ruleId}): ${message}\n\nApplied by node-migrator`;
  await execa('git', ['commit', '-m', commitMessage], { cwd: projectPath });

  // 커밋 해시 조회
  const { stdout: hash } = await execa('git', ['rev-parse', 'HEAD'], { cwd: projectPath });
  const { stdout: branch } = await execa('git', ['branch', '--show-current'], { cwd: projectPath });

  logger.info(`커밋 완료: ${hash.slice(0, 7)} — ${message}`);

  return {
    hash: hash.trim(),
    message: commitMessage,
    branch: branch.trim(),
  };
}

/** 원래 브랜치로 복귀 (마이그레이션 브랜치 유지) */
export async function returnToOriginalBranch(projectPath: string, originalBranch: string): Promise<void> {
  await execa('git', ['checkout', originalBranch], { cwd: projectPath });
  logger.info(`원래 브랜치로 복귀: ${originalBranch}`);
}

/** 마이그레이션 브랜치 삭제 (롤백) */
export async function rollbackBranch(projectPath: string, branchName: string): Promise<void> {
  const current = await getCurrentBranch(projectPath);
  if (current === branchName) {
    // 먼저 다른 브랜치로 이동해야 삭제 가능
    const { stdout } = await execa(
      'git', ['log', '--all', '--format=%D', '-1'],
      { cwd: projectPath },
    );
    // HEAD가 가리키는 원래 브랜치 찾기
    const refs = stdout.split(',').map((r) => r.trim()).filter((r) => !r.startsWith('HEAD'));
    const target = refs[0] ?? 'main';
    await execa('git', ['checkout', target], { cwd: projectPath });
  }

  await execa('git', ['branch', '-D', branchName], { cwd: projectPath });
  logger.info(`마이그레이션 브랜치 삭제 (롤백): ${branchName}`);
}

/** 마이그레이션 브랜치를 원래 브랜치에 머지 */
export async function mergeMigratorBranch(
  projectPath: string,
  migratorBranch: string,
  targetBranch: string,
): Promise<void> {
  await execa('git', ['checkout', targetBranch], { cwd: projectPath });
  await execa('git', ['merge', migratorBranch, '--no-ff', '-m', `merge: node-migrator 마이그레이션 적용`], {
    cwd: projectPath,
  });
  logger.info(`${migratorBranch} → ${targetBranch} 머지 완료`);
}

/** git init (프로젝트가 git 저장소가 아닌 경우) */
export async function initRepo(projectPath: string): Promise<void> {
  await execa('git', ['init'], { cwd: projectPath });
  await execa('git', ['add', '.'], { cwd: projectPath });
  await execa('git', ['commit', '-m', 'chore: node-migrator 초기 스냅샷'], { cwd: projectPath });
  logger.info('Git 저장소 초기화 및 초기 커밋 완료');
}
