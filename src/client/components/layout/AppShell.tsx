import type { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 overflow-hidden bg-gray-900">
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
