import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';
import * as path from 'path';

export class PuppeteerController {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private launchOptions: puppeteer.PuppeteerLaunchOptions | null = null;
    private accessWorkspace: boolean | undefined;
    private workspaceFolder: vscode.WorkspaceFolder | undefined;

    constructor(init: {accessWorkspace: boolean; workspaceFolder?: vscode.WorkspaceFolder}) {
        this.accessWorkspace = init.accessWorkspace ?? false;
        if (this.accessWorkspace && !init.workspaceFolder) {
            throw new Error("Workspace folder must be provided when accessing local files.");
        } 
        this.workspaceFolder = init.workspaceFolder;
    }

    public async initialize(width: number, height: number): Promise<void> {
        if (this.browser) { await this.close(); }
        this.launchOptions = {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
            defaultViewport: { 
                width: width,
                height: height, 
                deviceScaleFactor: 1 
            }
        };
        if (this.workspaceFolder) {
            this.launchOptions.args?.push('--allow-file-access-from-files');
            this.launchOptions.args?.push('--enable-local-file-accesses');
        }
        if (puppeteer.default && typeof puppeteer.default.launch === 'function') {
            (this.launchOptions as any).headless = 'new';
        } else {
            this.launchOptions.headless = false;
        }
        this.browser = await puppeteer.launch(this.launchOptions);
        this.page = await this.browser.newPage();
    }

    public async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    public isActive(): boolean {
        if (this.isBrowserActive() && this.isPageActive()) { return true; } 
        else {return false; }
    }

    public isPageActive(): boolean {
        if (this.page) { return true; }
        else { return false; }
    }

    public isBrowserActive(): boolean {
        if (this.browser) { return true; }
        else { return false; }
    }

    public getPage(): puppeteer.Page {
        if (!this.page) { throw new Error('Page not initialized.'); }
        return this.page;
    }

    public async setContent(html: string): Promise<void> {
        if (!this.page) { throw new Error('Page not initialized.'); }
        if (this.accessWorkspace && this.workspaceFolder) {
            await this.page.setBypassCSP(true);
            await this.page.setRequestInterception(true);
            this.page.on('request', request => {
                if (request.url().startsWith('file://')) {
                    request.continue();
                } else {
                    request.abort();
                }
            });
            await this.page.goto(`file://${path.resolve(this.workspaceFolder.uri.fsPath)}`);
        }
        await this.page.setContent(html, { waitUntil: 'domcontentloaded' });
        if (this.accessWorkspace && this.workspaceFolder) {
            await this.page.evaluate(() => {
                return new Promise(resolve => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(resolve);
                    });
                });
            });
        }
        await this.page.evaluate(() => { window.scrollTo(0, 0); });
    }

    public async screenshot(path: vscode.Uri): Promise<void> {
        if (!this.page) { throw new Error('Page not initialized.'); }
        const imageBuffer = await this.page.screenshot({
            fullPage: true,
            type: "png",
            omitBackground: false
        });
        await vscode.workspace.fs.writeFile(path, imageBuffer);
    } 
}