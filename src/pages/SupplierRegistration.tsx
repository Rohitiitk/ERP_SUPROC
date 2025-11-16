import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Info,
  Building,
  Hash,
  Link as LinkIcon,
  MapPin,
  Briefcase,
  Phone as PhoneIcon,
  FileText,
  Mail,
  Loader2,
  CheckCircle
} from 'lucide-react';

import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import '../index.css';

// --- Reusable Tooltip Component ---
const Tooltip = ({ text }: { text: string }) => (
  <div className="relative flex items-center group">
    <Info className="w-4 h-4 text-gray-400 cursor-pointer" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
      {text}
    </div>
  </div>
);

// --- Reusable Form Label with Tooltip ---
const FormLabelWithTooltip = ({
  htmlFor,
  label,
  tooltipText
}: {
  htmlFor: string;
  label: string;
  tooltipText: string;
}) => (
  <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium text-gray-700">
    {label}
    <Tooltip text={tooltipText} />
  </label>
);

// Success Modal Component
const SuccessModal = ({ message }: { message: string }) => (
  <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center backdrop-blur-sm">
    <div className="bg-white text-gray-800 rounded-2xl shadow-2xl p-8 max-w-xs w-full text-center transform transition-all animate-fade-in-up">
      <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
      <h2 className="text-lg font-medium text-gray-700">{message}</h2>
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

const SupplierRegistration = () => {
  const [formData, setFormData] = useState({
    companyLegalName: '',
    businessRegistrationNumber: '',
    companyUrl: '',
    location: '',
    organizationType: '',
    description: '',
    contact_email: ''
  });
  const [otherOrganizationType, setOtherOrganizationType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>('');
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSupplierData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        navigate('/login');
        return;
      }

      const { data: supplierData, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (supplierData) {
        setFormData({
          companyLegalName: supplierData.company_legal_name || '',
          businessRegistrationNumber: supplierData.business_registration_number || '',
          companyUrl: supplierData.company_url || '',
          location: supplierData.location || '',
          organizationType: supplierData.organization_type || '',
          description: supplierData.description || '',
          contact_email: supplierData.contact_email || ''
        });
        setPhoneNumber(supplierData.phone_number || '');

        if (supplierData.company_logo_url) {
          try {
            const { data, error: downloadError } = await supabase.storage
              .from('company-logos')
              .download(supplierData.company_logo_url);
            if (downloadError) throw downloadError;
            setLogoPreview(URL.createObjectURL(data));
          } catch (err) {
            console.error('Error downloading logo:', err);
          }
        }

        const standardTypes = ['Manufacturer', 'Distributor', 'Wholesaler', 'Service Provider'];
        if (supplierData.organization_type && !standardTypes.includes(supplierData.organization_type)) {
          setFormData((prev) => ({ ...prev, organizationType: 'Other' }));
          setOtherOrganizationType(supplierData.organization_type);
        }
      }

      if (error && (error as any).code !== 'PGRST116') {
        setError('Could not fetch your supplier data.');
      }
      setLoading(false);
    };

    fetchSupplierData();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setCompanyLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      !formData.companyLegalName ||
      !formData.businessRegistrationNumber ||
      !formData.description ||
      !formData.contact_email
    ) {
      setError('Please fill out all required fields.');
      return;
    }

    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setSaving(true);

    try {
      // Ensure we have a logged-in user/session before any writes (RLS relies on this)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      // (Optional but robust) ensure session is actually present
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error('No active session.');

      let logoPathToSave: string | null = null;

      if (companyLogoFile) {
        const fileExt = companyLogoFile.name.split('.').pop();
        const filePath = `${user.id}/logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, companyLogoFile, { upsert: true });
        if (uploadError) throw uploadError;

        logoPathToSave = filePath;
      }

      const organizationTypeToSave =
        formData.organizationType === 'Other' ? otherOrganizationType : formData.organizationType;

      const upsertData: Record<string, any> = {
        user_id: user.id,
        company_legal_name: formData.companyLegalName,
        business_registration_number: formData.businessRegistrationNumber,
        company_url: formData.companyUrl,
        location: formData.location,
        organization_type: organizationTypeToSave,
        phone_number: phoneNumber,
        description: formData.description,
        contact_email: formData.contact_email
      };

      if (logoPathToSave) {
        upsertData.company_logo_url = logoPathToSave;
      }

      // IMPORTANT: set/ensure profile role *before* suppliers upsert (prevents role-gated RLS from biting)
      await supabase
        .from('profiles')
        .upsert(
          { id: user.id, role: 'supplier' }, // keep/upgrade role to supplier
          { onConflict: 'id', returning: 'minimal' }
        );

      // Upsert supplier record; avoid implicit SELECT with returning: 'minimal'
      const { error: upsertError } = await supabase
        .from('suppliers')
        .upsert(upsertData, { onConflict: 'user_id', returning: 'minimal' });

      if (upsertError) throw upsertError;

      setShowSuccessModal(true);
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (err: any) {
      console.error('Supplier registration error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      {showSuccessModal && <SuccessModal message="Information Saved!" />}
      <div className="w-full max-w-2xl p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-800">Supplier Information</h2>
        <p className="text-center text-gray-600">Keep your business details up to date.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg flex items-center justify-center bg-gray-100 shrink-0 border">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <Building className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Upload Logo
                  <input
                    id="logo-upload"
                    name="logo-upload"
                    type="file"
                    className="sr-only"
                    accept="image/png, image/jpeg"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="companyLegalName"
                label="Company Legal Name *"
                tooltipText="The official name of your company as registered with the government."
              />
              <div className="relative">
                <Building
                  className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  id="companyLegalName"
                  name="companyLegalName"
                  type="text"
                  required
                  value={formData.companyLegalName}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., Acme Corp"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="businessRegistrationNumber"
                label="Business Reg. No. *"
                tooltipText="Your company's official registration number (e.g., CIN, GSTIN)."
              />
              <div className="relative">
                <Hash className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="businessRegistrationNumber"
                  name="businessRegistrationNumber"
                  type="text"
                  required
                  value={formData.businessRegistrationNumber}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., 123456789"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="contact_email"
                label="Contact Email *"
                tooltipText="The primary email address for business inquiries."
              />
              <div className="relative">
                <Mail className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  required
                  value={formData.contact_email}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., contact@acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="companyUrl"
                label="Company Website"
                tooltipText="The official URL of your company's website."
              />
              <div className="relative">
                <LinkIcon className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="companyUrl"
                  name="companyUrl"
                  type="url"
                  value={formData.companyUrl}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., https://acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="location"
                label="Location"
                tooltipText="The city and country where your business is located."
              />
              <div className="relative">
                <MapPin className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., Pune, India"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="phoneNumber"
                label="Phone Number"
                tooltipText="Your primary business contact number, including the country code."
              />
              <div className="relative bg-gray-100 border border-gray-200 rounded-lg flex items-center px-3">
                <PhoneIcon className="text-gray-400" size={20} />
                <PhoneInput
                  international
                  defaultCountry="IN"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  className="phone-input-custom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="organizationType"
                label="Organization Type"
                tooltipText="Select the option that best describes your business."
              />
              <div className="relative">
                <Briefcase className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <select
                  id="organizationType"
                  name="organizationType"
                  value={formData.organizationType}
                  onChange={handleChange}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg appearance-none"
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="Manufacturer">Manufacturer</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Wholesaler">Wholesaler</option>
                  <option value="Service Provider">Service Provider</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {formData.organizationType === 'Other' && (
              <div className="space-y-2">
                <FormLabelWithTooltip
                  htmlFor="otherOrganizationType"
                  label="Please Specify"
                  tooltipText="Enter your specific organization type here."
                />
                <div className="relative">
                  <Info className="absolute z-10 left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="otherOrganizationType"
                    name="otherOrganizationType"
                    type="text"
                    required
                    value={otherOrganizationType}
                    onChange={(e) => setOtherOrganizationType(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                    placeholder="Your organization type"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <FormLabelWithTooltip
                htmlFor="description"
                label="Business Description *"
                tooltipText="A brief summary of your company's products or services."
              />
              <div className="relative">
                <FileText className="absolute z-10 left-3 top-4 text-gray-400" size={20} />
                <textarea
                  id="description"
                  name="description"
                  required
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full py-3 pl-10 pr-4 text-gray-700 bg-gray-100 border rounded-lg"
                  placeholder="e.g., We are a leading manufacturer of high-quality industrial parts..."
                ></textarea>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-center text-red-500 pt-4">{error}</p>}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex justify-center items-center h-12 px-6 border border-transparent text-sm font-medium rounded-lg text-white bg-[#1A2C4A] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-all"
            >
              {saving ? <Loader2 className="animate-spin" /> : 'Save Information'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierRegistration;
