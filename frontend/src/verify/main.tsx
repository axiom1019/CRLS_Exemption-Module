import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import './verify.css';
import { VerifyApp } from './VerifyApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VerifyApp />
  </StrictMode>,
);
