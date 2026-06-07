import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

window.addEventListener('error', (event) => {
  if (window.braintwo?.logs?.error) {
    void window.braintwo.logs.error('renderer:global', event.error || event.message)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (window.braintwo?.logs?.error) {
    void window.braintwo.logs.error('renderer:unhandledRejection', event.reason)
  }
})
