import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Loader from '../components/Loader';
import {
    Award, DollarSign, FileText, ChevronLeft, Briefcase, MessageSquare, Package, X as XIcon, Check,
    Building, MapPin, Globe, Star, Calendar, Users, Server, Mail, Phone,
    Tag, CheckCircle, Clock, ShieldQuestion, Hash, Thermometer, Truck, Archive, Book, Shield,
    Users2, MessageSquare as MessageSquareIcon, Award as AwardIcon, AlertTriangle
} from 'lucide-react';

// --- TYPE DEFINITIONS ---
interface Material {
  name: string | null;
  inci_name: string | null;
  cas_number: string | null;
  regions_served: string | null;
  unit_of_measurement: string | null;
  price_range: string | null;
  min_order_quantity: string | null;
  inventory_info: string | null;
  technical_specs: string | null;
}
interface Service {
  name: string | null;
  service_type: string | null;
  delivery_mode: string | null;
  pricing_model: string | null;
  team_details: string | null;
  existing_clients: string | null;
  case_studies_link: string | null;
  service_sla_info: string | null;
  team_capacity: string | null;
  testimonials: string | null;
}
interface Document {
  doc_type: string;
  status: 'pending_review' | 'approved' | 'rejected';
  file_path: string;
  rejection_reason: string | null;
}
interface FetchedSupplier {
  id: number;
  user_id: string;
  company_legal_name: string | null;
  location: string | null;
  company_url: string | null;
  organization_type: string | null;
  description: string | null;
  profile_completeness_score: number | null;
  year_of_establishment: number | null;
  company_size: string | null;
  operating_regions: string[] | null;
  category: string | null;
  supplier_type: string | null;
  phone_number: string | null;
  contact_email: string | null;
  company_logo_url: string | null;
  country: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  gst_vat_number: string | null;
  business_registration_number: string | null;
  suppliers_materials: Material[];
  suppliers_services: Service[];
  suppliers_documents: Document[];
}
interface SupplierProfile extends FetchedSupplier {
  rating: number;
  materials: Material[];
  services: Service[];
  documents: Document[];
}
interface Profile {
  full_name: string;
}
interface Supplier {
  id: number;
  company_legal_name: string;
  profiles: Profile | null;
}
interface BidSubmission {
  amount: number;
  notes: string;
  materialName?: string;
}
interface Bid {
  id: number;
  status: 'submitted' | 'awarded' | 'rejected';
  bid_submission: BidSubmission | null;
  suppliers: Supplier | null;
}
interface Project {
  id: number;
  title: string;
  status: string;
  project_bids: Bid[];
}


// --- MODAL COMPONENTS ---
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText,
  confirmButtonClass
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText: string;
  confirmButtonClass: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto w-12 h-12 text-yellow-500 mb-4" />
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
            className={`px-6 py-2.5 text-sm font-semibold text-white rounded-lg ${confirmButtonClass}`}
          >
            {confirmButtonText}
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
const ProjectBids = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<SupplierProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: 'award' | 'reject'; bidId: number; } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchProjectBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase.from('sourcing_projects').select(`id, title, status, project_bids (id, status, bid_submission, suppliers (id, company_legal_name, profiles (full_name)))`).eq('id', projectId).single();
      if (queryError) throw queryError;
      if (!data) throw new Error("Project not found.");
      setProject(data as unknown as Project);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchProjectBids(); }, [fetchProjectBids]);

  const handleModalClose = () => setModalState(null);

  const handleConfirmAction = async () => {
    if (!modalState) return;
    const { type, bidId } = modalState;
    handleModalClose();
    setLoading(true);
    try {
      if (type === 'award') {
        const { error: rpcError } = await supabase.rpc('award_bid', { selected_bid_id: bidId, project_id_to_update: parseInt(projectId!, 10) });
        if (rpcError) throw rpcError;
        setSuccessMessage('Bid awarded successfully!');
      } else if (type === 'reject') {
        const { error: rpcError } = await supabase.rpc('reject_bid', { selected_bid_id: bidId });
        if (rpcError) throw rpcError;
        setSuccessMessage('Bid rejected successfully!');
      }
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
      await fetchProjectBids();
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleViewProfile = async (supplierId: number | undefined) => {
    if (!supplierId) return;
    setIsProfileModalOpen(true);
    setIsModalLoading(true);
    setSelectedProfile(null);
    try {
        const { data: supplierData, error: supplierError } = await supabase.from('suppliers').select(`*, suppliers_materials(*), suppliers_services(*), suppliers_documents(*)`).eq('id', supplierId).single();
        if (supplierError) throw supplierError;
        if (supplierData) {
            const mappedProfile: SupplierProfile = { ...(supplierData as FetchedSupplier), rating: Math.ceil((supplierData.profile_completeness_score || 0) / 20), materials: supplierData.suppliers_materials || [], services: supplierData.suppliers_services || [], documents: supplierData.suppliers_documents || [], };
            setSelectedProfile(mappedProfile);
        }
    } catch (error: any) { alert("Error fetching supplier profile: " + error.message); setIsProfileModalOpen(false); } finally { setIsModalLoading(false); }
  };

  const getStatusInfo = (status: Bid['status']) => {
    switch (status) {
      case 'awarded': return { text: 'Awarded', style: 'bg-green-100 text-green-800' };
      case 'rejected': return { text: 'Rejected', style: 'bg-red-100 text-red-700' };
      case 'submitted': return { text: 'Submitted', style: 'bg-blue-100 text-blue-700' };
      default: return { text: status, style: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading && !project) return <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-20"><p className="text-lg font-medium text-gray-700 mb-4">Loading Bids...</p><Loader /></div>;
  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;

  return (
    <div className="relative min-h-screen">
      {loading && <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-sm flex items-center justify-center z-20"><Loader /></div>}
      {showSuccessModal && <SuccessModal message={successMessage} />}
      <ConfirmationModal isOpen={!!modalState} onClose={handleModalClose} onConfirm={handleConfirmAction} title={modalState?.type === 'award' ? 'Award Bid?' : 'Reject Bid?'} message={ modalState?.type === 'award' ? 'Are you sure you want to award this bid? This will also reject other submitted bids.' : 'Are you sure you want to reject this bid?' } confirmButtonText={modalState?.type === 'award' ? 'Confirm Award' : 'Confirm Reject'} confirmButtonClass={ modalState?.type === 'award' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700' } />

      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
            <Link to="/my-projects" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium mb-2"><ChevronLeft size={16} /> Back to My Projects</Link>
            <h1 className="text-3xl font-bold text-gray-900">Bids for: {project?.title}</h1>
            <p className="text-gray-500 mt-1">Review proposals from suppliers and award the project.</p>
        </div>
        {project && project.project_bids.length > 0 ? (
          <div className="grid gap-6">
            {project.project_bids.map((bid) => {
              const submission = bid.bid_submission;
              const supplierName = bid.suppliers?.company_legal_name || bid.suppliers?.profiles?.full_name || 'N/A';
              const statusInfo = getStatusInfo(bid.status);
              return (
                <div key={bid.id} className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-lg hover:border-blue-400 transition-all" >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="self-start cursor-pointer" onClick={() => handleViewProfile(bid.suppliers?.id)}>
                        <p className="text-sm text-gray-500">Supplier</p>
                        <p className="text-lg font-semibold text-gray-800 flex items-center gap-2 hover:text-blue-600">
                            <Briefcase size={18} className="text-gray-400" /> {supplierName}
                        </p>
                    </div>
                    <div className="flex items-center self-end sm:self-center gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.style}`}>{statusInfo.text}</span>
                        {bid.status === 'submitted' && (
                            <>
                                <button onClick={() => setModalState({ isOpen: true, type: 'reject', bidId: bid.id })} className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors">
                                    <XIcon size={14} /> Reject
                                </button>
                                <button onClick={() => setModalState({ isOpen: true, type: 'award', bidId: bid.id })} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                                    <Check size={14} /> Award
                                </button>
                            </>
                        )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t space-y-3 cursor-pointer" onClick={() => handleViewProfile(bid.suppliers?.id)}>
                      {submission?.materialName && ( <InfoItem icon={<Package size={18} />} label="Item / Material" value={submission.materialName} /> )}
                      <InfoItem icon={<DollarSign size={18} />} label="Proposed Cost" value={submission?.amount ? `$${submission.amount.toLocaleString()}`: 'N/A'} />
                  </div>
                  {submission?.notes && (
                    <div className="border-t mt-4 pt-4 cursor-pointer" onClick={() => handleViewProfile(bid.suppliers?.id)}>
                        <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2"><MessageSquare size={16} /> Supplier Notes</p>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-md text-sm">{submission.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm border"><FileText size={48} className="mx-auto text-gray-300" /><h3 className="text-xl font-semibold text-gray-800 mt-4">No Bids Received Yet</h3><p className="text-gray-500 mt-2">Check back later to see proposals from suppliers.</p></div>
        )}
      </div>
        {isProfileModalOpen && ( isModalLoading || !selectedProfile ? ( <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"><Loader /></div> ) : ( <SupplierModal profile={selectedProfile} onClose={() => setIsProfileModalOpen(false)} /> ) )}
    </div>
  );
};

// --- Helper components ---
const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => ( <div className="flex items-center gap-2.5"><div className="text-gray-400">{icon}</div><div><p className="text-sm text-gray-500">{label}</p><p className="font-medium text-gray-800">{value}</p></div></div> );
const SupplierModal = ({ profile, onClose }: { profile: SupplierProfile, onClose: () => void }) => { const [imageUrl, setImageUrl] = useState<string | null>(null); useEffect(() => { const getImageUrl = async () => { if (profile.company_logo_url) { try { const { data, error } = await supabase.storage.from('company-logos').createSignedUrl(profile.company_logo_url, 3600); if (error) throw error; if (data) setImageUrl(data.signedUrl); } catch (error) { console.error('Error fetching image URL for modal:', error); setImageUrl(null); } } }; getImageUrl(); }, [profile.company_logo_url]); const fullAddress = [profile.address_line_1, profile.address_line_2, profile.city, profile.region, profile.postal_code, profile.country].filter(Boolean).join(', '); const renderDocStatus = (doc: Document) => { switch(doc.status) { case 'approved': return <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /> Verified</div>; case 'pending_review': return <div className="flex items-center gap-2 text-yellow-600"><Clock size={16} /> Pending Review</div>; case 'rejected': return <div className="flex items-center gap-2 text-red-600"><XIcon size={16} /> Rejected</div>; default: return <div className="flex items-center gap-2 text-gray-500"><ShieldQuestion size={16} /> Unknown</div>; } }; return ( <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300"><div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-3xl relative transform transition-all duration-300 max-h-[90vh] overflow-y-auto"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"><XIcon size={24} /></button><div className="flex flex-col sm:flex-row items-center mb-6 border-b pb-6"><div className="w-20 h-20 rounded-lg flex items-center justify-center bg-gray-100 shrink-0 mr-0 sm:mr-5 mb-4 sm:mb-0 border">{imageUrl ? <img src={imageUrl} alt={profile.company_legal_name || 'Supplier'} className="w-full h-full object-contain p-1 rounded-lg" /> : <Building className="w-10 h-10 text-gray-400" />}</div><div className="text-center sm:text-left"><h2 className="text-2xl font-bold text-gray-900">{profile.company_legal_name || 'N/A'}</h2><div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-gray-500 mt-1"><span>{profile.organization_type}</span><span className="text-gray-300">|</span><div className="flex items-center" title={`${profile.rating} out of 5`}>{[...Array(5)].map((_, i) => <Star key={i} size={16} className={i < profile.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} />)}</div></div></div></div><div className="space-y-8"><div><h3 className="font-bold text-lg text-gray-800 mb-4">Supplier Details</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm"><DetailItem icon={<Briefcase size={16}/>} label="Organization Type" value={profile.organization_type} /><DetailItem icon={<Tag size={16}/>} label="Category" value={profile.category} /><DetailItem icon={<Calendar size={16}/>} label="Year Established" value={profile.year_of_establishment} /><DetailItem icon={<Users size={16}/>} label="Company Size" value={profile.company_size} /><DetailItem icon={<Mail size={16}/>} label="Contact Email" value={profile.contact_email} /><DetailItem icon={<Phone size={16}/>} label="Phone" value={profile.phone_number} /><DetailItem icon={<Globe size={16}/>} label="Website" value={profile.company_url} isLink /><DetailItem icon={<FileText size={16}/>} label="Business Reg. No." value={profile.business_registration_number} /><DetailItem icon={<FileText size={16}/>} label="GST/VAT No." value={profile.gst_vat_number} /><DetailItem icon={<MapPin size={16}/>} label="Address" value={fullAddress} fullWidth /></div></div>{(profile.materials.length > 0 || profile.services.length > 0) && ( <div className="border-t pt-6"><h3 className="font-bold text-lg text-gray-800 mb-4">Offerings</h3><div className="space-y-6">{profile.materials.length > 0 && ( <div className="space-y-4"><h4 className="font-semibold text-gray-800 flex items-center gap-2"><Package size={18} /> Materials</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{profile.materials.map((m, i) => ( <div key={i} className="p-4 bg-gray-50 rounded-lg border"><h5 className="font-bold text-gray-900 mb-2">{m.name}</h5><div className="space-y-2 text-sm"><OfferingDetailItem icon={<Hash size={14} />} label="CAS Number" value={m.cas_number} /><OfferingDetailItem icon={<Tag size={14} />} label="INCI Name" value={m.inci_name} /><OfferingDetailItem icon={<DollarSign size={14} />} label="Price Range" value={m.price_range} /><OfferingDetailItem icon={<Package size={14} />} label="Min. Order" value={m.min_order_quantity} /><OfferingDetailItem icon={<Archive size={14} />} label="Inventory" value={m.inventory_info} /><OfferingDetailItem icon={<Globe size={14} />} label="Regions Served" value={m.regions_served} /><OfferingDetailItem icon={<Thermometer size={14} />} label="Measurement Unit" value={m.unit_of_measurement} /><OfferingDetailItem icon={<Book size={14} />} label="Tech Specs" value={m.technical_specs} /></div></div> ))}</div></div> )}{profile.services.length > 0 && ( <div className="space-y-4"><h4 className="font-semibold text-gray-800 flex items-center gap-2"><Server size={18} /> Services</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{profile.services.map((s, i) => ( <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-200"><h5 className="font-bold text-gray-900 mb-2">{s.name}</h5><div className="space-y-2 text-sm"><OfferingDetailItem icon={<Tag size={14} />} label="Service Type" value={s.service_type} /><OfferingDetailItem icon={<Truck size={14} />} label="Delivery Mode" value={s.delivery_mode} /><OfferingDetailItem icon={<DollarSign size={14} />} label="Pricing Model" value={s.pricing_model} /><OfferingDetailItem icon={<Users2 size={14} />} label="Team Details" value={s.team_details} /><OfferingDetailItem icon={<Users size={14} />} label="Team Capacity" value={s.team_capacity} /><OfferingDetailItem icon={<AwardIcon size={14} />} label="Existing Clients" value={s.existing_clients} /><OfferingDetailItem icon={<MessageSquareIcon size={14} />} label="Testimonials" value={s.testimonials} /><OfferingDetailItem icon={<Shield size={14} />} label="SLA Info" value={s.service_sla_info} /><OfferingDetailItem icon={<Globe size={14} />} label="Case Studies" value={s.case_studies_link} isLink /></div></div> ))}</div></div> )}</div></div> )}{profile.documents.length > 0 && ( <div className="border-t pt-6"><h3 className="font-bold text-lg text-gray-800 mb-4">Documents & Verification</h3><div className="space-y-3">{profile.documents.map((doc, i) => ( <div key={i} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"><span className="font-medium text-gray-700 text-sm capitalize">{doc.doc_type.replace(/_/g, ' ')}</span><div className="text-sm font-semibold">{renderDocStatus(doc)}</div></div> ))}</div></div> )}<div className="border-t pt-6"><h3 className="font-bold text-lg text-gray-800 mb-3">About</h3><p className="text-sm text-gray-600 leading-relaxed">{profile.description || 'No description provided.'}</p></div></div></div></div> ); };
const OfferingDetailItem = ({ icon, label, value, isLink = false }: { icon: React.ReactNode, label: string, value: string | null | undefined, isLink?: boolean }) => { if (!value) return null; return ( <div className="flex items-start gap-2"><div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div><div className="min-w-0"><p className="font-medium text-gray-500">{label}</p>{isLink ? ( <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{value}</a> ) : ( <p className="text-gray-800 font-semibold break-words">{value}</p> )}</div></div> ); };
const DetailItem = ({ icon, label, value, isLink = false, fullWidth = false }: { icon: React.ReactNode, label: string, value: string | number | null | undefined, isLink?: boolean, fullWidth?: boolean }) => { if (!value) return null; return ( <div className={`flex items-start gap-3 ${fullWidth ? 'sm:col-span-2' : ''}`}><div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div><div><p className="font-medium text-gray-500">{label}</p>{isLink && typeof value === 'string' ? ( <a href={value.startsWith('http') ? value : `https://www.${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{value}</a> ) : ( <p className="text-gray-800 font-semibold">{value}</p> )}</div></div> ) };


export default ProjectBids;