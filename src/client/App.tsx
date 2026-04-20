import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { SetupPage } from './pages/SetupPage';
import { WorkPage } from './pages/WorkPage';
import { ApiKeyModal } from './components/onboarding/ApiKeyModal';
import { useProjectStore } from './stores/useProjectStore';
import { useUIStore } from './stores/useUIStore';
import { useSettingsStore } from './stores/useSettingsStore';

function PageRouter() {
  const activePage = useUIStore((s) => s.activePage);

  switch (activePage) {
    case 'setup':
      return <SetupPage />;
    case 'work':
      return <WorkPage />;
    default:
      return <SetupPage />;
  }
}

export default function App() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const modals = useUIStore((s) => s.modals);
  const closeModal = useUIStore((s) => s.closeModal);

  // 프로젝트 로드 (앱 진입 시 1회)
  useEffect(() => {
    loadProject();
  }, []);

  // API 키 미설정 시 강제 온보딩 모달
  const onboardingOpen = !apiKey;
  // 설정 버튼에서 열 수도 있음
  const apiKeyModalOpen = onboardingOpen || modals.apiKey;

  return (
    <ErrorBoundary>
      <AppShell>
        <PageRouter />
      </AppShell>
      <ApiKeyModal
        open={apiKeyModalOpen}
        onClose={() => {
          if (!onboardingOpen) closeModal('apiKey');
          /* 강제 모달일 때는 키가 설정되어야만 자동 닫힘 */
        }}
        required={onboardingOpen}
      />
    </ErrorBoundary>
  );
}
