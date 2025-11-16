// =============================
// File: src/pages/Landing.tsx
// =============================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/neumo.css';

/** --------- Asset URLs --------- */
const logoUrl = new URL('../assets/fullLogo.png', import.meta.url).href;
const whiteLogoUrl = new URL('../assets/whitelogo.png', import.meta.url).href;
const ceoUrl = new URL('../assets/teams/ceo.jpg', import.meta.url).href;
const csoUrl = new URL('../assets/teams/cso.jpg', import.meta.url).href;
const devUrl = new URL('../assets/teams/developer.jpg', import.meta.url).href;
const desUrl = new URL('../assets/teams/designer.jpg', import.meta.url).href;

/** --------- Types --------- */
type LandingTheme = 'light' | 'dark';
type FeatureId = 'discover' | 'rfq' | 'rfp' | 'bidding' | 'erp' | 'chat';
type NavId = 'overview' | 'solutions' | 'journey' | 'faq';
type IconProps = React.SVGAttributes<SVGSVGElement> & { className?: string };
type NavItem = { id: NavId; label: string; target: string; Icon: (props: IconProps) => JSX.Element };

type Feature = {
  id: FeatureId;
  badge: string;
  title: string;
  summary: string;
  bullets: string[];
  media: (theme: LandingTheme) => JSX.Element;
  cta?: { label: string; href: string };
};

type TimelineStep = {
  id: number;
  title: string;
  caption: string;
  detail: string;
};

type MetricHighlight = {
  label: string;
  value: string;
  delta: string;
  description: string;
};

type FAQItem = {
  question: string;
  summary: string;
  body: string;
};

/** --------- Hooks --------- */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    setMatches(media.matches);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/** --------- Icons --------- */
const IconSparkle = ({ className, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} {...rest}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l1.9 3.86 4.1.6-3 2.94.71 4.09L12 12.98l-3.71 1.91.71-4.09-3-2.94 4.1-.6L12 3.5z" />
  </svg>
);

const IconGrid = ({ className, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} {...rest}>
    <rect x="4" y="4" width="6" height="6" rx="1.4" />
    <rect x="14" y="4" width="6" height="6" rx="1.4" />
    <rect x="4" y="14" width="6" height="6" rx="1.4" />
    <rect x="14" y="14" width="6" height="6" rx="1.4" />
  </svg>
);

const IconChart = ({ className, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} {...rest}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14M7 15l3-3 3 3 4-5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h3v3" />
  </svg>
);

const IconQuestion = ({ className, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} {...rest}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.82 0c0 1.657-1.5 2.3-2.31 2.85-.63.42-.91.76-.91 1.65" />
    <circle cx="12" cy="18" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="9.25" />
  </svg>
);

/** --------- Theme Switch & Header --------- */
function ThemeSwitch({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const iconTransition = { duration: 0.35, ease: [0.4, 0, 0.2, 1] };

  return (
    <button
      type="button"
      className="landing-toggle"
      data-theme={isDark ? 'dark' : 'light'}
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.svg
            key="moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="landing-toggle__icon"
            initial={{ opacity: 0, rotate: -90, scale: 0.65 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.65 }}
            transition={iconTransition}
          >
            <path
              d="M21 12.5c0 4.972-4.028 9-9 9s-9-4.028-9-9 4.028-9 9-9c.31 0 .616.014.918.043a6.5 6.5 0 000 11.917A9.026 9.026 0 0021 12.5z"
              fill="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            className="landing-toggle__icon"
            initial={{ opacity: 0, rotate: -90, scale: 0.65 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.65 }}
            transition={iconTransition}
          >
            <circle cx="12" cy="12" r="4.25" fill="currentColor" stroke="none" />
            <circle cx="12" cy="4" r="1.2" />
            <circle cx="17.657" cy="6.343" r="1.2" />
            <circle cx="20" cy="12" r="1.2" />
            <circle cx="17.657" cy="17.657" r="1.2" />
            <circle cx="12" cy="20" r="1.2" />
            <circle cx="6.343" cy="17.657" r="1.2" />
            <circle cx="4" cy="12" r="1.2" />
            <circle cx="6.343" cy="6.343" r="1.2" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}

function HeaderBar({
  theme,
  onToggleTheme,
  navItems,
  activeNav,
  onNavSelect,
}: {
  theme: LandingTheme;
  onToggleTheme: () => void;
  navItems: NavItem[];
  activeNav: NavId;
  onNavSelect: (item: NavItem) => void;
}) {
  const isDark = theme === 'dark';
  const shell = isDark
    ? 'bg-[rgba(5,10,22,0.82)] border border-[rgba(67,97,150,0.35)] shadow-[0_20px_60px_rgba(3,9,21,0.65)] text-slate-200'
    : 'bg-white/80 border border-white/60 shadow-[0_18px_56px_rgba(15,23,42,0.12)] text-slate-700';
  const navBtnBase =
    'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 backdrop-blur-sm';
  const navBtnActive = isDark
    ? 'bg-[rgba(53,161,255,0.28)] text-sky-100 shadow-[0_14px_38px_rgba(46,197,255,0.28)]'
    : 'bg-indigo-500/15 text-indigo-600 shadow-[0_14px_32px_rgba(79,70,229,0.18)]';
  const navBtnIdle = isDark
    ? 'text-slate-400 hover:text-sky-200 hover:bg-white/5'
    : 'text-slate-600 hover:text-indigo-600 hover:bg-white/50';
  const ctaShell = isDark
    ? 'bg-[rgba(11,17,29,0.82)] border border-[rgba(60,96,150,0.28)] text-slate-200 shadow-[0_20px_50px_rgba(3,9,20,0.55)]'
    : 'bg-white/85 border border-white/60 text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.12)]';
  const logoWrap = isDark
    ? 'inline-flex items-center justify-center rounded-2xl border border-sky-100/25 bg-gradient-to-br from-sky-100/60 via-sky-100/25 to-white/10 px-2 py-1 backdrop-blur-md shadow-[12px_12px_28px_rgba(4,12,30,0.45),-10px_-10px_26px_rgba(120,170,255,0.28)]'
    : 'inline-flex items-center justify-center';

  return (
    <header className={`relative z-40 ${isDark ? 'border-b border-white/10 bg-transparent' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:h-20 sm:px-6">
        <Link to="/" className="flex items-center gap-2 rounded-full bg-black/0 p-0 transition hover:opacity-90">
          <span className={logoWrap}>
            <img
              src={logoUrl}
              alt="Suproc"
              className="h-7 w-auto drop-shadow-[0_10px_30px_rgba(35,122,255,0.18)] sm:h-8"
              decoding="async"
              fetchPriority="high"
            />
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className={`hidden items-center gap-2 rounded-full px-2 py-1.5 md:flex backdrop-blur-md transition-colors ${shell}`}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavSelect(item)}
                className={`${navBtnBase} ${activeNav === item.id ? navBtnActive : navBtnIdle}`}
              >
                <item.Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className={`flex items-center gap-1.5 rounded-full px-1.5 py-1 backdrop-blur-md transition sm:gap-2 sm:px-2 sm:py-1.5 ${ctaShell}`}>
            <Link
              to="/login"
              className={`px-2 py-1 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm ${
                isDark ? 'text-slate-300 hover:text-sky-200' : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Sign in
            </Link>
            <Link to="/signup" className="landing-pearl-btn">
              <div className="landing-pearl-btn__wrap">
                <p>
                  <span>✧</span>
                  <span>✦</span>
                  Get started
                </p>
              </div>
            </Link>
          </div>
          <ThemeSwitch isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({
  theme,
  navItems,
  activeNav,
  onNavSelect,
}: {
  theme: LandingTheme;
  navItems: NavItem[];
  activeNav: NavId;
  onNavSelect: (item: NavItem) => void;
}) {
  const isDark = theme === 'dark';
  const barClass = isDark
    ? 'bg-[rgba(7,12,22,0.9)] border border-[rgba(70,110,180,0.35)] text-slate-200 shadow-[0_18px_55px_rgba(2,10,25,0.65)]'
    : 'bg-white/90 border border-white/60 text-slate-700 shadow-[0_14px_40px_rgba(15,23,42,0.14)]';
  const iconBase =
    'flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-all duration-200 sm:px-3.5 sm:py-2 sm:text-[11px]';
  const iconActive = isDark
    ? 'text-sky-100 bg-[rgba(53,161,255,0.24)] shadow-[0_12px_30px_rgba(46,197,255,0.25)]'
    : 'text-indigo-600 bg-indigo-500/15 shadow-[0_12px_28px_rgba(79,70,229,0.2)]';
  const iconIdle = isDark ? 'text-slate-400 hover:text-sky-200' : 'text-slate-500 hover:text-indigo-600';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center lg:hidden">
      <nav className={`pointer-events-auto flex items-center gap-1.5 rounded-[26px] px-2 py-1 backdrop-blur-md sm:px-2.5 sm:py-1.5 ${barClass}`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavSelect(item)}
            className={`${iconBase} ${activeNav === item.id ? iconActive : iconIdle}`}
          >
            <item.Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** --------- Team Grid (footer) --------- */
function InitialAvatar({ initials, theme }: { initials: string; theme: LandingTheme }) {
  const isDark = theme === 'dark';
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-xl text-sm font-semibold ${
        isDark
          ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200'
          : 'bg-gradient-to-br from-slate-100 to-white text-gray-700'
      }`}
    >
      {initials}
    </div>
  );
}

function TeamCard({ name, title, imgSrc, theme }: { name: string; title: string; imgSrc?: string; theme: LandingTheme }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isDark ? 'bg-white/5 text-slate-100' : 'bg-white text-gray-900'} shadow-sm`}>
      {!imgSrc || broken ? (
        <InitialAvatar initials={initials} theme={theme} />
      ) : (
        <img
          src={imgSrc}
          alt={name}
          loading="lazy"
          className="h-14 w-14 rounded-xl object-cover"
          decoding="async"
          onError={() => setBroken(true)}
        />
      )}
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{title}</div>
      </div>
    </div>
  );
}

function TeamGrid({ theme }: { theme: LandingTheme }) {
  const team = [
    { name: 'John Alexander', title: 'CTO', img: ceoUrl },
    { name: 'Sanjay Koshy', title: 'COO', img: csoUrl },
    { name: 'Palak Chauhan', title: 'Developer', img: devUrl },
    { name: 'Saakshi Singh', title: 'Designer', img: desUrl },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {team.map((member) => (
        <TeamCard key={member.name} name={member.name} title={member.title} imgSrc={member.img} theme={theme} />
      ))}
    </div>
  );
}

/** --------- Feature Preview Panels --------- */
function DiscoverPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const box = isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200';
  const row = isDark ? 'bg-white/5 text-slate-200' : 'bg-slate-50 text-slate-700';
  const label = isDark ? 'text-slate-400' : 'text-slate-500';

  const suppliers = [
    { name: 'Aurora Steel Works', region: 'Munich, DE', score: '96', tags: ['ISO 9001', 'Automotive', 'Tier-1'] },
    { name: 'BlueWave Plastics', region: 'Austin, US', score: '91', tags: ['Medical', 'FDA', 'Injection Molding'] },
    { name: 'NexForge Metals', region: 'Bengaluru, IN', score: '88', tags: ['Aerospace', 'Titanium', 'AS9100'] },
  ];

  return (
    <div className={`grid gap-3 rounded-2xl border ${box} p-4 text-xs`}>
      {suppliers.map((supplier) => (
        <div key={supplier.name} className={`rounded-xl px-4 py-3 ${row}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{supplier.name}</div>
              <div className={`mt-0.5 text-xs ${label}`}>{supplier.region}</div>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">Fit {supplier.score}%</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {supplier.tags.map((tag) => (
              <span key={tag} className={`rounded-full px-3 py-1 text-[11px] ${isDark ? 'bg-white/10 text-slate-200' : 'bg-white text-slate-600'}`}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RFQPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const box = isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700';
  const chip = isDark ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-700';
  const milestones = [
    { name: 'Draft requirements', owner: 'Amelia', status: 'Complete' },
    { name: 'Supplier shortlist', owner: 'Suproc AI', status: 'Complete' },
    { name: 'RFQ sent · 14 suppliers', owner: 'Suproc', status: 'In flight' },
    { name: 'Clarifications close', owner: 'Suppliers', status: 'Due in 2 days' },
  ];

  return (
    <div className={`rounded-2xl border ${box} p-4 text-xs`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-[11px] ${chip}`}>Volume · 120k/quarter</span>
        <span className={`rounded-full px-3 py-1 text-[11px] ${chip}`}>Region · PL · CZ · SK</span>
        <span className={`rounded-full px-3 py-1 text-[11px] ${chip}`}>Compliance · IATF 16949</span>
      </div>
      <div className="space-y-2">
        {milestones.map((step) => (
          <div key={step.name} className={`flex items-center justify-between rounded-xl px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
            <div>
              <div className="text-sm font-semibold">{step.name}</div>
              <div className="text-xs opacity-70">Owner · {step.owner}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] ${chip}`}>{step.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RFPPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const container = isDark ? 'bg-slate-900/60 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700';
  const barBg = isDark ? 'bg-white/10' : 'bg-slate-200';
  const barFill = 'bg-gradient-to-r from-purple-400 to-sky-400';
  const stages = [
    { title: 'Invites sent', progress: 100 },
    { title: 'Clarifications underway', progress: 72 },
    { title: 'Negotiation prep', progress: 28 },
    { title: 'Award recommendation', progress: 5 },
  ];

  return (
    <div className={`rounded-2xl border ${container} p-4`}>
      <div className="space-y-3 text-xs">
        {stages.map((stage) => (
          <div key={stage.title}>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{stage.title}</span>
              <span>{stage.progress}%</span>
            </div>
            <div className={`mt-1 h-2 rounded-full ${barBg}`}>
              <div className={`${barFill} h-full rounded-full`} style={{ width: `${stage.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BiddingPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const tableClass = isDark ? 'divide-white/10 text-slate-200' : 'divide-slate-200 text-slate-700';
  const headerClass = isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600';
  const bidders = [
    { name: 'Aurora Steel Works', quote: '$1.42', lead: '21 days', status: 'Shortlist' },
    { name: 'BlueWave Plastics', quote: '$1.38', lead: '24 days', status: 'Counter offer' },
    { name: 'NexForge Metals', quote: '$1.55', lead: '18 days', status: 'Clarify QA plan' },
  ];

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'} p-4 text-xs`}>
      <div className="overflow-hidden rounded-xl">
        <div className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${headerClass}`}>
          <span>Supplier</span>
          <span>Quote</span>
          <span>Lead time</span>
          <span>Status</span>
        </div>
        <div className={`divide-y ${tableClass}`}>
          {bidders.map((bid) => (
            <div key={bid.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-3 py-3">
              <div>
                <div className="text-sm font-semibold">{bid.name}</div>
                <div className="text-[11px] opacity-70">Trust score • 92</div>
              </div>
              <div>{bid.quote} / unit</div>
              <div>{bid.lead}</div>
              <div>
                <span className={`rounded-full px-3 py-1 text-[11px] ${isDark ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                  {bid.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ERPPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const listBg = isDark ? 'bg-white/5 text-slate-200' : 'bg-slate-100 text-slate-700';
  const domains = [
    { name: 'Direct Materials', spend: '$4.8M', delta: '+6.4%' },
    { name: 'Electronics', spend: '$3.1M', delta: '+2.1%' },
    { name: 'Logistics', spend: '$2.2M', delta: '-3.5%' },
  ];
  const alerts = [
    'Shortlist ready for RFQ · Precision Fasteners',
    'IonSense flagged for late shipments · monitor',
    'Savings potential 7.8% vs baseline · Bidding Room',
  ];

  return (
    <div className={`grid gap-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'} p-4 text-xs`}>
      <div className="grid gap-2">
        {domains.map((domain) => (
          <div key={domain.name} className={`flex items-center justify-between rounded-xl px-3 py-2 ${listBg}`}>
            <div>
              <div className="text-sm font-semibold">{domain.name}</div>
              <div className="text-[11px] opacity-70">Spend trend {domain.delta}</div>
            </div>
            <div className="text-sm font-semibold">{domain.spend}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white/5 px-3 py-2 text-[11px] text-slate-300">
        <div className="text-xs uppercase tracking-wide opacity-70">AI alerts</div>
        <ul className="mt-2 space-y-1">
          {alerts.map((alert) => (
            <li key={alert}>• {alert}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChatPreview({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const bubbleUser = isDark ? 'bg-sky-500/20 text-sky-100' : 'bg-blue-100 text-blue-700';
  const bubbleBot = isDark ? 'bg-white/5 text-slate-200' : 'bg-slate-100 text-slate-700';
  const messages = [
    { from: 'You', text: 'Summarise RFQ #2487 responses and suggest top 3 suppliers.', tone: 'user' },
    { from: 'Suproc', text: 'Aurora, Sunrise, and BlueWave lead on pricing and capability. Aurora is the strongest fit overall.', tone: 'bot' },
    { from: 'Suproc', text: 'Shall I draft the shortlist note and notify your VP?', tone: 'bot' },
    { from: 'You', text: 'Yes, and book a 20 min call with Aurora for tomorrow afternoon.', tone: 'user' },
  ];

  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'} p-4 text-xs`}>
      <div className="space-y-2">
        {messages.map((msg, idx) => {
          const isUser = msg.tone === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isUser ? bubbleUser : bubbleBot}`}>
                <div className="text-[10px] uppercase tracking-wide opacity-70">{msg.from}</div>
                <div className="text-sm leading-relaxed">{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-3 rounded-full px-3 py-2 text-[11px] ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
        Drafting shortlist summary…
      </div>
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    id: 'discover',
    badge: 'Discover AI',
    title: 'Know who to talk to in minutes',
    summary: 'Suproc reads supplier sites, scores fit, and hands you verified contacts automatically.',
    bullets: ['Deep supplier intelligence beyond keywords.', 'Instant scoring by compliance, region, and capability.', 'Warm intros handled by Suproc agents.'],
    media: (theme) => <DiscoverPreview theme={theme} />,
    cta: { label: 'See Discover AI', href: '/discover' },
  },
  {
    id: 'rfq',
    badge: 'RFQ Builder',
    title: 'Draft RFQs with zero busywork',
    summary: 'Structure requirements, invite suppliers, and track milestones in one guided flow.',
    bullets: ['Co-create RFQs with AI drafting.', 'Milestones tracked and nudged for you.', 'Pre-validated supplier lists ready to invite.'],
    media: (theme) => <RFQPreview theme={theme} />,
    cta: { label: 'Launch an RFQ', href: '/rfq' },
  },
  {
    id: 'rfp',
    badge: 'RFP Orchestration',
    title: 'Stay ahead of every clarification',
    summary: 'Live health indicators show which suppliers need attention before deadlines slip.',
    bullets: ['Stage-by-stage health and response tracking.', 'Clarifications logged and routed automatically.', 'AI suggestions keep momentum high.'],
    media: (theme) => <RFPPreview theme={theme} />,
  },
  {
    id: 'bidding',
    badge: 'Live Bidding',
    title: 'Watch savings materialise',
    summary: 'Quotes, compliance flags, and trust scores update in real time so you can steer negotiations.',
    bullets: ['Auto-refreshing bids with supplier trust signals.', 'See savings against your baseline instantly.', 'Nudge lagging suppliers with one click.'],
    media: (theme) => <BiddingPreview theme={theme} />,
  },
  {
    id: 'erp',
    badge: 'ERP Hub',
    title: 'Track spend, risks, and actions',
    summary: 'Domains, KPIs, and AI alerts keep you focused on the highest impact moves.',
    bullets: ['Unified view across categories and suppliers.', 'AI alerts call out anomalies before they bite.', 'Seamless handoff from sourcing to execution.'],
    media: (theme) => <ERPPreview theme={theme} />,
    cta: { label: 'Open the ERP', href: '/erp' },
  },
  {
    id: 'chat',
    badge: 'Suproc Chat',
    title: 'Ask, decide, and execute in one prompt',
    summary: 'Your sourcing co-pilot summarises decisions, books calls, and keeps stakeholders in sync.',
    bullets: ['Understands live context across RFQs and bids.', 'Drafts summaries and nudges stakeholders for you.', 'Every action is captured as an auditable trail.'],
    media: (theme) => <ChatPreview theme={theme} />,
  },
];

const JOURNEY_STEPS: TimelineStep[] = [
  { id: 1, title: 'Search & shortlist', caption: 'Discover AI', detail: 'Start with a product or capability. Suproc reads supplier sites, scores alignment, and prepares contact intel.' },
  { id: 2, title: 'Structure requirements', caption: 'RFQ Builder', detail: 'Turn requirements into a structured RFQ using templates and AI suggestions. Invite the shortlist instantly.' },
  { id: 3, title: 'Clarify & compare', caption: 'RFP orchestration', detail: 'Keep clarifications on track while side-by-side responses update automatically for the team.' },
  { id: 4, title: 'Negotiate & award', caption: 'Live bidding', detail: 'Watch quotes, compliance, and savings in real time. Suproc nudges lagging suppliers and captures decisions.' },
  { id: 5, title: 'Track execution', caption: 'ERP + Chat', detail: 'See spend, risk, and AI alerts in the ERP hub while the co-pilot pushes follow-ups to stakeholders.' },
];

const METRICS: MetricHighlight[] = [
  { label: 'Faster shortlists', value: '92%', delta: '+15 pts vs industry', description: 'Average time to identify qualified suppliers drops from 11 days to under 1 day when using Suproc intelligence.' },
  { label: 'RFQ cycle reduction', value: '68%', delta: '-9 days per event', description: 'Automated drafting, reminders, and structured responses remove the dead time between supplier updates.' },
  { label: 'Negotiated savings', value: '37%', delta: '+11 pts vs target', description: 'Transparency across quotes and AI nudges for competition drive sustainable savings across categories.' },
];

const FAQS: FAQItem[] = [
  {
    question: 'Does Suproc replace our ERP?',
    summary: 'Suproc orchestrates sourcing, then syncs to your ERP.',
    body: 'Teams typically run Suproc alongside SAP, Oracle, or Netsuite. We handle supplier discovery, RFQ/RFP, bidding, and approvals, then push clean data into the ERP so execution stays aligned.',
  },
  {
    question: 'How do suppliers interact with Suproc?',
    summary: 'They respond via secure portals or guided email.',
    body: 'Suppliers can use the Suproc portal, structured email responses, or API. We maintain audit trails automatically and provide visibility on engagement so nothing slips through.',
  },
  {
    question: 'What does implementation look like?',
    summary: 'Most teams go live in under 4 weeks.',
    body: 'We import suppliers, categories, templates, and projects for you. Change management is handled with in-product tours, and our team co-pilots the first RFQ to ensure success.',
  },
];

const LOGOS = ['Zenith Aerospace', 'Helio Labs', 'BlueLake Medical', 'Northwind Devices', 'IonSense Robotics'];

/** --------- Feature Carousel --------- */
function FeatureCarousel({ theme }: { theme: LandingTheme }) {
  const [active, setActive] = useState<FeatureId>('discover');
  const [progressKey, setProgressKey] = useState(0);
  const isCompact = useMediaQuery('(max-width: 1023px)');
  const headingTone = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const helperTone = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const cardBase = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-200'
    : 'border-slate-200 bg-white text-slate-700';
  const cardActive = theme === 'dark'
    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_rgba(37,99,235,0.25)]'
    : 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_20px_38px_rgba(79,70,229,0.22)]';
  const panelClass = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-100 shadow-[0_24px_60px_rgba(5,12,26,0.45)] backdrop-blur'
    : 'border-slate-200 bg-white text-slate-800 shadow-[0_24px_60px_rgba(15,23,42,0.12)]';
  const previewBox = theme === 'dark'
    ? 'border-white/10 bg-black/40'
    : 'border-slate-200 bg-slate-50';
  const ctaTone = theme === 'dark'
    ? 'text-indigo-200 hover:text-indigo-100'
    : 'text-indigo-600 hover:text-indigo-700';
  const featureBadgeChip = theme === 'dark'
    ? 'border-white/15 text-indigo-200'
    : 'border-indigo-200 bg-indigo-50 text-indigo-600';
  const featureSummaryTone = theme === 'dark' ? 'text-slate-200' : 'text-slate-600';
  const featureBulletTone = theme === 'dark' ? 'text-slate-100' : 'text-slate-700';
  const progressTrack = theme === 'dark' ? 'bg-white/10' : 'bg-slate-200';

  useEffect(() => {
    if (isCompact) return;
    const timer = window.setTimeout(() => {
      setActive((prev) => {
        const currentIndex = FEATURES.findIndex((f) => f.id === prev);
        const next = FEATURES[(currentIndex + 1) % FEATURES.length];
        return next.id;
      });
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [active, isCompact]);

  useEffect(() => {
    setProgressKey((prev) => prev + 1);
  }, [active]);

  const activeFeature = FEATURES.find((f) => f.id === active) ?? FEATURES[0];
  const accent = theme === 'dark' ? 'bg-white/8 text-slate-100' : 'bg-slate-100 text-slate-700';

  if (isCompact) {
    return (
      <section id="solutions" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="feature-carousel">
        <div className="mb-8 flex flex-col gap-3 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">Product snapshots</span>
          <h2 id="feature-carousel" className={`text-3xl font-semibold tracking-tight ${headingTone}`}>
            Explore Suproc in motion
          </h2>
          <p className={`text-sm ${helperTone}`}>Tap a card to see the full preview immediately below it.</p>
        </div>

        <div className="space-y-4">
          {FEATURES.map((feature) => {
            const selected = feature.id === active;
            return (
              <div
                key={feature.id}
                className={`rounded-3xl border px-4 py-3 transition ${selected ? cardActive : cardBase}`}
              >
                <button
                  type="button"
                  onClick={() => setActive(feature.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-wide opacity-70">{feature.badge}</div>
                    <div className="mt-1 text-base font-semibold">{feature.title}</div>
                    <div className="mt-1 text-xs opacity-70">{feature.summary}</div>
                  </div>
                  <span className="text-lg">{selected ? '–' : '+'}</span>
                </button>

                <AnimatePresence initial={false}>
                  {selected && (
                    <motion.div
                      key={`${feature.id}-mobile`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          {feature.bullets.map((bullet) => (
                            <div key={bullet} className={`rounded-xl px-3 py-2 ${accent}`}>
                              {bullet}
                            </div>
                          ))}
                        </div>
                        <div className={`overflow-hidden rounded-[28px] border p-3 ${previewBox}`}>
                          {feature.media(theme)}
                        </div>
                        {feature.cta && (
                          <Link
                            to={feature.cta.href}
                            className={`inline-flex items-center gap-2 text-sm font-semibold ${ctaTone}`}
                          >
                            {feature.cta.label}
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                              <path d="M6 4l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section id="solutions" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="feature-carousel">
      <div className="mb-10 flex flex-col gap-3 text-center">
        <motion.span
          className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400"
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          Product snapshots
        </motion.span>
        <motion.h2
          id="feature-carousel"
          className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingTone}`}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          Every step, one tap away
        </motion.h2>
      </div>

      <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {FEATURES.map((feature) => {
            const selected = feature.id === active;
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => setActive(feature.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${selected ? cardActive : cardBase}`}
              >
                <div className="text-[11px] uppercase tracking-wide opacity-70">{feature.badge}</div>
                <div className="mt-1 text-sm font-semibold">{feature.title}</div>
                <div className="mt-1 text-xs opacity-70">{feature.summary}</div>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature.id}
            className={`grid gap-5 rounded-[32px] border p-6 ${panelClass}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${featureBadgeChip}`}>
                {activeFeature.badge}
              </div>
              <h3 className="text-2xl font-semibold">{activeFeature.title}</h3>
              <p className={`text-sm ${featureSummaryTone}`}>{activeFeature.summary}</p>
            </div>

            <div className={`grid gap-2 text-sm ${featureBulletTone} sm:grid-cols-2`}>
              {activeFeature.bullets.map((bullet) => (
                <div key={bullet} className={`rounded-xl px-4 py-3 text-left ${accent}`}>
                  {bullet}
                </div>
              ))}
            </div>

            <div className={`relative overflow-hidden rounded-[26px] border p-4 ${previewBox}`}>
              <div className={`absolute inset-x-0 top-0 h-1.5 ${progressTrack}`}>
                <motion.div
                  key={progressKey}
                  className="h-full bg-gradient-to-r from-sky-400 to-indigo-400"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 9, ease: 'linear' }}
                />
              </div>
              <div className="mt-4">{activeFeature.media(theme)}</div>
            </div>

            {activeFeature.cta && (
              <Link
                to={activeFeature.cta.href}
                className={`inline-flex items-center gap-2 text-sm font-semibold ${ctaTone}`}
              >
                {activeFeature.cta.label}
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                  <path d="M6 4l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/** --------- Journey Timeline --------- */
function JourneyTimeline({ theme }: { theme: LandingTheme }) {
  const [activeStep, setActiveStep] = useState<number>(JOURNEY_STEPS[0].id);
  const selected = JOURNEY_STEPS.find((step) => step.id === activeStep) ?? JOURNEY_STEPS[0];
  const isCompact = useMediaQuery('(max-width: 767px)');
  const headingTone = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
  const helperTone = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
  const cardBase = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-200'
    : 'border-slate-200 bg-white text-slate-700';
  const cardActiveTimeline = theme === 'dark'
    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_rgba(37,99,235,0.25)]'
    : 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_18px_36px_rgba(79,70,229,0.18)]';
  const activeBadge = theme === 'dark'
    ? 'border-indigo-400 text-indigo-200'
    : 'border-indigo-500 text-indigo-600';
  const badgeBase = theme === 'dark'
    ? 'border-white/20 text-slate-300'
    : 'border-slate-200 text-slate-500';
  const detailPanel = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-200 shadow-[0_22px_44px_rgba(5,12,26,0.4)]'
    : 'border-slate-200 bg-white text-slate-700 shadow-[0_22px_44px_rgba(15,23,42,0.1)]';
  const detailInline = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-200'
    : 'border-slate-200 bg-white text-slate-700';
  const mobileCardBase = theme === 'dark'
    ? 'border-white/10 bg-white/5 text-slate-200'
    : 'border-slate-200 bg-white text-slate-700';
  const mobileCardActive = theme === 'dark'
    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100'
    : 'border-indigo-500 bg-indigo-50 text-indigo-700';

  if (isCompact) {
    return (
      <section id="journey" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="journey-heading">
        <div className="mb-8 flex flex-col gap-3 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">How Suproc flows</span>
          <h2 id="journey-heading" className={`text-3xl font-semibold tracking-tight ${headingTone}`}>
            One continuous sourcing journey
          </h2>
          <p className={`text-sm ${helperTone}`}>Tap any step to see the detail right below it.</p>
        </div>

        <div className="space-y-3">
          {JOURNEY_STEPS.map((step) => {
            const isActive = step.id === activeStep;
            return (
              <div key={step.id} className={`rounded-3xl border px-4 py-3 transition ${isActive ? mobileCardActive : mobileCardBase}`}>
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-wide opacity-70">{step.caption}</div>
                    <div className="text-base font-semibold">{step.title}</div>
                  </div>
                  <span className="text-lg">{isActive ? '–' : '+'}</span>
                </button>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      key={`${step.id}-detail`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className={`mt-3 rounded-2xl border p-4 text-sm ${detailInline}`}>
                        {step.detail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section id="journey" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="journey-heading">
      <div className="mb-8 flex flex-col gap-3 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">How Suproc flows</span>
        <h2 id="journey-heading" className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingTone}`}>
          One continuous sourcing journey
        </h2>
      </div>
      <div className="relative">
        <div className="hidden w-full border-t border-white/10 sm:block" />
        <div className="grid gap-4 sm:grid-cols-5">
          {JOURNEY_STEPS.map((step) => {
            const isActive = step.id === activeStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-center text-sm transition ${isActive ? cardActiveTimeline : cardBase}`}
              >
                <span
                  className={`grid place-items-center rounded-full border-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide ${
                    isActive ? activeBadge : badgeBase
                  }`}
                >
                  {step.caption}
                </span>
                <span className="text-base font-semibold">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`mt-6 rounded-3xl border p-6 text-left text-sm ${detailPanel}`}>
        <div className="text-xs uppercase tracking-wide text-indigo-300">Step {selected.id}</div>
        <div className="mt-2 text-lg font-semibold">{selected.title}</div>
        <p className="mt-2 leading-relaxed">{selected.detail}</p>
      </div>
    </section>
  );
}

/** --------- Metrics --------- */
function MetricsSection({ theme }: { theme: LandingTheme }) {
  const [activeMetric, setActiveMetric] = useState<string>(METRICS[0].label);
  const selected = METRICS.find((metric) => metric.label === activeMetric) ?? METRICS[0];
  const isDark = theme === 'dark';
  const headingTone = isDark ? 'text-slate-100' : 'text-slate-900';
  const helperTone = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardBase = isDark ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-white text-slate-700';
  const cardActive = isDark
    ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100 shadow-[0_18px_40px_rgba(37,99,235,0.25)]'
    : 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_18px_40px_rgba(79,70,229,0.18)]';
  const detailClass = isDark
    ? 'border-white/10 bg-white/5 text-slate-200 shadow-[0_22px_40px_rgba(5,12,26,0.35)]'
    : 'border-slate-200 bg-white text-slate-700 shadow-[0_22px_40px_rgba(15,23,42,0.12)]';

  return (
    <section id="landing-metrics" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="metrics-heading">
      <div className="mb-8 flex flex-col gap-3 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">Proof in numbers</span>
        <h2 id="metrics-heading" className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingTone}`}>
          Outcomes teams care about
        </h2>
        <p className={`text-sm ${helperTone}`}>Tap a card to see how teams measure the impact.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {METRICS.map((metric) => {
          const selectedMetric = metric.label === activeMetric;
          return (
            <button
              key={metric.label}
              type="button"
              onClick={() => setActiveMetric(metric.label)}
              className={`rounded-2xl border px-5 py-6 text-left transition ${selectedMetric ? cardActive : cardBase}`}
            >
              <div className="text-xs uppercase tracking-wide opacity-70">{metric.label}</div>
              <div className="mt-3 text-3xl font-semibold">{metric.value}</div>
              <div className="mt-1 text-xs text-emerald-300">{metric.delta}</div>
            </button>
          );
        })}
      </div>
      <div className={`mt-6 rounded-2xl border p-6 text-sm ${detailClass}`}>
        {selected.description}
      </div>
    </section>
  );
}

/** --------- Social Proof --------- */
function SocialProofStrip({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const stripClass = isDark
    ? 'border-white/10 bg-white/5 text-slate-300'
    : 'border-slate-200 bg-slate-100 text-slate-600';
  const logoTone = isDark ? 'text-slate-100' : 'text-slate-700';

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className={`rounded-3xl border px-6 py-5 text-center text-xs uppercase tracking-[0.35em] ${stripClass}`}>
        <span className={`text-[0.95rem] tracking-normal ${logoTone}`}>Trusted by sourcing teams at</span>
        <div className={`mt-3 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold sm:gap-8 sm:text-base ${logoTone}`}>
          {LOGOS.map((logo) => (
            <span key={logo} className="opacity-80">{logo}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** --------- FAQ --------- */
function FAQSection({ theme }: { theme: LandingTheme }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isDark = theme === 'dark';
  const headingTone = isDark ? 'text-slate-100' : 'text-slate-900';
  const collapsedTone = isDark ? 'text-slate-300' : 'text-slate-600';
  const accordionBase = isDark ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-white text-slate-700';
  const detailTone = isDark ? 'text-slate-300' : 'text-slate-600';

  return (
    <section id="landing-faq" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="faq-heading">
      <div className="mb-8 flex flex-col gap-3 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">Questions</span>
        <h2 id="faq-heading" className={`text-3xl font-semibold tracking-tight sm:text-4xl ${headingTone}`}>
          Quick answers before the demo
        </h2>
      </div>
      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const expanded = openIndex === idx;
          return (
            <div key={faq.question} className={`overflow-hidden rounded-2xl border ${accordionBase}`}>
              <button
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium focus:outline-none"
                onClick={() => setOpenIndex(expanded ? null : idx)}
              >
                <span>{faq.question}</span>
                <span className="text-lg text-slate-400">{expanded ? '–' : '+'}</span>
              </button>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className={`px-6 pb-5 text-sm ${detailTone}`}>
                      <div className="font-semibold">{faq.summary}</div>
                      <p className="mt-2 leading-relaxed">{faq.body}</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className={`px-6 pb-4 text-sm ${collapsedTone}`}>{faq.summary}</div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** --------- Footer --------- */
function LandingFooter({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const container = isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-100';
  const bodyText = isDark ? 'text-slate-300' : 'text-slate-600';
  const linkText = isDark ? 'text-slate-300' : 'text-slate-700';
  const headingText = isDark ? 'text-slate-100' : 'text-slate-800';

  return (
    <footer className={`border-t py-14 ${container}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:flex-row sm:justify-between sm:px-6">
        <div className="sm:max-w-sm">
          <img src={isDark ? whiteLogoUrl : logoUrl} alt="Suproc" className="h-8 w-auto" />
          <p className={`mt-4 text-sm ${bodyText}`}>
            Suproc unifies supplier discovery, RFQ/RFP automation, live bidding, and ERP execution so sourcing teams move at AI speed.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
          <div>
            <h3 className="text-xs uppercase tracking-[0.3em] text-indigo-400">Links</h3>
            <ul className={`mt-3 space-y-2 text-sm ${linkText}`}>
              <li><Link to="/discover">Discover AI</Link></li>
              <li><Link to="/rfq">RFQ Builder</Link></li>
              <li><Link to="/bidding">Bidding Room</Link></li>
              <li><Link to="/erp">ERP Hub</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-[0.3em] text-indigo-400">Core Team</h3>
            <div className="mt-3"><TeamGrid theme={theme} /></div>
          </div>
        </div>
      </div>
      <div className={`mt-10 text-center text-xs ${bodyText}`}>
        © Suproc 2024 - 2025 All rights reserved
      </div>
    </footer>
  );
}

/** --------- Hero --------- */
function LandingHero({ theme }: { theme: LandingTheme }) {
  const isDark = theme === 'dark';
  const primaryBtn = isDark ? 'bg-sky-500 text-slate-900 hover:bg-sky-400' : 'bg-indigo-600 text-white hover:bg-indigo-500';
  const secondaryBtn = isDark ? 'text-sky-200 border border-sky-400/40 hover:bg-sky-500/10' : 'text-indigo-600 border border-indigo-200 hover:bg-indigo-50';
  const pillClass = isDark ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-white text-slate-600';
  const [showDemoTooltip, setShowDemoTooltip] = useState(false);

  useEffect(() => {
    if (!showDemoTooltip) return;
    const timer = setTimeout(() => setShowDemoTooltip(false), 2200);
    return () => clearTimeout(timer);
  }, [showDemoTooltip]);

  return (
    <section id="landing-hero" className="relative mx-auto max-w-6xl px-3 pt-20 pb-10 sm:px-6 sm:pt-28 sm:pb-16">
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <motion.div
          className="space-y-5 text-center lg:text-left sm:space-y-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10px] uppercase tracking-[0.28em] text-indigo-300 sm:gap-2 sm:px-4 sm:py-1 sm:text-xs ${pillClass}`}>
            Enterprise-grade sourcing command center
          </div>
          <h1 className={`text-[clamp(1.55rem,4.6vw,3.2rem)] font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            The fastest way to discover, bid, and execute with suppliers.
          </h1>
          <p className={`text-sm leading-relaxed sm:text-base ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Suproc pairs operator grade sourcing workflows with AI co-pilots so your team can find the right vendors, launch RFQs, run negotiations, and sync to the ERP without leaving one interface.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3 lg:justify-start">
            <Link to="/signup" className={`btn-shimmer inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition sm:px-6 sm:py-3 ${primaryBtn}`}>
              Start in minutes
            </Link>
            <div className="relative">
              <Link
                to="/demo"
                onClick={(event) => {
                  event.preventDefault();
                  setShowDemoTooltip(true);
                }}
                onMouseLeave={() => setShowDemoTooltip(false)}
                className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition sm:px-6 sm:py-3 ${secondaryBtn}`}
                title="Coming soon"
              >
                Watch a 2-min demo
              </Link>
              {showDemoTooltip && (
                <div
                  className={`absolute left-1/2 top-[calc(100%+0.5rem)] w-max -translate-x-1/2 rounded-md px-3 py-1 text-xs font-medium shadow-lg ${
                    isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Coming soon
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative h-[250px] w-full overflow-hidden rounded-[30px] border border-white/10 bg-[#0b182d] sm:h-[320px] sm:rounded-[36px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.35),transparent_50%),radial-gradient(circle_at_80%_0%,rgba(79,70,229,0.35),transparent_55%)]" />
          <div className="absolute inset-x-0 top-5 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1 text-xs text-slate-200 backdrop-blur">
              <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400" />
              Discover → RFQ → Bidding → ERP
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
            <div className="grid gap-2.5 text-xs text-slate-200 sm:gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-indigo-200">Now</div>
                  <div className="text-sm font-semibold text-slate-100">Suproc discovered Aurora Steel Works</div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-300">Fit 96%</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-indigo-200">Next</div>
                  <div className="text-sm font-semibold text-slate-100">RFQ draft ready · Precision Fasteners</div>
                </div>
                <span className="text-[11px] text-slate-300">Invite suppliers ▸</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        className={`mt-8 flex flex-wrap items-center justify-center gap-1.5 text-[11px] sm:mt-12 sm:gap-3 sm:text-sm sm:justify-between ${isDark ? 'text-slate-200' : 'text-slate-600'}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
      >
        <span className={`rounded-full border px-2.5 py-0.5 sm:px-4 sm:py-1 ${pillClass}`}>Discover AI</span>
        <span className={`rounded-full border px-2.5 py-0.5 sm:px-4 sm:py-1 ${pillClass}`}>RFQ/RFP automation</span>
        <span className={`rounded-full border px-2.5 py-0.5 sm:px-4 sm:py-1 ${pillClass}`}>Live bidding</span>
        <span className={`rounded-full border px-2.5 py-0.5 sm:px-4 sm:py-1 ${pillClass}`}>ERP sync</span>
        <span className={`rounded-full border px-2.5 py-0.5 sm:px-4 sm:py-1 ${pillClass}`}>AI co-pilot</span>
      </motion.div>
    </section>
  );
}

/** --------- Main Landing --------- */
const primaryNavItems: NavItem[] = [
  { id: 'overview', label: 'Overview', target: 'landing-hero', Icon: IconSparkle },
  { id: 'solutions', label: 'Solutions', target: 'solutions', Icon: IconGrid },
  { id: 'journey', label: 'Journey', target: 'journey', Icon: IconChart },
  { id: 'faq', label: 'FAQ', target: 'landing-faq', Icon: IconQuestion },
];

export default function Landing() {
  const [theme, setTheme] = useState<LandingTheme>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [activeNav, setActiveNav] = useState<NavId>('overview');

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleNavSelect = useCallback((item: NavItem) => {
    const el = document.getElementById(item.target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNav(item.id);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target.id) return;
        const nav = primaryNavItems.find((item) => item.target === visible.target.id);
        if (nav) setActiveNav(nav.id);
      },
      { threshold: 0.45, rootMargin: '-20% 0px -40% 0px' }
    );

    primaryNavItems.forEach((item) => {
      const el = document.getElementById(item.target);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`landing-root relative isolate min-h-screen overflow-x-hidden ${theme === 'dark' ? 'landing-dark bg-[#050915] text-slate-100' : 'landing-light bg-white text-gray-900'}`}>
      <div aria-hidden className={`landing-liquid ${theme === 'dark' ? 'landing-liquid--dark' : 'landing-liquid--light'}`} />

      <HeaderBar theme={theme} onToggleTheme={handleThemeToggle} navItems={primaryNavItems} activeNav={activeNav} onNavSelect={handleNavSelect} />

      <main className="relative">
        <LandingHero theme={theme} />
        <FeatureCarousel theme={theme} />
        <JourneyTimeline theme={theme} />
        <MetricsSection theme={theme} />
        <SocialProofStrip theme={theme} />
        <FAQSection theme={theme} />
      </main>

      <LandingFooter theme={theme} />
      <MobileBottomNav theme={theme} navItems={primaryNavItems} activeNav={activeNav} onNavSelect={handleNavSelect} />
    </div>
  );
}
