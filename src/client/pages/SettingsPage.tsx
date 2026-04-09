import { useState } from 'react';
import { KeyRound, Check, Moon, Sun } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { SUPPORTED_NODE_VERSIONS } from '@shared/constants';
import { Button } from '../components/shared/Button';

export function SettingsPage() {
  const {
    apiKey,
    setApiKey,
    clearApiKey,
    targetNodeVersion,
    setTargetNodeVersion,
    theme,
    toggleTheme,
  } = useSettingsStore();

  const [keyInput, setKeyInput] = useState(apiKey ?? '');
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim());
    } else {
      clearApiKey();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-bold text-gray-100">설정</h1>

      {/* API 키 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <KeyRound size={16} />
          Anthropic API 키
        </h2>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
          />
          <Button onClick={handleSaveKey} icon={saved ? <Check size={14} /> : undefined}>
            {saved ? '저장됨' : '저장'}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          브라우저 로컬 스토리지에만 저장됩니다.
        </p>
      </section>

      {/* 목표 Node 버전 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">목표 Node.js 버전</h2>
        <select
          value={targetNodeVersion}
          onChange={(e) => setTargetNodeVersion(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {SUPPORTED_NODE_VERSIONS.map((v) => (
            <option key={v} value={v}>
              Node {v} LTS
            </option>
          ))}
        </select>
      </section>

      {/* 테마 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">테마</h2>
        <Button
          variant="secondary"
          onClick={toggleTheme}
          icon={theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
        >
          {theme === 'dark' ? '다크 모드' : '라이트 모드'}
        </Button>
      </section>
    </div>
  );
}
