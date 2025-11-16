import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import Loader from '../components/Loader';
import SphereImageGrid, { ImageData } from '../components/SphereImageGrid';
import {
    Building, MapPin, Globe, Search, X as XIcon, Star, Calendar, Users, Package, Server, Mail, Phone,
    Briefcase, Tag, FileText, CheckCircle, Clock, ShieldQuestion, SlidersHorizontal,
    DollarSign, Hash, Thermometer, Truck, Archive, Book, Shield, Users2, MessageSquare, Award
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
interface DiscoveredBusiness {
  id: number;
  search_term: string;
  country: string;
  results: Array<{
    name: string;
    url: string;
    email?: string;
    phone?: string;
    summary?: string;
  }>;
  created_at: string;
}

interface SupLinkDiscovered {
  id: number;
  company_name: string;
  favicon_url: string;
  website_url: string;
  description?: string;
  created_at: string;
  search_query?: string;
  search_country?: string;
  location?: string;
  email?: string;
  phone?: string;
  overall_score?: number;
  star_rating?: number;
  certifications?: string[];
  b2b_platform_verified?: boolean;
  b2b_platform_name?: string;
  founded_year?: number;
  score_analysis?: string;
  products?: string[];
  services?: string[];
  address?: string;
  social_media?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
}

// --- FILTER MODAL COMPONENT ---
const FilterModal = ({
    isOpen,
    onClose,
    onApply,
    onClear,
    initialFilters,
    options
}: {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { category: string; supplierType: string; location: string }) => void;
    onClear: () => void;
    initialFilters: { category: string; supplierType: string; location: string };
    options: { categories: string[]; supplierTypes: string[]; locations: string[] };
}) => {
    const [tempFilters, setTempFilters] = useState(initialFilters);

    useEffect(() => {
        if (isOpen) {
            setTempFilters(initialFilters);
        }
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handleApplyClick = () => {
        onApply(tempFilters);
        onClose();
    };
    
    const handleClearClick = () => {
        onClear();
        onClose();
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTempFilters(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Filters</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                        <select name="category" value={tempFilters.category} onChange={handleSelectChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">All Categories</option>
                            {options.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Supplier Type</label>
                        <select name="supplierType" value={tempFilters.supplierType} onChange={handleSelectChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">All Supplier Types</option>
                            {options.supplierTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                        <select name="location" value={tempFilters.location} onChange={handleSelectChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">All Locations</option>
                            {options.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <button onClick={handleClearClick} className="w-full px-4 py-2 font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Clear</button>
                    <button onClick={handleApplyClick} className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Apply Filters</button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const SupLinks = () => {
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- Filter States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplierType, setSelectedSupplierType] = useState('');

  const [selectedProfile, setSelectedProfile] = useState<SupplierProfile | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // --- View Toggle State (Suplinks / Discovered) ---
  const [activeView, setActiveView] = useState<'suplinks' | 'discovered'>('suplinks');
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<DiscoveredBusiness[]>([]);
  const [discoveredLoading, setDiscoveredLoading] = useState(false);
  const [supLinkDiscovered, setSupLinkDiscovered] = useState<SupLinkDiscovered[]>([]);
  const [selectedDiscoveredSupplier, setSelectedDiscoveredSupplier] = useState<SupLinkDiscovered | null>(null);

  // --- Discovered View Search & Filter States ---
  const [discoveredSearchTerm, setDiscoveredSearchTerm] = useState('');
  const [discoveredSearchType, setDiscoveredSearchType] = useState<'product' | 'supplier'>('supplier');
  const [discoveredFilterCountry, setDiscoveredFilterCountry] = useState('');
  const [discoveredFilterMinScore, setDiscoveredFilterMinScore] = useState(0);
  const [discoveredFilterCertified, setDiscoveredFilterCertified] = useState<boolean | null>(null);
  const [discoveredFilterB2B, setDiscoveredFilterB2B] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };

    const fetchSuppliers = async () => {
      setLoading(true);
      setError(null);
      try {
        // --- UPDATED QUERY ---
        const { data, error } = await supabase
          .from('suppliers')
          .select(`
            *,
            suppliers_materials ( * ),
            suppliers_services ( * ),
            suppliers_documents ( doc_type, status, file_path, rejection_reason )
          `);

        if (error) throw error;

        if (data) {
          const fetchedData = data as FetchedSupplier[];
          const mappedProfiles = fetchedData.map(supplier => ({
            ...supplier,
            rating: Math.ceil((supplier.profile_completeness_score || 0) / 20),
            materials: supplier.suppliers_materials || [],
            services: supplier.suppliers_services || [],
            documents: supplier.suppliers_documents || [],
          })).filter((p): p is SupplierProfile => !!p.company_legal_name);

          setProfiles(mappedProfiles);
        }
      } catch (err: any) {
        setError('Failed to fetch supplier data. Please try again later.');
        console.error('Error fetching suppliers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
    fetchSuppliers();
  }, []);

  // --- Fetch Discovered Businesses when view is 'discovered' ---
  useEffect(() => {
    const fetchDiscoveredData = async () => {
      if (activeView !== 'discovered') return;

      setDiscoveredLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user found - cannot fetch discovered suppliers');
          return;
        }

        console.log(`[FETCH] Fetching ALL suplink_discovered suppliers (public view)`);

        // Fetch from suplink_discovered table - NO USER FILTER (show all suppliers to everyone)
        const { data, error } = await supabase
          .from('suplink_discovered')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching suplink_discovered:', error);
          throw error;
        }

        if (data) {
          console.log(`[SUCCESS] Fetched ${data.length} suppliers from suplink_discovered table (public view)`);
          setSupLinkDiscovered(data as SupLinkDiscovered[]);
        } else {
          console.log('[INFO] No discovered suppliers found');
          setSupLinkDiscovered([]);
        }
      } catch (err: any) {
        console.error('Error fetching suplink discovered data:', err);
        setSupLinkDiscovered([]);
      } finally {
        setDiscoveredLoading(false);
      }
    };

    fetchDiscoveredData();
  }, [activeView]);

  // --- Memoized lists for filter dropdowns ---
  const locations = useMemo(() => [...new Set(profiles.map(p => p.location).filter((l): l is string => !!l))], [profiles]);
  const categories = useMemo(() => [...new Set(profiles.map(p => p.category).filter((c): c is string => !!c))], [profiles]);
  const supplierTypes = useMemo(() => [...new Set(profiles.map(p => p.supplier_type).filter((st): st is string => !!st))], [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(profile => {
      const term = searchTerm.toLowerCase();
      return (
        profile.company_legal_name?.toLowerCase().includes(term) &&
        (selectedLocation ? profile.location === selectedLocation : true) &&
        (selectedCategory ? profile.category === selectedCategory : true) &&
        (selectedSupplierType ? profile.supplier_type === selectedSupplierType : true)
      );
    });
  }, [profiles, searchTerm, selectedLocation, selectedCategory, selectedSupplierType]);

  const displayProfiles = filteredProfiles.filter(p => p.user_id !== currentUserId);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedLocation('');
    setSelectedCategory('');
    setSelectedSupplierType('');
  };

  const handleApplyFilters = (newFilters: { category: string; supplierType: string; location: string }) => {
    setSelectedCategory(newFilters.category);
    setSelectedSupplierType(newFilters.supplierType);
    setSelectedLocation(newFilters.location);
  };
  
  const handleCardClick = (profile: SupplierProfile) => {
    setSelectedProfile(profile);
  };

  const hasActiveFilters = !!selectedCategory || !!selectedLocation || !!selectedSupplierType;

  // --- Filter discovered suppliers based on search and filters ---
  const filteredDiscovered = useMemo(() => {
    // First, filter based on search and filter criteria
    const filtered = supLinkDiscovered.filter(link => {
      // Search filter
      if (discoveredSearchTerm) {
        const searchLower = discoveredSearchTerm.toLowerCase();
        if (discoveredSearchType === 'supplier') {
          // Search by supplier name
          if (!link.company_name?.toLowerCase().includes(searchLower)) {
            return false;
          }
        } else {
          // Search by product (search_query)
          if (!link.search_query?.toLowerCase().includes(searchLower)) {
            return false;
          }
        }
      }

      // Country filter
      if (discoveredFilterCountry && link.search_country !== discoveredFilterCountry) {
        return false;
      }

      // Score filter
      if (discoveredFilterMinScore > 0 && (link.overall_score || 0) < discoveredFilterMinScore) {
        return false;
      }

      // Certified filter
      if (discoveredFilterCertified !== null) {
        const hasCerts = link.certifications && link.certifications.length > 0;
        if (discoveredFilterCertified && !hasCerts) return false;
        if (!discoveredFilterCertified && hasCerts) return false;
      }

      // B2B Platform filter
      if (discoveredFilterB2B !== null && link.b2b_platform_verified !== discoveredFilterB2B) {
        return false;
      }

      return true;
    });

    // Remove duplicates by website URL (keep the one with highest score)
    const uniqueMap = new Map<string, SupLinkDiscovered>();

    filtered.forEach(link => {
      const url = link.website_url;
      const existing = uniqueMap.get(url);

      if (!existing) {
        // First occurrence, add it
        uniqueMap.set(url, link);
      } else {
        // Keep the one with higher score, or newer date if scores are equal
        const existingScore = existing.overall_score || 0;
        const linkScore = link.overall_score || 0;

        if (linkScore > existingScore) {
          uniqueMap.set(url, link);
        } else if (linkScore === existingScore) {
          // If scores are equal, keep the newer one
          const existingDate = new Date(existing.created_at).getTime();
          const linkDate = new Date(link.created_at).getTime();
          if (linkDate > existingDate) {
            uniqueMap.set(url, link);
          }
        }
      }
    });

    // Sort: analyzed suppliers (with scores) first, then unanalyzed
    const uniqueSuppliers = Array.from(uniqueMap.values());

    return uniqueSuppliers.sort((a, b) => {
      const aHasScore = a.overall_score !== null && a.overall_score !== undefined;
      const bHasScore = b.overall_score !== null && b.overall_score !== undefined;

      // If both have scores or both don't have scores, sort by score (higher first)
      if (aHasScore && bHasScore) {
        return (b.overall_score || 0) - (a.overall_score || 0);
      }
      if (!aHasScore && !bHasScore) {
        return 0; // Keep original order for unanalyzed
      }

      // Analyzed (with score) comes before unanalyzed (without score)
      return aHasScore ? -1 : 1;
    });
  }, [supLinkDiscovered, discoveredSearchTerm, discoveredSearchType, discoveredFilterCountry, discoveredFilterMinScore, discoveredFilterCertified, discoveredFilterB2B]);

  // Get unique countries for filter dropdown
  const discoveredCountries = useMemo(() => {
    const countries = new Set<string>();
    supLinkDiscovered.forEach(link => {
      if (link.search_country) countries.add(link.search_country);
    });
    return Array.from(countries).sort();
  }, [supLinkDiscovered]);

  // Check if any discovered filters are active
  const hasActiveDiscoveredFilters = discoveredFilterCountry || discoveredFilterMinScore > 0 ||
    discoveredFilterCertified !== null || discoveredFilterB2B !== null;

  // --- Helper function to convert filtered discovered to ImageData format ---
  const convertToImageData = (): ImageData[] => {
    const imageDataArray: ImageData[] = [];
    const seenFavicons = new Set<string>(); // Track unique favicon URLs

    // Convert each filtered discovered entry to ImageData format
    for (const link of filteredDiscovered) {
      // Use the favicon_url directly from the database, but only add unique ones
      if (link.favicon_url && !seenFavicons.has(link.favicon_url)) {
        seenFavicons.add(link.favicon_url);
        imageDataArray.push({
          id: `suplink-${link.id}`,
          src: link.favicon_url,
          alt: link.company_name || 'Company',
          title: link.company_name,
          description: link.description || `Visit ${link.company_name} at ${link.website_url}`
        });
      }
    }

    return imageDataArray;
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  if (error) return <div className="flex justify-center items-center h-screen text-red-500 p-8 text-center">{error}</div>;

  return (
    <>
      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        body {
          overflow-x: hidden;
        }
        * {
          max-width: 100%;
        }
      `}</style>

      <div className="bg-gray-50 min-h-screen overflow-x-hidden w-full">
        <div className="max-w-7xl mx-auto w-full overflow-x-hidden">
        {/* Header - Mobile optimized */}
        <header className="bg-white shadow-sm px-4 py-4 sm:px-6 lg:px-8 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">SupLinks</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600">Discover verified suppliers in the network.</p>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 w-full overflow-x-hidden max-w-full">
        {/* --- TOGGLE BUTTONS - Full width on mobile, compact on desktop --- */}
        <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow border border-gray-200 p-1 flex sm:inline-flex gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveView('suplinks')}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 rounded font-semibold transition-all duration-200 text-sm sm:text-base whitespace-nowrap ${
              activeView === 'suplinks'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Suplinks
          </button>
          <button
            onClick={() => setActiveView('discovered')}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 rounded font-semibold transition-all duration-200 text-sm sm:text-base whitespace-nowrap ${
              activeView === 'discovered'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Discovered
          </button>
        </div>

        {activeView === 'suplinks' ? (
          <>
            {/* --- SEARCH AND FILTER BAR (REDESIGNED) --- */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 p-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-transparent text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="relative p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                  aria-label="Open filters"
                >
                  <SlidersHorizontal size={20} />
                  {hasActiveFilters && (
                    <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white"></span>
                  )}
                </button>
              </div>
            </div>

            {displayProfiles.length > 0 ? (
              <div className="space-y-6">
                {displayProfiles.map(profile => <SupplierCard key={profile.id} profile={profile} onClick={() => handleCardClick(profile)} />)}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-800">No Suppliers Found</h3>
                <p className="text-gray-500 mt-2">Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* --- DISCOVERED VIEW WITH SPHERE IMAGE GRID IN TOP RIGHT --- */}
            {discoveredLoading ? (
              <div className="flex flex-col justify-center items-center py-32 bg-white rounded-lg shadow border border-gray-200">
                <Loader />
                <p className="text-gray-600 mt-4 font-medium">Loading discovered suppliers...</p>
              </div>
            ) : supLinkDiscovered.length > 0 ? (
              <div className="relative w-full max-w-full overflow-x-hidden">
                {/* Mobile: Sphere on top, stacked layout */}
                <div className="lg:hidden mb-4 sm:mb-6 w-full max-w-full">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-200 p-3 sm:p-6 flex flex-col items-center w-full max-w-full">
                    <div className="w-60 h-60 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
                      <SphereImageGrid
                        images={convertToImageData()}
                        containerSize={240}
                        sphereRadius={100}
                        autoRotate={true}
                        autoRotateSpeed={0.2}
                        dragSensitivity={0.6}
                        baseImageScale={0.15}
                      />
                    </div>
                    {/* Supplier count badge */}
                    <div className="mt-3 bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold">
                      {filteredDiscovered.length} Supplier{filteredDiscovered.length !== 1 ? 's' : ''} Found
                    </div>
                  </div>
                </div>

                {/* Desktop: 3D Sphere fixed on right side */}
                <div className="hidden lg:block fixed top-24 right-8 z-10">
                  <div className="relative">
                    <SphereImageGrid
                      images={convertToImageData()}
                      containerSize={350}
                      sphereRadius={150}
                      autoRotate={true}
                      autoRotateSpeed={0.2}
                      dragSensitivity={0.6}
                      baseImageScale={0.15}
                    />

                    {/* Supplier count badge */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-md text-sm font-semibold whitespace-nowrap">
                      {filteredDiscovered.length} Supplier{filteredDiscovered.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Content area - full width on mobile, add padding on desktop */}
                <div className="w-full max-w-full lg:pr-[400px]">
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3 sm:p-5 lg:p-6 w-full max-w-full overflow-x-hidden">
                    {/* Header */}
                    <div className="mb-3 sm:mb-4 lg:mb-6">
                      <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900 mb-1">
                        Discovered Suppliers
                      </h2>
                      <p className="text-gray-600 text-[10px] sm:text-xs lg:text-sm">
                        Showing {filteredDiscovered.length} of {supLinkDiscovered.length} suppliers
                        {hasActiveDiscoveredFilters || discoveredSearchTerm ? ' (filtered)' : ''}
                      </p>
                    </div>

                    {/* Search and Filter Section */}
                    <div className="mb-3 sm:mb-4 lg:mb-6 space-y-2 sm:space-y-3 lg:space-y-4">
                      {/* Search Bar with Type Selector - stack on mobile */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={discoveredSearchType}
                          onChange={(e) => setDiscoveredSearchType(e.target.value as 'product' | 'supplier')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 font-medium text-xs sm:text-sm"
                        >
                          <option value="supplier">Suppliers</option>
                          <option value="product">Products</option>
                        </select>
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder={discoveredSearchType === 'supplier' ? 'Search suppliers...' : 'Search products...'}
                            value={discoveredSearchTerm}
                            onChange={(e) => setDiscoveredSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs sm:text-sm"
                          />
                          {discoveredSearchTerm && (
                            <button
                              onClick={() => setDiscoveredSearchTerm('')}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              <XIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Section - responsive grid */}
                      <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 lg:p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <SlidersHorizontal size={14} className="text-gray-600" />
                            <span className="text-xs sm:text-sm font-semibold text-gray-700">Filters</span>
                          </div>
                          {hasActiveDiscoveredFilters && (
                            <button
                              onClick={() => {
                                setDiscoveredFilterCountry('');
                                setDiscoveredFilterMinScore(0);
                                setDiscoveredFilterCertified(null);
                                setDiscoveredFilterB2B(null);
                              }}
                              className="px-2 sm:px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 rounded border border-red-200 transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {/* Country Filter */}
                          <select
                            value={discoveredFilterCountry}
                            onChange={(e) => setDiscoveredFilterCountry(e.target.value)}
                            className={`px-2 sm:px-3 py-1.5 border ${discoveredFilterCountry ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm`}
                          >
                            <option value="">All Countries</option>
                            {discoveredCountries.map((country) => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </select>

                          {/* Score Filter */}
                          <select
                            value={discoveredFilterMinScore}
                            onChange={(e) => setDiscoveredFilterMinScore(Number(e.target.value))}
                            className={`px-2 sm:px-3 py-1.5 border ${discoveredFilterMinScore > 0 ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm`}
                          >
                            <option value={0}>All Scores</option>
                            <option value={15}>≥ 15</option>
                            <option value={18}>≥ 18</option>
                            <option value={20}>≥ 20</option>
                          </select>

                          {/* Certified Filter */}
                          <select
                            value={discoveredFilterCertified === null ? '' : discoveredFilterCertified ? 'yes' : 'no'}
                            onChange={(e) => setDiscoveredFilterCertified(e.target.value === '' ? null : e.target.value === 'yes')}
                            className={`px-2 sm:px-3 py-1.5 border ${discoveredFilterCertified !== null ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-white'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm`}
                          >
                            <option value="">Cert.</option>
                            <option value="yes">Certified</option>
                            <option value="no">Not Cert.</option>
                          </select>

                          {/* B2B Platform Filter */}
                          <select
                            value={discoveredFilterB2B === null ? '' : discoveredFilterB2B ? 'yes' : 'no'}
                            onChange={(e) => setDiscoveredFilterB2B(e.target.value === '' ? null : e.target.value === 'yes')}
                            className={`px-2 sm:px-3 py-1.5 border ${discoveredFilterB2B !== null ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm`}
                          >
                            <option value="">B2B</option>
                            <option value="yes">Verified</option>
                            <option value="no">Not Verified</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* List view of suppliers */}
                    {filteredDiscovered.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3 lg:space-y-4 w-full max-w-full">
                        {filteredDiscovered.map((link) => (
                          <div
                            key={link.id}
                            onClick={() => setSelectedDiscoveredSupplier(link)}
                            className="bg-white border border-gray-200 rounded-lg p-2 sm:p-4 lg:p-5 hover:shadow-xl hover:border-blue-300 transition-all duration-200 cursor-pointer w-full max-w-full overflow-hidden box-border"
                          >
                            {/* Mobile: Compact vertical layout */}
                            <div className="sm:hidden w-full max-w-full overflow-hidden box-border">
                              {/* Mobile: Logo and title in one row */}
                              <div className="flex items-center gap-2 mb-2 w-full max-w-full">
                                {/* Logo */}
                                <div className="relative flex-shrink-0">
                                  <div className="w-10 h-10 rounded-lg bg-white shadow-md border border-gray-200 p-1 flex items-center justify-center">
                                    <img
                                      src={link.favicon_url || 'https://via.placeholder.com/40'}
                                      alt={link.company_name}
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  {link.b2b_platform_verified && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                      <CheckCircle size={10} className="text-white" />
                                    </div>
                                  )}
                                </div>

                                {/* Title and rating */}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    <h3 className="font-bold text-sm text-gray-900 truncate flex-1">
                                      {link.company_name}
                                    </h3>
                                    {link.star_rating && (
                                      <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-1 rounded-full flex-shrink-0">
                                        <Star size={10} fill="currentColor" />
                                        <span className="text-[10px] font-bold">{link.star_rating}</span>
                                      </div>
                                    )}
                                  </div>
                                  {link.founded_year && (
                                    <span className="text-[9px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">
                                      Est. {link.founded_year}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Website URL */}
                              <a
                                href={link.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-[10px] flex items-center gap-1 mb-2 w-full overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe size={10} className="flex-shrink-0" />
                                <span className="truncate block">{link.website_url}</span>
                              </a>

                              {/* Contact Info and Badges combined */}
                              <div className="flex flex-wrap gap-1.5 text-[9px] w-full">
                                {link.email && (
                                  <a
                                    href={`mailto:${link.email}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 max-w-[45%] overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Mail size={9} className="flex-shrink-0" />
                                    <span className="truncate text-[9px]">{link.email}</span>
                                  </a>
                                )}
                                {link.phone && (
                                  <a
                                    href={`tel:${link.phone}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Phone size={9} className="flex-shrink-0" />
                                    <span className="text-[9px]">{link.phone}</span>
                                  </a>
                                )}
                                {link.location && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 max-w-[45%] overflow-hidden">
                                    <MapPin size={9} className="flex-shrink-0" />
                                    <span className="truncate text-[9px]">{link.location}</span>
                                  </span>
                                )}
                                {link.overall_score !== undefined && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded font-bold border border-green-300 flex-shrink-0">
                                    <Award size={9} className="flex-shrink-0" />
                                    <span className="text-[9px]">{link.overall_score}/25</span>
                                  </span>
                                )}
                                {link.b2b_platform_verified && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded border border-purple-300 flex-shrink-0">
                                    <CheckCircle size={9} className="flex-shrink-0" />
                                    <span className="text-[9px]">B2B</span>
                                  </span>
                                )}
                                {link.certifications && link.certifications.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded border border-orange-300 flex-shrink-0">
                                    <Shield size={9} className="flex-shrink-0" />
                                    <span className="text-[9px]">{link.certifications.length}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Desktop/Tablet: Original layout */}
                            <div className="hidden sm:flex items-start gap-4">
                              {/* Logo */}
                              <div className="relative flex-shrink-0">
                                <div className="w-14 h-14 rounded-lg bg-white shadow border border-gray-200 p-2 flex items-center justify-center">
                                  <img
                                    src={link.favicon_url || 'https://via.placeholder.com/56'}
                                    alt={link.company_name}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                {link.b2b_platform_verified && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                                    <CheckCircle size={12} className="text-white" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Header with title and rating */}
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <h3 className="font-semibold text-lg text-gray-900 truncate">
                                        {link.company_name}
                                      </h3>
                                      {link.founded_year && (
                                        <span className="flex-shrink-0 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                          Est. {link.founded_year}
                                        </span>
                                      )}
                                    </div>
                                    <a
                                      href={link.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-sm flex items-center gap-1 truncate max-w-full"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Globe size={14} className="flex-shrink-0" />
                                      <span className="truncate">{link.website_url}</span>
                                    </a>
                                  </div>

                                  {/* Rating badge */}
                                  {link.star_rating && (
                                    <div className="flex-shrink-0 flex items-center gap-1 bg-yellow-400 text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                                      <Star size={14} fill="currentColor" />
                                      <span className="text-xs font-semibold">{link.star_rating}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Description */}
                                {link.description && (
                                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                    {link.description}
                                  </p>
                                )}

                                {/* Contact Info */}
                                {(link.email || link.phone) && (
                                  <div className="flex flex-wrap gap-3 mb-3">
                                    {link.email && (
                                      <a
                                        href={`mailto:${link.email}`}
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors truncate max-w-[200px]"
                                        onClick={(e) => e.stopPropagation()}
                                        title={link.email}
                                      >
                                        <Mail size={13} className="flex-shrink-0" />
                                        <span className="truncate">{link.email}</span>
                                      </a>
                                    )}
                                    {link.phone && (
                                      <a
                                        href={`tel:${link.phone}`}
                                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Phone size={13} className="flex-shrink-0" />
                                        <span>{link.phone}</span>
                                      </a>
                                    )}
                                  </div>
                                )}

                                {/* Metadata Badges */}
                                <div className="flex flex-wrap gap-2">
                                  {link.location && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                      <MapPin size={12} />
                                      {link.location}
                                    </span>
                                  )}
                                  {link.search_country && (
                                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                      {link.search_country}
                                    </span>
                                  )}
                                  {link.overall_score !== undefined && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                      Score: {link.overall_score}/25
                                    </span>
                                  )}
                                  {link.b2b_platform_verified && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                      <CheckCircle size={12} />
                                      {link.b2b_platform_name || 'B2B Verified'}
                                    </span>
                                  )}
                                  {link.certifications && link.certifications.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                      <Shield size={12} />
                                      {link.certifications.length} Cert{link.certifications.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 sm:py-16 bg-white rounded-lg border border-gray-200">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search size={28} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No suppliers found</h3>
                        <p className="text-gray-500 text-sm">Try adjusting your search or filter criteria</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-lg shadow border border-gray-200">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe size={36} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Discovered Suppliers Yet</h3>
                <p className="text-gray-600 text-sm max-w-md mx-auto">
                  Start discovering suppliers by using the AI search feature. Your discovered suppliers will appear here.
                </p>
              </div>
            )}
          </>
        )}
        </div>
      </div>
      </div>

      {selectedProfile && <SupplierModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />}
      
      {selectedDiscoveredSupplier && (
        <DiscoveredSupplierModal 
          supplier={selectedDiscoveredSupplier} 
          onClose={() => setSelectedDiscoveredSupplier(null)} 
        />
      )}

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        initialFilters={{
          category: selectedCategory,
          supplierType: selectedSupplierType,
          location: selectedLocation
        }}
        options={{
          categories,
          supplierTypes,
          locations
        }}
      />
    </>
  );
};


// --- HELPER for card details ---
const CardDetailItem = ({ icon, label, value, isLink = false }: { icon: React.ReactNode, label: string, value: string | number | null | undefined, isLink?: boolean }) => {
    if (!value) return null;
    return (
        <div className="flex items-center gap-2 text-sm">
            <div className="text-gray-400 flex-shrink-0">{icon}</div>
            <div className="text-gray-600 truncate min-w-0">
                <span className="font-medium">{label}:</span> 
                {isLink && typeof value === 'string' ? (
                     <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">{value}</a>
                ) : (
                   <span className="ml-1">{value}</span>
                )}
            </div>
        </div>
    )
}

// --- CHILD COMPONENT: SupplierCard ---
const SupplierCard = ({ profile, onClick }: { profile: SupplierProfile, onClick: () => void }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const getImageUrl = async () => {
      if (profile.company_logo_url) {
        try {
          const { data, error } = await supabase.storage
            .from('company-logos')
            .createSignedUrl(profile.company_logo_url, 3600);
          if (error) throw error;
          if (data) setImageUrl(data.signedUrl);
        } catch (error) {
          console.error('Error fetching image URL for card:', error);
          setImageUrl(null);
        }
      }
    };
    getImageUrl();
  }, [profile.company_logo_url]);

  const allOfferings = [
    ...profile.services.map(s => ({ type: 'service', name: s.name })),
    ...profile.materials.map(m => ({ type: 'material', name: m.name })),
  ].filter(tag => tag.name);

  const getTagStyle = (type: string) => {
    switch(type) {
        case 'service': return "text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1.5";
        case 'material': return "text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1.5";
        default: return "";
    }
  }
   const getTagIcon = (type: string) => {
    switch(type) {
        case 'service': return <Server size={12}/>;
        case 'material': return <Package size={12}/>;
        default: return null;
    }
  }

  return (
    <div
        onClick={onClick}
        className="bg-white rounded-xl shadow-md p-3 sm:p-5 transition-all duration-300 hover:shadow-lg cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-5">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex items-center justify-center bg-gray-100 shrink-0 border">
          {imageUrl ? <img src={imageUrl} alt={profile.company_legal_name || 'Supplier'} className="w-full h-full object-contain p-2 rounded-lg" /> : <Building className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />}
        </div>
        <div className="flex-grow min-w-0 w-full">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{profile.company_legal_name || 'N/A'}</h2>
            <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                Supplier
            </span>
          </div>
          <div className="flex items-center" title={`${profile.rating} out of 5`}>
            {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < profile.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} />)}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 line-clamp-1">
            {profile.description || 'No description provided.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
             {allOfferings.length > 0 ? allOfferings.map((tag, i) => (
              <span key={i} className={getTagStyle(tag.type)}>
                {getTagIcon(tag.type)}
                <span className="truncate">{tag.name}</span>
              </span>
            )) : (
                <span className="text-xs text-gray-500">No specific offerings listed.</span>
            )}
          </div>
          <div className="mt-4">
             <span className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800">View More...</span>
          </div>
        </div>
        <div className="w-full sm:w-64 shrink-0 space-y-1.5 sm:space-y-2">
            <CardDetailItem icon={<Mail size={12} className="sm:w-14" />} label="Email" value={profile.contact_email} />
            <CardDetailItem icon={<Phone size={12} />} label="Phone" value={profile.phone_number} />
            <CardDetailItem icon={<MapPin size={12} />} label="Country" value={profile.country} />
            <CardDetailItem icon={<Globe size={12} />} label="Website" value={profile.company_url} isLink />
        </div>
      </div>
    </div>
  );
};


// --- MODAL COMPONENT (UPDATED) ---
const SupplierModal = ({ profile, onClose }: { profile: SupplierProfile, onClose: () => void }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const getImageUrl = async () => {
      if (profile.company_logo_url) {
        try {
          const { data, error } = await supabase.storage
            .from('company-logos')
            .createSignedUrl(profile.company_logo_url, 3600);
          if (error) throw error;
          if (data) setImageUrl(data.signedUrl);
        } catch (error) {
          console.error('Error fetching image URL for modal:', error);
          setImageUrl(null);
        }
      }
    };
    getImageUrl();
  }, [profile.company_logo_url]);
  
  const fullAddress = [profile.address_line_1, profile.address_line_2, profile.city, profile.region, profile.postal_code, profile.country].filter(Boolean).join(', ');

  const renderDocStatus = (doc: Document) => {
    switch(doc.status) {
        case 'approved': return <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /> Verified</div>;
        case 'pending_review': return <div className="flex items-center gap-2 text-yellow-600"><Clock size={16} /> Pending Review</div>;
        case 'rejected': return <div className="flex items-center gap-2 text-red-600"><XIcon size={16} /> Rejected</div>;
        default: return <div className="flex items-center gap-2 text-gray-500"><ShieldQuestion size={16} /> Unknown</div>;
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-2 sm:p-4 transition-opacity duration-300">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 lg:p-8 w-full max-w-3xl relative transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 sm:top-4 right-3 sm:right-4 text-gray-400 hover:text-gray-600 z-10"><XIcon size={24} /></button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center mb-6 border-b pb-6 gap-3 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center bg-gray-100 shrink-0 border">
            {imageUrl ? <img src={imageUrl} alt={profile.company_legal_name || 'Supplier'} className="w-full h-full object-contain p-1 rounded-lg" /> : <Building className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />}
          </div>
          <div className="text-left sm:text-left flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{profile.company_legal_name || 'N/A'}</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 mt-2">
              <span>{profile.organization_type}</span>
              <span className="hidden sm:inline text-gray-300">|</span>
              <div className="flex items-center" title={`${profile.rating} out of 5`}>
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < profile.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'} />)}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4">Supplier Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-x-8 sm:gap-y-4 text-xs sm:text-sm">
                <DetailItem icon={<Briefcase size={14} />} label="Organization Type" value={profile.organization_type} />
                <DetailItem icon={<Tag size={14} />} label="Category" value={profile.category} />
                <DetailItem icon={<Calendar size={14} />} label="Year Established" value={profile.year_of_establishment} />
                <DetailItem icon={<Users size={14} />} label="Company Size" value={profile.company_size} />
                <DetailItem icon={<Mail size={14} />} label="Contact Email" value={profile.contact_email} />
                <DetailItem icon={<Phone size={14} />} label="Phone" value={profile.phone_number} />
                <DetailItem icon={<Globe size={14} />} label="Website" value={profile.company_url} isLink />
                <DetailItem icon={<FileText size={14} />} label="Business Reg. No." value={profile.business_registration_number} />
                <DetailItem icon={<FileText size={14} />} label="GST/VAT No." value={profile.gst_vat_number} />
                <DetailItem icon={<MapPin size={14} />} label="Address" value={fullAddress} fullWidth />
            </div>
          </div>

          {/* --- OFFERINGS SECTION (REDESIGNED) --- */}
          {(profile.materials.length > 0 || profile.services.length > 0) && (
            <div className="border-t pt-6">
                <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4">Offerings</h3>
                <div className="space-y-4 sm:space-y-6">
                    {profile.materials.length > 0 && (
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base"><Package size={16} /> Materials</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {profile.materials.map((m, i) => (
                              <div key={i} className="p-3 sm:p-4 bg-gray-50 rounded-lg border text-xs sm:text-sm">
                                <h5 className="font-bold text-gray-900 mb-2">{m.name}</h5>
                                <div className="space-y-1.5 sm:space-y-2">
                                  <OfferingDetailItem icon={<Hash size={12} />} label="CAS Number" value={m.cas_number} />
                                  <OfferingDetailItem icon={<Tag size={12} />} label="INCI Name" value={m.inci_name} />
                                  <OfferingDetailItem icon={<DollarSign size={12} />} label="Price Range" value={m.price_range} />
                                  <OfferingDetailItem icon={<Package size={12} />} label="Min. Order" value={m.min_order_quantity} />
                                  <OfferingDetailItem icon={<Archive size={12} />} label="Inventory" value={m.inventory_info} />
                                  <OfferingDetailItem icon={<Globe size={12} />} label="Regions Served" value={m.regions_served} />
                                  <OfferingDetailItem icon={<Thermometer size={12} />} label="Measurement Unit" value={m.unit_of_measurement} />
                                  <OfferingDetailItem icon={<Book size={12} />} label="Tech Specs" value={m.technical_specs} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    )}
                    {profile.services.length > 0 && (
                        <div className="space-y-3 sm:space-y-4">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base"><Server size={16} /> Services</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {profile.services.map((s, i) => (
                              <div key={i} className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 text-xs sm:text-sm">
                                <h5 className="font-bold text-gray-900 mb-2">{s.name}</h5>
                                <div className="space-y-1.5 sm:space-y-2">
                                  <OfferingDetailItem icon={<Tag size={12} />} label="Service Type" value={s.service_type} />
                                  <OfferingDetailItem icon={<Truck size={12} />} label="Delivery Mode" value={s.delivery_mode} />
                                  <OfferingDetailItem icon={<DollarSign size={12} />} label="Pricing Model" value={s.pricing_model} />
                                  <OfferingDetailItem icon={<Users2 size={12} />} label="Team Details" value={s.team_details} />
                                  <OfferingDetailItem icon={<Users size={12} />} label="Team Capacity" value={s.team_capacity} />
                                  <OfferingDetailItem icon={<Award size={12} />} label="Existing Clients" value={s.existing_clients} />
                                  <OfferingDetailItem icon={<MessageSquare size={12} />} label="Testimonials" value={s.testimonials} />
                                  <OfferingDetailItem icon={<Shield size={12} />} label="SLA Info" value={s.service_sla_info} />
                                  <OfferingDetailItem icon={<Globe size={12} />} label="Case Studies" value={s.case_studies_link} isLink />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    )}
                </div>
            </div>
          )}

          {profile.documents.length > 0 && (
            <div className="border-t pt-6">
                <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4">Documents & Verification</h3>
                <div className="space-y-2 sm:space-y-3">
                    {profile.documents.map((doc, i) => (
                        <div key={i} className="p-2 sm:p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs sm:text-sm">
                            <span className="font-medium text-gray-700 capitalize">{doc.doc_type.replace(/_/g, ' ')}</span>
                            <div className="text-xs sm:text-sm font-semibold">{renderDocStatus(doc)}</div>
                        </div>
                    ))}
                </div>
            </div>
          )}
          <div className="border-t pt-6">
            <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-2 sm:mb-3">About</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{profile.description || 'No description provided.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- NEW HELPER for Offering Details ---
const OfferingDetailItem = ({ icon, label, value, isLink = false }: { icon: React.ReactNode, label: string, value: string | null | undefined, isLink?: boolean }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2">
            <div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="font-medium text-gray-500">{label}</p>
                 {isLink ? (
                     <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{value}</a>
                ) : (
                    <p className="text-gray-800 font-semibold break-words">{value}</p>
                )}
            </div>
        </div>
    );
};

// Helper component for modal details
const DetailItem = ({ icon, label, value, isLink = false, fullWidth = false }: { icon: React.ReactNode, label: string, value: string | number | null | undefined, isLink?: boolean, fullWidth?: boolean }) => {
    if (!value) return null;
    return (
        <div className={`flex items-start gap-3 ${fullWidth ? 'sm:col-span-2' : ''}`}>
            <div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div>
            <div>
                <p className="font-medium text-gray-500">{label}</p>
                {isLink && typeof value === 'string' ? (
                     <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{value}</a>
                ) : (
                    <p className="text-gray-800 font-semibold">{value}</p>
                )}
            </div>
        </div>
    )
};

// --- DISCOVERED SUPPLIER MODAL COMPONENT ---
const DiscoveredSupplierModal = ({ supplier, onClose }: { supplier: SupLinkDiscovered, onClose: () => void }) => {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-4xl relative transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <XIcon size={24} />
        </button>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-center mb-6 border-b pb-6">
          <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-white shadow border border-gray-200 shrink-0 mr-0 sm:mr-5 mb-4 sm:mb-0 p-2">
            <img 
              src={supplier.favicon_url || 'https://via.placeholder.com/80'} 
              alt={supplier.company_name} 
              className="w-full h-full object-contain" 
            />
          </div>
          <div className="text-center sm:text-left flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap justify-center sm:justify-start">
              <h2 className="text-2xl font-bold text-gray-900">{supplier.company_name}</h2>
              {supplier.b2b_platform_verified && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  <CheckCircle size={14} />
                  Verified
                </span>
              )}
              {supplier.founded_year && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Est. {supplier.founded_year}
                </span>
              )}
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-gray-500">
              {supplier.star_rating && (
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-gray-700">{supplier.star_rating}</span>
                </div>
              )}
              {supplier.overall_score !== undefined && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                  Score: {supplier.overall_score}/25
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Description */}
          {supplier.description && (
            <div>
              <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                <FileText size={18} />
                About
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
                {supplier.description}
              </p>
            </div>
          )}

          {/* Contact & Location Information */}
          <div>
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <Building size={18} />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={<Globe size={16}/>} label="Website" value={supplier.website_url} isLink />
              <DetailItem icon={<Mail size={16}/>} label="Email" value={supplier.email} />
              <DetailItem icon={<Phone size={16}/>} label="Phone" value={supplier.phone} />
              <DetailItem icon={<MapPin size={16}/>} label="Location" value={supplier.location} />
              <DetailItem icon={<MapPin size={16}/>} label="Address" value={supplier.address} fullWidth />
              <DetailItem icon={<Globe size={16}/>} label="Country" value={supplier.search_country} />
            </div>
          </div>

          {/* Analysis Section */}
          {supplier.score_analysis && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Award size={18} />
                Suproc Supplier Analysis
              </h3>
              
              {/* Milestone Timeline Style Display */}
              <div className="space-y-6">
                {/* Header with AI Badge */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <Award size={24} className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">Supplier Evaluation</h4>
                    <p className="text-sm text-gray-500">Comprehensive analysis breakdown</p>
                  </div>
                </div>

                {/* Milestone Timeline */}
                <div className="relative pl-8 space-y-6">
                  {/* Vertical Line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-green-500"></div>

                  {/* Milestone 1: Discovery */}
                  <div className="relative">
                    <div className="absolute -left-8 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-4 border-white">
                      <Globe size={12} className="text-white" />
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200 ml-2">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-bold text-blue-900">Supplier Discovered</h5>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Step 1</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Found via search: <span className="font-semibold text-blue-700">{supplier.search_query || 'AI Discovery'}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        📍 {supplier.location || supplier.search_country || 'Global'}
                      </p>
                    </div>
                  </div>

                  {/* Milestone 2: Overall Score */}
                  {supplier.overall_score !== undefined && (
                    <div className="relative">
                      <div className="absolute -left-8 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg border-4 border-white">
                        <Star size={12} className="text-white fill-white" />
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-200 ml-2">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="font-bold text-purple-900">Scoring Complete</h5>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Step 2</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-2">Overall Score</p>
                            <p className="text-3xl font-bold text-purple-700">
                              {supplier.overall_score}<span className="text-lg text-gray-400">/25</span>
                            </p>
                          </div>
                          <div className="flex-1 ml-6">
                            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${(supplier.overall_score / 25) * 100}%` }}
                              >
                                <span className="text-xs font-bold text-white">{Math.round((supplier.overall_score / 25) * 100)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Milestone 3: Analysis */}
                  <div className="relative">
                    <div className="absolute -left-8 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg border-4 border-white">
                      <Award size={12} className="text-white" />
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-lg p-5 shadow-sm border border-orange-200 ml-2">
                      <div className="flex items-center gap-2 mb-3">
                        <h5 className="font-bold text-orange-900">Detailed Analysis</h5>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Step 3</span>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="prose prose-sm max-w-none">
                          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
                            {supplier.score_analysis}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone 4: Verification */}
                  {(supplier.b2b_platform_verified || (supplier.certifications && supplier.certifications.length > 0)) && (
                    <div className="relative">
                      <div className="absolute -left-8 w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg border-4 border-white">
                        <Shield size={12} className="text-white" />
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-green-200 ml-2">
                        <div className="flex items-center gap-2 mb-3">
                          <h5 className="font-bold text-green-900">Verification Status</h5>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Step 4</span>
                        </div>
                        <div className="space-y-2">
                          {supplier.b2b_platform_verified && (
                            <div className="flex items-center gap-2 bg-purple-50 p-3 rounded-lg border border-purple-200">
                              <CheckCircle size={16} className="text-purple-600" />
                              <span className="text-sm font-semibold text-purple-900">
                                Verified on {supplier.b2b_platform_name || 'B2B Platform'}
                              </span>
                            </div>
                          )}
                          {supplier.certifications && supplier.certifications.length > 0 && (
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Award size={16} className="text-orange-600" />
                                <span className="text-sm font-semibold text-orange-900">
                                  {supplier.certifications.length} Certification{supplier.certifications.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {supplier.certifications.map((cert, idx) => (
                                  <span key={idx} className="text-xs bg-white text-orange-700 px-2 py-1 rounded border border-orange-200 font-medium">
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Final Milestone: Timestamp */}
                  <div className="relative">
                    <div className="absolute -left-8 w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center shadow-lg border-4 border-white">
                      <Clock size={12} className="text-white" />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 shadow-sm border border-gray-200 ml-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock size={14} />
                        <span className="font-medium">Analysis completed</span>
                        <span className="font-bold text-gray-800">
                          {new Date(supplier.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products & Services */}
          {(supplier.products || supplier.services) && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Package size={18} />
                Offerings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {supplier.products && supplier.products.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Package size={16} />
                      Products
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {supplier.products.map((product, idx) => (
                        <span key={idx} className="inline-block px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {supplier.services && supplier.services.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Server size={16} />
                      Services
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {supplier.services.map((service, idx) => (
                        <span key={idx} className="inline-block px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certifications */}
          {supplier.certifications && supplier.certifications.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Shield size={18} />
                Certifications
              </h3>
              <div className="flex flex-wrap gap-2">
                {supplier.certifications.map((cert, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                    <Award size={14} />
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Media Links */}
          {supplier.social_media && Object.values(supplier.social_media).some(v => v) && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Globe size={18} />
                Social Media
              </h3>
              <div className="flex flex-wrap gap-3">
                {supplier.social_media.linkedin && (
                  <a
                    href={supplier.social_media.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    LinkedIn
                  </a>
                )}
                {supplier.social_media.facebook && (
                  <a
                    href={supplier.social_media.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    Facebook
                  </a>
                )}
                {supplier.social_media.twitter && (
                  <a
                    href={supplier.social_media.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm font-medium"
                  >
                    Twitter
                  </a>
                )}
                {supplier.social_media.instagram && (
                  <a
                    href={supplier.social_media.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium"
                  >
                    Instagram
                  </a>
                )}
              </div>
            </div>
          )}

          {/* B2B Platform Info */}
          {supplier.b2b_platform_verified && supplier.b2b_platform_name && (
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle size={18} />
                Verification
              </h3>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900">
                  Verified on <span className="font-semibold">{supplier.b2b_platform_name}</span>
                </p>
              </div>
            </div>
          )}

          {/* Additional Metadata */}
          <div className="border-t pt-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <Calendar size={18} />
              Discovery Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {supplier.search_query && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Search Query</p>
                  <p className="text-sm font-semibold text-gray-800">{supplier.search_query}</p>
                </div>
              )}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Discovered On</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date(supplier.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 pt-6 border-t">
          <a
            href={supplier.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Globe size={18} />
            Visit Website
          </a>
        </div>
      </div>
    </div>
  );
};


export default SupLinks;