import type { RuleImplementation } from './types.js';

// 규칙 모듈들
import { bufferConstructorRule } from './node-api/buffer-constructor.js';
import { dirnameFilenameRule } from './node-api/dirname-filename.js';
import { fsPromisesRule } from './node-api/fs-promises.js';
import { utilDeprecatedRule } from './node-api/util-deprecated.js';
import { cryptoDeprecatedRule } from './node-api/crypto-deprecated.js';
import { processBindingRule } from './node-api/process-binding.js';
import { stringTrimRule } from './es-syntax/string-trim.js';
import { cjsToEsmRule } from './es-syntax/cjs-to-esm.js';

/** 등록된 모든 규칙 */
const ALL_RULES: RuleImplementation[] = [
  // Node API 규칙
  bufferConstructorRule,
  dirnameFilenameRule,
  fsPromisesRule,
  utilDeprecatedRule,
  cryptoDeprecatedRule,
  processBindingRule,
  // ES 문법 규칙
  stringTrimRule,
  cjsToEsmRule,
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
