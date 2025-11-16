import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, X, Loader, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg z-10">
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
interface Milestone {
  id: number;
  name: string;
  date: string;
}

const RFP = () => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [techRequirements, setTechRequirements] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([{ id: Date.now(), name: '', date: '' }]);
  const [files, setFiles] = useState<File[]>([]);
  const navigate = useNavigate();

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() ?? '';
    }
    return '';
  };

  // --- Handlers ---
  const addMilestone = () => {
    setMilestones([...milestones, { id: Date.now(), name: '', date: '' }]);
  };

  const removeMilestone = (id: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter(m => m.id !== id));
    }
  };

  const handleMilestoneChange = (id: number, field: 'name' | 'date', value: string) => {
    setMilestones(milestones.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }
    const newFiles = Array.from(event.target.files);
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  };
  
  const handleFileRemove = (fileIndex: number) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== fileIndex));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Publishing RFP...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to create an RFP.");

      const requirementsData = {
          project_timeline: { start_date: startDate, end_date: endDate },
          budget: { min: minBudget || null, max: maxBudget || null },
          technical_requirements: techRequirements,
          qualification_criteria: qualifications,
          milestones: milestones.filter(m => m.name && m.date),
          attachments: []
      };

      const { data: project, error: insertError } = await supabase
        .from('sourcing_projects')
        .insert({
          creator_user_id: user.id,
          title: title,
          description: description,
          type: 'RFP' as const,
          status: 'sourcing' as const,
          submission_deadline: endDate || null,
          requirements: requirementsData
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      const projectId = project.id;

      fetch('/api/generate-and-save-project-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: projectId }),
      }).catch(err => console.error("Error triggering embedding:", err));

      if (files.length > 0) {
        const uploadPromises = files.map(file => {
          const filePath = `${user.id}/${projectId}/${Date.now()}_${file.name}`;
          return supabase.storage.from('project-attachments').upload(filePath, file)
            .then(result => {
                if (result.error) throw new Error(`Failed to upload ${file.name}: ${result.error.message}`);
                return result.data.path;
            });
        });

        const filePaths = await Promise.all(uploadPromises);
        
        const { error: updateError } = await supabase
          .from('sourcing_projects')
          .update({ requirements: { ...requirementsData, attachments: filePaths } })
          .eq('id', projectId);

        if (updateError) throw updateError;
      }

      const erpUserId = getCookie('versatileErpUserId');
      const syncPayload = {
        projectId,
        title,
        description,
        status: 'sourcing',
        budget: maxBudget ? parseFloat(maxBudget) : null,
        deadline: endDate || null,
        totalItems: milestones.filter(m => m.name && m.date).length,
        type: 'RFP',
        createdAt: new Date().toISOString(),
        metadata: {
          requirements: requirementsData,
          startDate,
          endDate,
          minBudget: minBudget || null,
          maxBudget: maxBudget || null,
        },
      };

      try {
        await fetch('/api/erp/sync/rfp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(erpUserId ? { 'X-User-ID': erpUserId } : {}),
          },
          body: JSON.stringify(syncPayload),
        });
      } catch (syncError) {
        console.error('ERP RFP sync failed:', syncError);
      }
      
      toast.success("RFP published successfully!", { id: toastId });
      navigate(`/sourcing/${projectId}`);

    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] py-8 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-left mb-10">
                <h1 className="text-3xl font-bold text-[#0C2540] sm:text-4xl">Create Request for Proposal</h1>
                <p className="mt-2 text-sm text-gray-600">Fill in the details below to create a new RFP for your project.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Project Overview</h2>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-800">Project Title</label>
                                <Tooltip text="Give your project a clear, descriptive title." />
                            </div>
                            <input type="text" placeholder="e.g., Development of a New E-commerce Platform" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-800">Project Description</label>
                                <Tooltip text="Provide a detailed description of the project, including goals, scope, and key deliverables." />
                            </div>
                            <textarea placeholder="Describe your project requirements in detail..." value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="block font-medium text-gray-800">Start Date</label>
                                    <Tooltip text="The expected start date for the project." />
                                </div>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="block font-medium text-gray-800">End Date</label>
                                    <Tooltip text="The expected completion date for the project." />
                                </div>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Requirements</h2>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-800">Technical Requirements</label>
                                <Tooltip text="List any specific technologies, platforms, or integrations required." />
                            </div>
                            <textarea placeholder="e.g., React, Node.js, PostgreSQL, AWS hosting..." value={techRequirements} onChange={e => setTechRequirements(e.target.value)} rows={3} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-800">Qualification Criteria</label>
                                <Tooltip text="Specify the experience, certifications, or qualifications bidders must have." />
                            </div>
                            <textarea placeholder="e.g., 5+ years of experience in e-commerce development, certified AWS developers..." value={qualifications} onChange={e => setQualifications(e.target.value)} rows={3} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block font-medium text-gray-800">Budget Range</label>
                                <Tooltip text="Provide an estimated budget range for the project to guide bidders." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" placeholder="Min Budget" value={minBudget} onChange={e => setMinBudget(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                                <input type="number" placeholder="Max Budget" value={maxBudget} onChange={e => setMaxBudget(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
                        <Tooltip text="Upload any supporting documents, such as detailed specifications, wireframes, or current system documentation." />
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} multiple />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                            <Upload className="text-gray-400 mb-2" size={24} />
                            <p className="text-gray-600 mb-1">Drop files here or click to upload</p>
                            <p className="text-sm text-gray-500">You can add multiple files</p>
                        </label>
                    </div>
                    
                    {files.length > 0 && (
                        <div className="mt-4 space-y-2">
                        <h3 className="text-sm font-medium text-gray-700">Selected Files:</h3>
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 pl-3 bg-gray-50 rounded-lg border">
                            <p className="text-sm text-gray-800 truncate" title={file.name}>{file.name}</p>
                            <button
                                type="button"
                                onClick={() => handleFileRemove(index)}
                                className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500"
                                aria-label={`Remove ${file.name}`}
                            >
                                <X size={16} />
                            </button>
                            </div>
                        ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Timeline & Milestones</h2>
                        <Tooltip text="Break the project into key milestones with target completion dates." />
                    </div>
                    <div className="space-y-4">
                        {milestones.map((milestone, index) => (
                        <div key={milestone.id} className="flex items-center gap-4">
                            <input type="text" placeholder={`Milestone ${index + 1}`} value={milestone.name} onChange={e => handleMilestoneChange(milestone.id, 'name', e.target.value)} className="flex-1 p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                            <input type="date" value={milestone.date} onChange={e => handleMilestoneChange(milestone.id, 'date', e.target.value)} className="w-48 p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition" />
                            {milestones.length > 1 && <button type="button" onClick={() => removeMilestone(milestone.id)} className="p-3 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><X size={20} /></button>}
                        </div>
                        ))}
                        <button type="button" onClick={addMilestone} className="flex items-center text-[#3B82F6] hover:text-[#2563EB] transition-colors font-medium text-sm"><Plus size={16} className="mr-1" />Add Milestone</button>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button type="submit" disabled={loading} className="px-6 py-3 bg-[#0C2540] text-white rounded-lg font-semibold hover:bg-[#0A2136] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0C2540] focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center">
                        {loading && <Loader size={20} className="animate-spin mr-2" />}
                        {loading ? 'Publishing...' : 'Publish RFP'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default RFP;
