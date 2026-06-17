import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import './index.css'
import { initTheme } from './utils/theme'

initTheme()

const handleUncaughtError = (event: ErrorEvent) => {
  console.error("Uncaught error:", event.error);
};

const handleRejection = (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection:", event.reason);
};

window.addEventListener("error", handleUncaughtError);
window.addEventListener("unhandledrejection", handleRejection);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ToastProvider>
  </StrictMode>,
)
