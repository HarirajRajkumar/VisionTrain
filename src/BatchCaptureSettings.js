import React, { useState } from 'react';
import './BatchCaptureSettings.css';

// List of OV2640 and common resolutions
const RESOLUTIONS = [
  { width: 160, height: 120, label: 'QQVGA (160x120)' },
  { width: 320, height: 240, label: 'QVGA (320x240)' },
  { width: 640, height: 480, label: 'VGA (640x480)' },
  { width: 800, height: 600, label: 'SVGA (800x600)' },
  { width: 1024, height: 768, label: 'XGA (1024x768)' },
  { width: 1280, height: 720, label: 'HD (1280x720)' },
  { width: 1280, height: 1024, label: 'SXGA (1280x1024)' },
  { width: 1600, height: 1200, label: 'UXGA (1600x1200)' },
  { width: 1920, height: 1080, label: 'FHD (1920x1080)' },
];

function BatchCaptureSettings({
  isActive,
  onStartBatch,
  onPauseBatch,
  onStopBatch,
  isBatchRunning,
  isPaused,
  progress,
  currentResolution,
  currentCount
}) {
  // State for batch settings
  const [captureSettings, setCaptureSettings] = useState(
    RESOLUTIONS.map(res => ({
      width: res.width,
      height: res.height,
      count: 0,
      enabled: false
    }))
  );
  const [captureDelay, setCaptureDelay] = useState(2);
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  // Handle resolution count change
  const handleCountChange = (index, count) => {
    const newSettings = [...captureSettings];
    // Ensure count is a positive integer
    const validCount = Math.max(0, parseInt(count) || 0);
    newSettings[index] = {
      ...newSettings[index],
      count: validCount,
      enabled: validCount > 0
    };
    setCaptureSettings(newSettings);
  };

  // Handle toggle for a specific resolution
  const handleToggleResolution = (index) => {
    const newSettings = [...captureSettings];
    newSettings[index].enabled = !newSettings[index].enabled;
    // If enabling, ensure count is at least 1
    if (newSettings[index].enabled && newSettings[index].count === 0) {
      newSettings[index].count = 1;
    }
    setCaptureSettings(newSettings);
  };

  // Calculate total images to capture
  const totalImages = captureSettings.reduce((sum, setting) => 
    sum + (setting.enabled ? setting.count : 0), 0);

  // Start batch capture
  const handleStartBatch = () => {
    // Filter out enabled settings with count > 0
    const activeSettings = captureSettings
      .filter(setting => setting.enabled && setting.count > 0)
      .map(({ width, height, count }) => ({ width, height, count }));
    
    if (activeSettings.length === 0) {
      alert('Please select at least one resolution and set a count greater than 0');
      return;
    }

    onStartBatch(activeSettings, captureDelay, randomizeOrder);
  };

  // If not active, don't render
  if (!isActive) return null;

  return (
    <div className="batch-capture-settings">
      <h3>Automatic Capture Settings</h3>
      
      {!isBatchRunning ? (
        <>
          <div className="batch-resolution-list">
            <table className="resolution-table">
              <thead>
                <tr>
                  <th>Enable</th>
                  <th>Resolution</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {captureSettings.map((setting, index) => (
                  <tr key={`${setting.width}x${setting.height}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        onChange={() => handleToggleResolution(index)}
                      />
                    </td>
                    <td>{RESOLUTIONS[index].label}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={setting.count}
                        onChange={(e) => handleCountChange(index, e.target.value)}
                        disabled={!setting.enabled}
                        className="count-input"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2" className="total-label">Total Images:</td>
                  <td className="total-count">{totalImages}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="batch-options">
            <div className="option-group">
              <label htmlFor="capture-delay">Delay between captures (seconds):</label>
              <input
                id="capture-delay"
                type="number"
                min="0.5"
                step="0.5"
                value={captureDelay}
                onChange={(e) => setCaptureDelay(parseFloat(e.target.value) || 0.5)}
                className="delay-input"
              />
            </div>
            
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={randomizeOrder}
                  onChange={() => setRandomizeOrder(!randomizeOrder)}
                />
                Randomize capture order
              </label>
            </div>
          </div>
          
          <button 
            className="start-batch-btn"
            onClick={handleStartBatch}
            disabled={totalImages === 0}
          >
            Start Batch Capture
          </button>
        </>
      ) : (
        <div className="batch-progress">
          <div className="progress-info">
            <p>
              Capturing {currentCount.current}/{currentCount.total} at {currentResolution}
            </p>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-percentage">{progress.toFixed(1)}% Complete</p>
          </div>
          
          <div className="batch-controls">
            {isPaused ? (
              <button 
                className="resume-btn"
                onClick={onPauseBatch}
              >
                Resume Capture
              </button>
            ) : (
              <button 
                className="pause-btn"
                onClick={onPauseBatch}
              >
                Pause Capture
              </button>
            )}
            
            <button 
              className="stop-btn"
              onClick={onStopBatch}
            >
              Stop Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchCaptureSettings;