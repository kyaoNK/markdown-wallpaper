import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import pretty from 'pretty';

import { ContentDivider } from './dividedcontent';
import { PuppeteerController } from './puppeteercontroller';
import { wallpaperSizes } from './wallpapersize';
import { addBackgroundImageFilePath, getWallpaperCssFolderUri, getCssContent, updateStyleWallpaperSize } from './wallpapercss';

let defaultWallpaperSizeName: string = 'FHD';
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
	
	const config = vscode.workspace.getConfiguration('markdown-wallpaperimage');
	const defaultWallpaperSize = config.get<string>('defaultWallpaperSizeName') ?? 'FHD';
	const outputDir = config.get<string>('outputDirectory') ?? 'wallpapers';
	const outputFileName = config.get<string>('outputFileName') ?? 'wallpaper';
	const inputDir = config.get<string>('inputDirectory') ?? 'wallpaper-css';
	const readStyleCssFileName = config.get<string>('readStyleCssFileName') ?? 'style.css';
	const readBackgroundImageFileName = config.get<string>('readBackgroundImage') ?? 'background-image.png';
	const maxNumColumns = config.get<number>('maxNumColumns') ?? 6;
	const minNumColumns = config.get<number>('minNumColumns') ?? 1;
	const maxFontSize = config.get<number>('maxFontSize') ?? 24;
	const minFontSize = config.get<number>('minFontSize') ?? 14;
	
	defaultWallpaperSizeName = defaultWallpaperSize;
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

	const wallpaperCssFolderUri = getWallpaperCssFolderUri(workspaceFolder, inputDir);
	let cssContent = await getCssContent(wallpaperCssFolderUri, readStyleCssFileName);
	cssContent = updateStyleWallpaperSize(cssContent, wallpaperSize);

	const markdownText = editorDocument.getText();
	const md = new MarkdownIt();
	const htmlContent = `<html><head></head><body>${md.render(markdownText)}</body></html>`;

	const divider = new ContentDivider(
		htmlContent,
		cssContent, 
		wallpaperSize,
		maxNumColumns,
		minNumColumns,
		maxFontSize,
		minFontSize,
	);
	await divider.initialize();
	let dividedHtml = await divider.run();
	await divider.close();

	const backgroundImageUri = vscode.Uri.joinPath(wallpaperCssFolderUri, readBackgroundImageFileName);
	dividedHtml = await addBackgroundImageFilePath(dividedHtml, backgroundImageUri);

	let prettyHtml = pretty(dividedHtml);

	const outDir = vscode.Uri.joinPath(workspaceFolder.uri, outputDir);
	try {
		await vscode.workspace.fs.createDirectory(outDir);
	} catch (error) {
		// Directory might already exist, ignore the error
	}

	const htmlPath = vscode.Uri.joinPath(outDir, outputFileName + '.html');
	await vscode.workspace.fs.writeFile(htmlPath, Buffer.from(prettyHtml));

	const wallpaperImagePath = vscode.Uri.joinPath(outDir, outputFileName + '.png');

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