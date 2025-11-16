import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Briefcase, ChevronRight, Clock, DollarSign, FileText, UserCheck, Eye, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { Session } from '@supabase/supabase-js';

// --- TYPE DEFINITIONS ---
interface SupplierInfo {
  company_legal_name: string;
  company_logo_url?: string;
  location?: string;
  logoPublicUrl?: string; 
}

interface ProfileInfo {
  full_name: string;
  suppliers: SupplierInfo | null;
}

interface SourcingProject {
  id: number;
  title: string;
  type: 'RFQ' | 'RFP';
  submission_deadline: string | null;
  requirements: {
    budget?: { max?: number | string };
  } | null;
  profiles: ProfileInfo | null;
}

interface BiddingPageProps {
  session: Session | null;
}

// --- Registration Prompt Modal Component ---
const RegistrationModal = ({ onClose, onRegister }: { onClose: () => void, onRegister: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center transform transition-all animate-fade-in-up">
      <Info className="mx-auto w-16 h-16 text-blue-500 mb-4" />
      <h3 className="text-xl font-bold text-gray-800">Become a Supplier</h3>
      <p className="text-sm text-gray-600 mt-2">You must be a registered supplier to place a bid on projects. Registration is quick and easy.</p>
      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
        <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 order-2 sm:order-1">
          Maybe Later
        </button>
        <button onClick={onRegister} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 order-1 sm:order-2">
          Register Now
        </button>
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  </div>
);


// --- MAIN COMPONENT ---
const Bidding: React.FC<BiddingPageProps> = ({ session }) => {
  const [projects, setProjects] = useState<SourcingProject[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRoleAndProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        let userId = null;
        let userRole = 'simple';

        if (session?.user) {
            userId = session.user.id;
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .single();
            if (profileError) throw new Error("Could not fetch user profile.");
            userRole = profileData?.role || 'simple';
            setRole(userRole);
        }
        
        let projectIdsAlreadyBidOn: number[] = [];
        
        if (userId && userRole === 'supplier') {
            const { data: supplierData } = await supabase
              .from('suppliers')
              .select('id')
              .eq('user_id', userId)
              .single();

            if (supplierData) {
                const supplierId = supplierData.id;
                const { data: bidData } = await supabase
                    .from('project_bids')
                    .select('project_id')
                    .eq('supplier_id', supplierId);
                
                if (bidData) {
                    projectIdsAlreadyBidOn = bidData.map(bid => bid.project_id);
                }
            }
        }
        
        let query = supabase
          .from('sourcing_projects')
          .select(`
            id, title, type, submission_deadline, requirements,
            profiles (
              full_name,
              suppliers (
                company_legal_name,
                company_logo_url,
                location
              )
            )
          `)
          .in('status', ['sourcing', 'bidding_open']);

        if (userId) {
          query = query.neq('creator_user_id', userId);
        }

        if (projectIdsAlreadyBidOn.length > 0) {
          query = query.not('id', 'in', `(${projectIdsAlreadyBidOn.join(',')})`);
        }

        const { data, error: queryError } = await query.order('created_at', { ascending: false });

        if (queryError) throw queryError;
        
        const fetchedProjects = data || [];

        const processedProjects: SourcingProject[] = await Promise.all(
          fetchedProjects.map(async (project: any) => {
            const supplier = project.profiles?.suppliers;
            let signedUrl = null;

            if (supplier && supplier.company_logo_url) {
              const { data: signedUrlData } = await supabase.storage
                .from('company-logos')
                .createSignedUrl(supplier.company_logo_url, 300);
              signedUrl = signedUrlData?.signedUrl;
            }
            
            return {
              ...project,
              profiles: project.profiles ? {
                ...project.profiles,
                suppliers: supplier ? {
                  ...supplier,
                  logoPublicUrl: signedUrl
                } : null
              } : null
            };
          })
        );
        
        setProjects(processedProjects);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRoleAndProjects();
  }, [session]);
  
  const handleViewBid = (projectId: number) => {
    if (role === 'supplier') {
      navigate(`/bidding/${projectId}`);
    } else {
      setShowRegisterModal(true);
    }
  };
  
  const formatDeadline = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  const formatProjectId = (id: number) => `ID-${String(id).padStart(6, '0')}`;

  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="relative min-h-screen bg-gray-50">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <p className="text-lg font-medium text-gray-800 mb-4">Finding Open Bids...</p>
            <Loader />
        </div>
      )}
      
      {showRegisterModal && <RegistrationModal 
          onClose={() => setShowRegisterModal(false)} 
          onRegister={() => navigate('/supplier-registration')} 
      />}

      <div className={`max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Public Bidding Marketplace</h1>
              <p className="text-gray-600 mt-1">Find and bid on RFQs and RFPs from businesses worldwide.</p>
            </div>
            {role === 'supplier' && (
              // --- RESPONSIVENESS FIX: This group now stacks on small screens ---
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Link to="/my-bids" className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Eye size={16} /> Track My Bids
                </Link>
                <Link to="/my-projects" className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Briefcase size={16} /> Manage My Projects
                </Link>
              </div>
            )}
        </div>
        
        {role === 'simple' && !loading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                    <UserCheck className="w-6 h-6 flex-shrink-0" />
                    <p className="font-medium">Want to place a bid? Become a supplier to unlock all features.</p>
                </div>
                <Link to="/supplier-registration" className="font-semibold text-blue-600 hover:underline flex-shrink-0 mt-2 sm:mt-0">Register Now</Link>
            </div>
        )}

        {projects.length > 0 ? (
          <div className="grid gap-6">
            {projects.map((project) => {
              const supplierInfo = project.profiles?.suppliers;
              const companyName = supplierInfo?.company_legal_name || 'A Business';
              const companyLocation = supplierInfo?.location || 'Location not specified';
              const companyLogo = supplierInfo?.logoPublicUrl;
              
              return (
                <div key={project.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {companyLogo ? (
                        <img src={companyLogo} alt={`${companyName} logo`} className="w-12 h-12 rounded-full object-cover bg-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg flex-shrink-0">
                          {companyName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{companyName}</p>
                        <p className="text-sm text-gray-500 truncate">{companyLocation}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewBid(project.id)}
                      className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0C2540] rounded-lg hover:bg-[#0A2136] transition-colors"
                    >
                      Place Bid <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <h2 className="text-xl font-bold text-gray-900 hover:text-blue-600 cursor-pointer" onClick={() => handleViewBid(project.id)}>
                      {project.title}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{formatProjectId(project.id)}</p>
                  </div>
                  <div className="border-t my-4"></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Budget</p>
                      <p className="font-medium text-gray-800 flex items-center gap-1.5"><DollarSign size={16} className="text-gray-400" /> {project.requirements?.budget?.max ? `$${Number(project.requirements.budget.max).toLocaleString()}` : 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Deadline</p>
                      <p className="font-medium text-gray-800 flex items-center gap-1.5"><Clock size={16} className="text-gray-400" /> {formatDeadline(project.submission_deadline)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Type</p>
                      <span className="font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full text-xs">
                        {project.type}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
            !loading && (
              <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                <FileText size={48} className="mx-auto text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-800 mt-4">No Open Bids Available</h3>
                <p className="text-gray-500 mt-2">Please check back later for new sourcing projects.</p>
              </div>
            )
        )}
      </div>
    </div>
  );
};

export default Bidding;