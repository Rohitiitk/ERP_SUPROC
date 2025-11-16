import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';

// Components
import WordSwitcher from '../components/WordSwitcher';
import SearchBar, { SearchBarRef } from '../components/SearchBar';
import AuthModal from '../components/AuthModal';

// Assets
import DiscoverAILogo from '../assets/Discover_AI_logo.png';
// NOTE: fire.svg removed and replaced with inline animated fire icon

interface DiscoverAIProps {
  session: Session | null;
}

/**
 * Animated Fire Icon
 * Source: Uiverse.io by Admin12121 (CSS & structure adapted and scoped)
 * - Rendered inline and sized via CSS var --fire-size (defaults handled by utility classes below).
 * - We keep the same HTML structure from your snippet, but as JSX with className.
 */
const FireIcon: React.FC<{ className?: string; title?: string }> = ({ className = '', title = '' }) => {
  return (
    <span
      className={`fire-icon ${className}`}
      role="img"
      aria-label={title || 'Trending'}
      aria-hidden={title ? undefined : true}
    >
      <div className="fire">
        <div className="fire-left">
          <div className="main-fire"></div>
          <div className="particle-fire"></div>
        </div>
        <div className="fire-center">
          <div className="main-fire"></div>
          <div className="particle-fire"></div>
        </div>
        <div className="fire-right">
          <div className="main-fire"></div>
          <div className="particle-fire"></div>
        </div>
        <div className="fire-bottom">
          <div className="main-fire"></div>
        </div>
      </div>
    </span>
  );
};

function DiscoverAI({ session }: DiscoverAIProps) {
  const [topProducts, setTopProducts] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const navigate = useNavigate();
  const searchBarRef = useRef<SearchBarRef>(null);
  const [mode, setMode] = useState<'quick' | 'basic' | 'advanced'>('quick');
  const [searchParams] = useSearchParams();

  // EFFECT 1: This fetches the "Top Products" list when the page loads.
  useEffect(() => {
    fetch('/api/top-rankings')
      .then((response) => response.json())
      .then((data) => {
        if (data?.categories) {
          setTopProducts(data.categories);
        }
      })
      .catch((error) => console.error('Error fetching top products:', error));
  }, []);

  // EFFECT 2: This is the listener for the chatbot.
  useEffect(() => {
    const productFromUrl = searchParams.get('product');
    const modeFromUrl = searchParams.get('mode') as 'quick' | 'basic' | 'advanced' | null;
    const shouldInitiateSearch = searchParams.get('initiateSearch');

    if (modeFromUrl && ['quick', 'basic', 'advanced'].includes(modeFromUrl)) {
      setMode(modeFromUrl);
    }

    if (productFromUrl && shouldInitiateSearch === 'true' && searchBarRef.current) {
      setTimeout(() => {
        searchBarRef.current?.triggerSearch(productFromUrl);
      }, 100);
    }
  }, [searchParams]);

  // This is your original logic to go to the countries page. It is unchanged.
  const handleSearchAttempt = async (productName: string) => {
    if (session) {
      try {
        const resp = await fetch(
          `/api/top-countries?product=${encodeURIComponent(productName)}`
        );
        const data = resp.ok ? await resp.json() : [];
        navigate(
          `/select-country?product=${encodeURIComponent(productName)}&mode=${mode}`,
          { state: { initialCountries: data } }
        );
      } catch (err) {
        console.error('Error preloading countries:', err);
        navigate(`/select-country?product=${encodeURIComponent(productName)}&mode=${mode}`);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const handleProductClick = (productName: string) => {
    if (searchBarRef.current) {
      searchBarRef.current.triggerSearch(productName);
    }
  };

  // Only show the first 6 in the frame
  const visibleProducts = topProducts.slice(0, 6);

  return (
    <>
      {/* Radios + cards. Quick remains blue; Standard (basic) = pastel green; Pro (advanced) = pastel purple.
          Cards are compact, always horizontal on mobile, and each includes a minimal icon that glows with the card. */}
      <style>{`
        /* ================================
           GLOBAL TOKENS / BASE
        ================================ */
        :root {
          --radio-accent-h: 215;
          --radio-accent-s: 100%;
          --radio-accent-l: 60%;
          --radio-size: 18px;         /* MODIFIED: Was 20px */
          --icon-size: 18px;          /* MODIFIED: Was 20px */
          --radio-anim-offset: 24px;

          /* Neomorphic frame tokens (aligned to Tailwind gray-50 backdrop) */
          --neo-bg: #f9fafb; /* bg-gray-50 */
          --neo-shadow-light: rgba(255, 255, 255, 0.9);
          --neo-border: rgba(15, 23, 42, 0.06);

          /* UI accents */
          --accent-blue: #2563eb;  /* blue-600 */
          --accent-blue-glow: rgba(37, 99, 235, 0.5);
        }

        /* Per-card accent overrides for glow */
        .card-quick {
          --radio-accent-h: 215;
          --radio-accent-s: 100%;
          --radio-accent-l: 60%;
        }
        .card-basic { /* Standard */
          --radio-accent-h: 145;   /* pastel green */
          --radio-accent-s: 55%;
          --radio-accent-l: 62%;
        }
        .card-advanced { /* Pro */
          --radio-accent-h: 265;   /* pastel purple */
          --radio-accent-s: 70%;
          --radio-accent-l: 72%;
        }

        /* ===== Frame for Top Products (keeps soft neo container) ===== */
        .neo-panel {
          position: relative;
          background: var(--neo-bg);
          border-radius: 16px;
          padding: 14px 14px 36px 14px; /* extra bottom for the "View more" link */
          box-shadow:
            -8px -8px 16px var(--neo-shadow-light),
             8px  8px 16px rgba(17, 24, 39, 0.06);
          border: 1px solid var(--neo-border);
        }
        @media (min-width: 640px) {
          .neo-panel { padding: 16px 16px 40px 16px; border-radius: 18px; }
        }
        @media (min-width: 1024px) {
          .neo-panel { padding: 18px 18px 44px 18px; border-radius: 20px; }
        }

        /* Centered header; info button sits top-right */
        .neo-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center; /* center the title */
          gap: 10px;
          margin-bottom: 10px;
          text-align: center;
        }
        .neo-title {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #1f2937; /* gray-800 */
          font-weight: 600;
          font-size: 1rem;
          margin: 0 auto; /* ensure centered even with absolute icon */
          padding: 0 42px; /* breathing room so text doesn't collide with icon */
        }
        @media (min-width: 640px) {
          .neo-title { font-size: 1.0625rem; }
        }

        /* Info icon */
        .neo-info-btn {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          appearance: none;
          border: 0;
          background: transparent;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-blue);
          transition: filter .12s ease, color .12s ease;
        }
        .neo-info-btn:hover {
          filter: drop-shadow(0 0 6px var(--accent-blue-glow));
        }
        .neo-info-btn:active {
          filter: none;
          transform: translateY(-50%);
        }
        .neo-info-pop {
          position: absolute;
          top: 44px;
          right: 12px;
          width: min(92vw, 360px);
          background: #ffffff;
          color: #111827;
          border-radius: 12px;
          border: 1px solid rgba(15,23,42,0.06);
          box-shadow: 0 12px 28px rgba(17,24,39,0.12), 0 2px 6px rgba(17,24,39,0.06);
          padding: 12px 14px;
          z-index: 10;
        }
        .neo-info-pop:before {
          content: "";
          position: absolute;
          top: -8px;
          right: 18px;
          border-width: 8px;
          border-style: solid;
          border-color: transparent transparent #ffffff transparent;
          filter: drop-shadow(0 -1px 0 rgba(17,24,39,0.06));
        }

        /* Grid for 6 items: 2x3 on phones, 3x2 on sm+ */
        .product-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        @media (min-width: 640px) {
          .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        }
        @media (min-width: 1024px) {
          .product-grid { gap: 14px; }
        }

        /* Product items */
        .product-item {
          appearance: none;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 10px 12px;
          width: 100%;
          text-align: left;
          color: #374151; /* gray-700 */
          font-weight: 500;
          line-height: 1.25;

          white-space: normal;
          word-break: break-word;
          overflow: visible;
          text-overflow: clip;

          min-height: 2.6em;

          transition: box-shadow .14s ease, transform .14s ease, background .14s ease, border-color .14s ease;
        }
        .product-item:hover {
          background: #ffffff;
          border-color: rgba(15,23,42,0.06);
          box-shadow: 0 8px 18px rgba(17,24,39,0.08), 0 2px 6px rgba(17,24,39,0.05);
          transform: translateY(-2px);
        }
        .product-item:active {
          background: #f3f4f6; /* gray-100 */
          border-color: rgba(15,23,42,0.10);
          box-shadow: none;
          transform: translateY(1px);
        }
        .product-item:focus-visible {
          outline: 2px solid rgba(59,130,246,0.55);
          outline-offset: 2px;
          background: #ffffff;
          border-color: rgba(59,130,246,0.35);
        }

        /* Bottom-right "View more" mini link inside frame */
        .mini-link {
          position: absolute;
          right: 12px;
          bottom: 10px;
          font-size: 0.8125rem;
          color: var(--accent-blue);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .mini-link button {
          color: inherit;
          background: transparent;
          border: 0;
          padding: 4px 6px;
          border-radius: 8px;
        }
        .mini-link button:hover { text-decoration: underline; }

        /* Modal (All products) */
        .modal-overlay {
          position: fixed;
          inset: 0;
          backdrop-filter: blur(4px);
          background: rgba(2,6,23,0.28);
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-card {
          width: min(980px, 92vw);
          max-height: min(86vh, 980px);
          overflow: hidden;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 24px 48px rgba(2,6,23,0.30), 0 2px 8px rgba(2,6,23,0.20);
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(15,23,42,0.06);
        }
        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(15,23,42,0.06);
          background: linear-gradient(180deg, #ffffff, #fbfdff);
        }
        .modal-title {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: #111827; /* gray-900 */
        }
        .modal-body {
          padding: 14px 16px 18px;
          overflow: auto;
        }
        .modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        @media (min-width: 640px) {
          .modal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        }
        @media (min-width: 1024px) {
          .modal-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        }
        .modal-close {
          appearance: none;
          border: 0;
          background: #f3f4f6;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #4b5563;
          transition: background .12s ease, transform .12s ease;
        }
        .modal-close:hover { background: #e5e7eb; }
        .modal-close:active { transform: translateY(0.5px); }

        /* ============ RADIO (base) ============ */
        .mode-choices .input {
          -webkit-appearance: none;
          appearance: none;
          display: inline-block;
          margin: 0;
          flex-shrink: 0;
          width: var(--radio-size);
          height: var(--radio-size);
          border-radius: 9999px; /* perfect circle */
          cursor: pointer;
          vertical-align: middle;
          outline: none;
          box-shadow: hsla(0,0%,100%,.70) 0 1px 1px, inset hsla(220,15%,20%,.25) 0 0 0 1px;
          background-color: hsla(210, 20%, 97%, 1);
          /* QUICK (default blue) */
          background-image: -webkit-radial-gradient(
            hsla(215,100%,92%,1) 0%,
            hsla(215,100%,70%,.85) 15%,
            hsla(215,100%,60%,.25) 28%,
            hsla(215,100%,30%,0) 70%
          );
          background-repeat: no-repeat;
          -webkit-transition:
            background-position .15s cubic-bezier(.8, 0, 1, 1),
            -webkit-transform .25s cubic-bezier(.8, 0, 1, 1);
          transition:
            background-position .15s cubic-bezier(.8, 0, 1, 1),
            transform .25s cubic-bezier(.8, 0, 1, 1);
        }

        /* QUICK radio explicit rule to match Standard/Pro pattern */
        .mode-choices .input--quick {
          background-image: -webkit-radial-gradient(
            hsla(215,100%,92%,1) 0%,
            hsla(215,100%,70%,.85) 15%,
            hsla(215,100%,60%,.25) 28%,
            hsla(215,100%,30%,0) 70%
          );
        }

        /* STANDARD (pastel green) radio */
        .mode-choices .input--basic {
          background-image: -webkit-radial-gradient(
            hsla(145, 80%, 92%, 1) 0%,
            hsla(145, 65%, 70%, .85) 15%,
            hsla(145, 60%, 60%, .25) 28%,
            hsla(145, 60%, 30%, 0) 70%
          );
        }

        /* PRO (pastel purple) radio */
        .mode-choices .input--advanced {
          background-image: -webkit-radial-gradient(
            hsla(265, 100%, 93%, 1) 0%,
            hsla(265, 80%, 75%, .85) 15%,
            hsla(265, 70%, 65%, .25) 28%,
            hsla(265, 70%, 35%, 0) 70%
          );
        }

        .mode-choices .input:checked {
          -webkit-transition:
            background-position .2s .15s cubic-bezier(0, 0, .2, 1),
            -webkit-transform .25s cubic-bezier(0, 0, .2, 1);
          transition:
            background-position .2s .15s cubic-bezier(0, 0, .2, 1),
            transform .25s cubic-bezier(0, 0, .2, 1);
        }
        .mode-choices .input:active {
          transform: scale(1.15);
          -webkit-transform: scale(1.15);
          -webkit-transition: -webkit-transform .1s cubic-bezier(0, 0, .2, 1);
          transition: transform .1s cubic-bezier(0, 0, .2, 1);
        }
        .mode-choices .input,
        .mode-choices .input:active { background-position: 0 var(--radio-anim-offset); }
        .mode-choices .input:checked { background-position: 0 0; }
        .mode-choices .input:checked ~ .input,
        .mode-choices .input:checked ~ .input:active { background-position: 0 calc(var(--radio-anim-offset) * -1); }

        /* ============ CARDS (compact & always horizontal) ============ */
        .mode-choices { width: 100%; }

        .mode-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          justify-items: center;
          align-items: stretch;
        }
        @media (min-width: 640px) { /* sm */
          .mode-grid { gap: 8px; }
        }
        @media (min-width: 1024px) { /* lg */
          .mode-grid { gap: 10px; }
        }

        .mode-card {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e5e7eb; /* CORRECTED TYPO */
          box-shadow: 0 1px 2px rgba(16,24,40,0.06);
          transition: box-shadow .15s ease, border-color .15s ease, transform .15s ease;
          max-width: 150px; /* MODIFIED: Final width increase */
          width: 100%;
        }
        @media (min-width: 640px) { /* sm */
          .mode-card { max-width: 160px; padding: 9px; }
        }
        @media (min-width: 1024px) { /* lg */
          .mode-card { max-width: 170px; padding: 10px; }
        }

        .mode-card > div {
          flex: 1;
          min-width: 0;
        }

        .mode-card:hover {
          box-shadow: 0 6px 14px rgba(16,24,40,0.08);
          border-color: #d1d5db;
          transform: translateY(-1px);
        }

        .mode-card.selected {
          border-color: hsla(var(--radio-accent-h), var(--radio-accent-s), calc(var(--radio-accent-l) - 5%), 0.9);
          box-shadow:
            0 0 0 3px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.28),
            0 0 20px 6px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.32),
            0 8px 20px rgba(16,24,40,0.08);
        }
        .mode-card.selected:hover {
          box-shadow:
            0 0 0 3px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.35),
            0 0 24px 8px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.38),
            0 10px 24px rgba(16,24,40,0.10);
          transform: translateY(-1px);
        }

        .mode-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: var(--icon-size);
          height: var(--icon-size);
          color: #6b7280;
          transition: color .15s ease, filter .15s ease;
          flex: 0 0 var(--icon-size);
        }
        .mode-icon svg {
          width: 100%;
          height: 100%;
          stroke: currentColor;
        }

        .mode-card.selected .mode-icon {
          color: hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 1);
          filter: drop-shadow(0 0 6px hsla(var(--radio-accent-h), var(--radio-accent-s), var(--radio-accent-l), 0.55));
        }

        .mode-title {
          font-weight: 600;
          color: #111827;
          font-size: 0.6875rem;
          line-height: 1.15;
          letter-spacing: -0.025em;
        }
        @media (min-width: 640px) {
          .mode-title { font-size: 0.75rem; }
        }
        @media (min-width: 1024px) {
          .mode-title { font-size: 0.8125rem; }
        }

        .mode-desc {
          color: #6b7280;
          font-size: 0.5625rem;
          line-height: 1.1;
          margin-top: 1px;
        }
        @media (min-width: 640px) {
          .mode-desc { font-size: 0.625rem; }
        }
        @media (min-width: 1024px) {
          .mode-desc { font-size: 0.6875rem; }
        }

        .mode-label {
          display: flex;
          align-items: center;
          width: 100%;
          cursor: pointer;
        }

        /* ================================
           UIVERSE FIRE ICON (scoped & sized)
           Source CSS exactly included, then overridden for inline sizing.
        ================================ */
        /* From Uiverse.io by Admin12121 */
        @keyframes scaleUpDown {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50%, 90% { transform: scaleY(1.1); }
          75% { transform: scaleY(0.95); }
          80% { transform: scaleX(0.95); }
        }
        @keyframes shake {
          0%, 100% { transform: skewX(0) scale(1); }
          50% { transform: skewX(5deg) scale(0.9); }
        }
        @keyframes particleUp {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; top: -100%; transform: scale(0.5); }
        }
        @keyframes glow {
          0%, 100% { background-color: #ef5a00; }
          50% { background-color: #ff7800; }
        }

        /* Original base styles from snippet */
        .fire {
          position: absolute;
          top: calc(50% - 50px);
          left: calc(50% - 50px);
          width: 100px;
          height: 100px;
          background-color: transparent;
          margin-left: auto;
          margin-right: auto;
        }
        .fire-center { position: absolute; height: 100%; width: 100%; animation: scaleUpDown 3s ease-out infinite both; }
        .fire-center .main-fire {
          position: absolute; width: 100%; height: 100%;
          background-image: radial-gradient(farthest-corner at 10px 0, #d43300 0%, #ef5a00 95%);
          transform: scaleX(0.8) rotate(45deg);
          border-radius: 0 40% 60% 40%;
          filter: drop-shadow(0 0 10px #d43322);
        }
        .fire-center .particle-fire {
          position: absolute; top: 60%; left: 45%;
          width: 3px; height: 3px;                 /* was 10px x 10px */
          background-color: #ef5a00;
          border-radius: 50%;
          filter: drop-shadow(0 0 6px #d43322);    /* original; overridden below for icon */
          animation: particleUp 2s ease-out 0s infinite both;
        }
        .fire-right { height: 100%; width: 100%; position: absolute; animation: shake 2s ease-out 0s infinite both; }
        .fire-right .main-fire {
          position: absolute; top: 15%; right: -25%; width: 80%; height: 80%; background-color: #ef5a00;
          transform: scaleX(0.8) rotate(45deg);
          border-radius: 0 40% 60% 40%; filter: drop-shadow(0 0 10px #d43322);
        }
        .fire-right .particle-fire {
          position: absolute; top: 45%; left: 50%;
          width: 4px; height: 4px;                 /* was 15px x 15px */
          background-color: #ef5a00;
          transform: scaleX(0.8) rotate(45deg);
          border-radius: 50%;
          filter: drop-shadow(0 0 6px #d43322);    /* original; overridden below for icon */
          animation: particleUp 2s ease-out 0s infinite both;
        }
        .fire-left { position: absolute; height: 100%; width: 100%; animation: shake 3s ease-out 0s infinite both; }
        .fire-left .main-fire {
          position: absolute; top: 15%; left: -20%; width: 80%; height: 80%; background-color: #ef5a00;
          transform: scaleX(0.8) rotate(45deg); border-radius: 0 40% 60% 40%;
          filter: drop-shadow(0 0 10px #d43322);
        }
        .fire-left .particle-fire {
          position: absolute; top: 10%; left: 20%;
          width: 3px; height: 3px;                 /* was 10% x 10% (percent-based) */
          background-color: #ef5a00;
          border-radius: 50%;
          filter: drop-shadow(0 0 6px #d43322);    /* original; overridden below for icon */
          animation: particleUp 3s infinite ease-out 0s; animation-fill-mode: both;
        }
        .fire-bottom .main-fire {
          position: absolute; top: 30%; left: 20%; width: 75%; height: 75%; background-color: #ff7800;
          transform: scaleX(0.8) rotate(45deg); border-radius: 0 40% 100% 40%;
          filter: blur(10px); animation: glow 2s ease-out 0s infinite both;
        }

        /* ======= Scoped inline overrides to make it a tidy small icon (reduced glow) ======= */
        .fire-icon {
            --fire-size: 12px;            /* much smaller on mobile (was 20px) */
            position: relative;
            display: inline-block;
            width: var(--fire-size);
            height: var(--fire-size);
            vertical-align: middle;
            line-height: 0;
            pointer-events: none;
          }
          @media (min-width: 768px) {     /* md */
            .fire-icon { --fire-size: 14px; }  /* compact on larger screens (was 24px) */
          }
        .fire-icon .fire {
          position: relative !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          background: transparent;
        }
        /* MUCH softer glow for inline icon */
        .fire-icon .main-fire,
        .fire-icon .particle-fire {
          filter: drop-shadow(0 0 2px rgba(212, 51, 34, 0.35));  /* was 6–10px solid */
        }
        /* Reduce the fuzzy base glow at the bottom */
        .fire-icon .fire-bottom .main-fire {
          filter: blur(3px);                                      /* was 10px */
        }
        /* Ensure the internal absolute children are contained within the icon box */
        .fire-icon .fire-left,
        .fire-icon .fire-center,
        .fire-icon .fire-right,
        .fire-icon .fire-bottom {
          position: absolute;
          inset: 0;
        }

        /* Utility variants for reusability (header & modal use the same) */
        .fire-icon--sm { /* uses default --fire-size (12 -> 14 on md) */ }
      `}</style>




      <div
        className={`min-h-screen bg-gray-50 flex flex-col transition-filter duration-300 ${
          isModalOpen ? 'blur-sm' : ''
        }`}
      >
        <main className="flex-grow">
          {/* HERO */}
          <section className="px-4 md:px-8 min-h-[60vh] sm:min-h-[58vh] md:min-h-[68vh] lg:min-h-[66vh] xl:min-h-[64vh] flex flex-col items-center justify-center py-10 md:py-16">
            <div className="w-full text-center translate-y-[-1.5vh] md:translate-y-[1vh] lg:translate-y-[1.5vh]">
              <div className="mb-9 md:mb-12">
                <img
                  src={DiscoverAILogo}
                  alt="Discover AI Logo"
                  className="h-16 mx-auto mb-6"
                />
                <p className="text-xl text-gray-700 text-center">
                  Connect with suppliers for your <WordSwitcher />
                </p>
              </div>

              {/* Search Bar */}
              <div className="max-w-2xl mx-auto">
                <SearchBar
                  ref={searchBarRef}
                  onAnimationComplete={handleSearchAttempt}
                />
              </div>

              {/* Search Mode – pushed a bit lower */}
              <div className="mt-8 sm:mt-10 md:mt-12 max-w-2xl mx-auto text-left">
                <div
                  className="mode-choices"
                  role="radiogroup"
                  aria-label="Search mode"
                >
                  <div className="mode-grid">
                    {/* QUICK (blue) */}
                    <label
                      htmlFor="mode-quick"
                      className={`mode-card mode-label card-quick ${mode === 'quick' ? 'selected' : ''}`}
                    >
                      <input
                        id="mode-quick"
                        type="radio"
                        name="searchMode"
                        className="input input--quick"
                        checked={mode === 'quick'}
                        onChange={() => setMode('quick')}
                        aria-label="Fast & Free 0 credits"
                      />
                      <span className="mode-icon" aria-hidden="true">
                        {/* Lightning (zap) icon */}
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                      </span>
                      <div>
                        <div className="mode-title">Quick</div>
                        <div className="mode-desc">Fast & Free 0 credits</div>
                      </div>
                    </label>

                    {/* STANDARD (pastel green) -> underlying 'basic' */}
                    <label
                      htmlFor="mode-basic"
                      className={`mode-card mode-label card-basic ${mode === 'basic' ? 'selected' : ''}`}
                    >
                      <input
                        id="mode-basic"
                        type="radio"
                        name="searchMode"
                        className="input input--basic"
                        checked={mode === 'basic'}
                        onChange={() => setMode('basic')}
                        aria-label="Standard mode: Balanced detail 1 credit"
                      />
                      <span className="mode-icon" aria-hidden="true">
                        {/* Shield-check icon */}
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2l7 4v5c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6l7-4z"></path>
                          <path d="M9 12l2 2 4-4"></path>
                        </svg>
                      </span>
                      <div>
                        <div className="mode-title">Standard</div>
                        <div className="mode-desc">Balanced detail 1 credit</div>
                      </div>
                    </label>

                    {/* PRO (pastel purple) -> underlying 'advanced' */}
                    <label
                      htmlFor="mode-advanced"
                      className={`mode-card mode-label card-advanced ${mode === 'advanced' ? 'selected' : ''}`}
                    >
                      <input
                        id="mode-advanced"
                        type="radio"
                        name="searchMode"
                        className="input input--advanced"
                        checked={mode === 'advanced'}
                        onChange={() => setMode('advanced')}
                        aria-label="Pro mode: Deeper reach 2 credits"
                      />
                      <span className="mode-icon" aria-hidden="true">
                        {/* Target (bullseye) icon */}
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="8"></circle>
                          <circle cx="12" cy="12" r="4"></circle>
                          <line x1="12" y1="4" x2="12" y2="2"></line>
                          <line x1="20" y1="12" x2="22" y2="12"></line>
                          <line x1="12" y1="22" x2="12" y2="20"></line>
                          <line x1="2" y1="12" x2="4" y2="12"></line>
                        </svg>
                      </span>
                      <div>
                        <div className="mode-title">Pro</div>
                        <div className="mode-desc">Deeper reach 2 credits</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* TOP PRODUCTS (Framed with 6 items) */}
          <section
            className="
              px-4 md:px-8 w-full max-w-5xl mx-auto
              mt-3
            "
          >
            <div className="neo-panel">
              <div className="neo-header">
                <div className="neo-title">
                  {/* Replaced old <img src={fire.svg} .../> with animated FireIcon */}
                  <FireIcon className="fire-icon--sm" />
                  <span>Top Products Globally</span>
                </div>

                <button
                  type="button"
                  className="neo-info-btn"
                  aria-label="About these products"
                  onClick={() => setIsInfoOpen((s) => !s)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="8" />
                  </svg>
                </button>

                {isInfoOpen && (
                  <div
                    role="status"
                    className="neo-info-pop"
                    onMouseLeave={() => setIsInfoOpen(false)}
                  >
                    <p className="text-sm leading-snug">
                      These products reflect aggregated global sales popularity and sourcing interest across categories. The list updates periodically to highlight items with sustained international demand.
                    </p>
                  </div>
                )}
              </div>

              <ul className="product-grid" role="list">
                {visibleProducts.map((product, idx) => (
                  <li key={`${product}-${idx}`}>
                    <button
                      type="button"
                      className="product-item"
                      title={product}
                      onClick={() => handleProductClick(product)}
                    >
                      {product}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mini-link">
                <button type="button" onClick={() => setIsAllOpen(true)}>
                  View more
                </button>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </section>
        </main>

        <footer className="w-full text-center py-4">
          <p className="text-sm text-gray-500">© Suproc 2024 - 2025 All rights reserved</p>
        </footer>
      </div>

      {/* All Products Modal */}
      {isAllOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="All Top Products"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAllOpen(false);
          }}
        >
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">
                {/* Replaced old <img src={fire.svg} .../> with animated FireIcon */}
                <FireIcon className="fire-icon--sm" />
                <span>All Top Products</span>
              </div>
              <button
                className="modal-close"
                aria-label="Close"
                onClick={() => setIsAllOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <ul className="modal-grid" role="list">
                {topProducts.map((product, idx) => (
                  <li key={`${product}-all-${idx}`}>
                    <button
                      type="button"
                      className="product-item"
                      title={product}
                      onClick={() => {
                        setIsAllOpen(false);
                        handleProductClick(product);
                      }}
                    >
                      {product}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default DiscoverAI;
