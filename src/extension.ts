import * as vscode from 'vscode';
import * as path from 'path';
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
		const markdownText = document.getText();
		const md = new MarkdownIt();
		const htmlContent = md.render(markdownText);

		const divider = new ContentDivider(htmlContent);
		await divider.initialize();
		const dividedHtml = await divider.run();

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found for the current document.');
			return;
		}
		const cssPath = vscode.Uri.joinPath(workspaceFolder.uri, 'md-wallpaper', 'style.css');
		// const cssPath = vscode.Uri.file(path.join(path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath || ''), 'md-wallpaper', 'style.css'));
		// const cssContent = fs.readFileSync(cssPath, 'utf-8');
		const cssContentBuffer = await vscode.workspace.fs.readFile(cssPath);
		const cssContent = Buffer.from(cssContentBuffer).toString('utf-8');
		const completeHtml = insertCSS(cssContent, dividedHtml);

		const prettyHtml = pretty(completeHtml);

		// if (!fs.existsSync(outDir)) {
		// 	fs.mkdirSync(outDir);
		// }

		const outDir = vscode.Uri.joinPath(workspaceFolder.uri, 'out');
		try {
			await vscode.workspace.fs.createDirectory(outDir);
		} catch (error) {
			// Directory might already exist, ignore the error
		}

		const htmlPath = vscode.Uri.joinPath(outDir, 'output.html');
		// fs.writeFileSync(htmlPath, prettyHtml);
		await vscode.workspace.fs.writeFile(htmlPath, Buffer.from(prettyHtml));

		const wallpaperImagePath = vscode.Uri.joinPath(outDir, 'wallpaper.png');
		// // const imagePath = path.join(outDir.fsPath, 'output.png');
		await generateImageFromHtml(prettyHtml, wallpaperImagePath);

		vscode.window.showInformationMessage('HTML and Image generated and saved!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

function insertCSS(cssContent: string, htmlContent: string): string {
	return `
		<html>
			<head>
				<style>${cssContent}</style>
			</head>
			<body>
				${htmlContent}
			</body>
		</html>
		`;
}

async function generateImageFromHtml( html: string, outputPath: vscode.Uri ) {
	const browser: puppeteer.Browser = await puppeteer.launch();
	const page: puppeteer.Page = await browser.newPage();
	await page.setViewport({ width: 1920, height: 1080 });
	await page.setContent(html);
	const imageBuffer = await page.screenshot({ fullPage: true });
	await vscode.workspace.fs.writeFile(outputPath, imageBuffer);
	// await page.screenshot({ path: outputPath, fullPage: true });
	await browser.close();
}
