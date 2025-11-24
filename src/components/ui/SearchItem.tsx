import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface SearchItemProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  /** Fungsi untuk mendapatkan nilai string yang akan ditampilkan di input saat item dipilih (opsional) */
  displayValue?: (item: T) => string;
  /** Fungsi untuk merender tampilan item di dalam dropdown */
  renderOption: (item: T) => React.ReactNode;
  /** Fungsi filter custom */
  filterFunction: (item: T, query: string) => boolean;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Jika true, input akan dikosongkan setelah memilih (mode "Search & Add") */
  clearOnSelect?: boolean;
}

const SearchItem = <T,>({
  items,
  onSelect,
  displayValue,
  renderOption,
  filterFunction,
  placeholder = "Cari item...",
  label,
  className = "",
  disabled = false,
  clearOnSelect = false,
}: SearchItemProps<T>) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredItems, setFilteredItems] = useState<T[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Click Outside Detection Logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup - remove listener on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 2. Filtering Logic
  useEffect(() => {
    if (!query) {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(item => filterFunction(item, query)));
    }
  }, [query, items, filterFunction]);

  const handleSelect = (item: T) => {
    onSelect(item);
    if (clearOnSelect) {
      setQuery('');
    } else if (displayValue) {
      setQuery(displayValue(item));
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>}
      
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-navbar-accent-1 transition-colors" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          className={`
            w-full pl-10 pr-10 py-2.5 
            bg-white border border-gray-300 rounded-xl 
            text-gray-900 text-sm placeholder-gray-400 
            focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 
            transition-all shadow-sm 
            disabled:bg-gray-100 disabled:cursor-not-allowed
          `}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          // 3. UX Specific: Re-open dropdown on focus or click
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />

        {query && !disabled && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-auto custom-scrollbar animate-fade-in">
          {filteredItems.length > 0 ? (
            <ul className="py-1">
              {filteredItems.map((item, index) => (
                <li
                  key={index}
                  onClick={() => handleSelect(item)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none group"
                >
                  {renderOption(item)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <p className="text-sm font-medium">Tidak ada hasil ditemukan.</p>
              <p className="text-xs mt-1">Coba kata kunci lain.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchItem;
