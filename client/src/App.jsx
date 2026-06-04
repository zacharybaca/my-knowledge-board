import { Routes, Route, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import NavBar from './components/Layout/NavBar/NavBar';
import Footer from './components/Layout/Footer/Footer';
import Login from './components/Auth/Login/Login';
import Register from './components/Auth/Register/Register';
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
import SessionLogs from './components/Admin/SessionLogs'; // <-- NEW IMPORT
import WorkspaceManagement from './components/Admin/WorkspaceManagement/WorkspaceManagement'; // Adjust path based on where you saved it
import './App.css';

const Layout = () => {
  const { user } = useAuth();
  return (
    <div className="app-container">
      <NavBar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
      {user && <Chatbot />}
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
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
          <Route path="session-logs" element={<SessionLogs />} />{' '}
          <Route path="workspaces" element={<WorkspaceManagement />} />{' '}
          {/* <-- NEW ROUTE */}
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
