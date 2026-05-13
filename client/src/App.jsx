import { Routes, Route, Outlet } from "react-router-dom";
import NavBar from './components/Layout/NavBar/NavBar';
import Footer from './components/Layout/Footer/Footer';
import Login from './components/Auth/Login/Login';
import Register from './components/Auth/Register/Register';
import CompanyRegistration from './components/Company/CompanyRegistration/CompanyRegistration';
import Home from './components/Pages/Home';
import VerifyWorkspace from './components/Auth/VerifyWorkspace/VerifyWorkspace';
import "./App.css";

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
        <Route path="*" element={<div className="page-content"><h2>404: Page Not Found</h2></div>} />
      </Route>
    </Routes>
  );
}

export default App;
