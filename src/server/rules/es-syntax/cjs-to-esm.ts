import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { walkAST } from '../../services/astService.js';
import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** CommonJS require() → ES module import 감지 */
export const cjsToEsmRule: RuleImplementation = {
  id: 'es-syntax/cjs-to-esm',
  requiresAST: true,
  name: 'CommonJS require() 사용',
  description: 'require() → import 문으로 변환 권장. 동적 require는 AI 검토 필요.',
  category: 'es-syntax',
  severity: 'info',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];
    if (!context.ast) return matches;

    walkAST(context.ast, {
      [AST_NODE_TYPES.CallExpression](node) {
        const n = node as any;
        if (n.callee?.type === AST_NODE_TYPES.Identifier && n.callee.name === 'require') {
          const arg = n.arguments?.[0];
          const isStaticString =
            arg?.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string';

          if (isStaticString) {
            // 정적 require — 단순 변환 가능
            matches.push({
              ruleId: 'es-syntax/cjs-to-esm',
              ruleName: 'CommonJS require()',
              line: n.loc.start.line,
              column: n.loc.start.column,
              endLine: n.loc.end.line,
              endColumn: n.loc.end.column,
              message: `require("${arg.value}") → import 문으로 변환 가능`,
              severity: 'info',
              fixable: false,
              needsAI: true,
              aiReason: 'require 패턴(구조분해, 조건부 등)에 따라 변환 방식이 다릅니다',
            });
          } else {
            // 동적 require — AI 필요
            matches.push({
              ruleId: 'es-syntax/cjs-to-esm',
              ruleName: 'CommonJS 동적 require()',
              line: n.loc.start.line,
              column: n.loc.start.column,
              endLine: n.loc.end.line,
              endColumn: n.loc.end.column,
              message: '동적 require() → import() 비동기 변환 또는 createRequire() 사용 검토',
              severity: 'warning',
              fixable: false,
              needsAI: true,
              aiReason: '동적 모듈 로딩은 비즈니스 로직에 따라 변환 방법이 다릅니다',
            });
          }
        }
      },
    });

    return matches;
  },
};
