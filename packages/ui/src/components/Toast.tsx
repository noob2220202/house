'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';
import { cx } from '../lib/cx';
import { useMounted } from '../lib/hooks';
import { Icon } from '../icons/Icon';

export interface ToastOptions {
  message: ReactNode;
  /** success (default, green check) · error · info */
  tone?: 'success' | 'error' | 'info';
  /** Inline action, e.g. { label: '보러 가기', href: '/me/favorites' } or { label: '실행 취소', onClick }. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Auto-dismiss in ms (default 4000; 0 = sticky). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

export interface ToastApi {
  /** Show a toast; returns its id. */
  toast: (options: ToastOptions | string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API: `const { toast } = useToast(); toast('관심 매물에 담았어요')`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Max simultaneously visible toasts. */
  max?: number;
}

/** Mount once near the app root. Toasts stack bottom-centre, above the mobile tab bar. */
export function ToastProvider({ children, max = 3 }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const mounted = useMounted();

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (options: ToastOptions | string) => {
      const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
      const id = nextId.current++;
      setItems((list) => [...list.slice(-(max - 1)), { ...opts, id }]);
      const duration = opts.duration ?? 4000;
      if (duration > 0)
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      return id;
    },
    [dismiss, max],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div
              className={styles.region}
              role="region"
              aria-label="알림 메시지"
              aria-live="polite"
            >
              {items.map((t) => (
                <div
                  key={t.id}
                  className={cx(styles.toast, t.tone === 'error' && styles.error)}
                  role={t.tone === 'error' ? 'alert' : 'status'}
                >
                  <Icon
                    name={
                      t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check-circle'
                    }
                    size={20}
                    className={styles.icon}
                  />
                  <span className={styles.msg}>{t.message}</span>
                  {t.action &&
                    (t.action.href ? (
                      <a className={styles.action} href={t.action.href}>
                        {t.action.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.action}
                        onClick={() => {
                          t.action?.onClick?.();
                          dismiss(t.id);
                        }}
                      >
                        {t.action.label}
                      </button>
                    ))}
                  <button
                    type="button"
                    className={styles.close}
                    onClick={() => dismiss(t.id)}
                    aria-label="알림 닫기"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
