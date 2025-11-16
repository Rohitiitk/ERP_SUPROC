// src/pages/SelectCountry.tsx
import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';

interface Country {
  name: string;
  code: string; // ISO-2 preferred (e.g., "CN", "US"). Used for higher-res flags.
  flag: string; // Optional direct URL; we fallback to this if present.
}

interface LocationState {
  initialCountries?: Country[];
}

/**
 * Coalesced request cache to prevent duplicate network calls in React 18 StrictMode.
 * Keyed by product.
 */
const countryRequestCache = new Map<string, Promise<Country[]>>();

function fetchTopCountriesCoalesced(product: string): Promise<Country[]> {
  const key = product.trim().toLowerCase();
  const existing = countryRequestCache.get(key);
  if (existing) return existing;

  const p = fetch(`/api/top-countries?product=${encodeURIComponent(product)}`)
    .then((resp) => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json() as Promise<Country[]>;
    })
    // Let the promise be reusable while in-flight; remove after it settles so future searches can refetch.
    .finally(() => {
      countryRequestCache.delete(key);
    });

  countryRequestCache.set(key, p);
  return p;
}

const SelectCountry = () => {
  const [params] = useSearchParams();
  const product = params.get('product') ?? '';
  const mode = params.get('mode') ?? 'quick';
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [countries, setCountries] = useState<Country[]>(state?.initialCountries ?? []);
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const didFetch = useRef(false);

  useEffect(() => {
    // If already provided via navigation state, or no product, do nothing.
    if (!product || state?.initialCountries) return;

    // Avoid duplicate network calls caused by React 18 StrictMode by coalescing:
    // we DON'T abort the shared promise; we just ignore stale updates from the first pass.
    let isActive = true;

    // Keep original guard to prevent repeated manual triggers within the same mount.
    if (didFetch.current) return;
    didFetch.current = true;

    fetchTopCountriesCoalesced(product)
      .then((data) => {
        if (isActive) setCountries(data);
      })
      .catch((err) => {
        if (isActive) console.error('Failed to load top countries:', err);
      });

    return () => {
      // Mark this pass as inactive; the in-flight promise continues and the second StrictMode pass will consume it.
      isActive = false;
    };
  }, [product, state?.initialCountries]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const country = custom.trim() || selected;
    if (!country) {
      setError('Please choose or enter a country.');
      return;
    }
    setError('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 50));

    const url = `/results?product=${encodeURIComponent(product)}&country=${encodeURIComponent(country)}&mode=${encodeURIComponent(mode)}`;
    navigate(url);
  };

  const handleClear = () => navigate('/');

return (
  <div className="bg-gray-50"> 
    <main className="flex-1 relative"> 
        <section className="px-4 sm:px-8 min-h-[70vh] md:min-h-[80vh] flex items-center justify-center py-8 sm:py-12">
          <div className="w-full translate-y-[-2vh] md:translate-y-0 flex items-center justify-center">
            <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4">
                Select a top country producing <strong>{product}</strong>
              </h2>

              {error && <p className="text-red-500 mb-2">{error}</p>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  {countries.map((c) => {
                    // Prefer high-res flag from FlagCDN when we have ISO code
                    const code = (c.code || '').toLowerCase();
                    const flagSrc =
                      c.flag ||
                      (code ? `https://flagcdn.com/w40/${code}.png` : '');
                    const flagSrcSet =
                      code ? `https://flagcdn.com/w80/${code}.png 2x` : undefined;

                    return (
                      <label
                        key={c.code || c.name}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition"
                      >
                        <input
                          type="radio"
                          name="country"
                          value={c.name}
                          checked={selected === c.name}
                          onChange={() => {
                            setSelected(c.name);
                            setCustom('');
                          }}
                          className="form-radio"
                        />
                        {flagSrc ? (
                          <img
                            src={flagSrc}
                            srcSet={flagSrcSet}
                            sizes="24px"
                            alt={c.name}
                            width={24}
                            height={16}
                            loading="lazy"
                            className="w-6 h-4 object-contain rounded-sm shadow-sm [image-rendering:-webkit-optimize-contrast] [image-rendering:crisp-edges]"
                          />
                        ) : null}
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label className="block mb-1">Or enter a country:</label>
                  <input
                    type="text"
                    value={custom}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setCustom(e.target.value);
                      setSelected('');
                    }}
                    placeholder="e.g. Vietnam"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2 bg-[#0C2540] text-white rounded-lg text-sm font-medium hover:bg-[#0A2136] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0C2540] focus:ring-offset-2"
                  >
                    Search Suppliers
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="absolute inset-0 bg-gray-50 bg-opacity-90 flex flex-col items-center justify-center z-10">
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
            <Loader />
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default SelectCountry;
