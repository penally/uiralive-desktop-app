import React, { useEffect, useState, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  useLocation,
  type Location,
} from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthGuard } from './components/AuthGuard';
import { DiscordRPCProvider } from './components/DiscordRPC';
import LoadingScreen from './components/home/Loading';
import { checkExtensionStatus } from './backend/extension';

const Home = lazy(() => import('./pages/Home'));
const MoviePage = lazy(() => import('./pages/Movie'));
const TvPage = lazy(() => import('./pages/Tv'));
const TrendingPage = lazy(() => import('./pages/Trending'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ErrorPage = lazy(() => import('./pages/ErrorPage'));
const MovieDetailRoute = lazy(() => import('./pages/MovieDetailRoute'));
const TvDetailRoute = lazy(() => import('./pages/TvDetailRoute'));
const SearchPage = lazy(() => import('./pages/Search'));
const MovieWatchPage = lazy(() => import('./pages/MovieWatchPage'));
const TvWatchPage = lazy(() => import('./pages/TvWatchPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const Anime = lazy(() => import('./pages/Anime'));

type ModalState = {
  backgroundLocation?: Location;
};

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const state = location.state as ModalState | undefined;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <AuthGuard>
      <Suspense fallback={<LoadingScreen />}>
        {/* Main routes render against the background location when a modal is open */}
        <Routes location={backgroundLocation || location}>
        <Route path="/" element={<Home />} />
        <Route path="/movie" element={<MoviePage />} />
        <Route path="/tv" element={<TvPage />} />
        <Route path="/movie/watch/:id" element={<MovieWatchPage />} />
        <Route path="/tv/watch/:id/:season/:episode" element={<TvWatchPage />} />
        {/* Detail routes should also work as full pages when loaded directly */}
        <Route path="/movie/:id" element={<MovieDetailRoute />} />
        <Route path="/tv/:id" element={<TvDetailRoute />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/anime" element={<Anime />} />
        {/* Fallback */}
        <Route path="*" element={<ErrorPage />} />
      </Routes>

      {/* Modal routes layered on top when we have a background */}
      {backgroundLocation && (
        <Routes>
          <Route path="/movie/:id" element={<MovieDetailRoute />} />
          <Route path="/tv/:id" element={<TvDetailRoute />} />
        </Routes>
      )}
    </Suspense>
    </AuthGuard>
  );
};

export const AppRoot: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsBooting(false), 1200);
    
    // Check extension status when app initializes
    checkExtensionStatus();
    
    return () => clearTimeout(timeout);
  }, []);

  if (isBooting) {
    return <LoadingScreen />;
  }

  // Use HashRouter for file:// or Electron build — BrowserRouter resolves /login to file:///C:/login on Windows
  const isElectronBuild = import.meta.env.MODE === 'electron';
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const hasElectronAPI = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectronApp;
  const Router = isElectronBuild || isFileProtocol || hasElectronAPI ? HashRouter : BrowserRouter;

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <DiscordRPCProvider>
            <AppRoutes />
          </DiscordRPCProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);