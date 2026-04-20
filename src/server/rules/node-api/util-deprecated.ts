import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** 자동수정 가능 여부 + 대체 표현 */
interface DeprecatedUtil {
  replacement: string;
  /** 단순 함수명 치환으로 자동수정 가능한 경우 치환 대상 */
  autoFix?: string;
}

const DEPRECATED_UTILS: Record<string, DeprecatedUtil> = {
  // ─── 자동수정 가능 (함수 호출 1:1 치환) ───
  'util.isArray':     { replacement: 'Array.isArray()',          autoFix: 'Array.isArray' },
  'util.isRegExp':    { replacement: 'value instanceof RegExp',  autoFix: undefined },
  'util.isDate':      { replacement: 'value instanceof Date',    autoFix: undefined },
  'util.isError':     { replacement: 'value instanceof Error',   autoFix: undefined },
  'util.isBoolean':   { replacement: 'typeof v === "boolean"',   autoFix: undefined },
  'util.isNumber':    { replacement: 'typeof v === "number"',    autoFix: undefined },
  'util.isString':    { replacement: 'typeof v === "string"',    autoFix: undefined },
  'util.isObject':    { replacement: 'typeof v === "object" && v !== null', autoFix: undefined },
  'util.isNull':      { replacement: 'value === null',           autoFix: undefined },
  'util.isUndefined': { replacement: 'value === undefined',      autoFix: undefined },
  'util.isNullOrUndefined': { replacement: 'value == null',      autoFix: undefined },
  'util.isPrimitive': { replacement: '네이티브 타입 체크',        autoFix: undefined },
  'util.isFunction':  { replacement: 'typeof v === "function"',  autoFix: undefined },
  'util.isBuffer':    { replacement: 'Buffer.isBuffer()',        autoFix: 'Buffer.isBuffer' },
  // ─── 로깅/스트림 ───
  'util.log':   { replacement: 'console.log()',            autoFix: 'console.log' },
  'util.print': { replacement: 'process.stdout.write()',   autoFix: 'process.stdout.write' },
  'util.puts':  { replacement: 'console.log()',            autoFix: 'console.log' },
  'util.pump':  { replacement: 'stream.pipeline()',        autoFix: undefined },
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

    for (const [pattern, info] of Object.entries(DEPRECATED_UTILS)) {
      const regex = new RegExp(`\\b${pattern.replace('.', '\\.')}\\s*\\(`, 'g');
      let match;
      while ((match = regex.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;
        const canAutoFix = !!info.autoFix;

        matches.push({
          ruleId: 'node-api/util-deprecated',
          ruleName: 'util deprecated 함수',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: `${pattern}()은 deprecated → ${info.replacement} 사용 권장`,
          severity: 'warning',
          fixable: canAutoFix,
          needsAI: !canAutoFix,
          aiReason: canAutoFix ? undefined : '인자 구조에 따라 변환 방식이 다릅니다',
          suggestedFix: canAutoFix ? `${info.autoFix}(...)` : undefined,
        });
      }
    }

    return matches;
  },

  fix(content: string, _matches: RuleMatch[]): string {
    let result = content;
    for (const [pattern, info] of Object.entries(DEPRECATED_UTILS)) {
      if (!info.autoFix) continue;
      const regex = new RegExp(`\\b${pattern.replace('.', '\\.')}\\s*\\(`, 'g');
      result = result.replace(regex, `${info.autoFix}(`);
    }
    return result;
  },
};
