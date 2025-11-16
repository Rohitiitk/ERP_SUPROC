import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, LogOut, Settings } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const COOKIE_NAME = 'versatileErpUserId';
const COOKIE_EXPIRED = 'Thu, 01 Jan 1970 00:00:00 UTC';

const getCookieValue = (name) => {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i += 1) {
        let cookie = cookies[i];
        while (cookie.charAt(0) === ' ') cookie = cookie.substring(1, cookie.length);
        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }
    return null;
};

const clearCookieValue = (name) => {
    document.cookie = `${name}=; expires=${COOKIE_EXPIRED}; path=/; SameSite=Lax`;
};

const ERPSettings = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = React.useState(false);
    const wrapperRef = React.useRef(null);

    const ensureAuthContext = React.useCallback(async () => {
        const userId = getCookieValue(COOKIE_NAME);
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        const accessToken = session?.access_token || null;

        if (!userId) {
            throw new Error('ERP workspace not found. Please configure your workspace again.');
        }

        return { userId, accessToken };
    }, []);

    const handleDeleteErp = async () => {
        if (!window.confirm('Are you sure you want to permanently delete this entire ERP? This action cannot be undone.')) {
            return;
        }

        try {
            const { userId, accessToken } = await ensureAuthContext();
            const response = await fetch('/api/erp/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId,
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
            });

            if (response.status === 401 || response.status === 403) {
                alert('Your session expired. Please sign in again.');
                await supabase.auth.signOut();
                navigate('/login');
                return;
            }

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to delete ERP.');
            }

            alert('ERP has been successfully deleted.');
            await handleLogout();
        } catch (error) {
            console.error('Error deleting ERP:', error);
            alert('Error: ' + (error.message || 'Unknown error.'));
        }
    };

    const handleLogout = React.useCallback(async () => {
        setIsOpen(false);
        let userId = getCookieValue(COOKIE_NAME);

        if (!userId) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                userId = session?.user?.id || null;
            } catch (error) {
                console.error('Error resolving user session during logout:', error);
            }
        }

        clearCookieValue(COOKIE_NAME);

        if (userId) {
            Object.keys(localStorage)
                .filter((key) => key.startsWith(`${userId}_`))
                .forEach((key) => localStorage.removeItem(key));
        }

        navigate('/erp');
    }, [navigate]);

    React.useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="mt-auto border-t border-gray-200 pt-4 relative" ref={wrapperRef}>
            {isOpen && (
                <div className="absolute bottom-full mb-2 w-full bg-white rounded-md shadow-lg border border-gray-200 z-10">
                    <ul className="p-1">
                        <li>
                            <button
                                onClick={() => { handleLogout(); }}
                                className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors font-medium"
                            >
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={handleDeleteErp}
                                className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-md text-danger transition-colors font-medium"
                            >
                                <Trash2 size={18} />
                                <span>Delete ERP</span>
                            </button>
                        </li>
                    </ul>
                </div>
            )}

            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full text-left flex items-center gap-3 py-2 px-4 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors font-medium"
            >
                <Settings size={18} />
                <span>Settings</span>
            </button>
        </div>
    );
};

export default ERPSettings;
