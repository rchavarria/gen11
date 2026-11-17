import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage.jsx';
import CompetitionsPage from './pages/CompetitionsPage.jsx';
import GamePage from './pages/GamePage.jsx';
import './styles.css';

// Featured round the home page redirects to; updated every week
const HOME = '/competitions?c=s67-kdt-oro&ph=f1&g=g2&r=j08';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate replace to={HOME} />} />
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/game/:slug" element={<GamePage />} />
        <Route path="*" element={<Navigate replace to={HOME} />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
