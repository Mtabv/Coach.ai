import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PdfAusgabe } from './ui/pages/PdfAusgabe';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.hash.startsWith('#/pdfausgabe') ? <PdfAusgabe /> : <App />}
  </StrictMode>,
);
