import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { logger } from '../utils/logger.js';

export interface ParseResult {
  ast: TSESTree.Program;
  lines: string[];
}

/** 파일 내용을 AST로 파싱 */
export function parseCode(content: string, filePath: string): ParseResult | null {
  const isTS =
    filePath.endsWith('.ts') ||
    filePath.endsWith('.tsx') ||
    filePath.endsWith('.mts') ||
    filePath.endsWith('.cts');
  const isJsxExt = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  const tryParse = (jsx: boolean) =>
    parse(content, {
      loc: true,
      range: true,
      tokens: false,
      comment: false,
      jsx,
      ...(isTS ? {} : { allowInvalidAST: true }),
    });

  try {
    // 1차 시도: 확장자 기반 jsx 옵션
    const ast = tryParse(isJsxExt);
    return { ast, lines: content.split('\n') };
  } catch {
    // 2차 시도: .js/.mjs 파일에 JSX가 포함된 경우 (CRA 등) jsx:true로 재시도
    if (!isJsxExt && !isTS) {
      try {
        const ast = tryParse(true);
        return { ast, lines: content.split('\n') };
      } catch { /* fall through */ }
    }
    logger.warn(`AST 파싱 실패: ${filePath}`);
    return null;
  }
}

/** AST 노드를 재귀적으로 방문하는 간단한 워커 */
export function walkAST(
  node: TSESTree.Node,
  visitors: Partial<Record<TSESTree.AST_NODE_TYPES, (node: TSESTree.Node) => void>>,
): void {
  const visitor = visitors[node.type];
  if (visitor) visitor(node);

  for (const key of Object.keys(node) as Array<keyof typeof node>) {
    const child = node[key];
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            walkAST(item as TSESTree.Node, visitors);
          }
        }
      } else if ('type' in child) {
        walkAST(child as TSESTree.Node, visitors);
      }
    }
  }
}
