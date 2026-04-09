import type { RuleImplementation, RuleContext } from '../types.js';
import type { RuleMatch } from '../../../shared/types/rule.js';

/** String trimLeft/trimRight → trimStart/trimEnd */
export const stringTrimRule: RuleImplementation = {
  id: 'es-syntax/string-trim',
  name: 'trimLeft/trimRight deprecated',
  description: 'trimLeft/trimRight → trimStart/trimEnd 사용 권장.',
  category: 'es-syntax',
  severity: 'warning',
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],

  detect(context: RuleContext): RuleMatch[] {
    const matches: RuleMatch[] = [];

    const patterns = [
      { pattern: /\.trimLeft\s*\(\)/g, old: 'trimLeft()', replacement: 'trimStart()' },
      { pattern: /\.trimRight\s*\(\)/g, old: 'trimRight()', replacement: 'trimEnd()' },
    ];

    for (const { pattern, old, replacement } of patterns) {
      let match;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = context.content.substring(0, match.index).split('\n').length;
        const col = match.index - context.content.lastIndexOf('\n', match.index) - 1;

        matches.push({
          ruleId: 'es-syntax/string-trim',
          ruleName: 'trimLeft/trimRight deprecated',
          line,
          column: col,
          endLine: line,
          endColumn: col + match[0].length,
          message: `.${old} → .${replacement}로 변경 권장`,
          severity: 'warning',
          fixable: true,
          suggestedFix: `.${replacement}`,
        });
      }
    }

    return matches;
  },

  fix(content: string): string {
    return content
      .replace(/\.trimLeft\s*\(\)/g, '.trimStart()')
      .replace(/\.trimRight\s*\(\)/g, '.trimEnd()');
  },
};
