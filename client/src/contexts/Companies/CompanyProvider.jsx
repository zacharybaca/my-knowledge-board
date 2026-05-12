import { useState, useEffect } from 'react';
import { useFetcher } from './../../hooks/useFetcher.js';
import { CompanyContext } from './CompanyContext.jsx';

export const CompanyProvider = ({ children }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetcher } = useFetcher();

  useEffect(() => {
    const fetchCompanies = async () => {
      const response = await fetcher('/api/companies');
      if (response.success) {
        // useFetcher returns data directly if successful
        setCompanies(response.data || []);
      }
      setLoading(false);
    };

    fetchCompanies();
  }, [fetcher]);

  return (
    <CompanyContext.Provider value={{ companies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
};
