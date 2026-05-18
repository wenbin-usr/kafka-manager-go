import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import { AppSettingsProvider } from './context/AppSettings';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppSettingsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppSettingsProvider>
  </React.StrictMode>,
);
