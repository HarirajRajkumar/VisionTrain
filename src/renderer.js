// DOM Elements
const startCameraBtn = document.getElementById('startCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const cameraSelect = document.getElementById('cameraSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const projectFolderInput = document.getElementById('projectFolder');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const currentLabelSelect = document.getElementById('currentLabel');
const newLabelInput = document.getElementById('newLabel');
const addLabelBtn = document.getElementById('addLabelBtn');
const imageGallery = document.getElementById('imageGallery');
const imageCount = document.getElementById('imageCount');
const downloadImagesBtn = document.getElementById('downloadImagesBtn');
const exportMetadataBtn = document.getElementById('exportMetadataBtn');
const saveLocationDisplay = document.getElementById('saveLocationDisplay');
const locationDisplay = document.getElementById('locationDisplay');
const statusBar = document.getElementById('statusBar');

// State
let cameraActive = false;
let stream = null;
let projectFolder = '';
let currentLabel = '';
let labels = ['dog', 'cat', 'car', 'person']; // Default labels
let capturedImages = [];
let currentLocation = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Get available cameras
  getCameras();
  
  // Get current location
  getLocation();
});

// Event Listeners
startCameraBtn.addEventListener('click', toggleCamera);
captureBtn.addEventListener('click', captureImage);
cameraSelect.addEventListener('change', changeCamera);
resolutionSelect.addEventListener('change', changeResolution);
selectFolderBtn.addEventListener('click', selectProjectFolder);
currentLabelSelect.addEventListener('change', (e) => {
  currentLabel = e.target.value;
  updateSaveLocation();
  updateStatus();
});
addLabelBtn.addEventListener('click', addNewLabel);
newLabelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addNewLabel();
  }
});
downloadImagesBtn.addEventListener('click', downloadAllImages);
exportMetadataBtn.addEventListener('click', exportMetadata);

// Functions
async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    cameraSelect.innerHTML = '';
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });
    
    cameraSelect.disabled = videoDevices.length === 0;
    
    if (videoDevices.length === 0) {
      updateStatus('No cameras found');
    } else {
      updateStatus('Camera ready');
    }
  } catch (error) {
    console.error('Error getting cameras:', error);
    updateStatus('Error accessing cameras');
  }
}

async function getLocation() {
  try {
    // Use the Electron API to get location
    const result = await window.electronAPI.getLocation();
    
    if (result.success) {
      currentLocation = result.location;
      locationDisplay.textContent = `${currentLocation.city}, ${currentLocation.country} (${currentLocation.latitude}, ${currentLocation.longitude})`;
    } else {
      locationDisplay.textContent = 'Location unavailable';
    }
  } catch (error) {
    console.error('Error getting location:', error);
    locationDisplay.textContent = 'Location unavailable';
  }
}

async function toggleCamera() {
  if (cameraActive) {
    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    video.srcObject = null;
    cameraActive = false;
    startCameraBtn.textContent = 'Start Camera';
    captureBtn.disabled = true;
    updateStatus('Camera stopped');
    return;
  }
  
  // Start camera
  try {
    const [width, height] = resolutionSelect.value.split(',').map(Number);
    
    const constraints = {
      video: {
        deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
        width: { ideal: width },
        height: { ideal: height }
      }
    };
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    
    cameraActive = true;
    startCameraBtn.textContent = 'Stop Camera';
    captureBtn.disabled = false;
    updateStatus('Camera started');
  } catch (error) {
    console.error('Error starting camera:', error);
    updateStatus('Error starting camera: ' + error.message);
  }
}

async function changeCamera() {
  if (!cameraActive) return;
  
  // Restart camera with new device
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  await toggleCamera();
}

async function changeResolution() {
  if (cameraActive) {
    await toggleCamera(); // Stop camera
    await toggleCamera(); // Start with new resolution
  }
}

async function selectProjectFolder() {
  try {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      projectFolder = folder;
      projectFolderInput.value = folder;
      updateSaveLocation();
      updateStatus(`Project folder set to: ${folder}`);
      downloadImagesBtn.disabled = false;
      exportMetadataBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error selecting folder:', error);
    updateStatus('Error selecting folder');
  }
}

function addNewLabel() {
  const newLabel = newLabelInput.value.trim();
  
  if (!newLabel) {
    updateStatus('Label cannot be empty');
    return;
  }
  
  if (labels.includes(newLabel)) {
    updateStatus(`Label "${newLabel}" already exists`);
    currentLabelSelect.value = newLabel;
    currentLabel = newLabel;
    updateSaveLocation();
    return;
  }
  
  // Add new option to select
  const option = document.createElement('option');
  option.value = newLabel;
  option.text = newLabel;
  currentLabelSelect.appendChild(option);
  
  // Update state
  labels.push(newLabel);
  currentLabelSelect.value = newLabel;
  currentLabel = newLabel;
  newLabelInput.value = '';
  
  updateSaveLocation();
  updateStatus(`Added new label: ${newLabel}`);
}

async function captureImage() {
  if (!cameraActive || !stream) {
    updateStatus('Camera is not active');
    return;
  }
  
  if (!currentLabel) {
    updateStatus('Please select a label first');
    return;
  }
  
  if (!projectFolder) {
    updateStatus('Please select a project folder first');
    return;
  }
  
  try {
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
    const filename = `${currentLabel}_${dateStr}.jpg`;
    const labelFolder = `${projectFolder}/${currentLabel}`;
    const filePath = `${labelFolder}/${filename}`;
    
    // Save the image
    const result = await window.electronAPI.saveImage({
      dataUrl: imageDataUrl,
      filePath: filePath
    });
    
    if (result.success) {
      // Add to captured images
      capturedImages.push({
        id: timestamp,
        dataUrl: imageDataUrl,
        label: currentLabel,
        filename: filename,
        path: filePath,
        timestamp: now.toISOString(),
        location: currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          city: currentLocation.city,
          country: currentLocation.country
        } : null
      });
      
      // Update UI
      updateImageGallery();
      updateStatus(`Image captured and saved to ${labelFolder}`);
      saveLocationDisplay.textContent = `Saving to: ${labelFolder}`;
    } else {
      updateStatus(`Error saving image: ${result.error}`);
    }
  } catch (error) {
    console.error('Error capturing image:', error);
    updateStatus('Error capturing image: ' + error.message);
  }
}

function updateImageGallery() {
  imageGallery.innerHTML = '';
  imageCount.textContent = capturedImages.length;
  
  // Display most recent images first
  const recentImages = [...capturedImages].reverse().slice(0, 20);
  
  recentImages.forEach(img => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    
    // Create image
    const imgElement = document.createElement('img');
    imgElement.src = img.dataUrl;
    imgElement.alt = `${img.label} image`;
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.onclick = () => deleteImage(img.id);
    
    // Create info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'image-info';
    
    // Format date for display
    const timestamp = new Date(img.timestamp).toLocaleString();
    
    infoDiv.textContent = `${img.label} - ${timestamp}`;
    
    // Add location if available
    if (img.location) {
      const locationSpan = document.createElement('div');
      locationSpan.textContent = `📍 ${img.location.city}`;
      locationSpan.style.fontSize = '0.8rem';
      locationSpan.style.marginTop = '2px';
      infoDiv.appendChild(locationSpan);
    }
    
    // Add to container
    imageItem.appendChild(imgElement);
    imageItem.appendChild(deleteBtn);
    imageItem.appendChild(infoDiv);
    
    imageGallery.appendChild(imageItem);
  });
  
  // Enable/disable download buttons
  downloadImagesBtn.disabled = capturedImages.length === 0 || !projectFolder;
  exportMetadataBtn.disabled = capturedImages.length === 0 || !projectFolder;
}

function deleteImage(id) {
  // Note: In a full implementation, we would also delete the file from disk
  capturedImages = capturedImages.filter(img => img.id !== id);
  updateImageGallery();
  updateStatus('Image deleted');
}

async function downloadAllImages() {
  // This is informational only, as the images are already being saved to disk
  alert(`Images are being saved to:
  ${projectFolder}
  
  Directory structure:
  ${projectFolder}/
  ${labels.filter(label => capturedImages.some(img => img.label === label))
    .map(label => `  ├── ${label}/`)
    .join('\n')}
  
  Total images: ${capturedImages.length}`);
}

async function exportMetadata() {
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
      path: img.path,
      timestamp: img.timestamp,
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
      updateStatus(`Metadata exported to ${result.path}`);
    } else {
      updateStatus(`Error exporting metadata: ${result.error}`);
    }
  } catch (error) {
    console.error('Error exporting metadata:', error);
    updateStatus('Error exporting metadata: ' + error.message);
  }
}

function updateSaveLocation() {
  if (projectFolder && currentLabel) {
    const saveDir = `${projectFolder}/${currentLabel}`;
    saveLocationDisplay.textContent = `Saving to: ${saveDir}`;
  } else {
    saveLocationDisplay.textContent = '';
  }
}

function updateStatus(message = '') {
  statusBar.textContent = message || 'Ready';
}
