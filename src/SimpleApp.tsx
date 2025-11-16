// Simple ERP Demo App - No Authentication Required
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ERPDashboard from '@erp';
import { Home } from '@erp';

function SimpleApp() {
  return (
    <Router>
      <Routes>
        {/* Default route - goes to ERP home to configure Supabase */}
        <Route path="/" element={<Home />} />
        
        {/* ERP Dashboard route */}
        <Route path="/workspace" element={<ERPDashboard />} />
        
        {/* Redirect everything else to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default SimpleApp;
