import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface Config {
  activeLibraryPath: string | null;
}

let configPath = '';
let currentConfig: Config = {
  activeLibraryPath: null
};

export function initConfig() {
  configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      currentConfig = { ...currentConfig, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

export function getConfig(): Config {
  return currentConfig;
}

export function setConfig(newConfig: Partial<Config>) {
  currentConfig = { ...currentConfig, ...newConfig };
  try {
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}
