import { Link } from 'react-router-dom';
import { useCompany } from '../../../hooks/useCompany.js';
import { Building2, ArrowRight } from 'lucide-react';

import './company-list.css';

const CompanyList = () => {
  const { companies, loading } = useCompany();

  if (loading) {
    return (
      <div className="company-list-loading">
        <div className="spinner"></div>
        <p>Loading organizations...</p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="company-list-empty">
        <Building2 size={48} />
        <p>No participating organizations found.</p>
        <Link to="/register-company" className="register-inline-link">
          Register your company today
        </Link>
      </div>
    );
  }

  return (
    <div className="company-grid">
      {companies.map((company) => (
        <div key={company._id} className="company-card">
          <div className="company-card-icon">
            <Building2 size={24} />
          </div>
          <div className="company-card-content">
            <h3>{company.name}</h3>
            <p className="company-status">Active Partner</p>
          </div>
          <Link
            to={`/register?companyId=${company._id}`}
            className="company-card-action"
          >
            <span>Join</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ))}
    </div>
  );
};

export default CompanyList;
