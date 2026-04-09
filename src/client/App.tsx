import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ApiKeyModal } from './components/onboarding/ApiKeyModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { EditorPage } from './pages/EditorPage';
import { DependencyPage } from './pages/DependencyPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { GuidePage } from './pages/GuidePage';
import { useProjectStore } from './stores/useProjectStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { useUIStore } from './stores/useUIStore';

function PageRouter() {
  const activePage = useUIStore((s) => s.activePage);

  switch (activePage) {
    case 'editor':
      return <EditorPage />;
    case 'dependencies':
      return <DependencyPage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'settings':
      return <SettingsPage />;
    case 'guide':
      return <GuidePage />;
    default:
      return <EditorPage />;
  }
}

export default function App() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // 프로젝트 로드
    loadProject();

    // API 키가 없으면 온보딩 모달 표시
    if (!apiKey) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <ErrorBoundary>
      <AppShell>
        <PageRouter />
      </AppShell>

      {/* 온보딩 모달 */}
      <ApiKeyModal
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </ErrorBoundary>
  );
}
