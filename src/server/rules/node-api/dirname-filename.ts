import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { walkAST } from '../../services/astService.js';
import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** __dirname / __filename → import.meta.dirname / import.meta.filename (Node 20+) */
export const dirnameFilenameRule: RuleImplementation = {
  id: 'node-api/dirname-filename',
  name: '__dirname/__filename 사용',
  description: 'ESM에서는 __dirname/__filename 사용 불가. Node 20+에서는 import.meta.dirname 사용.',
  category: 'node-api',
  severity: 'warning',
  minTargetVersion: '20',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

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

  fix(content: string, _matches: RuleMatch[]): string {
    return content
      .replace(/\b__dirname\b/g, 'import.meta.dirname')
      .replace(/\b__filename\b/g, 'import.meta.filename');
  },
};
