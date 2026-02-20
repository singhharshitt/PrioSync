import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import DependencyPage from './pages/DependencyPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

/**
 * ProtectedRoute — redirects unauthenticated users to /login
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#604C39] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * PublicRoute — redirects authenticated users away from auth pages
 */
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

    {/* Protected */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
    <Route path="/dependencies" element={<ProtectedRoute><DependencyPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

    {/* 404 */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer
          position="bottom-right"
          autoClose={3500}
          hideProgressBar={false}
          closeOnClick
          pauseOnFocusLoss={false}
          draggable
          theme="dark"
          toastStyle={{
            background: '#273751',
            border: '1px solid rgba(98,120,144,0.25)',
            borderRadius: '0.75rem',
            color: '#f1f5f9',
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
