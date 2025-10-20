import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import DossierDetailPage from './pages/DossierDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import ProfilePage from './pages/ProfilePage';
import AnimatedBackground from './components/AnimatedBackground';
import { getUser, removeToken, removeUser, authAPI } from './api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const storedUser = getUser();
    if (storedUser) {
      try {
        const currentUser = await authAPI.getMe();
        setUser(currentUser);
      } catch (error) {
        // Token invalid, clear storage
        removeToken();
        removeUser();
      }
    }
    setLoading(false);
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    removeToken();
    removeUser();
    setUser(null);
    setShowAdmin(false);
  };

  if (loading) {
    return (
      <div className="App loading-screen">
        <div className="loading-content">
          <div className="es-logo">🛡️</div>
          <h1>ETERNAL SENTINELS</h1>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  // Show admin panel if user clicked admin button
  if (showAdmin && user && user.clearance_level >= 5) {
    return (
      <div className="App">
        <AdminPanel
          currentUser={user}
          onLogout={() => {
            setShowAdmin(false);
            handleLogout();
          }}
          onBackToHome={() => {
            setShowAdmin(false);
          }}
        />
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {/* Animated background with toggle button */}
        <AnimatedBackground />
        
        <div className="main-content">
          <Routes>
            <Route
              path="/login"
              element={
                user ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />
              }
            />
            <Route
              path="/"
              element={
                user ? (
                  <HomePage onAdminClick={() => setShowAdmin(true)} />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/profile"
              element={
                user ? <ProfilePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
              }
            />
            <Route
              path="/dossier/:number"
              element={
                user ? <DossierDetailPage /> : <Navigate to="/login" />
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;