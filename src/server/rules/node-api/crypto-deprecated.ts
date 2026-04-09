import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** crypto.createCipher → crypto.createCipheriv */
export const cryptoDeprecatedRule: RuleImplementation = {
  id: 'node-api/crypto-deprecated',
  name: 'crypto deprecated API',
  description: 'crypto.createCipher/Decipher → createCipheriv/Decipheriv 사용 필요.',
  category: 'node-api',
  severity: 'error',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    const patterns = [
      { pattern: /\bcrypto\.createCipher\s*\(/g, msg: 'crypto.createCipher() → crypto.createCipheriv()로 변경 필요 (IV 필수)' },
      { pattern: /\bcrypto\.createDecipher\s*\(/g, msg: 'crypto.createDecipher() → crypto.createDecipheriv()로 변경 필요 (IV 필수)' },
      { pattern: /\btls\.createSecurePair\s*\(/g, msg: 'tls.createSecurePair()는 제거됨 — tls.TLSSocket 사용' },
    ];

    for (const { pattern, msg } of patterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'node-api/crypto-deprecated',
          ruleName: 'crypto deprecated API',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: msg,
          severity: 'error',
          fixable: false,
          needsAI: true,
          aiReason: 'IV(초기화 벡터) 추가가 필요하여 수동 검토가 필요합니다',
        });
      }
    }

    return matches;
  },
};
