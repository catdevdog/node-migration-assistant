import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { walkAST } from '../../services/astService.js';
import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** __dirname / __filename → import.meta.dirname / import.meta.filename (Node 20+) */
export const dirnameFilenameRule: RuleImplementation = {
  id: 'node-api/dirname-filename',
  requiresAST: true,
  name: '__dirname/__filename 사용',
  description: 'ESM에서는 __dirname/__filename 사용 불가. Node 20+에서는 import.meta.dirname 사용.',
  category: 'node-api',
  severity: 'warning',
  minTargetVersion: '20',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];
    if (!context.ast) return matches;

    walkAST(context.ast, {
      [AST_NODE_TYPES.Identifier](node) {
        const n = node as any;
        if (n.name === '__dirname' || n.name === '__filename') {
          const replacement = n.name === '__dirname'
            ? 'import.meta.dirname'
            : 'import.meta.filename';

          matches.push({
            ruleId: 'node-api/dirname-filename',
            ruleName: '__dirname/__filename 사용',
            line: n.loc.start.line,
            column: n.loc.start.column,
            endLine: n.loc.end.line,
            endColumn: n.loc.end.column,
            message: `${n.name} → ${replacement}으로 변경 권장 (Node 20+ ESM)`,
            severity: 'warning',
            fixable: true,
            suggestedFix: replacement,
          });
        }
      },
    });

    return matches;
  },

  fix(content: string, matches: RuleMatch[]): string {
    // AST에서 감지된 정확한 위치만 치환 (문자열/주석 내부 제외)
    // 뒤에서부터 치환하여 위치 오프셋이 어긋나지 않도록 함
    const lines = content.split('\n');
    const sorted = [...matches].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const match of sorted) {
      const lineIdx = match.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) continue;

      const line = lines[lineIdx];
      const col = match.column;
      const original = match.suggestedFix?.includes('dirname') ? '__dirname' : '__filename';
      const replacement = match.suggestedFix ?? original;

      // 해당 위치에 실제로 원본 텍스트가 있는지 확인
      if (line.substring(col, col + original.length) === original) {
        lines[lineIdx] = line.substring(0, col) + replacement + line.substring(col + original.length);
      }
    }

    return lines.join('\n');
  },
};
