import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker disabled for preview environment to avoid redirect errors
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Standard registration path to minimize proxy interference
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
      console.error('SW registration failed: ', err);
    });
  });
}
*/

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
