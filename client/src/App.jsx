import { Routes, Route, Outlet } from 'react-router-dom';
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
// Import these when you create them
// import ArticleViewer from './components/Article/ArticleViewer/ArticleViewer';
// import ArticleReview from './components/Article/ArticleReview/ArticleReview';
// import SearchResults from './components/Pages/SearchResults/SearchResults';
import AdminRoute from './components/Utility/AdminRoute/AdminRoute';
import ProtectedRoute from './components/Utility/ProtectedRoute/ProtectedRoute';
import './App.css';

const Layout = () => {
  return (
    <div className="app-container">
      <NavBar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="register-company" element={<CompanyRegistration />} />
        <Route path="verify-workspace/:token" element={<VerifyWorkspace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="employee-dashboard" element={<EmployeeDashboard />} />

          {/* Article Routing */}
          <Route path="articles/new" element={<ArticleEditor />} />
          <Route path="articles/:id/edit" element={<ArticleEditor />} />

          {/* Future Routes needed for full dashboard functionality */}
          {/* <Route path="articles/:id" element={<ArticleViewer />} /> */}
          {/* <Route path="search" element={<SearchResults />} /> */}
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="manager-dashboard" element={<ManagerDashboard />} />

          {/* Future Route for Manager Approval Queue */}
          {/* <Route path="queue/:id" element={<ArticleReview />} /> */}
        </Route>

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
