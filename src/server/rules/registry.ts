import type { RuleImplementation } from './types.js';

// 규칙 모듈들 — Node API
import { bufferConstructorRule } from './node-api/buffer-constructor.js';
import { dirnameFilenameRule } from './node-api/dirname-filename.js';
import { fsPromisesRule } from './node-api/fs-promises.js';
import { utilDeprecatedRule } from './node-api/util-deprecated.js';
import { cryptoDeprecatedRule } from './node-api/crypto-deprecated.js';
import { processBindingRule } from './node-api/process-binding.js';
import { urlParseRule } from './node-api/url-parse.js';
import { querystringDeprecatedRule } from './node-api/querystring-deprecated.js';
// 규칙 모듈들 — ES 문법
import { stringTrimRule } from './es-syntax/string-trim.js';
import { cjsToEsmRule } from './es-syntax/cjs-to-esm.js';
import { moduleExportsRule } from './es-syntax/module-exports.js';

/** 등록된 모든 규칙 */
const ALL_RULES: RuleImplementation[] = [
  // Node API 규칙
  bufferConstructorRule,
  dirnameFilenameRule,
  fsPromisesRule,
  utilDeprecatedRule,
  cryptoDeprecatedRule,
  processBindingRule,
  urlParseRule,
  querystringDeprecatedRule,
  // ES 문법 규칙
  stringTrimRule,
  cjsToEsmRule,
  moduleExportsRule,
];

/** 파일 확장자에 맞는 규칙 필터링 */
export function getRulesForFile(filePath: string): RuleImplementation[] {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return ALL_RULES.filter((rule) => rule.fileExtensions.includes(ext));
}

/** 전체 규칙 목록 */
export function getAllRules(): RuleImplementation[] {
  return [...ALL_RULES];
}
