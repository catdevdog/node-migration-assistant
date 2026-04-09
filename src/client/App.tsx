import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { EditorPage } from './pages/EditorPage';
import { DependencyPage } from './pages/DependencyPage';
import { SettingsPage } from './pages/SettingsPage';
import { GuidePage } from './pages/GuidePage';
import { useProjectStore } from './stores/useProjectStore';
import { useUIStore } from './stores/useUIStore';

function PageRouter() {
  const activePage = useUIStore((s) => s.activePage);

  switch (activePage) {
    case 'editor':
      return <EditorPage />;
    case 'dependencies':
      return <DependencyPage />;
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

  useEffect(() => {
    // 프로젝트 로드
    loadProject();
  }, []);

  return (
    <ErrorBoundary>
      <AppShell>
        <PageRouter />
      </AppShell>
    </ErrorBoundary>
  );
}
