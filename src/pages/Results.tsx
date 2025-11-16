import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import { Globe, Mail, Phone, Info, Star, CheckCircle, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Supplier {
  name: string;
  url: string;
  email?: string;
  phone?: string;
  summary?: string;
  overall_score?: number; // Score from analysis (0-25)
  star_rating?: number; // Star rating (1-5)
  certifications?: string[]; // Certifications array
  b2b_platform_verified?: boolean; // B2B platform verification
  b2b_platform_name?: string; // Name of B2B platform
}

interface FAQItem {
  title: string;
  answer: string;
}

/**
 * Coalesced request cache to prevent duplicate network calls in React 18 StrictMode.
 * Keyed by product|country|mode.
 * Also track DB insert once per key to avoid duplicate writes during dev double-mounts.
 */
const resultsRequestCache = new Map<string, Promise<Supplier[]>>();
const insertOnce = new Set<string>();

function fetchResultsCoalesced(product: string, country: string, mode: string): Promise<Supplier[]> {
  const key = `${product}|${country}|${mode}`.toLowerCase();
  const existing = resultsRequestCache.get(key);
  if (existing) return existing;

  const p = fetch(
  `/api/search?product=${encodeURIComponent(product)}&country=${encodeURIComponent(country)}&mode=${encodeURIComponent(mode)}`
)
    .then((resp) => {
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      return resp.json() as Promise<Supplier[]>;
    })
    .finally(() => {
      resultsRequestCache.delete(key);
    });

  resultsRequestCache.set(key, p);
  return p;
}

/** Coalesced fetch for FAQs (keyed only by product; country-agnostic by design) */
const faqRequestCache = new Map<string, Promise<FAQItem[]>>();

function fetchFaqCoalesced(product: string): Promise<FAQItem[]> {
  const key = product.trim().toLowerCase();
  const existing = faqRequestCache.get(key);
  if (existing) return existing;

  const p = fetch(`/api/faq?product=${encodeURIComponent(product)}`)
    .then((resp) => {
      if (!resp.ok) throw new Error(`FAQ HTTP ${resp.status}`);
      return resp.json() as Promise<{ faqs: FAQItem[] }>;
    })
    .then(({ faqs }) => faqs || [])
    .catch(() => [])
    .finally(() => {
      faqRequestCache.delete(key);
    });

  faqRequestCache.set(key, p);
  return p;
}

// Typed handler to avoid TS7006 on implicit 'any'
const handleImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  (e.currentTarget as HTMLImageElement).style.display = 'none';
};

/** Fixed 10-second display per FAQ item */
function durationForFaq(_item?: FAQItem): number {
  return 10000; // 10,000 ms = 10s
}

const Results: React.FC = () => {
  const [params] = useSearchParams();
  const product = params.get('product') || '';
  const country = params.get('country') || '';
  const mode = params.get('mode') ?? 'quick';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [analyzedSuppliers, setAnalyzedSuppliers] = useState<Supplier[]>([]);
  const [newSuppliers, setNewSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // FAQ state (shown during loading)
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [faqIndex, setFaqIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!product || !country) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    // Prepare UI immediately (no delay)
    setLoading(true);
    setError('');
    setSuppliers([]);

    let isActive = true; // Ignore stale updates from the first StrictMode pass

    // Start FAQ fetch in parallel (doesn't block suppliers)
    fetchFaqCoalesced(product).then((items) => {
      if (!isActive) return;
      if (Array.isArray(items) && items.length > 0) {
        setFaqs(items.slice(0, 5));
        setFaqIndex(0);
      } else {
        setFaqs([]);
      }
    });

    fetchResultsCoalesced(product, country, mode)
      .then(async (data) => { // <-- Make callback async
        if (!isActive) return;

        // Fetch analyzed suppliers from suplink_discovered table
        try {
          console.log('[DEBUG] Fetching analyzed suppliers for:', { product, country });

          // Fetch ALL suppliers from suplink_discovered (no filters on Supabase side)
          const { data: allSuppliers, error: dbError } = await supabase
            .from('suplink_discovered')
            .select('*');

          console.log('[DEBUG] All suppliers from suplink_discovered:', allSuppliers?.length || 0);

          if (dbError) {
            console.error('Error fetching from suplink_discovered:', dbError);
          }

          // Filter in JavaScript for matching product, country, AND has a score
          const analyzedSuppliers = allSuppliers?.filter(s => {
            const hasScore = s.overall_score !== null && s.overall_score !== undefined;
            const queryMatch = s.search_query?.toLowerCase().includes(product.toLowerCase());
            const countryMatch = s.search_country?.toLowerCase().includes(country.toLowerCase());
            console.log('[DEBUG] Checking supplier:', {
              url: s.website_url,
              hasScore,
              score: s.overall_score,
              searchQuery: s.search_query,
              searchCountry: s.search_country,
              queryMatch,
              countryMatch
            });
            return hasScore && queryMatch && countryMatch;
          }) || [];

          console.log('[DEBUG] Filtered analyzed suppliers for', product, '+', country, ':', analyzedSuppliers.length);
          console.log('[DEBUG] Analyzed suppliers:', analyzedSuppliers);

          // Create a map to track all suppliers by URL
          const supplierMap = new Map<string, Supplier>();

          // First, add all search results
          data.forEach((supplier) => {
            supplierMap.set(supplier.url.toLowerCase(), supplier);
          });

          // Then merge or add analyzed suppliers from database
          if (analyzedSuppliers && analyzedSuppliers.length > 0) {
            analyzedSuppliers.forEach((analyzed) => {
              const urlKey = analyzed.website_url.toLowerCase();
              const existing = supplierMap.get(urlKey);

              if (existing) {
                // Merge analyzed data with existing search result
                supplierMap.set(urlKey, {
                  ...existing,
                  name: analyzed.company_name || existing.name,
                  email: analyzed.email || existing.email,
                  phone: analyzed.phone || existing.phone,
                  summary: analyzed.description || existing.summary,
                  overall_score: analyzed.overall_score,
                  star_rating: analyzed.star_rating,
                  certifications: analyzed.certifications,
                  b2b_platform_verified: analyzed.b2b_platform_verified,
                  b2b_platform_name: analyzed.b2b_platform_name,
                });
              } else {
                // Add analyzed supplier even if not in current search results
                supplierMap.set(urlKey, {
                  name: analyzed.company_name || 'Unknown',
                  url: analyzed.website_url,
                  email: analyzed.email,
                  phone: analyzed.phone,
                  summary: analyzed.description,
                  overall_score: analyzed.overall_score,
                  star_rating: analyzed.star_rating,
                  certifications: analyzed.certifications,
                  b2b_platform_verified: analyzed.b2b_platform_verified,
                  b2b_platform_name: analyzed.b2b_platform_name,
                });
              }
            });
          }

          // Convert map back to array
          const mergedSuppliers = Array.from(supplierMap.values());

          // Sort: analyzed suppliers (with scores) first, then unanalyzed
          const sortedSuppliers = mergedSuppliers.sort((a, b) => {
            const aHasScore = a.overall_score !== null && a.overall_score !== undefined;
            const bHasScore = b.overall_score !== null && b.overall_score !== undefined;

            // If both have scores, sort by score (higher first)
            if (aHasScore && bHasScore) {
              return (b.overall_score || 0) - (a.overall_score || 0);
            }

            // Analyzed (with score) comes before unanalyzed (without score)
            if (aHasScore && !bHasScore) return -1;
            if (!aHasScore && bHasScore) return 1;

            // Both unanalyzed, maintain original order
            return 0;
          });

          console.log('[DEBUG] Final sorted suppliers:', sortedSuppliers.map(s => ({
            name: s.name,
            score: s.overall_score,
            hasScore: s.overall_score !== null && s.overall_score !== undefined
          })));

          // Separate analyzed and new suppliers
          const analyzed = sortedSuppliers.filter(s => 
            s.overall_score !== null && s.overall_score !== undefined
          );
          const newOnes = sortedSuppliers.filter(s => 
            s.overall_score === null || s.overall_score === undefined
          );

          console.log('[DEBUG] Separated:', { analyzed: analyzed.length, new: newOnes.length });

          setAnalyzedSuppliers(analyzed);
          setNewSuppliers(newOnes);
          setSuppliers(sortedSuppliers);
        } catch (e) {
          console.error('Error merging analyzed suppliers:', e);
          setSuppliers(data); // Fallback to original data
        }

        // Fire-and-forget DB insert and trigger analysis; don't block rendering.
        const key = `${product}|${country}|${mode}`.toLowerCase();
        if (!insertOnce.has(key)) {
          insertOnce.add(key);

          // Get the current authenticated user
          const { data: { user } } = await supabase.auth.getUser();

          // Save search results and trigger analysis via backend endpoint
          try {
            const response = await fetch('/api/save-search-and-analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                search_term: product,
                country,
                results: data,
                mode,
                user_id: user?.id // Optional: only included if user is logged in
              })
            });

            if (response.ok) {
              const result = await response.json();
              console.log('Search saved and analysis triggered:', result.message);
            } else {
              const error = await response.json();
              console.error('Error saving search:', error);
            }
          } catch (e) {
            console.error('Failed to save search and trigger analysis:', e);
          }
        }
      })
      .catch((err: any) => {
        if (!isActive) return;
        console.error('Failed to load or save suppliers:', err);
        setError('Failed to load suppliers.');
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [product, country, mode]); // include mode so changing search mode refetches

  // Rotate FAQs while loading
  useEffect(() => {
    if (!loading || faqs.length === 0) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    // Fixed timeout per item (10s)
    const ms = durationForFaq(faqs[faqIndex]);
    timerRef.current = window.setTimeout(() => {
      setFaqIndex((i) => (i + 1) % Math.min(faqs.length, 5));
    }, ms) as unknown as number;

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [loading, faqs, faqIndex]);

  // Helper to extract hostname and build favicon URL
  const getFaviconUrl = (websiteUrl: string) => {
    try {
      const hostname = new URL(websiteUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return '';
    }
  };

  const currentFaq = faqs.length ? faqs[faqIndex % Math.min(faqs.length, 5)] : undefined;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navbar />

      <main className="flex-1 ml-0 sm:ml-20 relative">
        {/* Page container */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 pb-[env(safe-area-inset-bottom)]">
          <h2 className="text-2xl font-semibold mb-6">
            Suppliers for “{product}” in {country}
          </h2>

          {loading && (
            <div className="absolute inset-0 bg-gray-50/90 flex flex-col items-center justify-center z-10 p-4">
              <p
                style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#012547',
                }}
                className="text-center mb-4"
              >
                Our engine discovers top suppliers as it searches all sources in just 10 to 30 seconds
              </p>

              {/* Rotating FAQ card */}
              {currentFaq ? (
                <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5 mb-6">
                  <div className="flex items-center gap-2 text-[#012547] mb-2">
                    <Info size={18} className="shrink-0" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Key Insights</span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1 break-words [overflow-wrap:anywhere]">
                    {currentFaq.title}
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {currentFaq.answer}
                  </p>
                </div>
              ) : null}

              <Loader />
            </div>
          )}

          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && suppliers.length === 0 && (
            <p>No suppliers found.</p>
          )}

          {/* Analyzed Suppliers Section */}
          {!loading && analyzedSuppliers.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-green-600" size={20} />
                <h3 className="text-lg font-semibold text-gray-800">
                  Previously Analyzed Suppliers ({analyzedSuppliers.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6">
                {analyzedSuppliers.map((s) => {
                  const faviconUrl = getFaviconUrl(s.url);
                  const isAnalyzed = true;

                  return (
                    <div
                      key={s.url}
                      className="w-full rounded-2xl bg-white p-4 sm:p-5 md:p-6 shadow-sm border border-green-300 ring-2 ring-green-100"
                    >
                      {/* Header: favicon + name + score badge */}
                      <div className="flex items-start justify-between mb-3 sm:mb-4 min-w-0 gap-3">
                        <div className="flex items-center min-w-0 flex-1">
                          {faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt={`${s.name} favicon`}
                              className="w-6 h-6 mr-2 shrink-0"
                              onError={handleImgError}
                            />
                          )}
                          <h3 className="text-xl font-medium break-words [overflow-wrap:anywhere]">
                            {s.name}
                          </h3>
                        </div>

                        {/* Score and Star Rating */}
                        <div className="flex items-center gap-2 shrink-0">
                          {s.star_rating && (
                            <div className="flex items-center gap-1 bg-yellow-400 text-white px-2.5 py-1 rounded-full">
                              <Star size={13} fill="currentColor" />
                              <span className="text-xs font-semibold">{s.star_rating}</span>
                            </div>
                          )}
                          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                            Score: {s.overall_score}/25
                          </div>
                        </div>
                      </div>

                      {/* Analysis Badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {s.b2b_platform_verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            <CheckCircle size={11} />
                            {s.b2b_platform_name || 'B2B Verified'}
                          </span>
                        )}
                        {s.certifications && s.certifications.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                            <Shield size={11} />
                            {s.certifications.length} Cert{s.certifications.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      {Boolean(s.summary) && (
                        <p className="text-sm text-gray-600 mt-1 break-words [overflow-wrap:anywhere]">
                          {s.summary}
                        </p>
                      )}

                      {/* Details */}
                      <div className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3 text-[#012547] leading-relaxed">
                        {s.url && (
                          <div className="flex items-start gap-2.5">
                            <Globe size={20} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 w-full">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-full text-blue-600 underline underline-offset-2 break-all break-words [overflow-wrap:anywhere] whitespace-normal"
                              >
                                {s.url}
                              </a>
                            </div>
                          </div>
                        )}

                        {s.email && (
                          <div className="flex items-start gap-2.5">
                            <Mail size={20} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 w-full">
                              <a
                                href={`mailto:${s.email}`}
                                className="block max-w-full underline break-all break-words [overflow-wrap:anywhere] whitespace-normal"
                              >
                                {s.email}
                              </a>
                            </div>
                          </div>
                        )}

                        {s.phone && (
                          <div className="flex items-start gap-2.5">
                            <Phone size={20} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 w-full break-words [overflow-wrap:anywhere]">
                              {s.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Suppliers Section */}
          {!loading && newSuppliers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Info className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-gray-800">
                  New Suppliers ({newSuppliers.length})
                </h3>
                <span className="text-sm text-gray-500 italic">Analysis in progress...</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6">
                {newSuppliers.map((s) => {
                  const faviconUrl = getFaviconUrl(s.url);

                  return (
                    <div
                      key={s.url}
                      className="w-full rounded-2xl bg-white p-4 sm:p-5 md:p-6 shadow-sm border border-gray-200"
                    >
                      {/* Header: favicon + name */}
                      <div className="flex items-start justify-between mb-3 sm:mb-4 min-w-0 gap-3">
                        <div className="flex items-center min-w-0 flex-1">
                          {faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt={`${s.name} favicon`}
                              className="w-6 h-6 mr-2 shrink-0"
                              onError={handleImgError}
                            />
                          )}
                          <h3 className="text-xl font-medium break-words [overflow-wrap:anywhere]">
                            {s.name}
                          </h3>
                        </div>
                      </div>

                      {/* Summary */}
                      {Boolean(s.summary) && (
                        <p className="text-sm text-gray-600 mt-1 break-words [overflow-wrap:anywhere]">
                          {s.summary}
                        </p>
                      )}

                      {/* Details */}
                      <div className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3 text-[#012547] leading-relaxed">
                        {s.url && (
                          <div className="flex items-start gap-2.5">
                            <Globe size={20} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 w-full">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-full text-blue-600 underline underline-offset-2 break-all break-words [overflow-wrap:anywhere] whitespace-normal"
                              >
                                {s.url}
                              </a>
                            </div>
                          </div>
                        )}

                        {s.email && (
                          <div className="flex items-start gap-2.5">
                            <Mail size={20} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 w-full">
                              <a
                                href={`mailto:${s.email}`}
                                className="block max-w-full underline break-all break-words [overflow-wrap:anywhere] whitespace-normal"
                              >
                                {s.email}
                              </a>
                            </div>
                          </div>
                        )}

                        {s.phone && (
                          <div className="flex items-start gap-2.5">
                            <Phone size={20} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 w-full break-words [overflow-wrap:anywhere]">
                              {s.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Results;