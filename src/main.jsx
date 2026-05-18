import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { SyncProvider } from './contexts/SyncContext.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SyncProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </SyncProvider>
  </React.StrictMode>
)
