import React from 'react';
import { Target } from 'lucide-react';

interface LogoProps {
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ showText = true }) => {
  return (
    <div className="flex items-center gap-3">
        <div className="shrink-0 overflow-hidden rounded-xl transition-colors" style={{ backgroundColor: 'rgb(var(--nav-item-active-bg))' }}>
            <img src="/logo.png" alt="Cosmo" className="w-10 h-10 object-contain" />
        </div>
        {showText && (
          <div className="overflow-hidden transition-all duration-300 whitespace-nowrap">
            <span className="text-xl font-bold block" style={{ color: 'rgb(var(--color-text-primary))' }}>Cosmo</span>
          </div>
        )}
    </div>
  );
};

export default Logo;
