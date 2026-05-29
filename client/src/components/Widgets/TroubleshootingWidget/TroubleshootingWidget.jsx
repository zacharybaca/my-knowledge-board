import React, { useState } from 'react';
import { Activity, RotateCcw } from 'lucide-react';

const TroubleshootingWidget = () => {
  const [device, setDevice] = useState('');
  const [ledState, setLedState] = useState('');

  const resetState = () => {
    setDevice('');
    setLedState('');
  };

  const getDiagnostic = () => {
    if (!device) return 'Select a device to begin troubleshooting.';
    if (!ledState) return `Select the current LED status for the ${device}.`;

    if (device === 'eero') {
      if (ledState === 'Red')
        return 'Offline. Instruct customer to check the ethernet connection between the eero and the ONT. Power cycle the eero.';
      if (ledState === 'Blinking White')
        return 'Starting up/Searching. Wait 3 minutes. If status remains, verify ONT is online.';
      if (ledState === 'Solid White')
        return 'Online. Issue is likely device-specific. Instruct customer to toggle WiFi on their personal device.';
    }

    if (device === 'ONT') {
      if (ledState === 'Red (Alarm)')
        return 'Fiber cut or light level issue. Dispatch Technician required. Check map for known outages first.';
      if (ledState === 'Off (Power)')
        return 'No power to unit. Instruct customer to verify wall outlet functionality and check the power adapter.';
      if (ledState === 'Solid Green')
        return 'Link established. ONT is functioning. Shift troubleshooting focus to the connected router.';
    }
  };

  return (
    <div className="embedded-widget">
      <div className="widget-header">
        <Activity size={18} />
        <h4>Diagnostic Decision Tree</h4>
        <button
          onClick={resetState}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="widget-body">
        <div className="widget-input-group">
          <label>Hardware Type</label>
          <select
            value={device}
            onChange={(e) => {
              setDevice(e.target.value);
              setLedState('');
            }}
          >
            <option value="">-- Select --</option>
            <option value="eero">eero Router</option>
            <option value="ONT">Optical Network Terminal (ONT)</option>
          </select>
        </div>

        {device && (
          <div className="widget-input-group">
            <label>LED Status Indicator</label>
            <select
              value={ledState}
              onChange={(e) => setLedState(e.target.value)}
            >
              <option value="">-- Select --</option>
              {device === 'eero' ? (
                <>
                  <option value="Red">Solid Red</option>
                  <option value="Blinking White">Blinking White</option>
                  <option value="Solid White">Solid White</option>
                </>
              ) : (
                <>
                  <option value="Red (Alarm)">Red (Alarm/LOS)</option>
                  <option value="Off (Power)">No Lights (Power Off)</option>
                  <option value="Solid Green">Solid Green (PON/Link)</option>
                </>
              )}
            </select>
          </div>
        )}
      </div>
      <div
        className="widget-result"
        style={{ background: ledState ? '#d1fae5' : '#e2e8f0' }}
      >
        <p style={{ margin: 0, fontWeight: 500, color: '#0f172a' }}>
          {getDiagnostic()}
        </p>
      </div>
    </div>
  );
};

export default TroubleshootingWidget;
