import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Loader from '../components/Loader';
import {
    FileText, DollarSign, Package, Truck, Info, X as XIcon,
    Building, Star, Briefcase, Tag, Calendar, Users, Globe, MapPin,
    CheckCircle, Clock, ShieldQuestion, Phone, Gavel, UserCheck, XCircle
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';


// --- NEW: Info/Error/Success Modal Component ---
const InfoModal = ({
  title,
  message,
  onClose,
  type = 'info',
  onConfirm,
  confirmText
}: {
  title: string;
  message: string | null;
  onClose: () => void;
  type?: 'info' | 'error' | 'success';
  onConfirm?: () => void;
  confirmText?: string;
}) => {
  if (!message) return null;

  const config = {
    info: { Icon: Info, color: 'text-blue-500', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
    success: { Icon: CheckCircle, color: 'text-green-500', buttonClass: 'bg-green-600 hover:bg-green-700' },
    error: { Icon: XCircle, color: 'text-red-500', buttonClass: 'bg-red-600 hover:bg-red-700' },
  };

  const { Icon, color, buttonClass } = config[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center transform transition-all animate-fade-in-up">
        <Icon className={`mx-auto w-16 h-16 ${color} mb-4`} />
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={onClose}
            className={`w-full sm:w-auto px-8 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${buttonClass} ${onConfirm ? 'order-2 sm:order-1' : ''}`}
          >
            {onConfirm ? 'Cancel' : 'OK'}
          </button>
          {onConfirm && (
            <button
                onClick={onConfirm}
                className="w-full sm:w-auto px-8 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors bg-blue-600 hover:bg-blue-700 order-1 sm:order-2"
            >
                {confirmText}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};


// --- TYPE DEFINITIONS (Interfaces) ---
interface SupplierMaterial { name: string | null; inci_name: string | null; cas_number: string | null; regions_served: string | null; unit_of_measurement: string | null; price_range: string | null; min_order_quantity: string | null; inventory_info: string | null; technical_specs: string | null; }
interface SupplierService { name: string | null; service_type: string | null; delivery_mode: string | null; pricing_model: string | null; }
interface SupplierDocument { doc_type: string; status: 'pending_review' | 'approved' | 'rejected'; file_path: string; rejection_reason: string | null; }
interface FetchedSupplier { id: number; user_id: string; company_legal_name: string | null; location: string | null; company_url: string | null; organization_type: string | null; description: string | null; profile_completeness_score: number | null; year_of_establishment: number | null; company_size: string | null; operating_regions: string[] | null; category: string | null; supplier_type: string | null; phone_number: string | null; contact_email: string | null; company_logo_url: string | null; country: string | null; address_line_1: string | null; address_line_2: string | null; city: string | null; region: string | null; postal_code: string | null; gst_vat_number: string | null; business_registration_number: string | null; suppliers_materials: SupplierMaterial[]; suppliers_services: SupplierService[]; suppliers_documents: SupplierDocument[]; }
interface SupplierProfile extends FetchedSupplier { rating: number; materials: SupplierMaterial[]; services: SupplierService[]; documents: SupplierDocument[]; }
interface ProjectMaterial { name: string; price: string; quantity: string; attachments: string[]; shippingMethod: string; specifications: string; shippingAddress: string; attachmentUrls?: { name: string; url: string }[]; }
interface ProjectDetailsData { id: number; creator_user_id: string; title: string; requirements: { budget?: { max?: number | string }; materials?: ProjectMaterial[]; } | null; payment_method: string | null; contact_method: string | null; language: string | null; }
interface Bid { id: number; submitted_at: string; bid_submission: { amount: number; notes?: string; materialName: string; } | null; suppliers: { user_id: string; company_legal_name: string; company_logo_url?: string; logoPublicUrl?: string; } | null; }
interface BiddingDetailsProps { session: Session | null; }


// --- MAIN COMPONENT ---
const BiddingDetails: React.FC<BiddingDetailsProps> = ({ session }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetailsData | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectCreatorProfile, setProjectCreatorProfile] = useState<SupplierProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSupplierId, setCurrentSupplierId] = useState<number | null>(null);
  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; type: 'info' | 'error' | 'success'; onConfirm?: () => void; confirmText?: string; } | null>(null);
  const userId = session?.user?.id;

  const loadProjectData = useCallback(async () => {
    if (!projectId) { setError("Project ID is missing."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const projectPromise = supabase.from('sourcing_projects').select('*, creator_user_id').eq('id', projectId).single();
      const bidsPromise = supabase.from('project_bids').select(`id, submitted_at, bid_submission, suppliers (user_id, company_legal_name, company_logo_url)`).eq('project_id', projectId).order('submitted_at', { ascending: false });
      let supplierPromise = null; if (userId) { supplierPromise = supabase.from('suppliers').select('id').eq('user_id', userId).single(); }
      const [projectResult, bidsResult, supplierResult] = await Promise.all([projectPromise, bidsPromise, supplierPromise]);
      if (projectResult.error) throw projectResult.error; if (bidsResult.error) throw bidsResult.error; if (supplierResult && supplierResult.error && supplierResult.error.code !== 'PGRST116') { throw supplierResult.error; }
      let projectData = projectResult.data;
      if (supplierResult && supplierResult.data) { setCurrentSupplierId(supplierResult.data.id); }
      if (projectData && projectData.creator_user_id) {
        const { data: supplierData, error: supplierError } = await supabase.from('suppliers').select(`*, suppliers_materials(*), suppliers_services(*), suppliers_documents(*)`).eq('user_id', projectData.creator_user_id).single();
        if (!supplierError && supplierData) {
          const mappedProfile: SupplierProfile = { ...(supplierData as FetchedSupplier), rating: Math.ceil((supplierData.profile_completeness_score || 0) / 20), materials: supplierData.suppliers_materials || [], services: supplierData.suppliers_services || [], documents: supplierData.suppliers_documents || [], };
          setProjectCreatorProfile(mappedProfile);
        }
      }
      if (projectData && projectData.requirements?.materials) {
          const processedMaterials = await Promise.all( projectData.requirements.materials.map(async (material: ProjectMaterial) => { const attachmentUrls = await Promise.all( (material.attachments || []).map(async (path: string) => { const { data } = await supabase.storage.from('project-attachments').createSignedUrl(path, 3600); const fileName = path.split('/').pop() || path; return { name: fileName, url: data?.signedUrl || '#' }; }) ); return { ...material, attachmentUrls }; }) );
          projectData = { ...projectData, requirements: { ...projectData.requirements, materials: processedMaterials } };
      }
      setProject(projectData as ProjectDetailsData);
      setBids( Array.isArray(bidsResult.data) ? bidsResult.data.map((bid: any) => ({ ...bid, suppliers: Array.isArray(bid.suppliers) ? bid.suppliers[0] : bid.suppliers, })) : [] );
    } catch (err: any) { setError('Failed to fetch project details. ' + err.message); } finally { setLoading(false); }
  }, [projectId, userId]);

  useEffect(() => { loadProjectData(); }, [loadProjectData]);

  const handleOpenBidModal = (material: ProjectMaterial) => {
    if (!currentSupplierId) {
        setModalInfo({
            title: "Registration Required",
            message: "You must be a registered supplier to place a bid. Would you like to register now?",
            type: "info",
            onConfirm: () => navigate('/supplier-registration'),
            confirmText: "Register Now"
        });
        return;
    }
    setSelectedMaterial(material);
    setBidAmount('');
    setBidNotes('');
    setIsBidModalOpen(true);
  };

  const handleBidSubmit = async () => {
    if (!bidAmount || !selectedMaterial || !projectId || !currentSupplierId) {
        setModalInfo({ title: "Missing Information", message: "Please enter a bid amount before submitting.", type: "error" });
        return;
    }
    setIsSubmitting(true);
    try {
        const { error } = await supabase.from('project_bids').insert({
            project_id: parseInt(projectId),
            supplier_id: currentSupplierId,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            bid_submission: { amount: parseFloat(bidAmount), notes: bidNotes, materialName: selectedMaterial.name, },
        });

        if (error) throw error;
        
        setIsBidModalOpen(false);
        await loadProjectData();
        setModalInfo({ title: "Success!", message: "Your bid has been submitted successfully.", type: "success" });

    } catch (error: any) {
        setModalInfo({ title: "Submission Error", message: `An error occurred while submitting your bid: ${error.message}`, type: "error" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;
  if (!project) return <div className="flex justify-center items-center h-screen text-gray-600">Project not found.</div>;

  const materials = project.requirements?.materials || [];
  const budget = project.requirements?.budget?.max || 0;
  const userHasBidOnMaterial = (materialName: string) => {
      return bids.some(bid => bid.suppliers?.user_id === userId && bid.bid_submission?.materialName === materialName);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
        <InfoModal
            title={modalInfo?.title || ''}
            message={modalInfo?.message || null}
            onClose={() => setModalInfo(null)}
            type={modalInfo?.type}
            onConfirm={modalInfo?.onConfirm}
            confirmText={modalInfo?.confirmText}
        />
        
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900">Product details</h1>
                <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800 capitalize">{project.title}</h2>
                            {projectCreatorProfile && (<button onClick={() => setIsProfileModalOpen(true)} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline mt-1">by {projectCreatorProfile.company_legal_name}</button>)}
                            <p className="text-sm text-gray-500 mt-2">Number of materials: {String(materials.length).padStart(2, '0')}</p>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto"><p className="text-sm text-gray-500">Total Budget</p><p className="font-bold text-2xl text-green-600">${Number(budget).toLocaleString()}</p></div>
                    </div>
                </div>
                <div className="mt-5 space-y-5">
                    {materials.map((material, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-5"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h3 className="text-xl font-bold text-gray-800 capitalize">{material.name}</h3>{userHasBidOnMaterial(material.name) ? (<div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-700 bg-green-100 rounded-lg"><UserCheck size={16} />Bid Submitted</div>) : (<button onClick={() => handleOpenBidModal(material)} className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400" disabled={!userId || project.creator_user_id === userId}>Place a Bid</button>)}</div></div>
                            <div className="border-t border-gray-200 bg-gray-50/50 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 text-sm">
                                <div className="flex items-start gap-3"><DollarSign className="w-5 h-5 text-gray-400 mt-0.5" /><div><p className="text-gray-500">Suggested Price</p><p className="font-semibold text-gray-800">${material.price} per unit</p></div></div>
                                <div className="flex items-start gap-3"><Package className="w-5 h-5 text-gray-400 mt-0.5" /><div><p className="text-gray-500">Quantity</p><p className="font-semibold text-gray-800">{material.quantity} units</p></div></div>
                                <div className="flex items-start gap-3"><Truck className="w-5 h-5 text-gray-400 mt-0.5" /><div><p className="text-gray-500">Shipping</p><p className="font-semibold text-gray-800 capitalize">{material.shippingMethod} ({material.shippingAddress})</p></div></div>
                                <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-3"><Info className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="text-gray-500">Specifications</p><p className="font-semibold text-gray-800">{material.specifications}</p></div></div>
                                {material.attachmentUrls && material.attachmentUrls.length > 0 && (<div className="flex items-start gap-3"><FileText className="w-5 h-5 text-gray-400 mt-0.5" /><div><p className="text-gray-500">Attachments</p>{material.attachmentUrls.map((file, fileIndex) => (<a key={fileIndex} href={file.url} target="_blank" rel="noopener noreferrer" download={file.name} className="font-semibold text-blue-600 hover:underline block">{file.name}</a>))}</div></div>)}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-8"><h2 className="text-2xl font-bold text-gray-900 mb-4">Live Bids</h2><div className="bg-white border border-gray-200 rounded-xl shadow-sm">{bids.length > 0 ? ( <ul className="divide-y divide-gray-200">{bids.map((bid) => ( <li key={bid.id} className="p-4 flex justify-between items-center"><div><p className="font-semibold text-gray-800">{bid.suppliers?.company_legal_name || 'Anonymous Supplier'}</p><p className="text-sm text-gray-500">Material: {bid.bid_submission?.materialName}</p></div><div className="text-right"><p className="font-bold text-lg text-gray-900">${bid.bid_submission?.amount.toLocaleString()}</p><p className="text-xs text-gray-400">{new Date(bid.submitted_at).toLocaleDateString()}</p></div></li> ))}</ul> ) : ( <div className="p-6 text-center text-gray-500"><Gavel className="w-8 h-8 mx-auto text-gray-400 mb-2" />No bids have been placed yet.</div> )}</div></div>
            </div>
            {isProfileModalOpen && projectCreatorProfile && (<SupplierModal profile={projectCreatorProfile} onClose={() => setIsProfileModalOpen(false)} />)}
            {isBidModalOpen && selectedMaterial && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">Place Bid for <span className="capitalize">{selectedMaterial.name}</span></h3><button onClick={() => setIsBidModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XIcon size={24} /></button></div>
                        <div className="space-y-4">
                            <div><label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700">Your Bid Amount ($)</label><div className="mt-1 relative rounded-md shadow-sm"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span className="text-gray-500 sm:text-sm">$</span></div><input type="number" id="bidAmount" className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="0.00" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} required /></div></div>
                            <div><label htmlFor="bidNotes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label><textarea id="bidNotes" rows={4} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm mt-1" placeholder="Add any comments about your bid..." value={bidNotes} onChange={(e) => setBidNotes(e.target.value)} /></div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsBidModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button><button type="button" onClick={handleBidSubmit} disabled={isSubmitting || !bidAmount} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:bg-blue-300">{isSubmitting ? 'Submitting...' : 'Submit Bid'}</button></div>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};


// --- SUPPLIER MODAL & HELPERS ---
const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | null | undefined}) => { if (!value) return null; return ( <div className={`flex items-start gap-3`}><div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div><div><p className="font-medium text-gray-500">{label}</p><p className="text-gray-800 font-semibold">{value}</p></div></div> ) };
const SupplierModal = ({ profile, onClose }: { profile: SupplierProfile, onClose: () => void }) => { const [imageUrl, setImageUrl] = useState<string | null>(null); useEffect(() => { const getImageUrl = async () => { if (profile.company_logo_url) { const { data } = await supabase.storage.from('company-logos').createSignedUrl(profile.company_logo_url, 3600); setImageUrl(data?.signedUrl || null); } }; getImageUrl(); }, [profile.company_logo_url]); const fullAddress = [profile.address_line_1, profile.address_line_2, profile.city, profile.region, profile.postal_code, profile.country].filter(Boolean).join(', '); const renderDocStatus = (doc: SupplierDocument) => { switch(doc.status) { case 'approved': return <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /> Verified</div>; case 'pending_review': return <div className="flex items-center gap-2 text-yellow-600"><Clock size={16} /> Pending Review</div>; case 'rejected': return <div className="flex items-center gap-2 text-red-600"><XIcon size={16} /> Rejected</div>; default: return <div className="flex items-center gap-2 text-gray-500"><ShieldQuestion size={16} /> Unknown</div>; } }; return ( <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"><div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"><XIcon size={24} /></button><div className="flex flex-col sm:flex-row items-center mb-6 border-b pb-6"><div className="w-20 h-20 rounded-lg flex items-center justify-center bg-gray-100 shrink-0 mr-0 sm:mr-5 mb-4 sm:mb-0 border">{imageUrl ? <img src={imageUrl} alt={profile.company_legal_name || 'Supplier'} className="w-full h-full object-contain p-1 rounded-lg" /> : <Building className="w-10 h-10 text-gray-400" />}</div><div className="text-center sm:text-left"><h2 className="text-2xl font-bold text-gray-900">{profile.company_legal_name || 'N/A'}</h2><div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-gray-500 mt-1"><span>{profile.organization_type}</span><span className="text-gray-300">|</span><div className="flex items-center" title={`${profile.rating} out of 5`}>{[...Array(5)].map((_, i) => <Star key={i} size={16} className={i < profile.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} />)}</div></div></div></div><div className="space-y-8"><div><h3 className="font-bold text-lg text-gray-800 mb-4">Supplier Details</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm"><DetailItem icon={<Briefcase size={16}/>} label="Organization Type" value={profile.organization_type} /><DetailItem icon={<Tag size={16}/>} label="Category" value={profile.category} /><DetailItem icon={<Calendar size={16}/>} label="Year Established" value={profile.year_of_establishment} /><DetailItem icon={<Users size={16}/>} label="Company Size" value={profile.company_size} /><DetailItem icon={<Phone size={16}/>} label="Phone" value={profile.phone_number} /><DetailItem icon={<Globe size={16}/>} label="Website" value={profile.company_url} /><DetailItem icon={<MapPin size={16}/>} label="Address" value={fullAddress} /></div></div>{profile.documents.length > 0 && ( <div className="border-t pt-6"><h3 className="font-bold text-lg text-gray-800 mb-4">Documents & Verification</h3><div className="space-y-3">{profile.documents.map((doc, i) => ( <div key={i} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"><span className="font-medium text-gray-700 text-sm capitalize">{doc.doc_type.replace(/_/g, ' ')}</span><div className="text-sm font-semibold">{renderDocStatus(doc)}</div></div> ))}</div></div> )}<div className="border-t pt-6"><h3 className="font-bold text-lg text-gray-800 mb-3">About</h3><p className="text-sm text-gray-600 leading-relaxed">{profile.description || 'No description provided.'}</p></div></div></div></div> ); };

export default BiddingDetails;