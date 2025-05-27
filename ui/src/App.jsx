import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SessionList from './components/SessionList';
import SessionViewer from './components/SessionViewer';
import './index.css';
import { Sun, Moon } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Collaborative Debugger Replay</h1>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={toggleTheme}
            className="theme-toggle-button"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <Link to="/" style={{ marginLeft: 16 }}>Sessions</Link>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/sessions/:id" element={<SessionViewer />} />
      </Routes>
    </div>
  );
}

export default App;