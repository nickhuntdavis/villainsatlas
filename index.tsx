import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Lazy load StyleGuide since it's only used on /style-guide route
const StyleGuide = lazy(() => 
  import('./ui/StyleGuide').then(module => ({ default: module.StyleGuide }))
);

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
    {path === '/style-guide' ? (
      <Suspense fallback={<div>Loading style guide...</div>}>
        <StyleGuide />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);