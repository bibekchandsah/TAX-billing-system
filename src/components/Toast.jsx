import { useAppStore } from '../store/appStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import styles from './Toast.module.css';

const ToastContainer = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]} animate-slide-up`}>
          <div className={styles.icon}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
          </div>
          <div className={styles.message}>{toast.message}</div>
          <button onClick={() => removeToast(toast.id)} className={styles.closeBtn}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
