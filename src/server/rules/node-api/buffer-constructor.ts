import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { walkAST } from '../../services/astService.js';
import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** new Buffer() → Buffer.alloc() / Buffer.from() */
export const bufferConstructorRule: RuleImplementation = {
  id: 'node-api/buffer-constructor',
  requiresAST: true,
  name: 'Buffer() 생성자 사용 금지',
  description: 'new Buffer()는 Node 6+에서 deprecated. Buffer.alloc() 또는 Buffer.from()을 사용하세요.',
  category: 'node-api',
  severity: 'error',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];
    if (!context.ast) return matches;

    walkAST(context.ast, {
      [AST_NODE_TYPES.NewExpression](node) {
        const n = node as any;
        if (n.callee?.type === AST_NODE_TYPES.Identifier && n.callee.name === 'Buffer') {
          const arg = n.arguments?.[0];
          const isNumber = arg?.type === AST_NODE_TYPES.Literal && typeof arg.value === 'number';

          matches.push({
            ruleId: 'node-api/buffer-constructor',
            ruleName: 'Buffer() 생성자 사용 금지',
            line: n.loc.start.line,
            column: n.loc.start.column,
            endLine: n.loc.end.line,
            endColumn: n.loc.end.column,
            message: isNumber
              ? 'new Buffer(숫자) → Buffer.alloc(숫자)로 변경 필요'
              : 'new Buffer(값) → Buffer.from(값)으로 변경 필요',
            severity: 'error',
            fixable: true,
            suggestedFix: isNumber ? 'Buffer.alloc(...)' : 'Buffer.from(...)',
          });
        }
      },
    });

    return matches;
  },

  fix(content: string, _matches: RuleMatch[]): string {
    // new Buffer(숫자) → Buffer.alloc(숫자)
    let result = content.replace(
      /new\s+Buffer\(\s*(\d+)\s*\)/g,
      'Buffer.alloc($1)',
    );
    // new Buffer(기타) → Buffer.from(기타)
    result = result.replace(
      /new\s+Buffer\(/g,
      'Buffer.from(',
    );
    return result;
  },
};
