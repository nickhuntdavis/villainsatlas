import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StyleGuide } from './ui/StyleGuide';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Simple, dependency-free routing:
// - "/" renders the main App (map experience)
// - "/style-guide" renders the internal design system style guide
const path = window.location.pathname;

root.render(
  <React.StrictMode>
    {path === '/style-guide' ? <StyleGuide /> : <App />}
  </React.StrictMode>
);