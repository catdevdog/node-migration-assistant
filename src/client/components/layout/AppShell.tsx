import type { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <TopBar />

      {/* 메인 콘텐츠 — Sidebar 제거, 풀 너비 */}
      <main className="flex-1 overflow-hidden bg-gray-900">
        {children}
      </main>

      <StatusBar />
    </div>
  );
}
