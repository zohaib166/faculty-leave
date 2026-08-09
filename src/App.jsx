import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import FacultyDashboard from './pages/FacultyDashboard';
import SubRequests from './pages/SubRequests';
import HodDashboard from './pages/HodDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProfileSettings from './components/ProfileSettings';

export default function App() {
  const { user, profile, isHod, isAdmin } = useAuth();

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Navbar />
      <div className="min-h-screen bg-slate-100">
        <Routes>
          {/* Admin Protected Route */}
          <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />} />

          {/* HoD Protected Route */}
          <Route path="/hod-portal" element={isHod ? <HodDashboard /> : <Navigate to="/" replace />} />

          {/* Standard Faculty Routes (Admins are redirected to /admin) */}
          <Route path="/" element={isAdmin ? <Navigate to="/admin" replace /> : <FacultyDashboard />} />
          <Route path="/substitute-requests" element={isAdmin ? <Navigate to="/admin" replace /> : <SubRequests />} />

          {/* Profile Settings — accessible to all roles */}
          <Route path="/profile" element={<ProfileSettings />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to={isAdmin ? "/admin" : "/"} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}