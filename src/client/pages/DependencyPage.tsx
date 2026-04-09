import { useState } from 'react';
import { Package, FileSearch, GitFork, Network } from 'lucide-react';
import { PackageTab } from '../components/dependency/PackageTab';
import { FileScanTab } from '../components/dependency/FileScanTab';
import { UsageTab } from '../components/dependency/UsageTab';
import { GraphTab } from '../components/dependency/GraphTab';

type TabId = 'packages' | 'scan' | 'usage' | 'graph';

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: 'packages', label: '패키지', icon: Package },
  { id: 'scan', label: '파일 스캔', icon: FileSearch },
  { id: 'usage', label: '사용처', icon: GitFork },
  { id: 'graph', label: '그래프', icon: Network },
];

export function DependencyPage() {
  const [activeTab, setActiveTab] = useState<TabId>('packages');

  return (
    <div className="flex flex-col h-full">
      {/* 탭 바 */}
      <div className="flex items-center border-b border-gray-700 bg-gray-800 px-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'packages' && <PackageTab />}
        {activeTab === 'scan' && <FileScanTab />}
        {activeTab === 'usage' && <UsageTab />}
        {activeTab === 'graph' && <GraphTab />}
      </div>
    </div>
  );
}
