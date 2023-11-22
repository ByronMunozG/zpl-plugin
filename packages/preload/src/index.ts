/**
 * @module preload
 */

export {sha256sum} from './nodeCrypto';
export {versions} from './versions';

import {contextBridge, ipcRenderer} from 'electron';
import {electronAPI} from '@electron-toolkit/preload';

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('config', {
      load: () => ipcRenderer.invoke('config-load'),
      get: (key, defaultValue) => ipcRenderer.invoke('config-get', key, defaultValue),
      set: (key, value) => ipcRenderer.invoke('config-set', key, value),
      has: key => ipcRenderer.invoke('config-has', key),
    });
    contextBridge.exposeInMainWorld('devices', {
      get: () => ipcRenderer.invoke('devices-get'),
    });
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
}
