import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { Link } from 'react-router-dom';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda', href: '#' },
  { label: 'Layanan', href: '#services' },
  { label: 'Tentang Kami', href: '#about' },
  { label: 'Kontak', href: '#contact' },
];

const LandingNavbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll effect for sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ease-in-out ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-md py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          
          {/* Logo Section */}
          <div className="flex items-center flex-shrink-0">
            <a href="#" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 p-1.5 rounded-lg shadow-glow-gold group-hover:scale-105 transition-transform duration-300">
                <img 
                  src="https://i.imgur.com/DOjWG8r.png" 
                  alt="ARTIRASA Logo" 
                  className="h-8 w-8 object-contain brightness-0 invert" 
                />
              </div>
              <span className={`text-xl font-bold tracking-tight transition-colors duration-300 ${isScrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                ARTIRASA
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`text-sm font-medium transition-colors duration-200 hover:text-navbar-accent-1 ${
                  isScrolled ? 'text-gray-600' : 'text-gray-700'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA Button */}
          <div className="hidden md:flex items-center">
            <Link to="/auth/login">
              <Button 
                variant="primary" 
                className="shadow-lg shadow-navbar-accent-1/20 hover:shadow-navbar-accent-1/40 transition-all hover:-translate-y-0.5"
              >
                Masuk Member
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                isScrolled ? 'text-gray-900 hover:bg-gray-100' : 'text-gray-900 hover:bg-white/20'
              }`}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Drawer Content */}
        <div
          className={`absolute top-0 right-0 w-3/4 max-w-xs h-full bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xl font-bold text-gray-900">Menu</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col space-y-4 flex-grow">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-gray-700 hover:text-navbar-accent-1 hover:bg-gray-50 px-4 py-3 rounded-xl transition-all"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-gray-100">
              <Link to="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full justify-center py-3 text-base shadow-lg shadow-navbar-accent-1/20">
                  Masuk Member <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <p className="text-center text-xs text-gray-400 mt-4">
                © 2025 PT Artirasa Cipta Sentosa
              </p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;
