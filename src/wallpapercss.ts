import * as vscode from 'vscode';
import { WallpaperSize } from './wallpapersize';

export function updateStyleWallpaperSize(cssContent: string, wallpaperSize: WallpaperSize): string {
    function getRule(selector: string): string | null {
        const escapedSelector = selector.replace(/\./g, '\\.');
        const regex = new RegExp(`${escapedSelector}\\s*{[^}]*}`, 'g');
        const match = cssContent.match(regex);
        return match ? match[0] : null;
    }
    function setProperty(selector: string, property: string, value: string): void {
        const rule = getRule(selector);
        if (rule) {
            const updateRule = rule.replace(
                /{([^}]*)}/,
                (match: string, p1: string) => {
                    const properties = p1.split(';').map(p => p.trim()).filter(Boolean);
                    const updatedProperties = properties.map(p => {
                        const [prop, val] = p.split(':').map(s => s.trim());
                        if (prop === property) {
                            return `${prop}: ${value}`;
                        }
                        return p;
                    });
                    if (!properties.some(p => p.startsWith(property))) {
                        updatedProperties.push(`${property}: ${value}`);
                    }
                    return `{\n${updatedProperties.join(';\n')}\n}`;
                }
            );
            cssContent = cssContent.replace(rule, updateRule);
        } else {
            cssContent += `\n${selector} { ${property}: ${value}; }`;
        }
    }
    function getPropertyValue(selector: string, property: string): string | null {
        const rule = getRule(selector);
        if (rule) {
            const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`);
            const match = rule.match(regex);
            return match ? match[1].trim() : null;
        }
        return null;
    }
    function extractNumericValue(value: string): number {
        const match = value.match(/^(-?\d+(?:\.\d+)?)/);
        if (match) { return parseFloat(match[1]); }
        return 0;
    }

    /* --- hard code --- */
    // サイズを更新する要素とプロパティの配列
    const elementsToUpdate = [
        { selector: 'html', properties: ['height', 'max-width'] },
        { selector: 'body', properties: ['width', 'height'] },
        { selector: '.background', properties: ['width', 'height'] },
        { selector: '.container', properties: ['width', 'height'] }
    ];

    // 各要素のプロパティを更新
    elementsToUpdate.forEach(element => {
        element.properties.forEach(property => {
            const value = property === 'max-width' ? wallpaperSize.width : (property === 'width' ? wallpaperSize.width : wallpaperSize.height);
            setProperty(element.selector, property, `${value}px`);
        });
    });
    const paddingValue = getPropertyValue('.content', 'padding');
    const numericValue =  paddingValue ? extractNumericValue(paddingValue) : 0 ;
    setProperty('.content', 'width', `${wallpaperSize.width - (numericValue * 2)}px`);
    setProperty('.content', 'height', `${wallpaperSize.height - (numericValue * 2)}px`);
    /* --- hard code --- */
    return cssContent;
}

export function getWallpaperCssFolderUri(workspaceFolder: vscode.WorkspaceFolder, inputDir: string): vscode.Uri {
    /* --- hard code --- */
    return vscode.Uri.joinPath(workspaceFolder.uri, inputDir);
    /* --- hard code --- */
}

export async function getCssContent(wallpaperCssFolderUri: vscode.Uri, styleCssName: string): Promise<string> {
    try {
		await vscode.workspace.fs.stat(wallpaperCssFolderUri);
	} catch (error) {
		await vscode.workspace.fs.createDirectory(wallpaperCssFolderUri);
		vscode.window.showInformationMessage(`${wallpaperCssFolderUri.fsPath} folder created in your workspace root.`);
	}
    const cssPath = vscode.Uri.joinPath(wallpaperCssFolderUri, styleCssName);
	try {
		await vscode.workspace.fs.stat(cssPath);
	} catch (error) {
		try {
			await vscode.workspace.fs.writeFile(cssPath, Buffer.from(defaultCssContent, 'utf-8'));
			vscode.window.showInformationMessage(`${styleCssName} has been created in the ${wallpaperCssFolderUri.fsPath} folder.`);
		} catch (writeError) {
			vscode.window.showErrorMessage(`Failed to create ${styleCssName} in the ${wallpaperCssFolderUri.fsPath} folder.`);
			console.error(writeError);
		}
	}
	let cssContent = '';
	try {
		const cssContentBuffer = await vscode.workspace.fs.readFile(cssPath);
		cssContent = Buffer.from(cssContentBuffer).toString('utf-8');
	} catch (readError) {
		vscode.window.showErrorMessage(`Failed to read ${styleCssName} in the ${wallpaperCssFolderUri.fsPath} folder.`);
		console.error(readError);
	}
    return cssContent;
}

export async function addBackgroundImageFilePath(html: string, backgroundImageUri: vscode.Uri): Promise<string> {
    const backgroundImageFilePath = `file://${backgroundImageUri.fsPath.replace(/\\/g, '/')}`;
    await vscode.workspace.fs.stat(backgroundImageUri).then( (stat) => {
		if (stat.type === vscode.FileType.File) {
			const quotedPath = backgroundImageFilePath.includes(' ') ? `"${backgroundImageFilePath}"` : backgroundImageFilePath;
			const imgHtml = `<div class="background"><img src='${quotedPath}' alt="Background Image"></div>`;
			const bodyRegex = /(<body[^>]*>)/i;
			if (bodyRegex.test(html)) {
				html = html.replace(bodyRegex, `$1\n\t${imgHtml}`);
				// vscode.window.showInformationMessage('Background image tag added successfully.');
			} else {
				vscode.window.showWarningMessage('Could not find <body> tag to insert background image.');
			}
		} else {
			vscode.window.showErrorMessage('Background image file is not a file.');
		}
	}, (error) => {
		vscode.window.showInformationMessage(`If you want to include a background image, please put ${backgroundImageUri.fsPath} in the wallpaper css folder.`);
	});
    return html;
}

export const defaultCssContent = `
/* src/styles.css */
html {
    margin: 0 auto;
    padding: 0;
    width: 100%;
    height: 1080px;
    max-width: 1920px;
    overflow: hidden;
}
body {
    margin: 0;
    width: 1920px;
    height: 1080px;
    background-color: #121212;
    color: #ffffff;
    font-family: Arial, sans-serif;
    line-height: 1.5;
    overflow: hidden;
}
.background {
    position: fixed;
    top: 0;
    left: 0;
    width: 1920px;
    height: 1080px;
    z-index: -1;
}
.background img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0.4;
}
.container {
    width: 1920px;
    height: 1080px;
    display: flex;
    align-items:baseline;
}
.content {
    width: 1900px;
    height: 1080px;
    padding: 10px;
    overflow-y: hidden;
    column-rule: solid 2px #808080;
    column-width: auto;
    column-gap: 20px;
}
h1, h2, h3, h4, h5, h6 {
    color: #ffffff;
    margin-top: 10px;
    margin-bottom: 10px;
}
a {
    color: #ffffff;
    pointer-events: none;
    text-decoration: none;
}
ul, ol {
    padding-left: 30px;
    margin-top: 3px;
    margin-bottom: 3px;
}
li ul {
    padding-left: 20px;
}
li ol {
    padding-left: 20px;
}
li {
    padding-top: 3px;
    padding-bottom: 3px;
}
p {
    margin-top: 0px;
    margin-bottom: 0px;
}
hr {
    border-top: 1px solid #808080;
}
`;