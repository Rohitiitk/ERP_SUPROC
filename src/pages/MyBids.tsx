import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { Award, FileText, Clock, XCircle, HelpCircle } from 'lucide-react';

// --- TYPE DEFINITIONS ---
interface MyBid {
  id: number;
  status: 'submitted' | 'awarded' | 'rejected';
  created_at: string;
  sourcing_projects: {
    id: number;
    title: string;
    status: 'sourcing' | 'bidding_open' | 'bidding_closed' | 'awarded' | 'completed';
  } | null;
}

// --- MAIN COMPONENT ---
const MyBids = () => {
  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyBids = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be logged in to view your bids.");

        // Corrected logic to find user's bids
        // 1. Find the supplier ID for the current user
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        // If the user isn't a supplier, they won't have any bids.
        if (!supplierData) {
          setBids([]);
          setLoading(false);
          return;
        }

        const supplierId = supplierData.id;

        // 2. Use the supplier ID to fetch all bids
        const { data, error: queryError } = await supabase
          .from('project_bids')
          .select(`
            id,
            status,
            created_at,
            sourcing_projects (
              id,
              title,
              status
            )
          `)
          .eq('supplier_id', supplierId) // <-- Uses correct 'supplier_id' column
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;
        setBids(
          (data || []).map((bid: any) => ({
            ...bid,
            sourcing_projects: Array.isArray(bid.sourcing_projects)
              ? bid.sourcing_projects[0] || null
              : bid.sourcing_projects || null
          }))
        );
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMyBids();
  }, []);

  const getStatusInfo = (status: MyBid['status']) => {
    switch (status) {
      case 'awarded':
        return { text: 'Awarded', icon: <Award className="text-green-500" />, style: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { text: 'Not Awarded', icon: <XCircle className="text-red-500" />, style: 'bg-red-100 text-red-700' };
      case 'submitted':
        return { text: 'Under Review', icon: <Clock className="text-blue-500" />, style: 'bg-blue-100 text-blue-700' };
      default:
        return { text: 'Unknown', icon: <HelpCircle className="text-gray-500" />, style: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) return (
      <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <p className="text-lg font-medium text-gray-700 mb-4">Loading Your Bids...</p>
          <Loader />
      </div>
  );

  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Bids Dashboard</h1>
          <p className="text-gray-500">Track the status of your submitted bids.</p>
      </div>

      {bids.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border">
            <ul className="divide-y divide-gray-200">
              {bids.map((bid) => {
                const statusInfo = getStatusInfo(bid.status);
                const project = bid.sourcing_projects;
                return (
                  <li key={bid.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-grow">
                        <p className="text-sm text-gray-500">You placed a bid on:</p>
                        <Link to={`/bidding/${project?.id}`} className="font-semibold text-lg text-gray-800 hover:text-blue-600">
                          {project?.title || 'Project details not available'}
                        </Link>
                         <p className="text-xs text-gray-400 mt-1">
                          Submitted on {new Date(bid.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.style}`}>
                        {statusInfo.icon}
                        <span>{statusInfo.text}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
      ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
            <FileText size={48} className="mx-auto text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-800 mt-4">You Haven't Submitted Any Bids</h3>
            <p className="text-gray-500 mt-2">Explore the <Link to="/bidding" className="text-blue-600 font-medium hover:underline">Bidding Marketplace</Link> to find projects.</p>
          </div>
      )}
    </div>
  );
};

export default MyBids;