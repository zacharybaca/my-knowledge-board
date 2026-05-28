import React, { useState } from 'react';
import { FileText } from 'lucide-react';

const FirstStatementWidget = () => {
  const [basePrice, setBasePrice] = useState('');
  const [installFee, setInstallFee] = useState('0');
  const [daysActive, setDaysActive] = useState('');

  const calculateTotal = () => {
    if (!basePrice || !daysActive) return { prorated: 0, advance: 0, total: 0 };

    const base = parseFloat(basePrice);
    const dailyRate = base / 30;
    const prorated = dailyRate * parseInt(daysActive);
    const advance = base; // Billing one month in advance
    const install = parseFloat(installFee);

    return {
      prorated: prorated.toFixed(2),
      advance: advance.toFixed(2),
      install: install.toFixed(2),
      total: (prorated + advance + install).toFixed(2)
    };
  };

  const invoice = calculateTotal();

  return (
    <div className="embedded-widget">
      <div className="widget-header">
        <FileText size={18} />
        <h4>First-Statement Estimator</h4>
      </div>
      <div className="widget-body" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
        <div className="widget-input-group">
          <label>Base Plan ($)</label>
          <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0.00" />
        </div>
        <div className="widget-input-group">
          <label>Days in Month 1</label>
          <input type="number" value={daysActive} onChange={(e) => setDaysActive(e.target.value)} placeholder="0" />
        </div>
        <div className="widget-input-group">
          <label>Install Fee ($)</label>
          <input type="number" value={installFee} onChange={(e) => setInstallFee(e.target.value)} />
        </div>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem', color: '#475569' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Partial Month 1 (Prorated):</span>
          <span>${invoice.prorated}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Full Month 2 (Advance):</span>
          <span>${invoice.advance}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>One-Time Charges:</span>
          <span>${invoice.install}</span>
        </div>
      </div>
      <div className="widget-result">
        <span>Estimated Initial Invoice:</span>
        <span className="result-amount">${invoice.total}</span>
      </div>
    </div>
  );
};

export default FirstStatementWidget;
