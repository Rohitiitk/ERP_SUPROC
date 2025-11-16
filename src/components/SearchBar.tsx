import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search } from 'lucide-react';

// Define the props for the SearchBar component
interface SearchBarProps {
  onAnimationComplete: (product: string) => void;
}

// Define the shape of the ref handle
export interface SearchBarRef {
  triggerSearch: (productName: string) => void;
  setSearchValue: (value: string) => void;
}

const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(({ onAnimationComplete }, ref) => {
  const [inputVal, setInputVal] = useState('');
  const [showShadow, setShowShadow] = useState(false);
  const [btnFocused, setBtnFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    triggerSearch(productName: string) {
      setInputVal(productName);
      // Start the animation process
      if (productName.trim()) {
        setShowShadow(true);
      }
    },
    setSearchValue(value: string) {
        setInputVal(value);
    }
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setShowShadow(true);
  };

  useEffect(() => {
    if (showShadow && shadowRef.current && buttonRef.current) {
      const sh = shadowRef.current.getBoundingClientRect();
      const btn = buttonRef.current.getBoundingClientRect();
      const dx = btn.left + btn.width / 2 - (sh.left + sh.width / 2);
      const dy = btn.top + btn.height / 2 - (sh.top + sh.height / 2);
      requestAnimationFrame(() => {
        if (shadowRef.current) {
          shadowRef.current.style.transform = `translate(${dx}px, ${dy}px) scale(0.7)`;
          shadowRef.current.style.opacity = '0';
        }
      });
    }
  }, [showShadow]);

  // This function is called when the animation is done
  const handleTransitionEnd = () => {
    setBtnFocused(true);
    // Call the parent's function instead of navigating
    onAnimationComplete(inputVal);
    
    // Reset shadow for next search
    setTimeout(() => {
        setShowShadow(false);
        setBtnFocused(false);
    }, 1500); // Keep the glow effect for a bit
  };

  return (
    <>
      <style>{`
        @keyframes navyGlow {
          from { box-shadow: 0 4px 3px 1px #FCFCFC,0 6px 8px #D6D7D9,0 -4px 4px #CECFD1,0 -6px 4px #FEFEFE,inset 0 0 10px 0 rgba(10,40,80,0.3); }
          to   { box-shadow: 0 4px 3px 1px #FCFCFC,0 6px 8px #D6D7D9,0 -4px 4px #CECFD1,0 -6px 4px #FEFEFE,inset 0 0 3px 3px rgba(10,40,80,0.3); }
        }
      `}</style>

      <form onSubmit={handleSubmit} className="relative w-full max-w-xl mx-auto">
        <div className="relative bg-white rounded-full overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Search..."
            className="w-full py-3 pl-4 pr-14 text-gray-700 placeholder-gray-400 focus:outline-none"
          />

          {showShadow && (
            <span
              ref={shadowRef}
              className="absolute text-gray-400 pointer-events-none"
              style={{
                top: inputRef.current ? inputRef.current.offsetTop + (inputRef.current.offsetHeight / 4) : 0,
                left: inputRef.current ? inputRef.current.offsetLeft + 16 : 0,
                transform: 'translate(0,0) scale(1)',
                opacity: 1,
                transition: 'transform 0.7s ease-out, opacity 0.7s ease-out',
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {inputVal}
            </span>
          )}

          <button
            ref={buttonRef}
            type="submit"
            className={`
              absolute right-2 top-1/2 transform -translate-y-1/2
              w-10 h-10 rounded-full border border-gray-400
              bg-gradient-to-t from-gray-300 via-white to-gray-50
              shadow-[inset_0_0_3px_0_#CECFD1,0_4px_3px_#FCFCFC,0_6px_8px_#D6D7D9,0_-4px_4px_#CECFD1,0_-6px_4px_#FEFEFE]
              flex items-center justify-center
              transition-all focus:outline-none
              active:shadow-[inset_0_0_5px_3px_#999,inset_0_0_30px_#aaa]
            `}
            style={btnFocused ? { animation: 'navyGlow 1s infinite alternate' } : undefined}
          >
            <Search size={20} className="text-gray-600" />
          </button>
        </div>
      </form>
    </>
  );
});

export default SearchBar;
