import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style.css'; // Your base styles
import { supabase } from '../../../supabaseClient';

// --- Icon Components (from home.html for consistency) ---
const CustomizationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7v4c0 2.21 3.582 4 8 4s8-1.79 8-4V7" /></svg>;
const ManufacturingIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1-4h1m-1 4h1m-1 4h1"></path></svg>;
const TradingIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const RetailIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const EpcIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
const EcommerceIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>;
const EducationIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>;
const HealthcareIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>;
const ServicesIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const FinanceIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const NonprofitIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>;
const CustomIcon = () => <svg className="w-10 h-10 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;

// --- Industry Data ---
const industries = [
    { id: 'manufacturing', name: 'Manufacturing', Icon: ManufacturingIcon },
    { id: 'trading', name: 'Trading & Distribution', Icon: TradingIcon },
    { id: 'retail', name: 'Retail', Icon: RetailIcon },
    { id: 'epc', name: 'Engineering (EPC)', Icon: EpcIcon },
    { id: 'ecommerce', name: 'E-commerce', Icon: EcommerceIcon },
    { id: 'education', name: 'Education', Icon: EducationIcon },
    { id: 'healthcare', name: 'Healthcare', Icon: HealthcareIcon },
    { id: 'services', name: 'Services', Icon: ServicesIcon },
    { id: 'finance', name: 'Finance', Icon: FinanceIcon },
    { id: 'nonprofit', name: 'Non-Profit', Icon: NonprofitIcon }
];

// --- Loader Component ---
const Loader = () => (
    <div className="flex flex-col items-center justify-center py-16">
        <div className="loader">
            <div className="item1"></div>
            <div className="item2"></div>
            <div className="item3"></div>
        </div>
        <p className="text-gray-600 mt-8 font-semibold">Initializing your workspace...</p>
    </div>
);

const HERO_BULLETS = [
    'Run RFQs, supplier onboarding, and PO handoff in one workspace.',
    'AI scorecards surface risk, price variance, and delivery trends instantly.',
    'Supabase schema stays audited with RLS and SQL auto-generated for you.',
];

const HERO_PROOF_POINTS = [
    { stat: '15+ templates', label: 'Manufacturing, EPC, services ready to launch' },
    { stat: '312 RFQs', label: 'Created on Suproc workspaces last month' },
    { stat: '12-day go-live', label: 'Average from connect to first PO' },
];

const HERO_TRUST_MESSAGE = 'Trusted by procurement teams in manufacturing, construction, and services.';

const DEMO_STEPS = [
    {
        label: 'Create RFQ',
        detail: 'AI assembles scope, scoring matrices, and required docs directly from your BOM.',
        highlight: 'Co-pilot drafts the RFQ package in under 30 seconds—nothing manual.',
        eventId: 'create_rfq',
    },
    {
        label: 'Invite suppliers',
        detail: 'Send structured RFQs with AI-personalised briefs for every shortlisted vendor.',
        highlight: 'Outreach templates adapt to each supplier’s capabilities automatically.',
        eventId: 'invite_suppliers',
    },
    {
        label: 'Compare bids',
        detail: 'Scorecards rank responses across price, quality, delivery, and risk in real time.',
        highlight: 'Summaries call out anomalies and savings so you can move fast on decisions.',
        eventId: 'compare_bids',
    },
    {
        label: 'Issue PO',
        detail: 'Push awarded suppliers straight into your Supabase-backed ERP workspace.',
        highlight: 'One click writes the PO, updates workflow tables, and keeps RLS intact.',
        eventId: 'issue_po',
    },
];

const VALUE_CHIPS = [
    { title: 'AI Reports', body: 'Spend trends, price variance, supplier scores at any moment.' },
    { title: 'Live Schema Sync', body: 'Every domain change writes SQL and RLS safely to Supabase.' },
    { title: 'Secure Storage', body: 'Contracts, drawings, and compliance docs in your buckets.' },
    { title: 'Built-for-Teams', body: 'Approvals, roles, comments, and an auditable trail by default.' },
];

const ONBOARDING_STEPS = [
    { title: 'Connect Supabase', subtitle: 'We auto-verify credentials and set RLS.', eventId: 'connect_supabase' },
    { title: 'Pick a template', subtitle: 'Manufacturing, construction, or services in one click.', eventId: 'choose_template' },
    { title: 'Invite suppliers & launch AI reports', subtitle: 'Sample data included to fast-track insights.', eventId: 'invite_suppliers' },
];

const PATH_OPTIONS = [
    {
        title: 'Self-serve',
        description: 'Start free with sample data, industry templates, and email support.',
        bullets: ['Includes 15+ templates and 5-seat cap', 'No credit card required', 'Live Supabase schema you control'],
        ctaLabel: 'Start free workspace',
        ctaEvent: 'cta_start_free',
        mode: 'primary',
    },
    {
        title: 'Enterprise',
        description: 'Bring SSO, granular RBAC, private VPC, and a guided onboarding squad.',
        bullets: ['Dedicated solutions engineer', 'SLO-backed support & audit logs', 'Private networking & data residency options'],
        ctaLabel: 'Talk to sales',
        ctaEvent: 'cta_talk_sales',
        mode: 'outline',
    },
];

const CREDIBILITY_POINTS = [
    { title: 'Security & compliance', body: 'Row-level security, audit logs, and SSO come standard.' },
    { title: 'Migration help', body: 'Import suppliers, POs, and contracts via CSV or guided services.' },
    { title: '30-day rollback snapshots', body: 'Daily backups mean every change is reversible.' },
    { title: 'Pilot-friendly', body: 'Money-back guarantee on paid pilots when KPIs are not met.' },
];


// --- Home.jsx MODIFICATION ---

const Home = () => {
    const [isConfigModalOpen, setConfigModalOpen] = useState(false);
    const [isIndustryModalOpen, setIndustryModalOpen] = useState(false);
    const [configError, setConfigError] = useState('');
    const [industryError, setIndustryError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSettingIndustry, setSettingIndustry] = useState(false);
    const [activeDemoStep, setActiveDemoStep] = useState(0);
    const navigate = useNavigate();

    // --- HELPER FUNCTIONS (moved inside component) ---
    const setCookie = (name, value, days) => {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    };

    const getCookie = (name) => {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    };

    useEffect(() => {
        const userId = getCookie('versatileErpUserId');
        if (!userId) {
            return;
        }

        let cancelled = false;

        const verifyWorkspace = async () => {
            try {
                const response = await fetch('/api/erp/config', {
                    headers: {
                        'X-User-ID': userId
                    }
                });

                if (!response.ok || cancelled) {
                    return;
                }

                navigate('/workspace', { replace: true });
            } catch (error) {
                console.error('Failed to verify ERP workspace readiness.', error);
            }
        };

        verifyWorkspace();

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveDemoStep((prev) => (prev + 1) % DEMO_STEPS.length);
        }, 5200);
        return () => window.clearInterval(interval);
    }, []);

    const handleConfigSubmit = async (event) => {
        event.preventDefault();
        setConfigError('');
        setIsSubmitting(true);

        const formData = new FormData(event.target);
        const data = {
            supabase_url: formData.get('supabase_url'),
            supabase_db_url: formData.get('supabase_db_url'),
            supabase_key: formData.get('supabase_key')
        };

        try {
            const response = await fetch('/api/erp/configure', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                const workspaceId = result.workspace_id || result.user_id;
                if (workspaceId) {
                    setCookie('versatileErpUserId', workspaceId, 365);
                }
                
                if (result.is_configured) {
                    navigate('/workspace');
                } else {
                    setConfigModalOpen(false);
                    setIndustryModalOpen(true);
                }
            } else {
                setConfigError(result.error || 'Failed to configure workspace. Please check your credentials.');
            }
        } catch (error) {
            setConfigError(error.message || 'Failed to connect to the server. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleIndustrySelect = async (industry) => {
        setIndustryError('');
        setSettingIndustry(true);
        try {
            const userId = getCookie('versatileErpUserId');
            if (!userId) {
                throw new Error("User ID not found. Please configure your workspace first.");
            }

            const response = await fetch(`/api/erp/workspace?industry=${industry}`, {
                headers: {
                    'X-User-ID': userId
                }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to initialize workspace.');
            }

            navigate('/workspace');

        } catch (error) {
            console.error("Error setting industry:", error);
            setIndustryError(error.message);
            setSettingIndustry(false);
        }
    };

    const openConfigModal = () => setConfigModalOpen(true);
    const closeIndustryModal = () => setIndustryModalOpen(false);
    const currentDemoStep = DEMO_STEPS[activeDemoStep] || DEMO_STEPS[0];
    return (
        <div className="landing-shell min-h-screen bg-[#f4f7ff] text-[#0C2540]">
            <div className="landing-container">
                <header className="landing-topbar">
                    <div>
                        <span className="landing-brand">Universal ERP</span>
                        <span className="landing-brand-sub">Adaptive ERP built on Supabase</span>
                    </div>
                </header>

                <main className="landing-main">
                    <section className="landing-hero">
                        <div className="landing-hero__copy">
                            <div className="landing-pill">
                                <span className="landing-pill__dot" />
                                Procurement-first, Supabase-native
                            </div>
                            <h1 className="landing-title">
                                Procurement-first ERP you can launch today.
                            </h1>
                            <p className="landing-lede">
                                Spin up a Supabase workspace, import suppliers, run RFQs, and track POs—in minutes. AI reports included.
                            </p>
                            <ul className="landing-hero__bullets">
                                {HERO_BULLETS.map((bullet) => (
                                    <li key={bullet}>{bullet}</li>
                                ))}
                            </ul>
                            <div className="landing-cta-row">
                                <div className="landing-cta-block">
                                    <button
                                        onClick={openConfigModal}
                                        className="btn-primary landing-cta-primary"
                                        data-analytics-id="cta_start_free"
                                    >
                                        Start free workspace
                                    </button>
                                    <span className="landing-cta-note">No credit card • Uses your Supabase</span>
                                </div>
                                <div className="landing-cta-block">
                                    <button
                                        onClick={() => {
                                            const preview = document.getElementById('erp-preview');
                                            if (preview) {
                                                preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }}
                                        className="landing-cta-secondary"
                                        data-analytics-id="open_demo"
                                        type="button"
                                    >
                                        Open live demo
                                    </button>
                                    <span className="landing-cta-note">Sample data, no setup</span>
                                </div>
                            </div>
                            <div className="landing-cta-tertiary">
                                <a
                                    className="landing-cta-link"
                                    href="mailto:sales@suproc.com?subject=Suproc%20Enterprise%20Workspace"
                                    data-analytics-id="cta_talk_sales"
                                >
                                    Talk to sales
                                </a>
                                <span className="landing-assurance">No vendor lock-in: standard Postgres on Supabase</span>
                            </div>
                            <div className="landing-proof-row">
                                {HERO_PROOF_POINTS.map(({ stat, label }) => (
                                    <div key={stat} className="landing-proof-item">
                                        <span className="landing-proof-stat">{stat}</span>
                                        <span className="landing-proof-label">{label}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="landing-proof-trust">{HERO_TRUST_MESSAGE}</p>
                        </div>

                        <div className="landing-hero__preview" id="erp-preview">
                            <div className="preview-card floating">
                                <div className="preview-card__header">
                                    <div className="preview-card__brand">
                                        <span className="preview-card__avatar">VS</span>
                                        <div>
                                            <p className="preview-card__brand-title">Versatile Inc.</p>
                                            <p className="preview-card__brand-subtitle">Procurement Workspace</p>
                                        </div>
                                    </div>
                                    <button
                                        className="preview-card__action"
                                        onClick={() => setActiveDemoStep(0)}
                                        data-analytics-id="create_rfq"
                                        type="button"
                                    >
                                        Create RFQ draft
                                    </button>
                                </div>

                                <div className="preview-card__body">
                                    <aside className="preview-card__nav">
                                        {DEMO_STEPS.map((step, index) => (
                                            <button
                                                key={step.label}
                                                className={`preview-card__nav-item ${index === activeDemoStep ? 'is-active' : ''}`}
                                                type="button"
                                                onMouseEnter={() => setActiveDemoStep(index)}
                                                onFocus={() => setActiveDemoStep(index)}
                                                data-analytics-id={step.eventId}
                                            >
                                                {step.label}
                                            </button>
                                        ))}
                                    </aside>

                                    <div className="preview-card__panel">
                                        <header className="preview-panel__header">
                                            <div>
                                                <h2>{currentDemoStep.label}</h2>
                                                <p>{currentDemoStep.detail}</p>
                                            </div>
                                            <span className="preview-panel__tag">Live</span>
                                        </header>

                                        <div className="preview-step-highlight">
                                            <span className="preview-step-indicator">Step {activeDemoStep + 1} of {DEMO_STEPS.length}</span>
                                            <span className="preview-step-subtext">{currentDemoStep?.highlight ?? 'Suproc keeps every action synced to Supabase.'}</span>
                                        </div>

                                        <div className="preview-panel__stats">
                                            {[
                                                { label: 'Active suppliers', value: '42', meta: '+6% vs last month' },
                                                { label: 'RFQs in flight', value: '8', meta: '3 close this week' },
                                                { label: 'Savings outlook', value: '7.8%', meta: 'vs. baseline spend' }
                                            ].map(({ label, value, meta }) => (
                                                <article key={label} className="preview-stat">
                                                    <span className="preview-stat__label">{label}</span>
                                                    <span className="preview-stat__value">{value}</span>
                                                    <span className="preview-stat__meta">{meta}</span>
                                                </article>
                                            ))}
                                        </div>

                                        <div className="preview-table">
                                            <div className="preview-table__head">
                                                <span>{activeDemoStep <= 1 ? 'Suppliers' : 'Purchase Orders'}</span>
                                                <span>Status</span>
                                                <span>{activeDemoStep <= 1 ? 'Quote' : 'Total'}</span>
                                            </div>
                                            {(activeDemoStep <= 1
                                                ? [
                                                    ['Aurora Steel', 'Invited', '$18.4K'],
                                                    ['BlueWave Plastics', 'Responded', '$17.9K'],
                                                    ['NexForge Metals', 'Negotiating', '$21.1K']
                                                ]
                                                : [
                                                    ['PO-2041', 'Pending', '$18,400'],
                                                    ['PO-2039', 'Approved', '$9,250'],
                                                    ['PO-2033', 'Fulfilled', '$23,600']
                                                ]).map(([id, status, total]) => (
                                                <div key={id} className="preview-table__row">
                                                    <span>{id}</span>
                                                    <span className={`preview-pill preview-pill--${status.toLowerCase()}`}>{status}</span>
                                                    <span>{total}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="preview-callout preview-callout--right-mid">
                                <span className="preview-callout__title">Live schema sync</span>
                                <span className="preview-callout__body">RLS policies auto-written as you model domains.</span>
                            </div>
                            <div className="preview-callout preview-callout--right-top">
                                <span className="preview-callout__title">AI scorecards</span>
                                <span className="preview-callout__body">Supplier risk, price trends, and delivery health in one view.</span>
                            </div>
                            <div className="preview-callout preview-callout--right-bottom">
                                <span className="preview-callout__title">One-click RFQ → PO</span>
                                <span className="preview-callout__body">Award and issue POs directly to your Supabase ERP.</span>
                            </div>
                            <div className="preview-glow" aria-hidden="true"></div>
                        </div>
                    </section>

                    <section className="landing-paths" aria-labelledby="landing-paths-heading">
                        <div className="landing-paths__intro">
                            <h2 id="landing-paths-heading">Choose how you get started</h2>
                            <p>Pick the path that matches your team today—upgrade or switch anytime.</p>
                        </div>
                        <div className="landing-paths__grid">
                            {PATH_OPTIONS.map((option) => (
                                <article key={option.title} className={`landing-path-card landing-path-card--${option.mode}`}>
                                    <div className="landing-path-card__head">
                                        <h3>{option.title}</h3>
                                        <p>{option.description}</p>
                                    </div>
                                    <ul className="landing-path-card__list">
                                        {option.bullets.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                    {option.mode === 'primary' ? (
                                        <button
                                            type="button"
                                            className="landing-path-card__cta landing-path-card__cta--primary"
                                            onClick={openConfigModal}
                                            data-analytics-id={option.ctaEvent}
                                        >
                                            {option.ctaLabel}
                                        </button>
                                    ) : (
                                        <a
                                            className="landing-path-card__cta landing-path-card__cta--outline"
                                            href="mailto:sales@suproc.com?subject=Suproc%20Enterprise%20Workspace"
                                            data-analytics-id={option.ctaEvent}
                                        >
                                            {option.ctaLabel}
                                        </a>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="landing-secondary">
                        <div className="landing-secondary__copy">
                            <h2>Launch in three guided steps</h2>
                            <ol className="landing-progress">
                                {ONBOARDING_STEPS.map((step, index) => (
                                    <li key={step.title} className="landing-progress__step" data-analytics-id={step.eventId}>
                                        <span className="landing-progress__index">{index + 1}</span>
                                        <div>
                                            <span className="landing-progress__title">{step.title}</span>
                                            <span className="landing-progress__subtitle">{step.subtitle}</span>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            <button
                                type="button"
                                className="landing-link"
                                onClick={() => setIndustryModalOpen(true)}
                                data-analytics-id="choose_template"
                            >
                                See all templates →
                            </button>
                        </div>
                        <div className="landing-value-chips">
                            {VALUE_CHIPS.map(({ title, body }) => (
                                <article key={title} className="value-chip">
                                    <span className="value-chip__title">{title}</span>
                                    <span className="value-chip__body">{body}</span>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="credibility-band" aria-label="Proof and guarantees">
                        <div className="credibility-band__grid">
                            {CREDIBILITY_POINTS.map(({ title, body }) => (
                                <div key={title} className="credibility-point">
                                    <span className="credibility-point__title">{title}</span>
                                    <span className="credibility-point__body">{body}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>

                <footer className="landing-footer">
                    <p>&copy; Suproc 2024 - 2025 All rights reserved</p>
                </footer>
            </div>

            {/* Configuration Modal */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl relative transform transition-all">
                        <div className="text-center border-b pb-4 mb-6">
                            <h3 className="text-2xl font-bold">Configure Your Workspace</h3>
                            <p className="text-gray-500 mt-1">Please provide your Supabase project details to continue.</p>
                        </div>
                        <button onClick={() => setConfigModalOpen(false)} className="absolute top-4 right-4 text-3xl text-gray-400 hover:text-gray-700">&times;</button>
                        
                        <form onSubmit={handleConfigSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-700">Supabase Project URL</label>
                                <input type="text" id="supabase-url" name="supabase_url" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="supabase-db-url" className="block text-sm font-medium text-gray-700">Supabase DB URL (Session Pooler)</label>
                                <input type="text" id="supabase-db-url" name="supabase_db_url" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="supabase-key" className="block text-sm font-medium text-gray-700">Supabase Service Role Key</label>
                                <input type="password" id="supabase-key" name="supabase_key" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div className="callout-glow mt-4 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-5 py-4 text-sm shadow-sm">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3 text-emerald-900">
                                        <span className="attention-ping inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm">
                                            ?
                                        </span>
                                        <div className="space-y-1">
                                            <p className="text-base font-semibold">Need help finding these values?</p>
                                            <p className="text-emerald-800/80">
                                                Open the Supabase checklist for the exact path to the Project URL, Service Role key, and Session pooler string.
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href="/instructions.html"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                                    >
                                        <span>Open setup guide</span>
                                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <path d="M5 15l8-8M9 5h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                            {configError && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">{configError}</div>}
                            <div className="pt-4">
                                <button type="submit" disabled={isSubmitting} className="w-full text-white font-bold py-3 px-8 rounded-full text-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" style={{ backgroundColor: '#0C2540' }}>
                                    {isSubmitting ? 'Saving...' : 'Save & Continue'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Industry Selection Modal */}
            {isIndustryModalOpen && (
                 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                     <div className="bg-white rounded-xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                        <div className="text-center border-b pb-4 mb-6">
                            <h3 className="text-2xl font-bold">Select Your Industry</h3>
                            <p className="text-gray-500 mt-1">Choose an industry to get started with a pre-configured template.</p>
                        </div>
                        <button onClick={closeIndustryModal} className="absolute top-4 right-4 text-3xl text-gray-400 hover:text-gray-700" disabled={isSettingIndustry}>&times;</button>
                        
                        {isSettingIndustry ? (
                            <Loader />
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {industries.map(({ id, name, Icon }) => (
                                        <button key={id} onClick={() => handleIndustrySelect(id)} className="industry-block text-center p-4 border rounded-lg">
                                            <Icon />
                                            <span className="font-semibold text-sm">{name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center my-6">
                                    <div className="flex-grow border-t border-gray-200"></div>
                                    <span className="flex-shrink mx-4 text-gray-500 font-medium">OR</span>
                                    <div className="flex-grow border-t border-gray-200"></div>
                                </div>

                                <div className="flex justify-center">
                                    <button onClick={() => handleIndustrySelect('custom')} className="industry-block text-center p-4 border rounded-lg w-full md:w-1/4">
                                        <CustomIcon />
                                        <span className="font-semibold text-sm">Self-customizable</span>
                                    </button>
                                </div>
                                {industryError && <div className="mt-4 text-center text-red-600 text-sm p-3 bg-red-50 rounded-md">{industryError}</div>}
                            </>
                        )}
                     </div>
                 </div>
            )}
        </div>
    );
};

export default Home;
