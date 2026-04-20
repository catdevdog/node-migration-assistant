import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/**
 * querystring 모듈 → URLSearchParams 전환
 * - Node 공식 문서에서 legacy로 분류
 * - URLSearchParams가 WHATWG 표준이며 글로벌로 사용 가능 (Node 10+)
 */
export const querystringDeprecatedRule: RuleImplementation = {
  id: 'node-api/querystring-deprecated',
  requiresAST: false,
  name: 'querystring 모듈 사용',
  description: 'querystring 모듈은 legacy — URLSearchParams 사용 권장.',
  category: 'node-api',
  severity: 'info',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    // require('querystring') 또는 import ... from 'querystring' 감지
    const importPatterns = [
      /\brequire\s*\(\s*['"]querystring['"]\s*\)/g,
      /\bfrom\s+['"]querystring['"]/g,
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'node-api/querystring-deprecated',
          ruleName: 'querystring 모듈 사용',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: 'querystring 모듈은 legacy → URLSearchParams 사용 권장',
          severity: 'info',
          fixable: false,
          needsAI: true,
          aiReason: 'querystring.parse/stringify의 옵션(separator, eq 등)에 따라 변환이 달라집니다',
        });
      }
    }

    // querystring.parse(), querystring.stringify() 직접 호출
    const apiPatterns = [
      { pattern: /\bquerystring\.parse\s*\(/g, msg: 'querystring.parse() → new URLSearchParams()로 변환 가능' },
      { pattern: /\bquerystring\.stringify\s*\(/g, msg: 'querystring.stringify() → URLSearchParams.toString()으로 변환 가능' },
      { pattern: /\bquerystring\.escape\s*\(/g, msg: 'querystring.escape() → encodeURIComponent()로 변환 가능' },
      { pattern: /\bquerystring\.unescape\s*\(/g, msg: 'querystring.unescape() → decodeURIComponent()로 변환 가능' },
    ];

    for (const { pattern, msg } of apiPatterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'node-api/querystring-deprecated',
          ruleName: 'querystring deprecated API',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: msg,
          severity: 'info',
          fixable: false,
          needsAI: true,
          aiReason: 'URLSearchParams와 querystring의 인코딩/파싱 동작이 미세하게 다릅니다',
        });
      }
    }

    return matches;
  },
};
