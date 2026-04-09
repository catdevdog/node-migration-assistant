import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

const DEPRECATED_UTILS: Record<string, string> = {
  'util.isArray': 'Array.isArray()',
  'util.isRegExp': 'value instanceof RegExp',
  'util.isDate': 'value instanceof Date',
  'util.isError': 'value instanceof Error',
  'util.isBoolean': 'typeof value === "boolean"',
  'util.isNumber': 'typeof value === "number"',
  'util.isString': 'typeof value === "string"',
  'util.isObject': 'typeof value === "object" && value !== null',
  'util.isNull': 'value === null',
  'util.isUndefined': 'value === undefined',
  'util.isNullOrUndefined': 'value == null',
  'util.isPrimitive': '네이티브 타입 체크',
  'util.isFunction': 'typeof value === "function"',
  'util.isBuffer': 'Buffer.isBuffer()',
  'util.log': 'console.log()',
  'util.print': 'process.stdout.write()',
  'util.puts': 'console.log()',
  'util.pump': 'stream.pipeline()',
};

/** util 모듈 deprecated 함수 감지 */
export const utilDeprecatedRule: RuleImplementation = {
  id: 'node-api/util-deprecated',
  name: 'util 모듈 deprecated 함수',
  description: 'util.isArray() 등 deprecated 함수 → 네이티브 대체 권장.',
  category: 'node-api',
  severity: 'warning',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const [pattern, replacement] of Object.entries(DEPRECATED_UTILS)) {
      const regex = new RegExp(`\\b${pattern.replace('.', '\\.')}\\s*\\(`, 'g');
      let match;
      while ((match = regex.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'node-api/util-deprecated',
          ruleName: 'util deprecated 함수',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: `${pattern}()은 deprecated → ${replacement} 사용 권장`,
          severity: 'warning',
          fixable: pattern === 'util.isArray',
          suggestedFix: pattern === 'util.isArray' ? 'Array.isArray(...)' : undefined,
        });
      }
    }

    return matches;
  },

  fix(content: string, _matches: RuleMatch[]): string {
    return content.replace(/\butil\.isArray\s*\(/g, 'Array.isArray(');
  },
};
