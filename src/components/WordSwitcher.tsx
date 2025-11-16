import React, { useState, useEffect } from 'react';

const words = ['products', 'services', 'needs'];

const WordSwitcher = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setIsVisible(true);
      }, 500);
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <span className="inline-block min-w-[100px] text-left">
      <span
        className={`transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {words[currentIndex]}
      </span>
    </span>
  );
};

export default WordSwitcher;