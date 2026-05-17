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
            borderRadius: '16px',
            background: '#fff',
            color: '#0f172a',
            fontWeight: '600',
            fontSize: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
          },
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
