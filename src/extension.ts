import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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
		
		const cssPath = path.join(context.extensionPath, 'src', 'style.css');
		const cssContent = fs.readFileSync(cssPath, 'utf-8');

		const html = insertCSS(cssContent, htmlContent);

		const divider = new ContentDivider(html);
		await divider.initialize();
		const dividedHtml = await divider.run();

		const completeHtml = insertCSS(cssContent, dividedHtml);

		const prettyHtml = pretty(completeHtml);
		// const prettyHtml = pretty(dividedHtml);
		// console.log(prettyHtml);

		const outDir = path.join(path.dirname(document.uri.fsPath), 'out');
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir);
		}

		const htmlPath = path.join(outDir, 'output.html');
		fs.writeFileSync(htmlPath, prettyHtml);

		const imagePath = path.join(outDir, 'output.png');
		await generateImageFromHtml(prettyHtml, imagePath);

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

async function generateImageFromHtml( html: string, outputPath: string ) {
	const browser: puppeteer.Browser = await puppeteer.launch();
	const page: puppeteer.Page = await browser.newPage();
	await page.setViewport({ width: 1920, height: 1080 });
	await page.setContent(html);
	await page.screenshot({ path: outputPath, fullPage: true });
	await browser.close();
}
