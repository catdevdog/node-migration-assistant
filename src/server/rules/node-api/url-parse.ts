import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/**
 * url.parse() → new URL() 전환
 * - Node 11+에서 url.parse() deprecated
 * - url.resolve() 도 deprecated
 * - url.format(urlObject) 는 WHATWG URL과 호환 가능
 */
export const urlParseRule: RuleImplementation = {
  id: 'node-api/url-parse',
  name: 'url.parse() deprecated',
  description: 'url.parse()는 Node 11+에서 deprecated. new URL() 또는 URL API를 사용하세요.',
  category: 'node-api',
  severity: 'warning',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    const patterns: Array<{
      pattern: RegExp;
      msg: string;
      fixable: boolean;
      aiReason?: string;
    }> = [
      {
        pattern: /\burl\.parse\s*\(/g,
        msg: 'url.parse()는 deprecated → new URL()을 사용하세요',
        fixable: false,
        aiReason: '두 번째 인자(querystring 파싱), 세 번째 인자(슬래시 처리) 등 변환 패턴이 다양합니다',
      },
      {
        pattern: /\burl\.resolve\s*\(/g,
        msg: 'url.resolve()는 deprecated → new URL(relative, base)를 사용하세요',
        fixable: false,
        aiReason: '상대 경로 해석 로직이 new URL()과 미묘하게 다를 수 있습니다',
      },
      {
        pattern: /\burl\.format\s*\(/g,
        msg: 'url.format()은 deprecated → URL.toString() 또는 URL.href를 사용하세요',
        fixable: false,
        aiReason: 'url.format(urlObject)의 인자 구조에 따라 변환이 달라집니다',
      },
    ];

    for (const { pattern, msg, fixable, aiReason } of patterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'node-api/url-parse',
          ruleName: 'url deprecated API',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: msg,
          severity: 'warning',
          fixable,
          needsAI: true,
          aiReason,
        });
      }
    }

    return matches;
  },
};
