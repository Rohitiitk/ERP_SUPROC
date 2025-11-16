import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
    Loader as LoaderIcon, Users, Globe, Send, Check, FileText, Package, Server, 
    Briefcase, Search, Mail, Phone, Info, XCircle, CheckCircle 
} from 'lucide-react';
import Loader from '../components/Loader';

// --- Info/Error/Success Modal Component ---
const InfoModal = ({
  title,
  message,
  onClose,
  type = 'info'
}: {
  title: string;
  message: string | null;
  onClose: () => void;
  type?: 'info' | 'error' | 'success';
}) => {
  if (!message) return null;

  const config = {
    info: { Icon: Info, color: 'text-blue-500', button: 'bg-blue-600 hover:bg-blue-700' },
    error: { Icon: XCircle, color: 'text-red-500', button: 'bg-red-600 hover:bg-red-700' },
    success: { Icon: CheckCircle, color: 'text-green-500', button: 'bg-green-600 hover:bg-green-700' },
  };
  const { Icon, color, button } = config[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center transform transition-all animate-fade-in-up">
        <Icon className={`mx-auto w-16 h-16 ${color} mb-4`} />
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="mt-8">
          <button onClick={onClose} className={`w-full sm:w-auto px-8 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${button}`}>
            OK
          </button>
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

// --- INTERFACES ---
interface SourcingProject { id: number; title: string; type: 'RFQ' | 'RFP'; requirements: any; submission_deadline: string | null; }
interface Material { name: string | null; }
interface Service { name: string | null; }
interface InternalSupplier { id: number; user_id: string; company_legal_name: string; location: string; supplier_type: string | null; suppliers_materials: Material[]; suppliers_services: Service[]; }
interface ExternalSupplier { name: string; url: string; email: string; phone: string; }

// --- ProjectSummary Component ---
const ProjectSummary = ({ project, summary, isLoading }: { project: SourcingProject; summary: string; isLoading: boolean; }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-3 mb-4">Project Summary</h2>
        <div className="space-y-4 text-sm">
            <div><strong className="text-gray-900">Type:</strong><p className="text-gray-600">{project.type}</p></div>
            <div><strong className="text-gray-900">Deadline:</strong><p className="text-gray-600">{project.submission_deadline ? new Date(project.submission_deadline).toLocaleDateString() : 'Not set'}</p></div>
            <div><strong className="flex items-center gap-2 text-gray-900"><FileText size={16} /> AI Summary:</strong>{isLoading ? (<div className="flex items-center text-gray-500 mt-1"><LoaderIcon size={16} className="animate-spin mr-2" /> Generating...</div>) : (<p className="text-gray-600 mt-1 italic">{summary || "AI summary could not be generated."}</p>)}</div>
        </div>
    </div>
);

// --- MAIN SOURCING HUB COMPONENT ---
const SourcingHub = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<SourcingProject | null>(null);
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
  const [aiSummary, setAiSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [internalSuppliers, setInternalSuppliers] = useState<InternalSupplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<number | string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [externalSuppliers, setExternalSuppliers] = useState<ExternalSupplier[]>([]);
  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; type: 'info' | 'error' | 'success'; onClose?: () => void; } | null>(null);

  useEffect(() => {
    const fetchProjectAndRecommendations = async () => {
      if (!projectId) { setLoading(false); return; }
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("User not authenticated.");
        const [projectResponse, summaryResponse] = await Promise.all([ supabase.from('sourcing_projects').select('*').eq('id', projectId).single(), fetch(`/api/generate-project-summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId }), }) ]);
        const { data: projectData, error: projectError } = projectResponse;
        if (projectError) throw projectError; if (!projectData) throw new Error("Project not found."); setProject(projectData);
        if (summaryResponse.ok) { const summaryData = await summaryResponse.json(); setAiSummary(summaryData.summary); }
        setIsSummaryLoading(false);
        const recommendationsResponse = await fetch(`/api/get-recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId }), });
        if (!recommendationsResponse.ok) { throw new Error('Failed to fetch recommendations'); }
        const recommendedSuppliers = await recommendationsResponse.json();
        const filteredList = recommendedSuppliers.filter((s: InternalSupplier) => s.user_id !== user.id);
        setInternalSuppliers(filteredList);
      } catch (error: any) {
        console.error("Error fetching data:", error);
        setModalInfo({ title: 'Loading Error', message: `Failed to load project details: ${error.message}`, type: 'error', onClose: () => navigate('/') });
      } finally { setLoading(false); }
    };
    fetchProjectAndRecommendations();
  }, [projectId, navigate]);

  const handleSupplierSelect = (id: number | string, isSelected: boolean) => {
    setSelectedSuppliers(prev => { const newSet = new Set(prev); if (isSelected) newSet.add(id); else newSet.delete(id); return newSet; });
  };

  const handleDiscoverSearch = async (product: string, country: string, mode: string) => {
    if (!product || !country) {
        setModalInfo({ title: 'Missing Information', message: 'Please provide a product and a country to search.', type: 'info' });
        return;
    }
    setIsSearching(true); setExternalSuppliers([]);
    try {
        const response = await fetch(`/api/search?product=${encodeURIComponent(product)}&country=${encodeURIComponent(country)}&mode=${encodeURIComponent(mode)}`);
        if (!response.ok) throw new Error("Network response was not ok");
        const data: ExternalSupplier[] = await response.json();
        setExternalSuppliers(data);
    } catch (error) {
        console.error("Failed to fetch external suppliers:", error);
        setModalInfo({ title: 'Search Failed', message: 'Failed to perform Discover AI search. Please try again.', type: 'error' });
    } finally { setIsSearching(false); }
  };

  const handleSendInvitations = async () => {
    if (selectedSuppliers.size === 0) {
      setModalInfo({ title: 'No Suppliers Selected', message: 'Please select at least one supplier to invite.', type: 'info' });
      return;
    }
    setLoading(true);
    try {
        const { data: { user } } = await supabase.auth.getUser(); if (!user || !project) throw new Error("User or project not found.");
        const invitations = Array.from(selectedSuppliers).map(id => { const isInternal = typeof id === 'number'; const externalSupplier = isInternal ? null : externalSuppliers.find(s => s.url === id); return { project_id: project.id, supplier_id: isInternal ? id : null, external_supplier_details: !isInternal ? externalSupplier : null, status: 'invited' as const }; });
        const { error } = await supabase.from('project_bids').insert(invitations); if (error) throw error;
        await supabase.from('sourcing_projects').update({ status: 'bidding_open' }).eq('id', project.id);
        setModalInfo({ title: 'Success!', message: `Successfully sent ${invitations.length} invitations!`, type: 'success', onClose: () => navigate(`/my-projects/${project.id}/bids`) });
    } catch (error: any) {
        setModalInfo({ title: 'Error', message: `Error sending invitations: ${error.message}`, type: 'error' });
    } finally { setLoading(false); }
  };

  if (!project && !loading) {
    return <div className="text-center p-8">Project not found or you do not have permission to view it.</div>;
  }

  return (
    <div className="relative min-h-screen">
      <style>{`
        :root { --radio-accent-h: 215; --radio-accent-s: 100%; --radio-accent-l: 60%; --radio-size: 20px; --icon-size: 20px; --radio-anim-offset: 24px; }
        .card-quick { --radio-accent-h: 215; --radio-accent-s: 100%; --radio-accent-l: 60%; }
        .card-basic { --radio-accent-h: 145; --radio-accent-s: 55%; --radio-accent-l: 62%; }
        .card-advanced { --radio-accent-h: 265; --radio-accent-s: 70%; --radio-accent-l: 72%; }
        .mode-choices .input { -webkit-appearance: none; appearance: none; display: inline-block; margin: 0; width: var(--radio-size); height: var(--radio-size); border-radius: 9999px; cursor: pointer; vertical-align: middle; outline: none; box-shadow: hsla(0,0%,100%,.70) 0 1px 1px, inset hsla(220,15%,20%,.25) 0 0 0 1px; background-color: hsla(210, 20%, 97%, 1); background-repeat: no-repeat; -webkit-transition: background-position .15s cubic-bezier(.8, 0, 1, 1), -webkit-transform .25s cubic-bezier(.8, 0, 1, 1); transition: background-position .15s cubic-bezier(.8, 0, 1, 1), transform .25s cubic-bezier(.8, 0, 1, 1); }
        .mode-choices .input--quick { background-image: -webkit-radial-gradient( hsla(215,100%,92%,1) 0%, hsla(215,100%,70%,.85) 15%, hsla(215,100%,60%,.25) 28%, hsla(215,100%,30%,0) 70% ); }
        .mode-choices .input--basic { background-image: -webkit-radial-gradient( hsla(145, 80%, 92%, 1) 0%, hsla(145, 65%, 70%, .85) 15%, hsla(145, 60%, 60%, .25) 28%, hsla(145, 60%, 30%, 0) 70% ); }
        .mode-choices .input--advanced { background-image: -webkit-radial-gradient( hsla(265, 100%, 93%, 1) 0%, hsla(265, 80%, 75%, .85) 15%, hsla(265, 70%, 65%, .25) 28%, hsla(265, 70%, 35%, 0) 70% ); }
        .mode-choices .input:checked { -webkit-transition: background-position .2s .15s cubic-bezier(0, 0, .2, 1), -webkit-transform .25s cubic-bezier(0, 0, .2, 1); transition: background-position .2s .15s cubic-bezier(0, 0, .2, 1), transform .25s cubic-bezier(0, 0, .2, 1); }
        .mode-choices .input:active { transform: scale(1.15); -webkit-transform: scale(1.15); -webkit-transition: -webkit-transform .1s cubic-bezier(0, 0, .2, 1); transition: transform .1s cubic-bezier(0, 0, .2, 1); }
        .mode-choices .input, .mode-choices .input:active { background-position: 0 var(--radio-anim-offset); }
        .mode-choices .input:checked { background-position: 0 0; }
        .mode-choices .input:checked ~ .input, .mode-choices .input:checked ~ .input:active { background-position: 0 calc(var(--radio-anim-offset) * -1); }
        .mode-choices { width: 100%; } .mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; justify-items: center; align-items: stretch; }
        @media (min-width: 640px) { .mode-grid { gap: 10px; } } @media (min-width: 1024px) { .mode-grid { gap: 12px; } }
        .mode-card { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(16,24,40,0.06); transition: box-shadow .15s ease, border-color .15s ease, transform .15s ease; max-width: 150px; width: 100%; }
        @media (min-width: 640px) { .mode-card { max-width: 170px; padding: 9px 11px; } } @media (min-width: 1024px) { .mode-card { max-width: 180px; padding: 10px 12px; } }
        .mode-card:hover { box-shadow: 0 6px 14px rgba(16,24,40,0.08); border-color: #d1d5db; transform: translateY(-1px); }
        .mode-card.selected { border-color: hsla(var(--radio-accent-h), var(--radio-accent-s), calc(var(--radio-accent-l) - 5%), 0.9); box-shadow: 0 0 0 3px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.28), 0 0 20px 6px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.32), 0 8px 20px rgba(16,24,40,0.08); }
        .mode-card.selected:hover { box-shadow: 0 0 0 3px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.35), 0 0 24px 8px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.38), 0 10px 24px rgba(16,24,40,0.10); transform: translateY(-1px); }
        .mode-icon { display: inline-flex; align-items: center; justify-content: center; width: var(--icon-size); height: var(--icon-size); color: #6b7280; transition: color .15s ease, filter .15s ease; flex: 0 0 var(--icon-size); }
        .mode-icon svg { width: 100%; height: 100%; stroke: currentColor; }
        .mode-card.selected .mode-icon { color: hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 1); filter: drop-shadow(0 0 6px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.55)); }
        .mode-title { font-weight: 600; color: #111827; font-size: 0.85rem; line-height: 1.15; }
        @media (min-width: 640px) { .mode-title { font-size: 0.9rem; } } @media (min-width: 1024px) { .mode-title { font-size: 0.95rem; } }
        .mode-desc { color: #6b7280; font-size: 0.62rem; line-height: 1.05; margin-top: 1px; }
        @media (min-width: 640px) { .mode-desc { font-size: 0.7rem; } } @media (min-width: 1024px) { .mode-desc { font-size: 0.72rem; } }
        .mode-label { display: flex; align-items: center; gap: 8px; width: 100%; cursor: pointer; }
      `}</style>

      <InfoModal title={modalInfo?.title || ''} message={modalInfo?.message || null} onClose={() => { if (modalInfo?.onClose) modalInfo.onClose(); setModalInfo(null); }} type={modalInfo?.type} />
      {loading && ( <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-20"><p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 500, fontSize: '18px', color: '#012547', }} className="text-center mb-4 px-4">AI is analyzing your project to find the best suppliers...</p><Loader /></div> )}
      
      <div className={`max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}>
        {project && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
              <p className="text-gray-600 mt-1">Sourcing Hub - Find and invite suppliers to bid on your project.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="sticky top-8 space-y-6">
                  <ProjectSummary project={project} summary={aiSummary} isLoading={isSummaryLoading} />
                  <div className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="font-semibold mb-2">{selectedSuppliers.size} Suppliers Selected</h3>
                    <button onClick={handleSendInvitations} disabled={selectedSuppliers.size === 0} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
                      <Send size={16} /> Send Invitations
                    </button>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="flex border-b mb-6"><button onClick={() => setActiveTab('internal')} className={`flex items-center gap-2 px-4 py-2 font-medium ${activeTab === 'internal' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}><Users size={18} /> Internal Network</button><button onClick={() => setActiveTab('external')} className={`flex items-center gap-2 px-4 py-2 font-medium ${activeTab === 'external' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}><Globe size={18} /> Discover AI</button></div>
                {activeTab === 'internal' && ( <div className="space-y-4"><h3 className="font-semibold text-lg text-gray-800">AI-Powered Recommendations</h3>{internalSuppliers.length > 0 ? ( internalSuppliers.map(supplier => ( <InternalSupplierCard key={supplier.id} supplier={supplier} onSelect={handleSupplierSelect} isSelected={selectedSuppliers.has(supplier.id)} /> )) ) : ( <div className="text-center py-10 bg-white rounded-lg shadow-sm"><p className="text-gray-500">No matching suppliers found in your internal network.</p></div> )}</div> )}
                {activeTab === 'external' && ( <DiscoverAISearch projectTitle={project.title} onSearch={handleDiscoverSearch} isLoading={isSearching} results={externalSuppliers} onSelect={handleSupplierSelect} selectedSuppliers={selectedSuppliers} /> )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Child Component for Internal Supplier Card ---
const InternalSupplierCard = ({ supplier, onSelect, isSelected }: { supplier: InternalSupplier; onSelect: (id: number, selected: boolean) => void; isSelected: boolean; }) => {
    const offerings = [
        ...supplier.suppliers_services.map(s => ({ type: 'service', name: s.name })),
        ...supplier.suppliers_materials.map(m => ({ type: 'material', name: m.name })),
    ].filter(offering => offering.name);

    const getTagStyle = (type: string) => {
        return type === 'service' 
            ? "bg-blue-50 text-blue-700" 
            : "bg-gray-100 text-gray-700";
    };

    const getTagIcon = (type: string) => {
        return type === 'service' 
            ? <Server size={14} className="flex-shrink-0" /> 
            : <Package size={14} className="flex-shrink-0" />;
    };
    
    return (
        <div className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all border ${isSelected ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white shadow-sm border-gray-200 hover:border-gray-300'}`}>
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-gray-800 text-lg truncate">{supplier.company_legal_name}</p>
                    {supplier.supplier_type && (
                        <span className="text-xs font-semibold text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5">
                           <Briefcase size={12} /> {supplier.supplier_type}
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{supplier.location}</p>
                
                {offerings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {offerings.slice(0, 4).map((offering, index) => (
                           <div key={index} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full ${getTagStyle(offering.type)}`}>
                               {getTagIcon(offering.type)}
                               <span className="truncate">{offering.name}</span>
                           </div>
                        ))}
                        {offerings.length > 4 && (
                            <div className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                                +{offerings.length - 4} more
                            </div>
                        )}
                    </div>
                )}
            </div>
            <button 
                onClick={() => onSelect(supplier.id, !isSelected)}
                aria-label={`Select ${supplier.company_legal_name}`}
                className={`w-full sm:w-auto p-3 rounded-lg transition-colors ml-0 sm:ml-4 flex-shrink-0 flex justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
                <Check size={18} />
            </button>
        </div>
    );
};

// --- Component: Discover AI Search Interface ---
const DiscoverAISearch = ({ projectTitle, onSearch, isLoading, results, onSelect, selectedSuppliers }: { projectTitle: string; onSearch: (product: string, country: string, mode: string) => void; isLoading: boolean; results: ExternalSupplier[]; onSelect: (id: string, selected: boolean) => void; selectedSuppliers: Set<number | string>; }) => {
    const [country, setCountry] = useState('');
    const [mode, setMode] = useState<'quick' | 'basic' | 'advanced'>('quick');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(projectTitle, country, mode);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
                <h3 className="font-semibold text-lg text-gray-800">Find New Global Suppliers</h3>
                <p className="text-gray-500 mt-1 mb-4">Search for top suppliers worldwide based on your project requirements.</p>

                <div className="mode-choices mb-4">
                  <div className="mode-grid">
                    <label htmlFor="mode-quick" className={`mode-card mode-label card-quick ${mode === 'quick' ? 'selected' : ''}`}><input id="mode-quick" type="radio" name="searchMode" className="input input--quick" checked={mode === 'quick'} onChange={() => setMode('quick')}/><span className="mode-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span><div><div className="mode-title">Quick</div><div className="mode-desc">Fast & Free</div></div></label>
                    <label htmlFor="mode-basic" className={`mode-card mode-label card-basic ${mode === 'basic' ? 'selected' : ''}`}><input id="mode-basic" type="radio" name="searchMode" className="input input--basic" checked={mode === 'basic'} onChange={() => setMode('basic')}/><span className="mode-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v5c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6l7-4z"></path><path d="M9 12l2 2 4-4"></path></svg></span><div><div className="mode-title">Standard</div><div className="mode-desc">Balanced</div></div></label>
                    <label htmlFor="mode-advanced" className={`mode-card mode-label card-advanced ${mode === 'advanced' ? 'selected' : ''}`}><input id="mode-advanced" type="radio" name="searchMode" className="input input--advanced" checked={mode === 'advanced'} onChange={() => setMode('advanced')}/><span className="mode-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="4" x2="12" y2="2"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="12" y1="22" x2="12" y2="20"></line><line x1="2" y1="12" x2="4" y2="12"></line></svg></span><div><div className="mode-title">Pro</div><div className="mode-desc">Deeper reach</div></div></label>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <input type="text" value={projectTitle} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" title="Product name is based on your project title." />
                    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Enter Country" required className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" disabled={isLoading} className="flex items-center justify-center gap-2 px-5 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"> {isLoading ? <LoaderIcon size={20} className="animate-spin" /> : <Search size={18} />} <span>{isLoading ? "Searching..." : "Search"}</span> </button>
                </form>
            </div>

            <div className="mt-6 min-h-[400px] relative">
                {isLoading && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 rounded-lg">
                        <Loader />
                        <p className="mt-4 text-gray-600 font-medium">Discover AI is searching the web...</p>
                     </div>
                )}
                {!isLoading && results.length > 0 && (
                    <div className="space-y-4">
                        {results.map((supplier) => ( <ExternalSupplierCard key={supplier.url} supplier={supplier} onSelect={onSelect} isSelected={selectedSuppliers.has(supplier.url)} /> ))}
                    </div>
                )}
                {!isLoading && results.length === 0 && (
                    <div className="flex items-center justify-center h-full text-center py-10 bg-white rounded-lg shadow-sm">
                        <p className="text-gray-500">Enter a country and click search to find new suppliers.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Component: Card for External Suppliers ---
const ExternalSupplierCard = ({ supplier, onSelect, isSelected }: { 
    supplier: ExternalSupplier; 
    onSelect: (id: string, selected: boolean) => void; 
    isSelected: boolean; 
}) => (
    <div className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all border ${isSelected ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white shadow-sm border-gray-200 hover:border-gray-300'}`}>
        <div className="flex-grow min-w-0">
            <a href={supplier.url.startsWith('http') ? supplier.url : `https://${supplier.url}`} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-800 text-lg hover:text-blue-600 hover:underline truncate block">
                {supplier.name}
            </a>
             <div className="mt-2 space-y-1 text-sm text-gray-600">
                {supplier.email && (
                    <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <span className="truncate">{supplier.email}</span>
                    </div>
                )}
                 {supplier.phone && (
                    <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <span className="truncate">{supplier.phone}</span>
                    </div>
                )}
             </div>
        </div>
         <button 
            onClick={() => onSelect(supplier.url, !isSelected)}
            aria-label={`Select ${supplier.name}`}
            className={`w-full sm:w-auto p-3 rounded-lg transition-colors ml-0 sm:ml-4 flex-shrink-0 flex justify-center ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
        >
            <Check size={18} />
        </button>
    </div>
);

export default SourcingHub;
