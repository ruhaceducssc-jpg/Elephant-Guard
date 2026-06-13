import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: {
            borderRadius: '5px',
            background: '#fff',
            color: '#0f172a',
            fontWeight: '600',
            fontSize: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.07)',
          },
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
