import { reportException } from './lib/analytics';

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        void registration.update();
      })
      .catch((error: unknown) => {
        reportException(error, 'service_worker_registration');
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
