import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const TasksPage = lazy(() => import('./pages/TasksPage.jsx'));
const DependencyPage = lazy(() => import('./pages/DependencyPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const RouteLoader = () => (
  <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-[#2B1B17]/20 border-t-[#2B1B17] animate-spin" />
      <p className="text-sm text-gray-500 font-medium">Loading...</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#2B1B17]/20 border-t-[#2B1B17] animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route - Redirects to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#2B1B17]/20 border-t-[#2B1B17] animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </AuthProvider>
  );
}

// Separated routes for auth context access
const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route
          path="/"
          element={(
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          )}
        />

        <Route
          path="/login"
          element={(
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          )}
        />

        <Route
          path="/register"
          element={(
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          )}
        />

        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/tasks"
          element={(
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          )}
        />

        <Route
          path="/dependencies"
          element={(
            <ProtectedRoute>
              <DependencyPage />
            </ProtectedRoute>
          )}
        />

        <Route path="/analytics" element={<Navigate to="/dependencies" replace />} />

        <Route
          path="/profile"
          element={(
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          )}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default App;
