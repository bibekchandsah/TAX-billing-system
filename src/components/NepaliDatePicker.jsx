import React, { useEffect, useRef, useId } from 'react';
import { useAppStore } from '../store/appStore';

const NepaliDatePicker = ({ value, onChange, placeholder = "Select Date", className = "", required = false }) => {
  const { theme } = useAppStore();
  const containerRef = useRef(null);
  const datepickerId = useId().replace(/:/g, ''); // useId might contain colons which are invalid in CSS selectors
  const pickerInstance = useRef(null);
  const isMouseDown = useRef(false);

  useEffect(() => {
    const initPicker = () => {
      if (window.NepaliDatePicker && containerRef.current) {
        try {
          const id = containerRef.current.id;
          // Only initialize once per container
          if (!pickerInstance.current) {
            pickerInstance.current = window.NepaliDatePicker.init(`#${id}`, {
              mode: 'english',
              theme: 'default',
              dark: theme === 'dark',
              placeholder: placeholder,
              placeholderEn: placeholder,
              onChange: (data) => {
                if (data && onChange) {
                  // Format as YYYY-MM-DD (BS)
                  const val = data.bs ? `${data.bs.year}-${String(data.bs.month).padStart(2, '0')}-${String(data.bs.day).padStart(2, '0')}` : '';
                  onChange(val);
                  
                  // The library sets the input value to a verbose format just before calling onChange.
                  // We manually override it here so the user sees the clean YYYY-MM-DD format.
                  if (val && containerRef.current) {
                    const innerInput = containerRef.current.querySelector('input');
                    if (innerInput) {
                      innerInput.value = val;
                    }
                  }
                } else if (!data && onChange) {
                  onChange('');
                }
              }
            });
            
            // Note: Initial value sync is now handled by the separate useEffect below
          }
        } catch(e) { console.error(e) }
      } else {
        setTimeout(initPicker, 500);
      }
    };
    
    initPicker();
    
    // Cleanup if component unmounts
    return () => {
      if (pickerInstance.current && typeof pickerInstance.current.destroy === 'function') {
        pickerInstance.current.destroy();
        pickerInstance.current = null;
      }
    };
  }, [onChange, placeholder]); // Only run on mount or if callbacks/props deeply change

  // Sync value prop changes into the picker
  useEffect(() => {
    if (!pickerInstance.current) return;
    
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        
        const current = pickerInstance.current.selected;
        if (!current || current.year !== y || current.month !== m || current.day !== d) {
          // Temporarily remove onChange to prevent infinite loops
          const originalOnChange = pickerInstance.current.opts.onChange;
          pickerInstance.current.opts.onChange = null;
          
          try {
            if (typeof pickerInstance.current.setDate === 'function') {
              pickerInstance.current.setDate(y, m, d);
            }
          } catch(e) { console.error(e) }
          
          pickerInstance.current.opts.onChange = originalOnChange;
          
          // Override the inner input again since setDate replaces it with verbose string
          const innerInput = containerRef.current?.querySelector('input');
          if (innerInput) {
            innerInput.value = value;
          }
        } else {
          // Even if internal state matches, ensure input text matches our format
          const innerInput = containerRef.current?.querySelector('input');
          if (innerInput && innerInput.value !== value) {
            innerInput.value = value;
          }
        }
      }
    } else {
      // Clear if value is empty
      if (pickerInstance.current.selected) {
        const originalOnChange = pickerInstance.current.opts.onChange;
        pickerInstance.current.opts.onChange = null;
        try {
          if (typeof pickerInstance.current.clear === 'function') {
            pickerInstance.current.clear();
          }
        } catch(e) {}
        pickerInstance.current.opts.onChange = originalOnChange;
      }
    }
  }, [value]);

  // Sync theme changes without full re-initialization
  useEffect(() => {
    if (pickerInstance.current && typeof pickerInstance.current.setDark === 'function') {
      pickerInstance.current.setDark(theme === 'dark');
    }
  }, [theme]);

  const handleMouseDown = () => {
    isMouseDown.current = true;
  };

  const handleMouseUp = () => {
    // Small delay before resetting so the click event has time to fire
    setTimeout(() => {
      isMouseDown.current = false;
    }, 150);
  };

  const handleFocus = () => {
    // If the focus was caused by a direct mouse click on the input, we do nothing 
    // and let the library's internal click handler manage opening it.
    // We only forcefully open it if it was focused via keyboard (Tab) or clicking a <label>.
    if (!isMouseDown.current) {
      if (pickerInstance.current && typeof pickerInstance.current.open === 'function') {
        if (!pickerInstance.current.isOpen) {
          pickerInstance.current.open();
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onFocus={handleFocus}
      id={`ndp-${datepickerId}`}
      className={`nepali-datepicker-container ${className}`}
      style={{ display: 'inline-block', width: '100%', position: 'relative' }}
    />
  );
};

export default NepaliDatePicker;
