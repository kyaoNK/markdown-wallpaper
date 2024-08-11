import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import * as puppeteer from 'puppeteer';
import pretty from 'pretty';

import { ContentDivider } from './dividedcontent';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "markdown-wallpaperimage" is now active!');

	let disposable = vscode.commands.registerCommand('extension.generateImage', async() => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found.');
			return;
		}
		const document = editor.document;
		if (document.languageId !== 'markdown') {
			vscode.window.showErrorMessage('Active document is not a Markdown file.');
			return;
		}
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found for the current document.');
			return;
		}

		const markdownText = document.getText();
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
		const dividedHtml = await divider.run();
		await divider.close();

		let prettyHtml = pretty(dividedHtml);

		const backgroundImagePath = vscode.Uri.joinPath(wallpaperCssFolder, 'background-image.png');
		vscode.workspace.fs.stat(backgroundImagePath).then( (stat) => {
			if (stat.type === vscode.FileType.File) {
				const bodyRegex = /body\s*{[^}]*}/;
				const bodyMatch = prettyHtml.match(bodyRegex);
				if (bodyMatch) {
					const newBody = bodyMatch[0].replace(
						'}',
						`\tbackground-image: url('${backgroundImagePath.fsPath}');\n}`
					);
					const newPrettyHtml = prettyHtml.replace(bodyRegex, newBody);
					prettyHtml = newPrettyHtml;
					vscode.window.showInformationMessage('Successfully added background image.');
				} else {
					vscode.window.showWarningMessage('Not found body selector in css.');
				}
			} else {
				vscode.window.showErrorMessage('Background image file is not a file.');
			}
		}, (error) => {
			vscode.window.showInformationMessage('If you want to include a background image, please put background-image.png in the wallpaper-css folder.');
		});

		const outDir = vscode.Uri.joinPath(workspaceFolder.uri, 'out');
		try {
			await vscode.workspace.fs.createDirectory(outDir);
		} catch (error) {
			// Directory might already exist, ignore the error
		}

		const htmlPath = vscode.Uri.joinPath(outDir, 'wallpaper.html');
		await vscode.workspace.fs.writeFile(htmlPath, Buffer.from(prettyHtml));

		const wallpaperImagePath = vscode.Uri.joinPath(outDir, 'wallpaper.png');
		const browser: puppeteer.Browser = await puppeteer.launch();
		const page: puppeteer.Page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });
		await page.setContent(prettyHtml);
		const imageBuffer = await page.screenshot({ fullPage: true });
		await vscode.workspace.fs.writeFile(wallpaperImagePath, imageBuffer);
		await browser.close();

		vscode.window.showInformationMessage('HTML and Image generated and saved!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}