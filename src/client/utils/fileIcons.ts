/** 파일 확장자에 따른 색상 매핑 */
export function getFileColor(extension?: string): string {
  if (!extension) return 'text-gray-400';

  const colorMap: Record<string, string> = {
    '.ts': 'text-blue-400',
    '.tsx': 'text-blue-400',
    '.js': 'text-yellow-400',
    '.jsx': 'text-yellow-400',
    '.json': 'text-green-400',
    '.css': 'text-purple-400',
    '.scss': 'text-pink-400',
    '.less': 'text-purple-400',
    '.html': 'text-orange-400',
    '.vue': 'text-emerald-400',
    '.md': 'text-gray-300',
    '.yml': 'text-red-400',
    '.yaml': 'text-red-400',
    '.svg': 'text-orange-300',
    '.png': 'text-green-300',
    '.jpg': 'text-green-300',
    '.gif': 'text-green-300',
    '.env': 'text-yellow-600',
    '.lock': 'text-gray-500',
  };

  return colorMap[extension] ?? 'text-gray-400';
}
