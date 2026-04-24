import { useState, useCallback } from 'react';

export default function useFormValidation(rules) {
  const [errors, setErrors] = useState({});

  const validate = useCallback((data) => {
    const newErrors = {};
    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = data[field];
      for (const rule of fieldRules) {
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
          newErrors[field] = rule.message || `${field} is required`;
          break;
        }
        if (rule.minLength && value && value.length < rule.minLength) {
          newErrors[field] = rule.message || `${field} must be at least ${rule.minLength} characters`;
          break;
        }
        if (rule.pattern && value && !rule.pattern.test(value)) {
          newErrors[field] = rule.message || `${field} format is invalid`;
          break;
        }
        if (rule.custom && value) {
          const err = rule.custom(value, data);
          if (err) { newErrors[field] = err; break; }
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rules]);

  const clearErrors = useCallback(() => setErrors({}), []);

  return { errors, validate, clearErrors };
}
