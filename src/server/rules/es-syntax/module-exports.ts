import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/**
 * module.exports / exports.xxx → ESM export 전환 감지
 * - cjs-to-esm 규칙(require 감지)의 보완 — export 측 감지
 * - .cjs 파일은 의도적인 CJS이므로 제외
 */
export const moduleExportsRule: RuleImplementation = {
  id: 'es-syntax/module-exports',
  requiresAST: false,
  name: 'CommonJS module.exports 사용',
  description: 'module.exports / exports.xxx → ESM export 문으로 변환 권장.',
  category: 'es-syntax',
  severity: 'info',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    const patterns: Array<{
      pattern: RegExp;
      msg: string;
      aiReason: string;
    }> = [
      {
        pattern: /\bmodule\.exports\s*=/g,
        msg: 'module.exports = ... → export default ... 로 변환 권장',
        aiReason: '내보내는 값의 구조(객체/함수/클래스)에 따라 export default 또는 named export가 적절합니다',
      },
      {
        pattern: /\bexports\.\w+\s*=/g,
        msg: 'exports.xxx = ... → export const xxx = ... 로 변환 권장',
        aiReason: '내보내는 값과 사용처의 import 패턴을 함께 변경해야 합니다',
      },
    ];

    for (const { pattern, msg, aiReason } of patterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'es-syntax/module-exports',
          ruleName: 'CommonJS module.exports',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: msg,
          severity: 'info',
          fixable: false,
          needsAI: true,
          aiReason,
        });
      }
    }

    return matches;
  },
};
