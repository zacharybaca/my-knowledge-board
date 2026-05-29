import React, { useState } from 'react';
import { Wifi } from 'lucide-react';

const BandwidthWidget = () => {
  const [streams, setStreams] = useState('1');
  const [gamers, setGamers] = useState('0');
  const [smartDevices, setSmartDevices] = useState('0');

  const calculateRecommendation = () => {
    const score =
      parseInt(streams) * 25 +
      parseInt(gamers) * 50 +
      parseInt(smartDevices) * 5;

    if (score < 100)
      return {
        tier: '500 Mbps',
        script:
          'Based on your light household usage, our 500 Mbps tier will easily handle your streaming and browsing needs without overpaying.',
      };
    if (score < 300)
      return {
        tier: '1 Gig',
        script:
          'With multiple active devices and gamers, our 1 Gig tier is the sweet spot. It provides the bandwidth necessary to prevent buffering when everyone is online at once.',
      };
    return {
      tier: '2 Gig',
      script:
        'Given your heavy network demands, our 2 Gig tier is highly recommended. It guarantees maximum throughput for competitive gaming and 4K streaming simultaneously.',
    };
  };

  const rec = calculateRecommendation();

  return (
    <div className="embedded-widget">
      <div className="widget-header">
        <Wifi size={18} />
        <h4>Bandwidth Recommendation Engine</h4>
      </div>
      <div className="widget-body">
        <div className="widget-input-group">
          <label>Simultaneous 4K Streams</label>
          <select value={streams} onChange={(e) => setStreams(e.target.value)}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="widget-input-group">
          <label>Competitive Gamers</label>
          <select value={gamers} onChange={(e) => setGamers(e.target.value)}>
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="widget-input-group">
          <label>Smart Home / IoT Devices</label>
          <select
            value={smartDevices}
            onChange={(e) => setSmartDevices(e.target.value)}
          >
            <option value="0">0-10</option>
            <option value="15">11-20</option>
            <option value="30">21-40</option>
            <option value="50">40+</option>
          </select>
        </div>
      </div>
      <div
        className="widget-result"
        style={{
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>Recommended Tier:</span>
          <span className="result-amount">{rec.tier}</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: '#475569',
            fontStyle: 'italic',
          }}
        >
          "{rec.script}"
        </p>
      </div>
    </div>
  );
};

export default BandwidthWidget;
