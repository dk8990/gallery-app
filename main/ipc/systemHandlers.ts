import { ipcMain, dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import util from 'util';
import { exec } from 'child_process';

import * as path from 'path';
import * as fs from 'fs';
import { setConfig, getConfig } from '../config';
import { initDB, closeDb } from '../db';
import { startLibraryServices, stopLibraryServices } from '../index';

const execPromise = util.promisify(exec);

export function registerSystemHandlers(mainWindow: BrowserWindow | null) {
  ipcMain.handle('get-current-library', () => {
    return getConfig().activeLibraryPath;
  });

  ipcMain.handle('create-library', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder for New Library',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    
    const rootPath = result.filePaths[0];
    const libraryPath = path.join(rootPath, '.gallery-library');
    
    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }
    
    setConfig({ activeLibraryPath: libraryPath });
    initDB(libraryPath);
    startLibraryServices();
    
    return libraryPath;
  });

  ipcMain.handle('open-library', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Library Folder (.gallery-library)',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    
    let selectedPath = result.filePaths[0];
    // If they selected the parent folder, append .gallery-library
    if (!selectedPath.endsWith('.gallery-library')) {
      const impliedLibrary = path.join(selectedPath, '.gallery-library');
      if (fs.existsSync(impliedLibrary)) {
        selectedPath = impliedLibrary;
      } else {
        dialog.showErrorBox('Invalid Library', 'The selected folder is not a valid Gallery Library.');
        return null;
      }
    } else if (!fs.existsSync(selectedPath)) {
      dialog.showErrorBox('Invalid Library', 'The library folder does not exist.');
      return null;
    }

    setConfig({ activeLibraryPath: selectedPath });
    initDB(selectedPath);
    startLibraryServices();

    return selectedPath;
  });

  ipcMain.handle('close-library', () => {
    stopLibraryServices();
    closeDb();
    setConfig({ activeLibraryPath: null });
    return true;
  });

  ipcMain.handle('delete-library', () => {
    const libPath = getConfig().activeLibraryPath;
    if (!libPath) return false;
    
    stopLibraryServices();
    closeDb();
    setConfig({ activeLibraryPath: null });
    
    try {
      if (fs.existsSync(libPath)) {
        fs.rmSync(libPath, { recursive: true, force: true });
      }
      return true;
    } catch (e) {
      console.error('Failed to delete library directory:', e);
      return false;
    }
  });
  ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('reveal-in-explorer', (event, filepath: string) => {
    shell.showItemInFolder(filepath);
    return { success: true };
  });

  ipcMain.handle('set-wallpaper', async (event, filepath: string) => {
    try {
      if (process.platform === 'win32') {
        const script = `
          $path = "${filepath}"
          $code = @'
          using System.Runtime.InteropServices;
          public class Wallpaper {
            [DllImport("user32.dll", CharSet = CharSet.Auto)]
            public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
          }
'@
          Add-Type -TypeDefinition $code
          # SPI_SETDESKWALLPAPER = 0x0014
          [Wallpaper]::SystemParametersInfo(0x0014, 0, $path, 0x01 -bor 0x02)
        `;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        await execPromise(`powershell -EncodedCommand ${encodedScript}`);
      } else if (process.platform === 'darwin') {
        await execPromise(`osascript -e 'tell application "Finder" to set desktop picture to POSIX file "${filepath}"'`);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to set wallpaper:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('share-media', async (event, filepath: string) => {
    try {
      if (process.platform === 'win32') {
        const script = `Set-Clipboard -Path "${filepath}"`;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        await execPromise(`powershell -EncodedCommand ${encodedScript}`);
      } else if (process.platform === 'darwin') {
        await execPromise(`osascript -e 'set the clipboard to POSIX file "${filepath}"'`);
      } else {
        shell.showItemInFolder(filepath);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to copy media to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('copy-media-clipboard-multiple', async (event, filepaths: string[]) => {
    try {
      if (process.platform === 'win32') {
        const pathsString = filepaths.map(p => `"${p}"`).join(', ');
        const script = `Set-Clipboard -Path ${pathsString}`;
        const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
        await execPromise(`powershell -EncodedCommand ${encodedScript}`);
      } else if (process.platform === 'darwin') {
        const pathsString = filepaths.map(p => `POSIX file "${p}"`).join(', ');
        await execPromise(`osascript -e 'set the clipboard to {${pathsString}}'`);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to copy multiple media to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });
}
