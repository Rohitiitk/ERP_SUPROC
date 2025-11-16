import React from 'react';

type GoogleAuthButtonProps = {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

// Google brand colors and padding follow guidance from
// https://developers.google.com/identity/branding-guidelines
const GoogleIcon = () => (
  <svg
    className="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
    aria-hidden="true"
    role="img"
  >
    <path
      fill="#4285F4"
      d="M21.6 12.23c0-.74-.06-1.29-.18-1.85H12v3.35h5.44c-.11.83-.72 2.08-2.06 2.92l-.02.13 3 2.32.21.02c1.92-1.76 3.03-4.34 3.03-7.89z"
    />
    <path
      fill="#34A853"
      d="M12 21c2.7 0 4.96-.89 6.61-2.42l-3.15-2.46c-.84.58-1.97.98-3.46.98-2.64 0-4.88-1.76-5.68-4.19l-.12.01-3.08 2.39-.04.11C4.98 18.66 8.22 21 12 21z"
    />
    <path
      fill="#FBBC05"
      d="M6.32 12.91c-.2-.64-.32-1.32-.32-2.01 0-.69.12-1.37.31-2.01l-.01-.13-3.12-2.42-.1.05C2.42 7.77 2 9.34 2 11c0 1.66.42 3.23 1.09 4.61l3.23-2.7z"
    />
    <path
      fill="#EA4335"
      d="M12 5.5c1.87 0 3.13.81 3.85 1.49l2.81-2.74C16.95 2.77 14.7 2 12 2 8.22 2 4.98 4.34 3.09 7.39l3.2 2.51C7.12 7.26 9.36 5.5 12 5.5z"
    />
  </svg>
);

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onClick,
  label = 'Continue with Google',
  disabled,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      'group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg border border-[#DADCE0] bg-white py-3 text-sm font-semibold text-[#3C4043] transition-all duration-200',
      'shadow-sm hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A73E8]',
      disabled ? 'cursor-not-allowed opacity-75 hover:translate-y-0 hover:shadow-sm' : '',
      className ?? '',
    ].join(' ').trim()}
    aria-label={label}
  >
    <span className="absolute inset-y-0 left-0 w-12 border-r border-[#DADCE0]/70 bg-white/80 transition group-hover:bg-white" aria-hidden="true" />
    <span className="relative flex items-center gap-3">
      <GoogleIcon />
      <span className="tracking-wide">{label}</span>
    </span>
  </button>
);

export default GoogleAuthButton;
