import React, { useState, useEffect, useRef } from 'react';
import './CameraCaptureApp.css';
import BatchCaptureSettings from './BatchCaptureSettings';

function CameraCaptureApp() {
  // State
  const [cameraActive, setCameraActive] = useState(false);
  const [projectFolder, setProjectFolder] = useState('');
  const [currentLabel, setCurrentLabel] = useState('');
  const [labels, setLabels] = useState(['dog', 'cat', 'car', 'person']);
  const [capturedImages, setCapturedImages] = useState([]);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [resolution, setResolution] = useState('640,480');
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [scenario, setScenario] = useState('');
  const [manualLocation, setManualLocation] = useState({
    building: '',
    floor: '',
    room: ''
  });
  
  // Batch capture state
  const [showBatchSettings, setShowBatchSettings] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [currentBatchResolution, setCurrentBatchResolution] = useState('');
  const [currentBatchCount, setCurrentBatchCount] = useState({ current: 0, total: 0 });
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const batchTimerRef = useRef(null);
  const batchSettingsRef = useRef(null);
  const batchIndexRef = useRef(0);
  const captureCountRef = useRef(0);
  
  // Initialize
  useEffect(() => {
    // Get available cameras
    async function getCameras() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting cameras:', error);
        setStatus('Error accessing cameras');
      }
    }
    
    // Get location
    async function getLocation() {
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.getLocation();
          if (result.success) {
            setLocation(result.location);
          }
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    }
    
    getCameras();
    getLocation();
    
    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);
  
  // Handle manual location changes
  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    setManualLocation(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Start camera with specified resolution
  const startCamera = async (width, height) => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: width },
          height: { ideal: height }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setCameraActive(true);
      setResolution(`${width},${height}`);
      setStatus(`Camera started at resolution ${width}x${height}`);
      
      // Return true to indicate success
      return true;
    } catch (error) {
      console.error('Error starting camera:', error);
      setStatus('Error starting camera: ' + error.message);
      return false;
    }
  };
  
  // Toggle camera
  const toggleCamera = async () => {
    if (cameraActive) {
      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setCameraActive(false);
      setStatus('Camera stopped');
      return;
    }
    
    // Start camera with current resolution
    const [width, height] = resolution.split(',').map(Number);
    await startCamera(width, height);
  };
  
  // Select project folder
  const selectProjectFolder = async () => {
    if (window.electronAPI) {
      try {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
          setProjectFolder(folder);
          setStatus(`Project folder set to: ${folder}`);
        }
      } catch (error) {
        console.error('Error selecting folder:', error);
        setStatus('Error selecting folder');
      }
    } else {
      alert('Folder selection is only available in the desktop app');
    }
  };
  
  // Add new label
  const addNewLabel = () => {
    const newLabelInput = document.getElementById('newLabel');
    const newLabel = newLabelInput.value.trim();
    
    if (!newLabel) {
      setStatus('Label cannot be empty');
      return;
    }
    
    if (labels.includes(newLabel)) {
      setStatus(`Label "${newLabel}" already exists`);
      setCurrentLabel(newLabel);
      return;
    }
    
    setLabels([...labels, newLabel]);
    setCurrentLabel(newLabel);
    newLabelInput.value = '';
    
    setStatus(`Added new label: ${newLabel}`);
  };
  
  // Capture image
  const captureImage = async () => {
    if (!cameraActive || !streamRef.current) {
      setStatus('Camera is not active');
      return false;
    }
    
    if (!currentLabel) {
      setStatus('Please select a label first');
      return false;
    }
    
    if (!projectFolder) {
      setStatus('Please select a project folder first');
      return false;
    }
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas) return false;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      
      // Create timestamp and filename with date format
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
      const timestamp = now.getTime();
      
      // Add resolution to filename for batch captures
      const width = canvas.width;
      const height = canvas.height;
      const filename = `${currentLabel}_${width}x${height}_${dateStr}.jpg`;
      const labelFolder = `${projectFolder}/${currentLabel}`;
      const filePath = `${labelFolder}/${filename}`;
      
      if (window.electronAPI) {
        // Save the image
        const result = await window.electronAPI.saveImage({
          dataUrl: imageDataUrl,
          filePath: filePath
        });
        
        if (result.success) {
          // Add to captured images
          const newImage = {
            id: timestamp,
            dataUrl: imageDataUrl,
            label: currentLabel,
            filename: filename,
            path: filePath,
            resolution: `${width}x${height}`,
            timestamp: now.toISOString(),
            scenario: scenario,
            location: location || {
              manual: true,
              building: manualLocation.building,
              floor: manualLocation.floor,
              room: manualLocation.room
            }
          };
          
          setCapturedImages(prevImages => [...prevImages, newImage]);
          setStatus(`Image captured and saved to ${labelFolder}`);
          return true;
        } else {
          setStatus(`Error saving image: ${result.error}`);
          return false;
        }
      } else {
        // Web version - just add to captured images
        const newImage = {
          id: timestamp,
          dataUrl: imageDataUrl,
          label: currentLabel,
          filename: filename,
          resolution: `${width}x${height}`,
          timestamp: now.toISOString(),
          scenario: scenario,
          location: {
            manual: true,
            building: manualLocation.building,
            floor: manualLocation.floor,
            room: manualLocation.room
          }
        };
        
        setCapturedImages(prevImages => [...prevImages, newImage]);
        setStatus('Image captured (web demo mode)');
        return true;
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      setStatus('Error capturing image: ' + error.message);
      return false;
    }
  };
  
  // Batch Capture Functions
  const startBatchCapture = (settings, delay, randomize) => {
    if (!cameraActive) {
      setStatus('Please start the camera first');
      return;
    }
    
    if (!currentLabel) {
      setStatus('Please select a label first');
      return;
    }
    
    if (!projectFolder) {
      setStatus('Please select a project folder first');
      return;
    }
    
    // Prepare batch settings
    let batchSettings = [...settings];
    
    // Randomize order if requested
    if (randomize) {
      batchSettings = batchSettings.flatMap(setting => {
        const items = [];
        for (let i = 0; i < setting.count; i++) {
          items.push({
            width: setting.width,
            height: setting.height,
            index: i + 1,
            total: setting.count
          });
        }
        return items;
      });
      
      // Fisher-Yates shuffle
      for (let i = batchSettings.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [batchSettings[i], batchSettings[j]] = [batchSettings[j], batchSettings[i]];
      }
    } else {
      // Sequential order
      batchSettings = batchSettings.flatMap(setting => {
        const items = [];
        for (let i = 0; i < setting.count; i++) {
          items.push({
            width: setting.width,
            height: setting.height,
            index: i + 1,
            total: setting.count
          });
        }
        return items;
      });
    }
    
    // Store batch settings and initialize state
    batchSettingsRef.current = batchSettings;
    batchIndexRef.current = 0;
    captureCountRef.current = 0;
    
    // Update state
    setIsBatchRunning(true);
    setIsBatchPaused(false);
    setBatchProgress(0);
    
    // Calculate total images
    const totalImages = batchSettings.length;
    
    // Start the batch process
    processBatchItem(delay);
  };
  
  const processBatchItem = async (delay) => {
    // Clear any existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    
    // Check if batch is complete
    if (batchIndexRef.current >= batchSettingsRef.current.length) {
      completeBatchCapture();
      return;
    }
    
    // Get current item
    const currentItem = batchSettingsRef.current[batchIndexRef.current];
    const { width, height, index, total } = currentItem;
    
    // Update UI
    setCurrentBatchResolution(`${width}x${height}`);
    setCurrentBatchCount({ current: index, total: total });
    
    // Calculate progress percentage
    const progress = (batchIndexRef.current / batchSettingsRef.current.length) * 100;
    setBatchProgress(progress);
    
    // Start camera with the specified resolution
    const cameraStarted = await startCamera(width, height);
    
    if (cameraStarted) {
      // Wait a moment for the camera to stabilize
      batchTimerRef.current = setTimeout(async () => {
        // Capture the image
        const captureSuccessful = await captureImage();
        
        if (captureSuccessful) {
          captureCountRef.current += 1;
          batchIndexRef.current += 1;
          
          // Schedule next capture
          if (!isBatchPaused) {
            batchTimerRef.current = setTimeout(() => {
              processBatchItem(delay);
            }, delay * 1000);
          }
        } else {
          // If capture failed, try the next item
          batchIndexRef.current += 1;
          processBatchItem(delay);
        }
      }, 1000); // 1 second to stabilize camera
    } else {
      // If camera failed to start, try the next item
      batchIndexRef.current += 1;
      processBatchItem(delay);
    }
  };
  
  const pauseResumeBatchCapture = () => {
    setIsBatchPaused(!isBatchPaused);
    
    if (isBatchPaused) {
      // Resume
      setStatus('Batch capture resumed');
      processBatchItem(2); // Use default delay when resuming
    } else {
      // Pause
      setStatus('Batch capture paused');
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    }
  };
  
  const stopBatchCapture = () => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    
    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setBatchProgress(0);
    setStatus(`Batch capture stopped. Captured ${captureCountRef.current} images.`);
  };
  
  const completeBatchCapture = () => {
    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setBatchProgress(100);
    setStatus(`Batch capture complete. Captured ${captureCountRef.current} images.`);
  };
  
  // Export metadata
  const exportMetadata = async () => {
    if (!capturedImages.length) {
      setStatus('No images captured yet');
      return;
    }
    
    if (!projectFolder) {
      setStatus('Please select a project folder first');
      return;
    }
    
    if (window.electronAPI) {
      // Group images by label
      const imagesByLabel = {};
      capturedImages.forEach(img => {
        if (!imagesByLabel[img.label]) {
          imagesByLabel[img.label] = [];
        }
        imagesByLabel[img.label].push(img);
      });
      
      // Create metadata structure
      const metadata = {
        projectInfo: {
          name: projectFolder.split(/[/\\]/).pop(),
          path: projectFolder,
          dateCreated: new Date().toISOString(),
          totalImages: capturedImages.length
        },
        classes: Object.keys(imagesByLabel).map(label => ({
          name: label,
          count: imagesByLabel[label].length,
          path: `${projectFolder}/${label}/`
        })),
        images: capturedImages.map(img => ({
          id: img.id,
          label: img.label,
          filename: img.filename,
          path: img.path || `${projectFolder}/${img.label}/${img.filename}`,
          resolution: img.resolution,
          timestamp: img.timestamp,
          scenario: img.scenario,
          location: img.location
        }))
      };
      
      try {
        const defaultPath = `${projectFolder}/tensorflow_metadata.json`;
        const result = await window.electronAPI.saveMetadata({
          data: metadata,
          defaultPath: defaultPath
        });
        
        if (result.success) {
          setStatus(`Metadata exported to ${result.path}`);
        } else {
          setStatus(`Error exporting metadata: ${result.error}`);
        }
      } catch (error) {
        console.error('Error exporting metadata:', error);
        setStatus('Error exporting metadata: ' + error.message);
      }
    } else {
      // Web version
      setStatus('Metadata export is only available in the desktop app');
    }
  };
  
  // Delete image
  const deleteImage = (id) => {
    setCapturedImages(capturedImages.filter(img => img.id !== id));
    setStatus('Image deleted');
  };
  
  return (
    <div className="app-container">
      <header>
        <h1>Camera Capture for TensorFlow Training</h1>
      </header>
      
      <div className="main-content">
        {/* Camera View */}
        <div className="camera-container">
          <div className="camera-controls">
            <button onClick={toggleCamera} disabled={isBatchRunning}>
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </button>
            
            <select 
              value={selectedCamera}
              onChange={e => setSelectedCamera(e.target.value)}
              disabled={cameraActive || isBatchRunning}
            >
              {cameraDevices.length === 0 ? (
                <option value="">No cameras found</option>
              ) : (
                cameraDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))
              )}
            </select>
            
            <select 
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              disabled={cameraActive || isBatchRunning}
            >
              <option value="640,480">640x480</option>
              <option value="1280,720">1280x720</option>
              <option value="1920,1080">1920x1080</option>
            </select>
            
            <button 
              onClick={() => setShowBatchSettings(!showBatchSettings)}
              disabled={isBatchRunning}
            >
              {showBatchSettings ? 'Hide Batch Settings' : 'Batch Capture Mode'}
            </button>
          </div>
          
          <div className="video-container">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline
            />
            <canvas 
              ref={canvasRef}
              style={{ display: 'none' }}
            />
          </div>
          
          <button 
            onClick={captureImage}
            disabled={!cameraActive || isBatchRunning}
            className="capture-btn"
          >
            Capture Image
          </button>
        </div>
        
        {/* Settings Panel */}
        <div className="settings-panel">
          <div className="project-settings">
            <h3>Project Settings</h3>
            
            <div className="setting-group">
              <label>Project Folder:</label>
              <div className="input-with-button">
                <input 
                  type="text"
                  value={projectFolder}
                  readOnly
                  placeholder="/path/to/project"
                />
                <button onClick={selectProjectFolder} disabled={isBatchRunning}>
                  Select Folder
                </button>
              </div>
            </div>
            
            <div className="setting-group">
              <label>Current Label:</label>
              <select 
                value={currentLabel}
                onChange={e => setCurrentLabel(e.target.value)}
                disabled={isBatchRunning}
              >
                <option value="">Select a label</option>
                {labels.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
            
            <div className="setting-group">
              <label>Add New Label:</label>
              <div className="input-with-button">
                <input 
                  id="newLabel"
                  type="text"
                  placeholder="Enter new label"
                  disabled={isBatchRunning}
                />
                <button onClick={addNewLabel} disabled={isBatchRunning}>
                  Add
                </button>
              </div>
            </div>
            
            {/* Batch Capture Settings */}
            <BatchCaptureSettings 
              isActive={showBatchSettings}
              onStartBatch={startBatchCapture}
              onPauseBatch={pauseResumeBatchCapture}
              onStopBatch={stopBatchCapture}
              isBatchRunning={isBatchRunning}
              isPaused={isBatchPaused}
              progress={batchProgress}
              currentResolution={currentBatchResolution}
              currentCount={currentBatchCount}
            />
            
            {/* Scenario Field */}
            <div className="setting-group">
              <label>Scenario:</label>
              <textarea 
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Describe the scenario or context of this capture session"
                rows={3}
                className="scenario-input"
                disabled={isBatchRunning}
              />
            </div>
            
            <div className="setting-group">
              <label>Current Location:</label>
              <div className="location-info">
                {location ? (
                  `${location.city}, ${location.country}`
                ) : (
                  'Location unavailable'
                )}
              </div>
            </div>
            
            {/* Manual Location Fields */}
            <div className="setting-group">
              <label>Manual Location:</label>
              <div className="manual-location">
                <div className="location-field">
                  <label>Building:</label>
                  <input 
                    type="text"
                    name="building"
                    value={manualLocation.building}
                    onChange={handleLocationChange}
                    placeholder="Building name/number"
                    disabled={isBatchRunning}
                  />
                </div>
                
                <div className="location-field">
                  <label>Floor:</label>
                  <input 
                    type="text"
                    name="floor"
                    value={manualLocation.floor}
                    onChange={handleLocationChange}
                    placeholder="Floor number"
                    disabled={isBatchRunning}
                  />
                </div>
                
                <div className="location-field">
                  <label>Room:</label>
                  <input 
                    type="text"
                    name="room"
                    value={manualLocation.room}
                    onChange={handleLocationChange}
                    placeholder="Room number"
                    disabled={isBatchRunning}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Captured Images */}
          <div className="captured-images">
            <h3>Captured Images</h3>
            <div className="images-header">
              <span>Total: {capturedImages.length} images</span>
              <div>
                <button 
                  onClick={exportMetadata}
                  disabled={capturedImages.length === 0 || isBatchRunning}
                >
                  Export Metadata
                </button>
              </div>
            </div>
            
            <div className="image-gallery">
              {capturedImages.slice().reverse().slice(0, 20).map(img => (
                <div key={img.id} className="image-item">
                  <img src={img.dataUrl} alt={`${img.label}`} />
                  <button
                    className="delete-btn"
                    onClick={() => deleteImage(img.id)}
                    disabled={isBatchRunning}
                  >
                    ×
                  </button>
                  <div className="image-info">
                    {img.label} - {img.resolution}
                    <div>{new Date(img.timestamp).toLocaleString()}</div>
                    
                    {img.scenario && (
                      <div className="scenario-tag">
                        📝 {img.scenario.length > 20 ? img.scenario.substring(0, 20) + '...' : img.scenario}
                      </div>
                    )}
                    
                    {img.location && img.location.manual ? (
                      <div className="location-tag">
                        📍 {img.location.building}, Floor {img.location.floor}, Room {img.location.room}
                      </div>
                    ) : img.location ? (
                      <div className="location-tag">
                        📍 {img.location.city}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <footer>
        <div className="status-bar">{status}</div>
      </footer>
    </div>
  );
}

export default CameraCaptureApp;