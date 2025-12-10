import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchemaProvider } from './store/schemaStore';
import { ThemeProvider } from './store/themeStore';
import { SettingsProvider } from './store/settingsStore';
import Layout from './components/Layout';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SettingsProvider>
          <SchemaProvider>
            <Routes>
              <Route path="/login" element={<AuthPage type="login" />} />
              <Route path="/register" element={<AuthPage type="register" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/editor/:projectId" element={<Layout />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </SchemaProvider>
        </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
