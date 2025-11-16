import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, DollarSign, FileText, Users, Eye, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';

// --- TYPE DEFINITIONS ---
interface SourcingProject {
  id: number;
  title: string;
  status: 'draft' | 'sourcing' | 'bidding_open' | 'bidding_closed' | 'awarded' | 'completed';
  submission_deadline: string | null;
  requirements: {
    budget?: { max?: number };
    attachments?: any[];
  } | null;
  project_bids: { id: number }[];
}


// --- MODAL COMPONENTS ---
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const SuccessModal = ({ message }: { message: string }) => (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center backdrop-blur-sm">
      <div className="bg-white text-gray-800 rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center">
        <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-700">
          {message}
        </h2>
      </div>
    </div>
);


// --- MAIN COMPONENT ---
const MyProjects = () => {
  const [projects, setProjects] = useState<SourcingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');


  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found. Please log in.");

        const { data, error: queryError } = await supabase
          .from('sourcing_projects')
          .select(`
            id,
            title,
            status,
            submission_deadline,
            requirements,
            project_bids ( id )
          `)
          .eq('creator_user_id', user.id)
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;
        setProjects(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const openConfirmModal = (projectId: number) => {
    setProjectToDelete(projectId);
    setIsConfirmModalOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsConfirmModalOpen(false);
    setLoading(true);
    try {
        const { error: deleteError } = await supabase
            .from('sourcing_projects')
            .delete()
            .eq('id', projectToDelete);
        if (deleteError) throw deleteError;

        setProjects(currentProjects => currentProjects.filter(p => p.id !== projectToDelete));
        setSuccessMessage('Project deleted successfully.');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (err: any) {
        alert(`Error deleting project: ${err.message}`);
    } finally {
        setLoading(false);
        setProjectToDelete(null);
    }
  };

  const getStatusInfo = (status: SourcingProject['status']) => {
    switch (status) {
      case 'bidding_open': return { text: 'Bidding Open', style: 'bg-green-100 text-green-800' };
      case 'sourcing': return { text: 'Sourcing', style: 'bg-blue-100 text-blue-700' };
      case 'bidding_closed': return { text: 'Bidding Closed', style: 'bg-yellow-100 text-yellow-800' };
      case 'awarded':
      case 'completed': return { text: 'Completed', style: 'bg-purple-100 text-purple-800' };
      default: return { text: status, style: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatDeadline = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="relative min-h-screen">
      {loading && (
        <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <p className="text-lg font-medium text-gray-700 mb-4">Loading Your Projects...</p>
            <Loader />
        </div>
      )}
      {showSuccessModal && <SuccessModal message={successMessage} />}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleDeleteProject}
        title="Confirm Deletion"
        message="Are you sure you want to delete this project? This action is permanent and cannot be undone."
      />

      <div className={`max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}>
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Manage My Projects</h1>
        </div>

        {projects.length > 0 ? (
            <div className="grid gap-6">
            {projects.map((project) => {
                const statusInfo = getStatusInfo(project.status);
                const budget = project.requirements?.budget?.max
                    ? `$${Number(project.requirements.budget.max).toLocaleString()}`
                    : 'Not set';

                return (
                <div key={project.id} className="bg-white rounded-xl shadow-sm p-6 border">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{project.title}</h2>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium capitalize flex-shrink-0 ${statusInfo.style}`}>{statusInfo.text}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <InfoItem icon={<DollarSign size={20} />} label="Budget" value={budget} />
                      <InfoItem icon={<Clock size={20} />} label="Deadline" value={formatDeadline(project.submission_deadline)} />
                      <InfoItem icon={<Users size={20} />} label="Invited/Bids" value={project.project_bids.length} />
                      <InfoItem icon={<FileText size={20} />} label="Documents" value={project.requirements?.attachments?.length || 0} />
                    </div>

                    {/* --- RESPONSIVENESS FIX: This div now stacks on mobile --- */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Link to={`/my-projects/${project.id}/bids`} className="w-full sm:flex-1 text-center px-6 py-2 bg-[#0C2540] text-white rounded-lg text-sm font-medium hover:bg-[#0A2136] transition-colors">
                        Manage Bids
                      </Link>
                      <div className="w-full sm:w-auto flex items-center gap-3">
                        <Link to={`/sourcing/${project.id}`} className="w-full sm:w-auto justify-center flex-1 sm:flex-initial text-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                          <Eye size={16} /> <span>View Hub</span>
                        </Link>
                        <button
                          onClick={() => openConfirmModal(project.id)}
                          className="p-2.5 border border-gray-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors"
                          aria-label="Delete Project"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                </div>
                );
            })}
            </div>
        ) : (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-gray-800">No Sourcing Projects Found</h3>
              <p className="text-gray-500 mt-2">Get started by creating a new RFQ or RFP.</p>
            </div>
        )}
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
    <div className="flex items-center gap-2">
        <div className="text-gray-400">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium text-gray-800">{value}</p>
        </div>
    </div>
);

export default MyProjects;