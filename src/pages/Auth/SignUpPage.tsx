import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; // Import our configured Supabase client
import fullLogo from '../../assets/fullLogo.png';
import { GoogleAuthButton } from '../../components/GoogleAuthButton';

const SignUpPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // --- New: Google Sign-up / Sign-in handler (Supabase OAuth with PKCE) ---
    const handleGoogleLogin = async () => {
      try {
        setError(null);
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
      } catch (err: any) {
        setError(err.message || 'Google sign-in failed.');
        console.error('Google OAuth error:', err);
      }
    };


    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (!email || !password || !name) {
            setError("Please fill in all fields.");
            setIsLoading(false);
            return;
        }

        try {
            // Use Supabase to sign up the user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    // Pass the full name in metadata so our trigger can use it
                    data: {
                        full_name: name
                    }
                }
            });

            if (signUpError) {
                setError(signUpError.message);
                setIsLoading(false); // Stop loading on error
                return;
            }

            // By default, Supabase sends a confirmation email.
            // Let the user know they need to check their inbox.
            if (data.user) {
                alert('Sign up successful! Please check your email to confirm your account.');
                navigate('/login'); // Redirect to login page after showing the message
            }

        } catch (err: any) {
            setError("An unexpected error occurred. Please try again.");
            console.error("Unexpected sign up error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div className="flex justify-center">
                    <img src={fullLogo} alt="Zuproc Logo" className="h-12 w-auto" />
                </div>

                <h2 className="text-2xl font-bold text-center text-gray-800">
                    Create Your Account
                </h2>

                <form className="mt-8 space-y-6" onSubmit={handleFormSubmit}>
                    {/* Name Input */}
                    <div>
                        <label htmlFor="name" className="sr-only">Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            placeholder="Full Name"
                        />
                    </div>

                    {/* Email Input */}
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            placeholder="Email address"
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                            placeholder="Password"
                        />
                    </div>

                    {error && <p className="text-sm text-center text-red-500">{error}</p>}

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#1A2C4A] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-all duration-300"
                        >
                            {isLoading ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </div>

                    {/* New: Continue with Google */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-400">
                            <span className="bg-white px-3">or</span>
                        </div>
                    </div>

                    <GoogleAuthButton onClick={handleGoogleLogin} disabled={isLoading} />
                </form>

                {/* Link to Login Page */}
                <p className="text-sm text-center text-gray-600">
                    Already have an account?
                    <Link to="/login" className="ml-2 font-medium text-blue-600 hover:text-blue-500">
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default SignUpPage;

