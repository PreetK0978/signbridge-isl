import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Common/Layout';
import { AppProviders } from './context/AppProviders';
import Landing from './pages/Landing';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveTranslator = lazy(() => import('./pages/LiveTranslator'));
const TrainingStudio = lazy(() => import('./pages/TrainingStudio'));
const SignLibrary = lazy(() => import('./pages/SignLibrary'));
const SentenceBuilder = lazy(() => import('./pages/SentenceBuilder'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-cyan-300">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading page" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/translate" element={<LiveTranslator />} />
          <Route path="/training" element={<TrainingStudio />} />
          <Route path="/library" element={<SignLibrary />} />
          <Route path="/sentence" element={<SentenceBuilder />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
