import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:45000,workers:1,use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},webServer:{command:'node server/index.js',env:{NODE_ENV:'production',DATA_DIR:mkdtempSync(join(tmpdir(),'tug-browser-')),PORT:'3100'},port:3100,reuseExistingServer:false},reporter:'list'});
