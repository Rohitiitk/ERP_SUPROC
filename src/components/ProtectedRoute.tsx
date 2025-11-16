import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Loader from './Loader'; // Assuming you have a Loader component
import { Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  session: Session | null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ session }) => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        setRole(data?.role || 'simple');
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('simple'); // Default to least privileged role on error
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [session]);

  // Routes that require 'supplier' role
  const supplierRoutes = ['/rfq', '/bidding', '/rfp'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  // If there's no active session, redirect to the login page.
  if (!session) {
    return <Navigate to="/login" />;
  }
  
  // Check for supplier-only routes
  if (supplierRoutes.includes(location.pathname) && role !== 'supplier') {
    // If a simple user tries to access a supplier route, redirect them.
    alert("You don't have permission to access this page. Become a supplier to get access.");
    return <Navigate to="/profile" />;
  }

  // If all checks pass, render the child route.
  return <Outlet />;
};

export default ProtectedRoute;
