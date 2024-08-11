import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import * as puppeteer from 'puppeteer';
import pretty from 'pretty';
import * as path from 'path';

import { ContentDivider } from './dividedcontent';
import { resolve } from 'path';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "markdown-wallpaperimage" is now active!');

	let disposable = vscode.commands.registerCommand('extension.generateImage', async() => {
		// Check editor and document
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found.');
			return;
		}
		const editorDocument = editor.document;
		if (editorDocument.languageId !== 'markdown') {
			vscode.window.showErrorMessage('Active editor document is not a Markdown file.');
			return;
		}
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editorDocument.uri);
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found for the current editor document.');
			return;
		}

		const markdownText = editorDocument.getText();
		const md = new MarkdownIt();
		const htmlContent = md.render(markdownText);

		const wallpaperCssFolder = vscode.Uri.joinPath(workspaceFolder.uri, 'wallpaper-css');
		try {
			await vscode.workspace.fs.stat(wallpaperCssFolder);
		} catch (error) {
			vscode.window.showErrorMessage('wallpaper-css folder not found. Please create it in your workspace root.');
			return;
		}

		const cssPath = vscode.Uri.joinPath(wallpaperCssFolder, 'style.css');
		let cssContent: string = '';
		try {
			const cssContentBuffer = await vscode.workspace.fs.readFile(cssPath);
			cssContent = Buffer.from(cssContentBuffer).toString('utf-8');
		} catch (error) {
			vscode.window.showInformationMessage('Use default css. If you want to use css, create style.css in the wallpaper-css folder.');
		}

		const divider = new ContentDivider(htmlContent, cssContent);
		await divider.initialize();
		let dividedHtml = await divider.run();
		await divider.close();

		const backgroundImagePath = vscode.Uri.joinPath(wallpaperCssFolder, 'background-image.png');
		const backgroundImageURL = `file://${backgroundImagePath.fsPath.replace(/\\/g, '/')}`;

		await vscode.workspace.fs.stat(backgroundImagePath).then( (stat) => {
			if (stat.type === vscode.FileType.File) {
				const quotedPath = backgroundImageURL.includes(' ') ? `"${backgroundImageURL}"` : backgroundImageURL;
				const imgHtml = `<div class="background"><img src='${quotedPath}' alt="Background Image"></div>`;
				const bodyRegex = /(<body[^>]*>)/i;
				if (bodyRegex.test(dividedHtml)) {
					dividedHtml = dividedHtml.replace(bodyRegex, `$1\n\t${imgHtml}`);
					vscode.window.showInformationMessage('Background image tag added successfully.');
				} else {
					vscode.window.showWarningMessage('Could not find <body> tag to insert background image.');
				}
				vscode.window.showInformationMessage('Add Background image tag.');
			} else {
				vscode.window.showErrorMessage('Background image file is not a file.');
			}
		}, (error) => {
			vscode.window.showInformationMessage('If you want to include a background image, please put background-image.png in the wallpaper-css folder.');
		});

		let prettyHtml = pretty(dividedHtml);

		const outDir = vscode.Uri.joinPath(workspaceFolder.uri, 'out');
		try {
			await vscode.workspace.fs.createDirectory(outDir);
		} catch (error) {
			// Directory might already exist, ignore the error
		}

		const htmlPath = vscode.Uri.joinPath(outDir, 'wallpaper.html');
		await vscode.workspace.fs.writeFile(htmlPath, Buffer.from(prettyHtml));

		const wallpaperImagePath = vscode.Uri.joinPath(outDir, 'wallpaper.png');
		const launchOptions: puppeteer.PuppeteerLaunchOptions = {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--enable-local-file-accesses'],
            defaultViewport: { 
                width: 1920, 
                height: 1080,
                deviceScaleFactor: 1 
            }
        };
		if (puppeteer.default && typeof puppeteer.default.launch === 'function') {
			(launchOptions as any).headless = 'new';
		} else {
			launchOptions.headless = false;
		}
		const browser = await puppeteer.launch(launchOptions);
		const page: puppeteer.Page = await browser.newPage();
		await page.setBypassCSP(true);
		await page.setRequestInterception(true);
		page.on('request', request => {
			if (request.url().startsWith('file://')) {
				request.continue();
			} else {
				request.abort();
			}
		});
		await page.goto(`file://${path.resolve(workspaceFolder.uri.fsPath)}`);
		await page.setContent(prettyHtml, {waitUntil: 'networkidle0'});
		await page.evaluate(() => {
			return new Promise(resolve => {
				requestAnimationFrame(() => {
					requestAnimationFrame(resolve);
				});
			});
		});
		const imageBuffer = await page.screenshot({ 
			fullPage: true,
			type: 'png',
			omitBackground: false
		});
		await vscode.workspace.fs.writeFile(wallpaperImagePath, imageBuffer);
		vscode.window.showInformationMessage('HTML and Image generated and saved!');
		await browser.close();
	});
	context.subscriptions.push(disposable);
}

export function deactivate() {}