import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage.jsx';
import CompetitionsPage from './pages/CompetitionsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<CompetitionsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/game/:slug" element={<GamePage />} />
        <Route path="*" element={<CompetitionsPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
