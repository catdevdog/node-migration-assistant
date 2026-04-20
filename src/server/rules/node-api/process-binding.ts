import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** process.binding() 사용 감지 (자동 수정 불가) */
export const processBindingRule: RuleImplementation = {
  id: 'node-api/process-binding',
  requiresAST: false,
  name: 'process.binding() 사용',
  description: 'process.binding()은 internal API로 제거 예정. 공식 API로 전환 필요.',
  category: 'node-api',
  severity: 'error',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];
    const regex = /\bprocess\.binding\s*\(/g;

    let match;
    while ((match = regex.exec(context.content)) !== null) {
      const line = context.content.substring(0, match.index).split('\n').length;
      const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

      matches.push({
        ruleId: 'node-api/process-binding',
        ruleName: 'process.binding() 사용',
        line,
        column: col,
        endLine: line,
        endColumn: col + match[0].length,
        message: 'process.binding()은 internal API — 공식 Node.js API로 전환 필요',
        severity: 'error',
        fixable: false,
        needsAI: true,
        aiReason: '사용 중인 내부 바인딩에 따라 대체 API가 다릅니다',
      });
    }

    return matches;
  },
};
