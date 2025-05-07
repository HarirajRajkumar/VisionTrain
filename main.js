const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const isDev = require('electron-is-dev');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools during development (comment out for production)
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle folder selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// Handle saving an image
ipcMain.handle('save-image', async (event, { dataUrl, filePath }) => {
  try {
    // Create directory if it doesn't exist
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Write the file
    fs.writeFileSync(filePath, buffer);
    
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
  }
});

// Handle saving metadata
ipcMain.handle('save-metadata', async (event, { data, defaultPath }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Metadata',
      defaultPath: defaultPath,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    }
    
    return { success: false, error: 'Operation canceled' };
  } catch (error) {
    console.error('Error saving metadata:', error);
    return { success: false, error: error.message };
  }
});

// Get current location (using IP-based geolocation)
ipcMain.handle('get-location', async () => {
  try {
    // Note: In a production app, you would typically use a proper geolocation API
    // This is a placeholder that returns a mock location
    // For actual implementation, consider using node-fetch with a geolocation API
    
    // Mock location data (replace with actual API call)
    return {
      success: true,
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: "San Francisco",
        country: "United States"
      }
    };
    
    // Example of how to implement with an actual API:
    /*
    const fetch = require('node-fetch');
    const response = await fetch('https://ipinfo.io/json');
    const data = await response.json();
    return {
      success: true,
      location: {
        city: data.city || "Unknown",
        country: data.country || "Unknown",
        // Some APIs provide coordinates in the format "lat,lon"
        latitude: data.loc ? data.loc.split(',')[0] : null,
        longitude: data.loc ? data.loc.split(',')[1] : null
      }
    };
    */
  } catch (error) {
    console.error('Error getting location:', error);
    return { success: false, error: error.message };
  }
});
