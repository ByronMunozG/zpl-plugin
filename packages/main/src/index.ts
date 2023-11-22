import {app, ipcMain} from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import {platform} from 'node:process';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'node:path';
import Store from 'electron-store';
import {WebUSB, getDeviceList} from 'usb';

const store = new Store({
  defaults: {
    host: '127.0.0.1',
    port: '9100',
  },
});

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateWindow);

const getDevices = async () => {
  const customWebUSB = new WebUSB({
    devicesFound: async devices => {
      const device = devices.find(dev => dev.vendorId === 0xa5f);
      if (!device) return;
      return device;
    },
  });
  const devices = await customWebUSB.getDevices();

  return {
    devicesFilter: devices,
    deviceLegacy: getDeviceList(),
  };
};

const sendToPrinter = async (data: Buffer) => {
  try {
    const customWebUSB = new WebUSB({
      devicesFound: async devices => {
        const device = devices.find(dev => dev.vendorId === 0xa5f);
        if (!device) return;
        return device;
      },
    });
    const device = await customWebUSB.requestDevice({
      filters: [{}],
    });
    if (device) {
      await device.open();
      if (
        device.configuration &&
        device.configuration.interfaces.length > 0 &&
        device.configuration.interfaces[0].alternate.endpoints.length > 0
      ) {
        const deviceInterface = device.configuration.interfaces[0];
        if (!deviceInterface.claimed) {
          await device.claimInterface(deviceInterface.interfaceNumber);
        }
        const endpoint = deviceInterface.alternate.endpoints[0];
        const arrayBuffer: BufferSource = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        );
        await device.transferOut(endpoint.endpointNumber, arrayBuffer);
      }
    }
  } catch (error) {
    console.error('no printer found');
  }
};

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(() => {
    ipcMain.handle('config-load', () => {
      return store.get();
    });
    ipcMain.handle('config-get', (event, key, defaultValue) => {
      return store.get(key, defaultValue);
    });
    ipcMain.handle('config-set', (event, key, value) => {
      store.set(key, value);
    });
    ipcMain.handle('config-has', (event, key) => {
      return store.has(key);
    });
    ipcMain.handle('devices-get', getDevices);

    const host = store.get('host');
    const port = store.get('port');
    if (process.argv.length >= 2 && path.extname(process.argv[1]) === '.zpl') {
      const data = fs.readFileSync(process.argv[1]);
      sendToPrinter(data);
      // const data = fs.readFileSync(process.argv[1], 'utf-8');
      // const client = new net.Socket();
      // client.connect(port, host, () => {
      //   client.write(data, () => {
      //     client.end();
      //   });
      // });
    }
    return restoreOrCreateWindow();
  })
  .catch(e => console.error('Failed create window:', e));

// ipcMain.on('print-zpl', (event, zplContent) => {
//   const client = new net.Socket();
//   client.connect(9100, '127.0.0.1', () => {
//     client.write(zplContent, () => {
//       client.end();
//     });
//   });
// });

/**
 * Install Vue.js or any other extension in development mode only.
 * Note: You must install `electron-devtools-installer` manually
 */
// if (import.meta.env.DEV) {
//   app
//     .whenReady()
//     .then(() => import('electron-devtools-installer'))
//     .then(module => {
//       const {default: installExtension, VUEJS3_DEVTOOLS} =
//         // @ts-expect-error Hotfix for https://github.com/cawa-93/vite-electron-builder/issues/915
//         typeof module.default === 'function' ? module : (module.default as typeof module);
//
//       return installExtension(VUEJS3_DEVTOOLS, {
//         loadExtensionOptions: {
//           allowFileAccess: true,
//         },
//       });
//     })
//     .catch(e => console.error('Failed install extension:', e));
// }

/**
 * Check for app updates, install it in background and notify user that new version was installed.
 * No reason run this in non-production build.
 * @see https://www.electron.build/auto-update.html#quick-setup-guide
 *
 * Note: It may throw "ENOENT: no such file app-update.yml"
 * if you compile production app without publishing it to distribution server.
 * Like `npm run compile` does. It's ok 😅
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() =>
      /**
       * Here we forced to use `require` since electron doesn't fully support dynamic import in asar archives
       * @see https://github.com/electron/electron/issues/38829
       * Potentially it may be fixed by this https://github.com/electron/electron/pull/37535
       */
      require('electron-updater').autoUpdater.checkForUpdatesAndNotify(),
    )
    .catch(e => console.error('Failed check and install updates:', e));
}
