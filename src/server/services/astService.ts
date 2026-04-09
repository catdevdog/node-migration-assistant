import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { logger } from '../utils/logger.js';

export interface ParseResult {
  ast: TSESTree.Program;
  lines: string[];
}

/** 파일 내용을 AST로 파싱 */
export function parseCode(content: string, filePath: string): ParseResult | null {
  try {
    const isTS =
      filePath.endsWith('.ts') ||
      filePath.endsWith('.tsx') ||
      filePath.endsWith('.mts') ||
      filePath.endsWith('.cts');

    const ast = parse(content, {
      loc: true,
      range: true,
      tokens: false,
      comment: false,
      jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      ...(isTS ? {} : { allowInvalidAST: true }),
    });

    const lines = content.split('\n');
    return { ast, lines };
  } catch (err) {
    logger.warn(`AST 파싱 실패: ${filePath} — ${(err as Error).message}`);
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
