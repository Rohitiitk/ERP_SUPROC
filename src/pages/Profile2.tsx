import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { User as AuthUser } from '@supabase/supabase-js';
import { 
    User, Mail, Phone, Globe, Edit, Save, X, Building, MapPin, Briefcase, 
    Bell, Shield, Key, Clock, Package, FileText, CheckCircle, XCircle, Star, 
    Edit3, ListChecks, Info
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import Avatar from '../components/Avatar';

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
    success: { Icon: CheckCircle, color: 'text-green-500', button: 'bg-green-600 hover:bg-green-700' },
    error: { Icon: XCircle, color: 'text-red-500', button: 'bg-red-600 hover:bg-red-700' },
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


// --- Data Interfaces ---
interface ProfileData { id: string; full_name: string; website: string; role: 'simple' | 'supplier'; avatar_url: string | null; }
interface SupplierInfo { id: number; company_legal_name: string; location: string; company_url: string; phone_number: string; description: string; profile_status: 'basic' | 'enhanced' | 'verified'; profile_completeness_score: number; }
interface Activity { id: number; type: string; title: string; date: string; status: string; link: string; }

const Profile = () => {
  // --- State Management ---
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'activity'>('profile');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [supplierInfo, setSupplierInfo] = useState<SupplierInfo | null>(null);
  const [formData, setFormData] = useState({ fullName: '', website: '', companyLegalName: '', location: '', companyUrl: '', phoneNumber: '', description: '' });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const navigate = useNavigate();

  // --- Data Fetching ---
  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setAuthUser(user);

      const { data: profileData, error: profileError } = await supabase.from('profiles').select(`id, full_name, website, role, avatar_url`).eq('id', user.id).single();
      if (profileError) throw profileError;
      setProfile(profileData);

      const newFormData = { fullName: profileData.full_name || '', website: profileData.website || '', companyLegalName: '', location: '', companyUrl: '', phoneNumber: '', description: '' };
      
      let supplierDataForActivity = null;

      if (profileData.role === 'supplier') {
          const { data: supplierData, error: supplierError } = await supabase.from('suppliers').select(`id, company_legal_name, location, company_url, phone_number, description, profile_status, profile_completeness_score`).eq('user_id', user.id).single();
          if (supplierError && supplierError.code !== 'PGRST116') throw supplierError;
          if (supplierData) {
            setSupplierInfo(supplierData);
            supplierDataForActivity = supplierData;
            newFormData.companyLegalName = supplierData.company_legal_name || '';
            newFormData.location = supplierData.location || '';
            newFormData.companyUrl = supplierData.company_url || '';
            newFormData.phoneNumber = supplierData.phone_number || '';
            newFormData.description = supplierData.description || '';
          }
      }
      setFormData(newFormData);

      // --- Fetch real activity ---
      let combinedActivities: Activity[] = [];
      const { data: createdProjects } = await supabase.from('sourcing_projects').select('id, title, created_at, status, type').eq('creator_user_id', user.id);
      if (createdProjects) {
        const projectActivities: Activity[] = createdProjects.map(p => ({ id: p.id, type: `Project (${p.type})`, title: p.title, date: p.created_at, status: p.status, link: `/my-projects/${p.id}/bids` }));
        combinedActivities.push(...projectActivities);
      }
      if (profileData.role === 'supplier' && supplierDataForActivity) {
        const { data: submittedBids } = await supabase.from('project_bids').select('id, created_at, status, sourcing_projects(id, title)').eq('supplier_id', supplierDataForActivity.id);
        
        if (submittedBids) {
          const bidActivities: Activity[] = submittedBids
            // --- FIX IS HERE ---
            .map(b => {
              // Normalize the sourcing_projects property to always be an object or null
              const project = Array.isArray(b.sourcing_projects) ? b.sourcing_projects[0] : b.sourcing_projects;
              return { ...b, sourcing_projects: project };
            })
            .filter(b => b.sourcing_projects) // Filter out bids where project is null
            .map(b => ({ 
              id: b.id, 
              type: 'Bid', 
              title: `Bid on: ${b.sourcing_projects!.title}`, 
              date: b.created_at, 
              status: b.status, 
              link: `/bidding/${b.sourcing_projects!.id}` 
            }));
          combinedActivities.push(...bidActivities);
        }
      }
      combinedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(combinedActivities);

    } catch (error) { console.error('Error fetching profile:', error); } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);

  // --- Handlers ---
  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!authUser) return;
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('You must select an image to upload.');
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (error) throw error;
      await supabase.from('profiles').update({ avatar_url: fileName }).eq('id', authUser.id);
      setProfile(prev => prev ? { ...prev, avatar_url: fileName } : null);
    } catch (error: any) {
      setModalInfo({ title: "Upload Error", message: `Error uploading avatar: ${error.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    try {
        await supabase.from('profiles').update({ full_name: formData.fullName, website: formData.website }).eq('id', profile.id);
        if (profile.role === 'supplier') {
            await supabase.from('suppliers').update({ company_legal_name: formData.companyLegalName, location: formData.location, company_url: formData.companyUrl, phone_number: formData.phoneNumber, description: formData.description }).eq('user_id', profile.id);
        }
        await fetchProfileData();
        setIsEditing(false);
        setModalInfo({ title: "Success!", message: "Your profile has been updated successfully.", type: "success" });
    } catch (error: any) {
        setModalInfo({ title: "Update Failed", message: `Failed to update profile: ${error.message}`, type: "error" });
    } finally {
        setLoading(false);
    }
  };
  
  const handleCancelEdit = () => setIsEditing(false);

  const handlePasswordReset = async () => {
    if (authUser?.email) {
      const { error } = await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) {
        setModalInfo({ title: "Error", message: `Failed to send reset link: ${error.message}`, type: 'error' });
      } else {
        setModalInfo({ title: "Check Your Email", message: "A password reset link has been sent to your email address.", type: 'info' });
      }
    }
  };

  const handleFeatureComingSoon = () => {
    setModalInfo({ title: "Feature Coming Soon", message: "This functionality will be available in a future update. We appreciate your patience!", type: 'info' });
  };

  // --- Render Logic ---
  if (loading && !profile) return <div className="flex items-center justify-center h-screen"><Loader /></div>;
  if (!profile || !authUser) return <div className="flex items-center justify-center h-screen">Could not load profile.</div>;

  const TABS = profile.role === 'supplier' ? ['profile', 'settings', 'activity'] : ['profile', 'settings'];
  const rating = supplierInfo ? Math.ceil((supplierInfo.profile_completeness_score || 0) / 20) : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <InfoModal title={modalInfo?.title || ''} message={modalInfo?.message || null} onClose={() => setModalInfo(null)} type={modalInfo?.type} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
            <div className="p-6 bg-white rounded-xl shadow-sm flex items-center gap-4"><Avatar url={profile.avatar_url} size={80} onUpload={uploadAvatar} uploading={uploading} /><div><h1 className="text-xl font-bold text-gray-900">{profile.full_name}</h1><p className="text-gray-600 capitalize">{profile.role} User</p>{profile.role === 'supplier' && ( <div className="flex items-center mt-2" title={`${rating} out of 5`}> {[...Array(5)].map((_, i) => <Star key={i} size={16} className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} />)} </div> )}</div></div>
            {profile.role === 'supplier' && <ProfileActionsCard />}
            {profile.role === 'supplier' && <ProfileCompletionCard supplierInfo={supplierInfo} navigate={navigate} />}
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
            <div className="flex justify-between items-center border-b p-6">
                <div className="flex">
                    {TABS.map((tab) => ( <button key={tab} className={`px-4 py-2 font-medium capitalize text-sm sm:text-base ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'}`} onClick={() => setActiveTab(tab as any)}> {tab} </button> ))}
                </div>
                {activeTab === 'profile' && !isEditing && ( <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"><Edit size={16} /> Edit</button> )}
            </div>
            <div className="p-6">
                {activeTab === 'profile' && (
                    <div>
                        {isEditing && (
                            <div className="flex justify-end gap-2 mb-6">
                                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Save size={16} /> Save</button>
                                <button onClick={handleCancelEdit} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"><X size={16} /> Cancel</button>
                            </div>
                        )}
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-semibold mb-2">Personal Information</h3>
                                    <div className="flex items-start gap-3"><User className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Full Name</p>{isEditing ? <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full p-1 -ml-1 bg-gray-50 rounded-md"/> : <p className="font-medium">{profile.full_name}</p>}</div></div>
                                    <div className="flex items-start gap-3"><Mail className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Email</p><p className="font-medium text-gray-500">{authUser.email}</p></div></div>
                                    <div className="flex items-start gap-3"><Globe className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Website</p>{isEditing ? <input type="text" name="website" value={formData.website} onChange={handleInputChange} className="w-full p-1 -ml-1 bg-gray-50 rounded-md"/> : <p className="font-medium">{profile.website || 'Not provided'}</p>}</div></div>
                                </div>
                                {profile.role === 'supplier' && supplierInfo ? (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold mb-2">Company Information</h3>
                                        <div className="flex items-start gap-3"><Building className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Company</p>{isEditing ? <input type="text" name="companyLegalName" value={formData.companyLegalName} onChange={handleInputChange} className="w-full p-1 -ml-1 bg-gray-50 rounded-md"/> : <p className="font-medium">{supplierInfo.company_legal_name}</p>}</div></div>
                                        <div className="flex items-start gap-3"><MapPin className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Location</p>{isEditing ? <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full p-1 -ml-1 bg-gray-50 rounded-md"/> : <p className="font-medium">{supplierInfo.location}</p>}</div></div>
                                        <div className="flex items-start gap-3"><Phone className="mt-1 text-gray-400" size={20} /><div><p className="text-sm text-gray-500">Phone</p>{isEditing ? <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full p-1 -ml-1 bg-gray-50 rounded-md"/> : <p className="font-medium">{supplierInfo.phone_number || 'Not provided'}</p>}</div></div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold mb-2">Account Actions</h3>
                                        <Link to="/supplier-registration" className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline"><Briefcase size={20} />Register as a Supplier</Link>
                                    </div>
                                )}
                            </div>
                            {profile.role === 'supplier' && supplierInfo && (
                                <div className="space-y-2 pt-6 border-t">
                                    <h3 className="font-semibold mb-2">Business Description</h3>
                                    <div className="flex items-start gap-3"><FileText className="mt-1 text-gray-400 flex-shrink-0" size={20} /><div>{isEditing ? ( <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full p-2 bg-gray-50 rounded-md text-sm"/> ) : ( <p className="font-medium text-gray-700">{supplierInfo.description || 'Not provided'}</p> )}</div></div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'settings' && (
                    <div className="max-w-md space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3"><Bell className="text-gray-400" size={20} /><div><p className="font-medium">Email Notifications</p><p className="text-sm text-gray-500">Receive email updates</p></div></div>
                                <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.preventDefault()}><input type="checkbox" className="sr-only peer" checked={false} onChange={handleFeatureComingSoon} /><div className="w-11 h-6 bg-gray-200 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3"><Shield className="text-gray-400" size={20} /><div><p className="font-medium">Two-Factor Authentication</p><p className="text-sm text-gray-500">Add extra security</p></div></div>
                                    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.preventDefault()}><input type="checkbox" className="sr-only peer" checked={false} onChange={handleFeatureComingSoon} /><div className="w-11 h-6 bg-gray-200 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label>
                                </div>
                                <button onClick={handlePasswordReset} className="flex items-center gap-2 text-blue-600 font-medium hover:underline"><Key size={16} />Change Password</button>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'activity' && (
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                        <div className="space-y-4">
                            {activities.length > 0 ? activities.map((activity) => (
                                <Link to={activity.link} key={`${activity.type}-${activity.id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="p-2 bg-white rounded-full flex-shrink-0">{getActivityIcon(activity.type)}</div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{activity.title}</p>
                                            <p className="text-sm text-gray-500">{activity.type} • {new Date(activity.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 ml-4">
                                        {getStatusIcon(activity.status)}
                                    </div>
                                </Link>
                            )) : (
                                <p className="text-gray-500 text-sm text-center py-8">No recent activity found.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': case 'awarded': case 'bidding_open': case 'sourcing':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'pending': case 'submitted':
        return <Clock className="text-yellow-500" size={20} />;
      case 'rejected': case 'bidding_closed':
        return <XCircle className="text-red-500" size={20} />;
      default: return null;
    }
};

const getActivityIcon = (type: string) => {
    if (type.includes('RFQ')) return <Package className="text-blue-500" size={20} />;
    if (type.includes('RFP')) return <FileText className="text-indigo-500" size={20} />;
    if (type.includes('Bid')) return <FileText className="text-purple-500" size={20} />;
    return null;
};

const ProfileCompletionCard = ({ supplierInfo, navigate }: { supplierInfo: SupplierInfo | null, navigate: (path: string) => void }) => {
    if (!supplierInfo) return null;
    const score = supplierInfo.profile_completeness_score || 0;
    const isBasic = score < 85;
    return (
        <div className="p-6 rounded-xl bg-blue-50 border border-blue-200">
            <h3 className="font-bold text-lg text-gray-800 mb-3">Profile Strength</h3>
            <div className="flex items-center gap-4 mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${score}%` }}></div></div>
                <span className="font-bold text-blue-600">{score}%</span>
            </div>
            {isBasic ? (
                <div>
                    <p className="text-sm text-gray-600 mb-4">Your profile is incomplete. Add more details to <b>attract more opportunities.</b></p>
                    <button onClick={() => navigate('/enhance-profile')} className="w-full flex items-center justify-center gap-2 px-4 py-2 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                        <Star size={16} /> Enhance Your Profile
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500" />
                    <p className="text-sm text-gray-700 font-medium">Your profile is fully enhanced and visible.</p>
                </div>
            )}
        </div>
    );
};

const ProfileActionsCard = () => (
    <div className="p-6 bg-white rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Profile Actions</h3>
        <div className="space-y-4">
            <Link to="/supplier-registration" className="flex items-center gap-3 text-blue-600 hover:text-blue-800 font-medium transition-colors">
                <Edit3 size={18} />
                <span>Update Registration Details</span>
            </Link>
            <Link to="/enhance-profile" className="flex items-center gap-3 text-blue-600 hover:text-blue-800 font-medium transition-colors">
                <ListChecks size={18} />
                <span>Update Company & Offering Details</span>
            </Link>
        </div>
    </div>
);

export default Profile;