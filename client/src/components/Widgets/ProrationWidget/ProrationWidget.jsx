import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import '../widgets.css';

const ProrationWidget = () => {
  const [monthlyRate, setMonthlyRate] = useState('');
  const [daysActive, setDaysActive] = useState('');
  const [daysInMonth, setDaysInMonth] = useState(30);

  const calculateProration = () => {
    if (!monthlyRate || !daysActive) return '0.00';
    const dailyRate = parseFloat(monthlyRate) / parseInt(daysInMonth);
    const total = dailyRate * parseInt(daysActive);
    return total.toFixed(2);
  };

  return (
    <div className="embedded-widget proration-widget">
      <div className="widget-header">
        <Calculator size={18} />
        <h4>Quick Proration Calculator</h4>
      </div>
      <div className="widget-body">
        <div className="widget-input-group">
          <label>Monthly Rate ($)</label>
          <input
            type="number"
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
            placeholder="e.g. 50.00"
          />
        </div>
        <div className="widget-input-group">
          <label>Days Active</label>
          <input
            type="number"
            value={daysActive}
            onChange={(e) => setDaysActive(e.target.value)}
            placeholder="e.g. 12"
          />
        </div>
        <div className="widget-input-group">
          <label>Days in Billing Cycle</label>
          <select
            value={daysInMonth}
            onChange={(e) => setDaysInMonth(e.target.value)}
          >
            <option value="28">28 Days</option>
            <option value="30">30 Days</option>
            <option value="31">31 Days</option>
          </select>
        </div>
      </div>
      <div className="widget-result">
        <span>Prorated Charge:</span>
        <span className="result-amount">${calculateProration()}</span>
      </div>
    </div>
  );
};

export default ProrationWidget;
