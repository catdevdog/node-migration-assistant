import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** 콜백 스타일 fs → fs/promises 전환 안내 */
export const fsPromisesRule: RuleImplementation = {
  id: 'node-api/fs-promises',
  requiresAST: false,
  name: '콜백 스타일 fs 사용',
  description: '콜백 기반 fs API → fs/promises 또는 fs.promises 사용 권장.',
  category: 'node-api',
  severity: 'info',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    // 콜백 패턴: fs.readFile(path, callback), fs.writeFile 등
    const callbackPattern = /\bfs\.(readFile|writeFile|readdir|stat|unlink|mkdir|rmdir|rename|copyFile|access)\s*\([^)]*,\s*(function|\([^)]*\)\s*=>|\w+\s*=>)/g;

    let match;
    while ((match = callbackPattern.exec(context.content)) !== null) {
      const line = context.content.substring(0, match.index).split('\n').length;
      const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

      matches.push({
        ruleId: 'node-api/fs-promises',
        ruleName: '콜백 스타일 fs 사용',
        line,
        column: col,
        endLine: line,
        endColumn: col + match[0].length,
        message: `fs.${match[1]}() 콜백 패턴 → await fsPromises.${match[1]}() 사용 권장`,
        severity: 'info',
        fixable: false,
        needsAI: true,
        aiReason: '콜백→async/await 변환은 비즈니스 로직 이해가 필요합니다',
      });
    }

    return matches;
  },
};
