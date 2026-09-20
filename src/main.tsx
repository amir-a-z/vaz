import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'katex/dist/katex.min.css';

// Filter out benign KaTeX font metric warnings for Persian/Arabic characters and HMR websocket notices
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('No character metrics for') ||
      args[0].includes('LaTeX-incompatible input') ||
      args[0].includes('unknownSymbol') ||
      args[0].includes('[vite]'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Silence unhandled rejections from closed HMR websockets (HMR is intentionally disabled in cloud preview)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || (typeof event?.reason === 'string' ? event.reason : '');
  if (msg && (msg.includes('WebSocket') || msg.includes('websocket'))) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

