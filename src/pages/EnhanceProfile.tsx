import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
// Add these dependencies to your project:
// npm install react-select react-country-flag country-list
import Select from 'react-select';
import ReactCountryFlag from 'react-country-flag';
import countryList from 'country-list';
import {
    Building, Package, FileText, Banknote, Check, ArrowRight, Loader as LoaderIcon,
    Info, Briefcase, Calendar, Users, Map, Globe, MapPin, Hash, Ruler, Tag, List, Server,
    Users2, Link2, FileClock, BarChart, MessageSquare, User, Trash2, Landmark, CheckCircle, Upload, PlusCircle, X
} from 'lucide-react';
import Loader from '../components/Loader';


// --- Country Options with Codes for Flags ---
const countryOptions = countryList.getData().map(({ code, name }) => ({
  value: code,
  label: name,
}));

// --- NEW: Success Modal Component ---
const SuccessModal = ({ message }: { message: string }) => (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center backdrop-blur-sm">
      <div className="bg-white text-gray-800 rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center transform transition-all animate-fade-in-up">
        <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-700">
          {message}
        </h2>
        <p className="text-sm text-gray-500 mt-2">Redirecting to your profile...</p>
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


// --- Helper Components ---
const Step = ({ icon, title, status, onClick }: { icon: React.ReactNode, title: string, status: 'complete' | 'current' | 'upcoming', onClick: () => void }) => {
    const statusClasses = {
        complete: 'bg-green-500 text-white',
        current: 'border-2 border-blue-600 bg-white text-blue-600',
        upcoming: 'border-2 border-gray-300 bg-gray-50 text-gray-400'
    };
    return (
        <button onClick={onClick} className="flex flex-col items-center text-center cursor-pointer group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${statusClasses[status]}`}>
                {status === 'complete' ? <Check size={24} /> : icon}
            </div>
            <h3 className={`mt-2 font-medium text-sm ${status === 'current' ? 'text-blue-600' : 'text-gray-700'}`}>{title}</h3>
        </button>
    );
};

const FormInput = ({ name, label, placeholder, value, onChange, type = 'text', icon: Icon }: any) => (
    <div className="space-y-2">
        <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />}
            <input id={name} name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
    </div>
);

const FormSelect = ({ name, label, value, onChange, children, icon: Icon }: any) => (
     <div className="space-y-2">
        <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />}
            <select id={name} name={name} value={value} onChange={onChange} className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {children}
            </select>
        </div>
    </div>
);

// --- Interfaces and Types (UPDATED) ---
interface ICompanyInfo {
    business_type: string; category: string; supplier_type: string; address_line_1: string;
    address_line_2: string; city: string; region: string; postal_code: string; country: string;
    organization_type: string; gst_vat_number: string; year_of_establishment: string;
    company_size: string; operating_regions: string; website_url: string;
}
interface IMaterialInfo {
    id?: number; // Add ID for tracking existing entries
    name: string; inci_name: string; cas_number: string; regions_served: string; unit_of_measurement: string;
    price_range: string; min_order_quantity: string; inventory_info: string; technical_specs: string;
}
interface IServiceInfo {
    id?: number; // Add ID for tracking existing entries
    name: string; service_type: string; delivery_mode: string; pricing_model: string;
    team_details: string; existing_clients: string; case_studies_link: string; service_sla_info: string;
    team_capacity: string; testimonials: string;
}
interface IBankInfo {
    account_holder_name: string; bank_name: string; account_number: string;
    ifsc_swift_code: string; branch_name: string;
    turnover_year_1: string; turnover_year_2: string; turnover_year_3: string;
}
type DocumentDefinition = { label: string; type: string; description: string; };
type FilesToUploadState = { [key: string]: File };
type UploadedDocument = { doc_type: string; file_path: string; status: string; };

// --- Initial Empty States ---
const initialMaterialState: IMaterialInfo = {
    name: '', inci_name: '', cas_number: '', regions_served: '', unit_of_measurement: '',
    price_range: '', min_order_quantity: '', inventory_info: '', technical_specs: ''
};
const initialServiceState: IServiceInfo = {
    name: '', service_type: 'Maintenance', delivery_mode: 'Onsite', pricing_model: 'Per hour',
    team_details: '', existing_clients: '', case_studies_link: '', service_sla_info: '',
    team_capacity: '', testimonials: ''
};

// --- Main Component ---
const EnhanceProfile = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [supplierId, setSupplierId] = useState<number | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false); // <-- NEW state for modal
    const navigate = useNavigate();

    // --- State for each form step ---
    const [companyInfo, setCompanyInfo] = useState<ICompanyInfo>({
        business_type: '', category: 'Material', supplier_type: 'Manufacturer', address_line_1: '',
        address_line_2: '', city: '', region: '', postal_code: '', country: 'India',
        organization_type: 'Corporate', gst_vat_number: '', year_of_establishment: '',
        company_size: '', operating_regions: '', website_url: ''
    });

    const [otherCategory, setOtherCategory] = useState('');
    const [otherSupplierType, setOtherSupplierType] = useState('');
    const [otherOrganizationType, setOtherOrganizationType] = useState('');

    const [materials, setMaterials] = useState<IMaterialInfo[]>([initialMaterialState]);
    const [services, setServices] = useState<IServiceInfo[]>([initialServiceState]);
    const [initialMaterialIds, setInitialMaterialIds] = useState<number[]>([]);
    const [initialServiceIds, setInitialServiceIds] = useState<number[]>([]);

    const [bankInfo, setBankInfo] = useState<IBankInfo>({
        account_holder_name: '', bank_name: '', account_number: '',
        ifsc_swift_code: '', branch_name: '',
        turnover_year_1: '', turnover_year_2: '', turnover_year_3: ''
    });
    const [filesToUpload, setFilesToUpload] = useState<FilesToUploadState>({});
    const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

    // --- Handlers ---
    const fetchSupplierData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return;
        }
        const { data: supplier, error } = await supabase
            .from('suppliers')
            .select(`*, suppliers_bank_details(*), suppliers_materials(*), suppliers_services(*), suppliers_documents(*)`)
            .eq('user_id', user.id)
            .single();

        if (error) {
            setError('Could not find your supplier profile. Please register first.');
        } else if (supplier) {
            setSupplierId(supplier.id);

            const fetchedCompanyInfo: ICompanyInfo = {
                business_type: supplier.business_type || '',
                category: supplier.category || 'Material',
                supplier_type: supplier.supplier_type || 'Manufacturer',
                address_line_1: supplier.address_line_1 || '',
                address_line_2: supplier.address_line_2 || '',
                city: supplier.city || '',
                region: supplier.region || '',
                postal_code: supplier.postal_code || '',
                country: supplier.country || 'India',
                organization_type: supplier.organization_type || 'Corporate',
                gst_vat_number: supplier.gst_vat_number || '',
                year_of_establishment: supplier.year_of_establishment?.toString() || '',
                company_size: supplier.company_size || '',
                operating_regions: (supplier.operating_regions || []).join(', '),
                website_url: supplier.website_url || ''
            };

            const standardCategories = ['Material', 'Service', 'Both'];
            if (supplier.category && !standardCategories.includes(supplier.category)) {
                fetchedCompanyInfo.category = 'Other';
                setOtherCategory(supplier.category);
            }

            const standardSupplierTypes = ['Manufacturer', 'Distributor', 'Wholesaler', 'Retailer'];
            if (supplier.supplier_type && !standardSupplierTypes.includes(supplier.supplier_type)) {
                fetchedCompanyInfo.supplier_type = 'Other';
                setOtherSupplierType(supplier.supplier_type);
            }

            const standardOrgTypes = ['Corporate', 'Government', 'Non-Profit', 'Small Business'];
            if (supplier.organization_type && !standardOrgTypes.includes(supplier.organization_type)) {
                fetchedCompanyInfo.organization_type = 'Other';
                setOtherOrganizationType(supplier.organization_type);
            }

            setCompanyInfo(fetchedCompanyInfo);

            if (supplier.suppliers_materials?.length > 0) {
                setMaterials(supplier.suppliers_materials);
                setInitialMaterialIds(
                    supplier.suppliers_materials
                        .map((m: IMaterialInfo) => m.id)
                        .filter((id: number | undefined): id is number => !!id)
                );
            } else {
                setMaterials([initialMaterialState]);
            }

            if (supplier.suppliers_services?.length > 0) {
                setServices(supplier.suppliers_services);
                setInitialServiceIds(
                    supplier.suppliers_services
                        .map((s: IServiceInfo) => s.id)
                        .filter((id: number | undefined): id is number => !!id)
                );
            } else {
                setServices([initialServiceState]);
            }

            if (supplier.suppliers_bank_details?.length > 0) {
                const bankDetails = supplier.suppliers_bank_details[0];
                const turnover = bankDetails.annual_turnover_last_3_years || {};
                const currentYear = new Date().getFullYear();
                setBankInfo({
                    account_holder_name: bankDetails.account_holder_name || '', bank_name: bankDetails.bank_name || '',
                    account_number: bankDetails.account_number || '', ifsc_swift_code: bankDetails.ifsc_swift_code || '',
                    branch_name: bankDetails.branch_name || '',
                    turnover_year_1: turnover[currentYear - 1] || '',
                    turnover_year_2: turnover[currentYear - 2] || '',
                    turnover_year_3: turnover[currentYear - 3] || ''
                });
            }
            if (supplier.suppliers_documents?.length > 0) setUploadedDocuments(supplier.suppliers_documents);
        }
        setLoading(false);
    }, [navigate]);

    useEffect(() => {
        fetchSupplierData();
    }, [fetchSupplierData]);

    const handleFormChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setter(prev => ({...prev, [name]: value}));
    }

    const handleItemChange = <T,>(
        index: number,
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
        setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
        const { name, value } = event.target;
        setter(currentItems =>
            currentItems.map((item, i) =>
                i === index ? { ...item, [name]: value } : item
            )
        );
    };

    const addItem = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, initialState: T) => {
        setter(currentItems => [...currentItems, initialState]);
    };

    const removeItem = <T,>(index: number, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter(currentItems => currentItems.filter((_, i) => i !== index));
    };

    const handleFileSelect = (docType: string, file: File | null) => {
        setFilesToUpload(prev => {
            const newState = { ...prev };
            if (file) {
                newState[docType] = file;
            } else {
                delete newState[docType];
            }
            return newState;
        });
    };

    const handleSaveStep = async () => {
        if (!supplierId) return;
        setSaving(true);
        setError('');

        try {
            let scoreUpdate = 0;
            // --- NEW: Flag to check if we need to update the embedding ---
            let shouldUpdateEmbedding = false;

            if (currentStep === 1) {
                const year = parseInt(companyInfo.year_of_establishment);
                const updateData = {
                    ...companyInfo,
                    operating_regions: companyInfo.operating_regions.split(',').map(s => s.trim()),
                    category: companyInfo.category === 'Other' ? otherCategory : companyInfo.category,
                    supplier_type: companyInfo.supplier_type === 'Other' ? otherSupplierType : companyInfo.supplier_type,
                    organization_type: companyInfo.organization_type === 'Other' ? otherOrganizationType : companyInfo.organization_type,
                    year_of_establishment: !isNaN(year) ? year : null,
                };
                const { error } = await supabase.from('suppliers').update(updateData).eq('id', supplierId);
                if (error) throw error;
                scoreUpdate = 25;
                shouldUpdateEmbedding = true; // Mark for update
            } else if (currentStep === 2) {

                const materialsWithNames = materials.filter(m => m.name);
                const materialsToUpdate = materialsWithNames.filter(m => m.id).map(m => ({...m, supplier_id: supplierId}));
                const materialsToInsert = materialsWithNames.filter(m => !m.id).map(({ id, ...rest }) => ({ ...rest, supplier_id: supplierId }));
                const finalMaterialIds = materialsWithNames.map(m => m.id).filter(id => id);
                const materialsToDelete = initialMaterialIds.filter((id: number) => !finalMaterialIds.includes(id));

                if (materialsToDelete.length > 0) {
                    const { error } = await supabase.from('suppliers_materials').delete().in('id', materialsToDelete);
                    if (error) throw new Error(`Failed to delete materials: ${error.message}`);
                }
                if (materialsToUpdate.length > 0) {
                    const { error } = await supabase.from('suppliers_materials').upsert(materialsToUpdate);
                    if (error) throw new Error(`Failed to update materials: ${error.message}`);
                }
                if (materialsToInsert.length > 0) {
                    const { error } = await supabase.from('suppliers_materials').insert(materialsToInsert);
                    if (error) throw new Error(`Failed to insert new materials: ${error.message}`);
                }

                const servicesWithNames = services.filter(s => s.name);
                const servicesToUpdate = servicesWithNames.filter(s => s.id).map(s => ({...s, supplier_id: supplierId}));
                const servicesToInsert = servicesWithNames.filter(s => !s.id).map(({ id, ...rest }) => ({ ...rest, supplier_id: supplierId }));
                const finalServiceIds = servicesWithNames.map(s => s.id).filter(id => id);
                const servicesToDelete = initialServiceIds.filter((id: number) => !finalServiceIds.includes(id));

                if (servicesToDelete.length > 0) {
                    const { error } = await supabase.from('suppliers_services').delete().in('id', servicesToDelete);
                    if (error) throw new Error(`Failed to delete services: ${error.message}`);
                }
                if (servicesToUpdate.length > 0) {
                    const { error } = await supabase.from('suppliers_services').upsert(servicesToUpdate);
                    if (error) throw new Error(`Failed to update services: ${error.message}`);
                }
                if (servicesToInsert.length > 0) {
                    const { error } = await supabase.from('suppliers_services').insert(servicesToInsert);
                    if (error) throw new Error(`Failed to insert new services: ${error.message}`);
                }

                scoreUpdate = 25;
                shouldUpdateEmbedding = true; // Mark for update
            } else if (currentStep === 3) {
                const uploadPromises = Object.entries(filesToUpload).map(async ([docType, file]) => {
                    const filePath = `${supplierId}/${docType}/${file.name}`;
                    const { error: uploadError } = await supabase.storage
                        .from('supplier-documents')
                        .upload(filePath, file, { upsert: true });
                    if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
                    return { doc_type: docType, file_path: filePath, supplier_id: supplierId };
                });
                const uploadedFilesData = await Promise.all(uploadPromises);
                if (uploadedFilesData.length > 0) {
                    const { error: dbError } = await supabase.from('suppliers_documents').upsert(uploadedFilesData, { onConflict: 'supplier_id,doc_type' });
                    if (dbError) throw dbError;
                }
                setFilesToUpload({});
                scoreUpdate = 15;
            } else if (currentStep === 4) {
                const currentYear = new Date().getFullYear();
                const turnoverData = {
                    [`${currentYear - 1}`]: bankInfo.turnover_year_1,
                    [`${currentYear - 2}`]: bankInfo.turnover_year_2,
                    [`${currentYear - 3}`]: bankInfo.turnover_year_3,
                };
                const bankDataToSave = {
                    supplier_id: supplierId,
                    account_holder_name: bankInfo.account_holder_name, bank_name: bankInfo.bank_name,
                    account_number: bankInfo.account_number, ifsc_swift_code: bankInfo.ifsc_swift_code,
                    branch_name: bankInfo.branch_name, annual_turnover_last_3_years: turnoverData,
                };
                const { error } = await supabase.from('suppliers_bank_details').upsert(bankDataToSave, { onConflict: 'supplier_id' });
                if (error) throw error;
                scoreUpdate = 10;
            }

            // --- NEW: Trigger AI embedding update if marked ---
            if (shouldUpdateEmbedding) {
                fetch('/api/generate-supplier-embedding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ supplierId: supplierId })
                }).catch(err => console.error("Error triggering supplier embedding update:", err));
            }

            if(scoreUpdate > 0){
                const { error: rpcError } = await supabase.rpc('increment_completeness_score', { supplier_id_arg: supplierId, increment_value: scoreUpdate });
                if (rpcError) throw rpcError;
            }

            if (currentStep === 4) {
                 await supabase.from('suppliers').update({ profile_status: 'enhanced' }).eq('id', supplierId);
                 setShowSuccessModal(true); // <-- SHOW MODAL
                 setTimeout(() => {
                    navigate('/profile'); // <-- NAVIGATE AFTER DELAY
                 }, 2000);
            } else {
                setCurrentStep(prev => prev + 1);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // --- Document Definitions ---
    const mandatoryDocuments: DocumentDefinition[] = [
        { label: 'Business License or Company Registration', type: 'BUSINESS_LICENSE', description: 'Proof of your company’s legal existence.' },
        { label: 'GST Registration', type: 'GST_REGISTRATION', description: 'Proof of tax registration applicable for invoicing.' },
        { label: 'Address Proof', type: 'ADDRESS_PROOF', description: 'Utility bill, lease or other official address document.' },
    ];
    const optionalDocuments: DocumentDefinition[] = [
        { label: 'ISO Certification (if any)', type: 'ISO_CERTIFICATION', description: 'Certifies quality management standards.' },
        { label: 'MSME Certificate (if applicable)', type: 'MSME_CERTIFICATE', description: 'Helps classify your business as a micro, small, or medium enterprise.' },
    ];

    // --- Render Logic ---
    if (loading) return <div className="flex justify-center items-center h-screen"><Loader /></div>;
    if (error && !supplierId) return <div className="text-center p-8 text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            {showSuccessModal && <SuccessModal message="Profile Enhancement Complete!" />}
            <div className="w-full max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-center mb-4">Enhance Your Profile</h1>
                <p className="text-center text-gray-600 mb-12">Complete these steps to increase your visibility and attract more opportunities.</p>

                <div className="grid grid-cols-4 gap-4 mb-12 relative before:absolute before:top-6 before:left-[12.5%] before:w-3/4 before:h-0.5 before:bg-gray-200">
                    <Step icon={<Building size={24}/>} title="Company Info" status={currentStep >= 1 ? (currentStep === 1 ? 'current' : 'complete') : 'upcoming'} onClick={() => setCurrentStep(1)} />
                    <Step icon={<Package size={24}/>} title="Materials/Services" status={currentStep >= 2 ? (currentStep === 2 ? 'current' : 'complete') : 'upcoming'} onClick={() => setCurrentStep(2)} />
                    <Step icon={<FileText size={24}/>} title="Documents" status={currentStep >= 3 ? (currentStep === 3 ? 'current' : 'complete') : 'upcoming'} onClick={() => setCurrentStep(3)} />
                    <Step icon={<Banknote size={24}/>} title="Banking" status={currentStep >= 4 ? (currentStep === 4 ? 'current' : 'complete') : 'upcoming'} onClick={() => setCurrentStep(4)} />
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg">
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">Company Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                               <FormInput name="business_type" label="Business Type" placeholder="e.g., Private Limited" value={companyInfo.business_type} onChange={handleFormChange(setCompanyInfo)} icon={Briefcase} />

                                <div>
                                    <FormSelect name="category" label="Category" value={companyInfo.category} onChange={handleFormChange(setCompanyInfo)} icon={Info}>
                                        <option value="" disabled>Select a category</option>
                                        <option>Material</option>
                                        <option>Service</option>
                                        <option>Both</option>
                                        <option>Other</option>
                                    </FormSelect>
                                    {companyInfo.category === 'Other' && (
                                        <div className="mt-4">
                                            <FormInput name="otherCategory" label="Please Specify Category" placeholder="Your custom category" value={otherCategory} onChange={(e: any) => setOtherCategory(e.target.value)} icon={Info} />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <FormSelect name="supplier_type" label="Supplier Type" value={companyInfo.supplier_type} onChange={handleFormChange(setCompanyInfo)} icon={Info}>
                                        <option value="" disabled>Select a type</option>
                                        <option>Manufacturer</option>
                                        <option>Distributor</option>
                                        <option>Wholesaler</option>
                                        <option>Retailer</option>
                                        <option>Other</option>
                                    </FormSelect>
                                    {companyInfo.supplier_type === 'Other' && (
                                        <div className="mt-4">
                                            <FormInput name="otherSupplierType" label="Please Specify Supplier Type" placeholder="Your custom supplier type" value={otherSupplierType} onChange={(e: any) => setOtherSupplierType(e.target.value)} icon={Info} />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <FormSelect name="organization_type" label="Organization Type" value={companyInfo.organization_type} onChange={handleFormChange(setCompanyInfo)} icon={Building}>
                                        <option value="" disabled>Select a type</option>
                                        <option>Corporate</option>
                                        <option>Government</option>
                                        <option>Non-Profit</option>
                                        <option>Small Business</option>
                                        <option>Other</option>
                                    </FormSelect>
                                    {companyInfo.organization_type === 'Other' && (
                                        <div className="mt-4">
                                            <FormInput name="otherOrganizationType" label="Please Specify Organization Type" placeholder="Your custom organization type" value={otherOrganizationType} onChange={(e: any) => setOtherOrganizationType(e.target.value)} icon={Building} />
                                        </div>
                                    )}
                                </div>

                                <h3 className="md:col-span-2 font-semibold text-gray-700 mt-4 -mb-2">Head Office Address</h3>
                                <div className="md:col-span-2"><FormInput name="address_line_1" label="Street Address" placeholder="e.g., 123 Business Bay" value={companyInfo.address_line_1} onChange={handleFormChange(setCompanyInfo)} icon={MapPin} /></div>
                                <FormInput name="address_line_2" label="Address Line 2 (Optional)" placeholder="e.g., Near Landmark" value={companyInfo.address_line_2} onChange={handleFormChange(setCompanyInfo)} icon={MapPin} />
                                <FormInput name="city" label="City" placeholder="e.g., Pune" value={companyInfo.city} onChange={handleFormChange(setCompanyInfo)} icon={MapPin} />
                                <FormInput name="region" label="State / Region" placeholder="e.g., Maharashtra" value={companyInfo.region} onChange={handleFormChange(setCompanyInfo)} icon={MapPin} />
                                <FormInput name="postal_code" label="Postal / Zip Code" placeholder="e.g., 411001" value={companyInfo.postal_code} onChange={handleFormChange(setCompanyInfo)} icon={MapPin} />

                                <div className="space-y-2">
                                    <label htmlFor="country" className="text-sm font-medium text-gray-700 flex items-center gap-2"><Globe size={16}/> Country</label>
                                    <Select
                                        id="country"
                                        options={countryOptions}
                                        value={countryOptions.find(option => option.label === companyInfo.country)}
                                        onChange={(option) => setCompanyInfo(prev => ({...prev, country: option ? option.label : ''}))}
                                        formatOptionLabel={({ value, label }) => (
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <ReactCountryFlag countryCode={value} svg style={{ marginRight: '10px', width: '1.2em', height: '1.2em' }} />
                                            <span>{label}</span>
                                          </div>
                                        )}
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                backgroundColor: '#f3f4f6',
                                                borderColor: '#e5e7eb',
                                                padding: '0.35rem',
                                                borderRadius: '0.5rem'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                zIndex: 9999
                                            })
                                        }}
                                    />
                                </div>

                                <div></div>

                                <h3 className="md:col-span-2 font-semibold text-gray-700 mt-4 -mb-2">Business Details</h3>
                                <FormInput name="year_of_establishment" label="Year of Establishment" type="number" placeholder="e.g., 2010" value={companyInfo.year_of_establishment} onChange={handleFormChange(setCompanyInfo)} icon={Calendar} />
                                <FormInput name="company_size" label="Company Size" placeholder="e.g., 50-100 employees" value={companyInfo.company_size} onChange={handleFormChange(setCompanyInfo)} icon={Users} />
                                <FormInput name="operating_regions" label="Operating Regions" placeholder="e.g., Delhi, London, Dubai" value={companyInfo.operating_regions} onChange={handleFormChange(setCompanyInfo)} icon={Map} />
                                <FormInput name="website_url" label="Website URL" placeholder="e.g., https://yourcompany.com" value={companyInfo.website_url} onChange={handleFormChange(setCompanyInfo)} icon={Globe} />
                            </div>
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">Materials You Offer</h2>
                                <p className="text-sm text-gray-500 pt-4">Fill this out if you supply materials. You can add more from your profile later.</p>
                                {materials.map((material, index) => (
                                    <div key={material.id ? `mat-${material.id}` : `new-mat-${index}`} className="relative mt-6 pt-8 p-6 border rounded-lg bg-gray-50/50">
                                        {materials.length > 1 && (
                                            <button
                                                onClick={() => removeItem(index, setMaterials)}
                                                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full"
                                                aria-label="Remove Material"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormInput name="name" label="Name/Title of Material" placeholder="e.g., High-Grade Steel" value={material.name} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Package} />
                                            <FormInput name="inci_name" label="INCI Name (if applicable)" placeholder="International Nomenclature of Cosmetic Ingredients" value={material.inci_name} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Info} />
                                            <FormInput name="cas_number" label="CAS Number (if applicable)" placeholder="Chemical Abstracts Service number" value={material.cas_number} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Hash} />
                                            <FormInput name="regions_served" label="Regions Served or Shipped" placeholder="e.g., Maharashtra, Gujarat" value={material.regions_served} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Map} />
                                            <FormInput name="unit_of_measurement" label="Unit of Measurement" placeholder="e.g., kg, lt, units" value={material.unit_of_measurement} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Ruler} />
                                            <FormInput name="price_range" label="Price Range (per unit)" placeholder="e.g., 100 - 120 INR" value={material.price_range} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Tag} />
                                            <FormInput name="min_order_quantity" label="Minimum Order Quantity" placeholder="e.g., 1000 kg" value={material.min_order_quantity} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={List} />
                                            <FormInput name="inventory_info" label="Inventory/Availability" placeholder="e.g., In Stock, On-demand" value={material.inventory_info} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={Server} />
                                            <div className="md:col-span-2"><FormInput name="technical_specs" label="Technical Specifications (Optional)" placeholder="e.g., Grade, purity, dimensions" value={material.technical_specs} onChange={(e: any) => handleItemChange(index, e, setMaterials)} icon={FileText} /></div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => addItem(setMaterials, initialMaterialState)} className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                                    <PlusCircle size={16} /> Add Another Material
                                </button>
                            </div>
                            <hr />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">Services You Offer</h2>
                                <p className="text-sm text-gray-500 pt-4">Fill this out if you provide services. You can add more from your profile later.</p>
                                {services.map((service, index) => (
                                     <div key={service.id ? `srv-${service.id}` : `new-srv-${index}`} className="relative mt-6 pt-8 p-6 border rounded-lg bg-gray-50/50">
                                        {services.length > 1 && (
                                            <button
                                                onClick={() => removeItem(index, setServices)}
                                                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full"
                                                aria-label="Remove Service"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormInput name="name" label="Name/Title of Service" placeholder="e.g., Industrial Maintenance" value={service.name} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Briefcase} />
                                            <FormSelect name="service_type" label="Service Type" value={service.service_type} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Info}><option>Maintenance</option><option>Consulting</option><option>Logistics</option><option>IT Services</option></FormSelect>
                                            <FormSelect name="delivery_mode" label="Delivery Mode" value={service.delivery_mode} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Info}><option>Onsite</option><option>Remote</option><option>Hybrid</option></FormSelect>
                                            <FormSelect name="pricing_model" label="Pricing Model" value={service.pricing_model} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Tag}><option>Per hour</option><option>Fixed project</option><option>Retainer</option></FormSelect>
                                            <FormInput name="team_details" label="Team or Staff Details (Optional)" placeholder="e.g., 10 certified engineers" value={service.team_details} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Users2} />
                                            <FormInput name="existing_clients" label="Existing Clients" placeholder="e.g., Tata Motors, Reliance Industries" value={service.existing_clients} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Users} />
                                            <FormInput name="case_studies_link" label="Projects or Case Studies Link" placeholder="e.g., https://yoursite.com/casestudy" value={service.case_studies_link} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={Link2} />
                                            <FormInput name="service_sla_info" label="Service SLA's (if applicable)" placeholder="e.g., 24-hour response time" value={service.service_sla_info} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={FileClock} />
                                            <FormInput name="team_capacity" label="Team Capacity" placeholder="e.g., Can handle 5 concurrent projects" value={service.team_capacity} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={BarChart} />
                                            <div className="md:col-span-2"><FormInput name="testimonials" label="Client References or Testimonials" placeholder="e.g., 'Excellent service...' - CEO of ABC Corp" value={service.testimonials} onChange={(e: any) => handleItemChange(index, e, setServices)} icon={MessageSquare} /></div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => addItem(setServices, initialServiceState)} className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                                    <PlusCircle size={16} /> Add Another Service
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
                                <p className="text-sm text-gray-500 mt-1">These documents are required for verification.</p>
                                <div className="mt-4 space-y-4">
                                    {mandatoryDocuments.map(doc => (
                                        <DocumentUploadRow
                                            key={doc.type}
                                            doc={doc}
                                            file={filesToUpload[doc.type]}
                                            uploadedDoc={uploadedDocuments.find(d => d.doc_type === doc.type)}
                                            onFileSelect={handleFileSelect}
                                        />
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h2 className="text-xl font-semibold text-gray-800">Optional Documents</h2>
                                <p className="text-sm text-gray-500 mt-1">Providing these documents can increase your profile strength.</p>
                                <div className="mt-4 space-y-4">
                                    {optionalDocuments.map(doc => (
                                        <DocumentUploadRow
                                            key={doc.type}
                                            doc={doc}
                                            file={filesToUpload[doc.type]}
                                            uploadedDoc={uploadedDocuments.find(d => d.doc_type === doc.type)}
                                            onFileSelect={handleFileSelect}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-4">Banking Information</h2>
                            <p className="text-gray-600 pt-4">This information is kept secure and is only used for processing payments.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div className="md:col-span-2"><FormInput name="account_holder_name" label="Account Holder Name" placeholder="Must match company legal name" value={bankInfo.account_holder_name} onChange={handleFormChange(setBankInfo)} icon={User} /></div>
                                <FormInput name="bank_name" label="Bank Name" placeholder="e.g., State Bank of India" value={bankInfo.bank_name} onChange={handleFormChange(setBankInfo)} icon={Building} />
                                <FormInput name="account_number" label="Bank Account Number" placeholder="Enter your bank account number" value={bankInfo.account_number} onChange={handleFormChange(setBankInfo)} icon={Hash} />
                                <FormInput name="ifsc_swift_code" label="IFSC / SWIFT Code" placeholder="e.g., SBIN0000300" value={bankInfo.ifsc_swift_code} onChange={handleFormChange(setBankInfo)} icon={Info} />
                                <FormInput name="branch_name" label="Branch Name" placeholder="e.g., Pune Main Branch" value={bankInfo.branch_name} onChange={handleFormChange(setBankInfo)} icon={Landmark} />

                                <h3 className="md:col-span-2 font-semibold text-gray-700 mt-4 -mb-2">Annual Turnover (Last 3 Years)</h3>
                                <FormInput name="turnover_year_1" label={`Turnover for ${new Date().getFullYear() - 1}`} placeholder="e.g., 5000000" type="number" value={bankInfo.turnover_year_1} onChange={handleFormChange(setBankInfo)} icon={Tag} />
                                <FormInput name="turnover_year_2" label={`Turnover for ${new Date().getFullYear() - 2}`} placeholder="e.g., 4500000" type="number" value={bankInfo.turnover_year_2} onChange={handleFormChange(setBankInfo)} icon={Tag} />
                                <FormInput name="turnover_year_3" label={`Turnover for ${new Date().getFullYear() - 3}`} placeholder="e.g., 4000000" type="number" value={bankInfo.turnover_year_3} onChange={handleFormChange(setBankInfo)} icon={Tag} />
                            </div>
                        </div>
                     )}

                    {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

                    <div className="mt-8 flex justify-end">
                        <button onClick={handleSaveStep} disabled={saving} className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-all font-medium">
                            {saving ? <LoaderIcon className="animate-spin" size={20} /> : (currentStep === 4 ? 'Finish & Submit' : 'Save & Continue')}
                            {!saving && currentStep < 4 && <ArrowRight size={20}/>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- NEW HELPER COMPONENT FOR DOCUMENT ROWS ---
const DocumentUploadRow = ({ doc, file, uploadedDoc, onFileSelect }: { doc: DocumentDefinition, file: File | undefined, uploadedDoc: UploadedDocument | undefined, onFileSelect: (docType: string, file: File | null) => void }) => {
    const isUploaded = uploadedDoc && !file;

    return (
        <div className="p-4 border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow">
                <h4 className="font-semibold text-gray-800">{doc.label}</h4>
                <p className="text-sm text-gray-500">{doc.description}</p>
            </div>
            <div className="flex-shrink-0 w-full sm:w-auto">
                {isUploaded ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium text-sm p-2 rounded-md bg-green-50">
                        <CheckCircle size={18} />
                        <span>Uploaded</span>
                    </div>
                ) : file ? (
                    <div className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-blue-50">
                        <span className="text-blue-700 truncate max-w-xs">{file.name}</span>
                        <button onClick={() => onFileSelect(doc.type, null)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                ) : (
                    <label htmlFor={doc.type} className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <Upload size={16} />
                        <span>Upload File</span>
                        <input id={doc.type} type="file" className="sr-only" onChange={(e) => onFileSelect(doc.type, e.target.files ? e.target.files[0] : null)} />
                    </label>
                )}
            </div>
        </div>
    );
};

export default EnhanceProfile;