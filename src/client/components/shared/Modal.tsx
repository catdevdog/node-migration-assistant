import type { ReactNode } from 'react';
import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  /** true이면 닫기 버튼/ESC 비활성화 */
  persistent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_STYLES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  persistent = false,
  size = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent && onClose) {
        onClose();
      }
    },
    [onClose, persistent],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={persistent ? undefined : onClose}
      />

      {/* 모달 본체 */}
      <div
        className={`
          relative z-10 w-full ${SIZE_STYLES[size]}
          bg-gray-800 rounded-lg shadow-2xl border border-gray-700
          p-6 mx-4
        `}
      >
        {/* 헤더 */}
        {(title || !persistent) && (
          <div className="flex items-center justify-between mb-4">
            {title && (
              <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
            )}
            {!persistent && onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* 본문 */}
        {children}
      </div>
    </div>
  );
}
