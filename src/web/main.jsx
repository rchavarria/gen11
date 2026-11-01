import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage.jsx';
import GamePage from './pages/GamePage.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<CalendarPage />} />
        <Route path="/partido/:slug" element={<GamePage />} />
        <Route path="*" element={<CalendarPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
