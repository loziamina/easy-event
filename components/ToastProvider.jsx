import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type, title, description) => {
    const id = randomId();
    setToasts((current) => [...current, { id, type, title, description }]);
    setTimeout(() => removeToast(id), 4200);
  }, [removeToast]);

  const api = useMemo(() => ({
    showToast: (options) => pushToast(options.type || 'info', options.title, options.description),
    success: (title, description) => pushToast('success', title, description),
    error: (title, description) => pushToast('error', title, description),
    info: (title, description) => pushToast('info', title, description),
  }), [pushToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <div className="toast-copy">
              <p className="toast-title">{toast.title}</p>
              {toast.description ? <p className="toast-description">{toast.description}</p> : null}
            </div>
            <button type="button" className="toast-close" onClick={() => removeToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}
