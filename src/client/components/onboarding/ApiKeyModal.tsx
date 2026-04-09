import { useState } from 'react';
import { KeyRound, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ open, onClose }: ApiKeyModalProps) {
  const { apiKey, setApiKey } = useSettingsStore();
  const [inputKey, setInputKey] = useState(apiKey ?? '');
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const validateKey = async () => {
    if (!inputKey.trim()) {
      setStatus('invalid');
      setErrorMsg('API 키를 입력해주세요.');
      return;
    }

    setValidating(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      // Anthropic API에 경량 호출로 키 유효성 검증
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': inputKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      if (response.ok || response.status === 200) {
        setStatus('valid');
        setApiKey(inputKey.trim());
      } else if (response.status === 401) {
        setStatus('invalid');
        setErrorMsg('유효하지 않은 API 키입니다.');
      } else {
        // 다른 에러(429 등)는 키 자체는 유효한 것
        setStatus('valid');
        setApiKey(inputKey.trim());
      }
    } catch {
      setStatus('invalid');
      setErrorMsg('API 서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } finally {
      setValidating(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleConfirm = () => {
    if (status === 'valid') {
      onClose();
    }
  };

  return (
    <Modal open={open} persistent title="" size="md">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/10 mb-4">
          <Sparkles className="text-blue-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">
          Node Migration Assistant
        </h1>
        <p className="text-sm text-gray-400">
          Node.js 프로젝트 마이그레이션을 AI와 함께 자동화합니다.
          <br />
          규칙 기반 분석 + Claude AI 기반 지능형 코드 변환을 제공합니다.
        </p>
      </div>

      {/* API 키 입력 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          <KeyRound size={14} className="inline mr-1.5" />
          Anthropic API 키
        </label>

        <div className="relative">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => {
              setInputKey(e.target.value);
              setStatus('idle');
              setErrorMsg('');
            }}
            placeholder="sk-ant-api03-..."
            className={`
              w-full px-3 py-2 bg-gray-900 border rounded text-sm text-gray-200
              placeholder:text-gray-600 focus:outline-none transition-colors
              ${status === 'invalid' ? 'border-red-500 focus:border-red-400' : ''}
              ${status === 'valid' ? 'border-green-500 focus:border-green-400' : ''}
              ${status === 'idle' ? 'border-gray-600 focus:border-blue-500' : ''}
            `}
            onKeyDown={(e) => {
              if (e.key === 'Enter') validateKey();
            }}
          />
          {status === 'valid' && (
            <CheckCircle
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400"
            />
          )}
          {status === 'invalid' && (
            <AlertCircle
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400"
            />
          )}
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}

        {status === 'valid' && (
          <p className="text-xs text-green-400">API 키가 확인되었습니다.</p>
        )}

        <p className="text-xs text-gray-500">
          API 키는 브라우저 로컬 스토리지에만 저장되며, api.anthropic.com 이외의 서버로 전송되지 않습니다.
        </p>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 mt-6">
        <Button
          variant="primary"
          onClick={status === 'valid' ? handleConfirm : validateKey}
          loading={validating}
          className="flex-1"
        >
          {status === 'valid' ? '시작하기' : '키 검증'}
        </Button>
        <Button variant="ghost" onClick={handleSkip}>
          건너뛰기
        </Button>
      </div>

      <p className="text-xs text-gray-600 text-center mt-3">
        건너뛰면 규칙 기반 분석만 사용할 수 있습니다. 설정에서 언제든 키를 추가할 수 있습니다.
      </p>
    </Modal>
  );
}
