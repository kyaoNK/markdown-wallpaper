import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import pretty from 'pretty';

import { ContentDivider } from './dividedcontent';
import { PuppeteerController } from './puppeteercontroller';
import { wallpaperSizes } from './wallpapersize';
import { addBackgroundImageFilePath, getWallpaperCssFolderUri, getCssContent, updateStyleWallpaperSize } from './wallpapercss';

const defaultWallpaperSizeName: string = 'FHD';
let lastSelectedWallpaperSizeName: string | undefined;

async function registerUseLastWallpaperSizeCommand(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.generatWallpaperWithLastUsedWallpaperSize', async() => {
		if (lastSelectedWallpaperSizeName === undefined) {
			lastSelectedWallpaperSizeName = defaultWallpaperSizeName;
		}
		if (lastSelectedWallpaperSizeName in wallpaperSizes) {
			const size = wallpaperSizes[lastSelectedWallpaperSizeName];
			await generateHtmlAndWallpaperFromMarkdown(lastSelectedWallpaperSizeName);
		} else {
			vscode.window.showErrorMessage("No wallpaper size has been selected yet. Please select a size first.");
		}
	});
	context.subscriptions.push(disposable);
}
async function registerSelectWallpaperSizeCommand(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.generatWallpaperWithSelectedWallpaperSize', async() => {
		const options = Object.entries(wallpaperSizes).map(([key, size]) => ({
			label: key,
			description: `${size.width} x ${size.height} (${size.aspectRatio})`,
		}));
		const selectedOption = await vscode.window.showQuickPick(options, {
			placeHolder: "Select a wallpaper size",
			matchOnDescription: true,
			matchOnDetail: true
		});
		if (selectedOption) {
			lastSelectedWallpaperSizeName = selectedOption.label;
			await generateHtmlAndWallpaperFromMarkdown(lastSelectedWallpaperSizeName);
		} else {
			vscode.window.showErrorMessage("No wallpaper size has been selected yet. Please select a size first.");
		}
	});
	context.subscriptions.push(disposable);
}

async function generateHtmlAndWallpaperFromMarkdown(wallpaperSizeName: string): Promise<void> {
	const wallpaperSize = wallpaperSizes[wallpaperSizeName];

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

	const wallpaperCssFolderUri = getWallpaperCssFolderUri(workspaceFolder);
	let cssContent = await getCssContent(wallpaperCssFolderUri);
	cssContent = updateStyleWallpaperSize(cssContent, wallpaperSize);

	const markdownText = editorDocument.getText();
	const md = new MarkdownIt();
	const htmlContent = `<html><head></head><body>${md.render(markdownText)}</body></html>`;

	const divider = new ContentDivider(htmlContent, cssContent, wallpaperSize);
	await divider.initialize();
	let dividedHtml = await divider.run();
	await divider.close();

	const backgroundImageUri = vscode.Uri.joinPath(wallpaperCssFolderUri, 'background-image.png');
	dividedHtml = await addBackgroundImageFilePath(dividedHtml, backgroundImageUri);

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

	const puppeteerController = new PuppeteerController({accessWorkspace: true, workspaceFolder: workspaceFolder});
	if (lastSelectedWallpaperSizeName === undefined) {
		lastSelectedWallpaperSizeName = defaultWallpaperSizeName;
	}
	await puppeteerController.initialize(wallpaperSize.width, wallpaperSize.height);
	await puppeteerController.setContent(prettyHtml);
	await puppeteerController.screenshot(wallpaperImagePath);
	await puppeteerController.close();

	vscode.window.showInformationMessage(`Wallpaper generated successfully: ${wallpaperSizeName} (${wallpaperSize.width}x${wallpaperSize.height})`);
	console.log("HTML and wallpaper image were successfully generated.");
}

export function activate(context: vscode.ExtensionContext) {
	registerSelectWallpaperSizeCommand(context);
	registerUseLastWallpaperSizeCommand(context);
}

export function deactivate() {}