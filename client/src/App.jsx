import { Routes, Route, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import SplashScreen from './components/Layout/SplashScreen/SplashScreen';
import NavBar from './components/Layout/NavBar/NavBar';
import SideBar from './components/Layout/SideBar/SideBar';
import Footer from './components/Layout/Footer/Footer';
import Login from './components/Auth/Login/Login';
import Register from './components/Auth/Register/Register';
import ForgotPassword from './components/Auth/ForgotPassword/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword/ResetPassword';
import CompanyRegistration from './components/Company/CompanyRegistration/CompanyRegistration';
import Home from './components/Pages/Home';
import VerifyWorkspace from './components/Auth/VerifyWorkspace/VerifyWorkspace';
import EmployeeDashboard from './components/Dashboards/EmployeeDashboard/EmployeeDashboard';
import ManagerDashboard from './components/Dashboards/ManagerDashboard/ManagerDashboard';
import ArticleEditor from './components/Article/ArticleEditor/ArticleEditor';
import ArticleView from './components/Article/ArticleView/ArticleView';
import ArticleReview from './components/Article/ArticleReview/ArticleReview';
import SearchResults from './components/Search/SearchResults/SearchResults';
import ProfileSettings from './components/Auth/ProfileSettings/ProfileSettings';
import CreateElevatedUser from './components/Auth/CreateElevatedUser/CreateElevatedUser';
import AdminRoute from './components/Utility/AdminRoute/AdminRoute';
import ProtectedRoute from './components/Utility/ProtectedRoute/ProtectedRoute';
import Chatbot from './components/Chatbot/Chatbot';
import UserManagement from './components/UserManagement/UserManagement';
import SessionLogs from './components/Admin/SessionLogs';
import WorkspaceManagement from './components/Admin/WorkspaceManagement/WorkspaceManagement';
import FreshnessDashboard from './components/Admin/FreshnessDashboard/FreshnessDashboard';
import ContentGapDashboard from './components/Admin/ContentGapDashboard/ContentGapDashboard';
import './App.css';

const Layout = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-container">
      <NavBar onMobileMenuOpen={() => setMobileOpen(true)} />
      <div className="app-body">
        {user && (
          <SideBar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            isMobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
        )}
        <main
          className={[
            'main-content',
            user
              ? sidebarCollapsed
                ? 'main-content--collapsed'
                : 'main-content--expanded'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Outlet />
        </main>
      </div>
      <Footer />
      {user && <Chatbot />}
    </div>
  );
};

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = () => {
    sessionStorage.setItem('mkb_splash_shown', 'true');
    setShowSplash(false);
  };

  useEffect(() => {
    if (!showSplash) return;

    // Fallback timer in case SplashScreen doesn't trigger onFinish itself
    const timer = setTimeout(() => {
      handleSplashFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [showSplash]);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="resetpassword/:token" element={<ResetPassword />} />
        <Route path="register-company" element={<CompanyRegistration />} />
        <Route path="verify-workspace/:token" element={<VerifyWorkspace />} />

        {/* Global Authenticated Routes (Accessible by Employees, Managers, Admins) */}
        <Route element={<ProtectedRoute />}>
          <Route path="employee-dashboard" element={<EmployeeDashboard />} />
          <Route path="articles/new" element={<ArticleEditor />} />
          <Route path="articles/:id/edit" element={<ArticleEditor />} />
          <Route path="articles/:id" element={<ArticleView />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="profile-settings" element={<ProfileSettings />} />
        </Route>

        {/* Restricted Admin/Manager Routes */}
        <Route element={<AdminRoute />}>
          <Route path="manager-dashboard" element={<ManagerDashboard />} />
          <Route path="queue/:id" element={<ArticleReview />} />
          <Route path="create-user" element={<CreateElevatedUser />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="session-logs" element={<SessionLogs />} />
          <Route path="workspaces" element={<WorkspaceManagement />} />
          <Route path="freshness" element={<FreshnessDashboard />} />
          <Route path="content-gaps" element={<ContentGapDashboard />} />
        </Route>

        {/* 404 Fallback */}
        <Route
          path="*"
          element={
            <div className="page-content">
              <h2>404: Page Not Found</h2>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
