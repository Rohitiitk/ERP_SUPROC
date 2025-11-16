import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, X, Loader, Info, XCircle } from 'lucide-react';

// --- NEW: Error Modal Component ---
const ErrorModal = ({ message, onClose }: { message: string, onClose: () => void }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center transform transition-all animate-fade-in-up">
        <XCircle className="mx-auto w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-800">An Error Occurred</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

// --- Tooltip Component ---
const Tooltip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative flex items-center" ref={tooltipRef}>
      <Info
        size={16}
        className="text-gray-400 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg z-10 transition-opacity duration-300">
          {text}
          <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
            <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
          </svg>
        </div>
      )}
    </div>
  );
};

// --- Interfaces ---
interface RFQMaterial {
  id: number;
  name: string;
  price: string;
  quantity: string;
  specifications: string;
  shippingLocation: string;
  fullShippingAddress: string;
  shippingMethod: string;
  attachments: File[];
}

interface RFQFormData {
  productTitle: string;
  description: string;
  materials: RFQMaterial[];
  projectBudget: string;
  deadline: string;
  paymentMethod: string;
  contactMethod: string;
  language: string;
}

const RFQForm = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(''); // <-- NEW state for modal
  const [formData, setFormData] = useState<RFQFormData>({
    productTitle: '',
    description: '',
    materials: [createNewMaterial(1)],
    projectBudget: '',
    deadline: '',
    paymentMethod: '',
    contactMethod: '',
    language: ''
  });
  const navigate = useNavigate();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() ?? '';
    }
    return '';
  };

  function createNewMaterial(id: number): RFQMaterial {
    return {
      id, name: '', price: '', quantity: '1', specifications: '',
      shippingLocation: '', fullShippingAddress: '', shippingMethod: '', attachments: []
    };
  }

  const addMaterial = () => {
    const newId = formData.materials.length > 0 ? Math.max(...formData.materials.map(m => m.id)) + 1 : 1;
    setFormData({ ...formData, materials: [...formData.materials, createNewMaterial(newId)] });
  };

  const removeMaterial = (id: number) => {
    if (formData.materials.length > 1) {
      setFormData({ ...formData, materials: formData.materials.filter(material => material.id !== id) });
    }
  };

  const handleMaterialChange = (id: number, field: keyof Omit<RFQMaterial, 'id' | 'attachments'>, value: string) => {
    setFormData({
      ...formData,
      materials: formData.materials.map(material =>
        material.id === id ? { ...material, [field]: value } : material
      )
    });
  };

  const handleFileUpload = (id: number, files: FileList | null) => {
    if (!files) return;
    setFormData({
      ...formData,
      materials: formData.materials.map(material =>
        material.id === id ? { ...material, attachments: [...material.attachments, ...Array.from(files)] } : material
      )
    });
  };

  const handleFileRemove = (materialId: number, fileIndex: number) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      materials: prevFormData.materials.map(material => {
        if (material.id === materialId) {
          const updatedAttachments = material.attachments.filter((_, index) => index !== fileIndex);
          return { ...material, attachments: updatedAttachments };
        }
        return material;
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(''); // Clear previous errors

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to create an RFQ.");

      const initialProjectData = {
        creator_user_id: user.id,
        title: formData.productTitle,
        description: formData.description,
        submission_deadline: formData.deadline || null,
        type: 'RFQ' as const,
        status: 'sourcing' as const,
        payment_method: formData.paymentMethod,
        contact_method: formData.contactMethod,
        language: formData.language,
        requirements: {}
      };

      const { data: project, error: insertError } = await supabase
        .from('sourcing_projects')
        .insert(initialProjectData)
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      const projectId = project.id;

      fetch('/api/generate-and-save-project-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectId }),
      }).catch(err => console.error("Error triggering embedding:", err));

      const materialsWithFilePaths = await Promise.all(
        formData.materials.map(async (material) => {
          const filePaths: string[] = [];
          for (const file of material.attachments) {
            const filePath = `${user.id}/${projectId}/${material.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('project-attachments')
              .upload(filePath, file);
            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              continue;
            }
            filePaths.push(filePath);
          }
          const { attachments, id, ...rest } = material;
          return { ...rest, attachments: filePaths };
        })
      );
      
      const finalRequirements = {
        materials: materialsWithFilePaths,
        budget: formData.projectBudget ? { max: parseFloat(formData.projectBudget) } : null
      };

      const { error: updateError } = await supabase
        .from('sourcing_projects')
        .update({ requirements: finalRequirements })
        .eq('id', projectId);

      if (updateError) throw updateError;

      const erpUserId = getCookie('versatileErpUserId');
      const syncPayload = {
        projectId,
        title: formData.productTitle,
        description: formData.description,
        status: 'sourcing',
        budget: formData.projectBudget ? parseFloat(formData.projectBudget) : null,
        deadline: formData.deadline || null,
        totalItems: formData.materials.length,
        type: 'RFQ',
        createdAt: new Date().toISOString(),
        metadata: {
          materials: materialsWithFilePaths,
          paymentMethod: formData.paymentMethod,
          contactMethod: formData.contactMethod,
          language: formData.language,
        },
      };

      try {
        await fetch('/api/erp/sync/rfq', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(erpUserId ? { 'X-User-ID': erpUserId } : {}),
          },
          body: JSON.stringify(syncPayload),
        });
      } catch (syncError) {
        console.error('ERP RFQ sync failed:', syncError);
      }

      navigate(`/sourcing/${projectId}`);

    } catch (error: any) {
      // --- ALERT REPLACED WITH MODAL ---
      setErrorMessage(`Error creating RFQ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] py-8 sm:py-12">
        {/* --- NEW: RENDER THE ERROR MODAL --- */}
        <ErrorModal message={errorMessage} onClose={() => setErrorMessage('')} />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-left mb-10">
                <h1 className="text-3xl font-bold text-[#0C2540] sm:text-4xl">Request for Quote</h1>
                <p className="mt-2 text-sm text-gray-600">Fill out the details below to get quotes from suppliers worldwide.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <label className="block font-medium text-gray-800">Project Title</label>
                        <Tooltip text="Give your project a clear and concise name (e.g., '100% Cotton T-Shirts for Summer Collection')." />
                    </div>
                    <input type="text" className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" value={formData.productTitle} onChange={e => setFormData({ ...formData, productTitle: e.target.value })} required />
                
                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block font-medium text-gray-800">Project Description</label>
                            <Tooltip text="Provide a brief summary of your project. Explain why you need these materials and what they will be used for." />
                        </div>
                        <textarea className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="e.g., We are sourcing materials for our upcoming clothing line..." />
                    </div>
                </div>

                {formData.materials.map((material, index) => (
                <div key={material.id} className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Material {index + 1}</h2>
                        {formData.materials.length > 1 && (<button type="button" onClick={() => removeMaterial(material.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>)}
                    </div>
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-gray-700">Material Name</label>
                            <Tooltip text="Enter the name of the raw material or component you need." />
                        </div>
                        <input type="text" className="w-full p-2.5 border border-gray-300 rounded-md" value={material.name} onChange={e => handleMaterialChange(material.id, 'name', e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-gray-700">Target Price (per unit)</label>
                                <Tooltip text="What is your ideal price per unit for this material?" />
                            </div>
                            <div className="flex"><span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-600">$</span><input type="number" className="w-full p-2.5 border border-gray-300 rounded-r-md" value={material.price} onChange={e => handleMaterialChange(material.id, 'price', e.target.value)} placeholder="0.00" required /></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-gray-700">Quantity</label>
                                <Tooltip text="How many units of this material do you need?" />
                            </div>
                            <input type="number" className="w-full p-2.5 border border-gray-300 rounded-md" value={material.quantity} onChange={e => handleMaterialChange(material.id, 'quantity', e.target.value)} required min="1" />
                        </div>
                    </div>
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-gray-700">Specifications</label>
                            <Tooltip text="Add specific features, technical requirements, or standards (e.g., color codes, weight, certifications)." />
                        </div>
                        <textarea className="w-full p-2.5 border border-gray-300 rounded-md" value={material.specifications} onChange={e => handleMaterialChange(material.id, 'specifications', e.target.value)} rows={3} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-gray-700">Shipping To</label>
                                <Tooltip text="Will this material be shipped within your country or from another country?" />
                            </div>
                            <select className="w-full p-2.5 border border-gray-300 rounded-md pr-8 appearance-none" value={material.shippingLocation} onChange={e => handleMaterialChange(material.id, 'shippingLocation', e.target.value)} required>
                                <option value="">Select location</option><option value="domestic">Domestic</option><option value="international">International</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-gray-700">Preferred Shipping Method</label>
                                <Tooltip text="Select your preferred mode of transport for the delivery." />
                            </div>
                            <select className="w-full p-2.5 border border-gray-300 rounded-md pr-8 appearance-none" value={material.shippingMethod} onChange={e => handleMaterialChange(material.id, 'shippingMethod', e.target.value)} required>
                                <option value="">Select mode of shipping</option><option value="air">Air Freight</option><option value="sea">Sea Freight</option><option value="land">Land Shipping</option>
                            </select>
                        </div>
                    </div>
                    
                    {(material.shippingLocation === 'domestic' || material.shippingLocation === 'international') && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-gray-700">Full Shipping Address (Optional)</label>
                            <Tooltip text="Provide the detailed street address, city, state, and postal code for delivery." />
                        </div>
                        <textarea 
                            className="w-full p-2.5 border border-gray-300 rounded-md" 
                            value={material.fullShippingAddress} 
                            onChange={e => handleMaterialChange(material.id, 'fullShippingAddress', e.target.value)} 
                            rows={2}
                            placeholder="e.g., 123 Supply Chain St, Factory Town, ST 12345, Country"
                        />
                    </div>
                    )}

                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-gray-700">Attachments</label>
                            <Tooltip text="Attach any relevant files, such as design specs, technical drawings, or example images." />
                        </div>
                        <div className="flex items-center">
                            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-md border border-gray-300 flex items-center transition-colors">
                                <Upload size={16} className="mr-2" />Choose File
                                <input type="file" className="hidden" ref={el => (fileInputRefs.current[index] = el)} onChange={e => handleFileUpload(material.id, e.target.files)} multiple />
                            </label>
                            <span className="ml-3 text-sm text-gray-600">{material.attachments.length > 0 ? `${material.attachments.length} file(s) selected` : 'No file chosen'}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            {material.attachments.map((file, fileIndex) => (
                            <div key={fileIndex} className="flex items-center justify-between p-2 pl-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm text-gray-800 truncate" title={file.name}>{file.name}</p>
                                <button type="button" onClick={() => handleFileRemove(material.id, fileIndex)} className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full" aria-label={`Remove ${file.name}`}>
                                    <X size={16} />
                                </button>
                            </div>
                            ))}
                        </div>
                    </div>
                </div>
                ))}
                
                <button type="button" onClick={addMaterial} className="flex items-center text-[#3B82F6] hover:text-[#2563EB] transition-colors font-medium text-sm"><Plus size={16} className="mr-1" />Add another material</button>
                
                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Project Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-700">Overall Project Budget</label>
                                <Tooltip text="What is the maximum total budget for this entire RFQ?" />
                            </div>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-600">$</span>
                                <input type="number" className="w-full p-2.5 border border-gray-300 rounded-r-md" value={formData.projectBudget} onChange={e => setFormData({ ...formData, projectBudget: e.target.value })} placeholder="e.g., 5000.00" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-700">Submission Deadline</label>
                                <Tooltip text="Set the final date for suppliers to submit their quotations." />
                            </div>
                            <input type="date" className="w-full p-2.5 border border-gray-300 rounded-md" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-700">Preferred Payment Method</label>
                                <Tooltip text="How would you prefer to pay the supplier?" />
                            </div>
                            <select className="w-full p-2.5 border border-gray-300 rounded-md pr-8 appearance-none" value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })} required>
                                <option value="">Select mode of payment</option><option value="credit_card">Credit Card</option><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option><option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-700">Preferred Contact Method</label>
                                <Tooltip text="How should suppliers contact you with questions?" />
                            </div>
                            <select className="w-full p-2.5 border border-gray-300 rounded-md pr-8 appearance-none" value={formData.contactMethod} onChange={e => setFormData({ ...formData, contactMethod: e.target.value })} required>
                                <option value="">Select mode of contact</option><option value="email">Email</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="in_person">In Person</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-700">Language</label>
                                <Tooltip text="In which language should the suppliers respond?" />
                            </div>
                            <select className="w-full p-2.5 border border-gray-300 rounded-md pr-8 appearance-none" value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} required>
                                <option value="">Select language</option><option value="english">English</option><option value="spanish">Spanish</option><option value="french">French</option><option value="german">German</option><option value="chinese">Chinese</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={loading} className="px-6 py-3 bg-[#0C2540] text-white rounded-lg font-semibold hover:bg-[#0A2136] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0C2540] focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg">
                        {loading && <Loader size={20} className="animate-spin mr-2" />}
                        {loading ? 'Submitting...' : 'Send RFQ'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default RFQForm;
