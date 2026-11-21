import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioUtils } from './audio/utils';
import './App.scss';

if (process.env.NODE_ENV === 'development') {
  (window as any).AudioUtils = AudioUtils;
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  // 暫時關閉 StrictMode 以診斷重複渲染問題
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);