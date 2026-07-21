import { ipcMain, dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import util from 'util';
import { exec } from 'child_process';

const execPromise = util.promisify(exec);

export function registerSystemHandlers(mainWindow: BrowserWindow | null) {
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
