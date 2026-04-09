import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Network, Loader2, Play, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useEditorStore } from '../../stores/useEditorStore';
import { useUIStore } from '../../stores/useUIStore';
import type { ImportGraph, ImportGraphNode, ImportGraphEdge } from '@shared/types/dependency';

/** 노드/엣지 위치 계산 (그리드 레이아웃) */
function computeLayout(
  graphNodes: ImportGraphNode[],
  graphEdges: ImportGraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(graphNodes.length));
  const nodes: Node[] = graphNodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % cols) * 200, y: Math.floor(i / cols) * 120 },
    data: { label: n.label, issueCount: n.issueCount ?? 0, type: n.type },
    style: {
      background:
        n.issueCount && n.issueCount > 0
          ? n.type === 'package'
            ? '#1e1b4b'
            : '#7f1d1d'
          : '#1a2332',
      color: '#e5e7eb',
      border: `1px solid ${n.issueCount && n.issueCount > 0 ? '#dc2626' : '#374151'}`,
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '11px',
      width: 160,
    },
  }));

  const edges: Edge[] = graphEdges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    animated: false,
    style: { stroke: '#4b5563', strokeWidth: 1 },
  }));

  return { nodes, edges };
}

export function GraphTab() {
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const openFile = useEditorStore((s) => s.openFile);
  const setActivePage = useUIStore((s) => s.setActivePage);

  /** 그래프 데이터 가져오기 */
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<ImportGraph>('/deps/graph');
      const { nodes, edges } = computeLayout(data.nodes, data.edges);
      setFlowNodes(nodes);
      setFlowEdges(edges);
      setGenerated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '그래프 생성에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /** 노드 클릭 시 에디터에서 파일 열기 */
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // package 노드는 파일이 아니므로 무시
      if (node.data.type === 'package') return;
      openFile(node.id);
      setActivePage('editor');
    },
    [openFile, setActivePage],
  );

  // 초기 상태 (생성 전)
  if (!generated && !loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <Network size={32} />
        <p className="text-sm">import 관계를 그래프로 시각화합니다.</p>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-200 bg-blue-600 rounded hover:bg-blue-500 transition-colors"
        >
          <Play size={14} />
          그래프 생성
        </button>
      </div>
    );
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
        <span className="text-sm">그래프를 생성하고 있습니다...</span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Network size={32} className="text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <span className="text-xs text-gray-400">
          <Network size={12} className="inline mr-1" />
          {flowNodes.length}개 노드 / {flowEdges.length}개 연결
        </span>

        {/* 범례 */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1a2332] border border-gray-600" />
            정상
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#7f1d1d] border border-red-600" />
            이슈 있음
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1e1b4b] border border-indigo-600" />
            외부 패키지
          </span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} />
          다시 생성
        </button>
      </div>

      {/* React Flow 캔버스 */}
      <div className="flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#374151" gap={20} size={1} />
          <Controls
            showInteractive={false}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.data.type === 'package') return '#4338ca';
              if (node.data.issueCount > 0) return '#dc2626';
              return '#374151';
            }}
            maskColor="rgba(0, 0, 0, 0.7)"
            style={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
