import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import pretty from 'pretty';

interface TreeNode {
	tag: string;
	directTextContent: string;
	height: number;
	topOffset: number;
	bottomOffset: number;
	marginTop: number;
	marginBottom: number;
	paddingTop: number;
    paddingBottom: number;
	divideHere: boolean;
	attributes?: string;
	isHidden: boolean;
	children: TreeNode[];
}

export class ContentDivider {

	private readonly MAX_WIDTH : number = 1920;
	private readonly MAX_HEIGHT: number = 1080;
	private readonly MAX_NUM_DIVISIONS: number = 6;
	private readonly MIN_NUM_DIVISIONS: number = 1;
	private readonly MAX_FONT_SIZE: number = 24;
	private readonly MIN_FONT_SIZE: number = 14;

	private htmlString: string;
	private cssContent: string;

	private currentFontSize: number = 0;
	private currentNumDivisions: number = 0;

	private domTree: TreeNode | null = null;
	private dividedDomTrees: TreeNode[] = [];

	private browser: puppeteer.Browser | null = null;
	private page: puppeteer.Page | null = null;

	private optimalFontSize: number = 0;
	private optimalDivisions: number = 0;

	constructor(htmlString: string) {
		this.htmlString = `<html><head></head><body>${htmlString}</body></html>`;
		this.currentFontSize = this.MAX_FONT_SIZE;
		this.cssContent = '';
	}

	public async initialize(): Promise<void> {
		if (this.browser) {
			await this.close();
		}
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

		const cssPath = vscode.Uri.joinPath(workspaceFolder.uri, 'md-wallpaper', 'style.css');
		// const cssPath = vscode.Uri.file(path.join(path.dirname(vscode.window.activeTextEditor?.document.uri.fsPath || ''), 'md-wallpaper', 'style.css'));
		const cssContentBuffer = await vscode.workspace.fs.readFile(cssPath);
		this.cssContent = Buffer.from(cssContentBuffer).toString('utf-8');

		const launchOptions: puppeteer.PuppeteerLaunchOptions = {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { 
                width: this.MAX_WIDTH, 
                height: this.MAX_HEIGHT, 
                deviceScaleFactor: 1 
            }
        };

		if (puppeteer.default && typeof puppeteer.default.launch === 'function') {
			(launchOptions as any).headless = 'new';
		} else {
			launchOptions.headless = true;
		}

		this.browser = await puppeteer.launch(launchOptions);
		this.page = await this.browser.newPage();
	}

	public async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
		}
	}

	public setHtmlString(htmlString: string) {
		this.htmlString = htmlString;
	}

	public async run(): Promise<string> {
		if (!this.browser || !this.page) {
			await this.initialize();
		}
		try {
			await this.getOptimalSettings();

			// // 最適な設定を適用したHTMLを取得
			// const optimalHtml = await this.getOptimalHtml();
		
			// // HTMLをファイルとして保存
			// const filePath = await this.saveHtmlFile(optimalHtml);
			
			// // 保存したファイルをブラウザで開く
			// this.openInBrowser(filePath);
	
			this.divideTree();
			// this.logResults();
	
			// await this.testHtml();
	
			return this.createHtml();
		} finally {
			await this.close();
		}
	}

	// private async getOptimalHtml(): Promise<string> {
    //     if (!this.page) {
    //         throw new Error('Page not initialized.');
    //     }
    //     // 現在のページのHTMLを取得
    //     let html = await this.page.content();
    //     return pretty(html);
    // }

	// private async saveHtmlFile(html: string): Promise<string> {
    //     const editor = vscode.window.activeTextEditor;
    //     if (!editor) {
    //         throw new Error('No active editor found.');
    //     }
        
    //     const folderPath = path.dirname(editor.document.uri.fsPath);
    //     const filePath = vscode.Uri.file(path.join(folderPath, 'out', 'optimal_content.html'));
        
    //     // fs.writeFileSync(filePath, html);
	// 	await vscode.workspace.fs.writeFile(filePath, Buffer.from(html));
    //     console.log(`Optimal HTML saved to: ${filePath}`);
        
    //     return filePath.fsPath;
    // }

    // private openInBrowser(filePath: string) {
    //     vscode.env.openExternal(vscode.Uri.file(filePath));
    // }

	private async setDomTree(): Promise<void> {
		if (!this.page) {
			throw new Error('Page not initialized.');
		}

		const columnWidth = this.MAX_WIDTH / this.currentNumDivisions;
		const bodyContentRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
		const newBodyContent = `<body><div class="divided-content" style="width: ${this.MAX_WIDTH}px; font-size: ${this.currentFontSize}px;"><div class="content-column" style="max-width: ${columnWidth}px;">$1</div></div></body>`;
		let modifiedHtml = this.htmlString.replace(bodyContentRegex, newBodyContent);

		// CSSを<head>タグ内に挿入
		modifiedHtml = modifiedHtml.replace('</head>', `<style>${this.cssContent}</style></head>`);

		await this.page.setContent(modifiedHtml, {waitUntil: 'domcontentloaded'});

		await this.page.setViewport({
			width: this.MAX_WIDTH,
			height: this.MAX_HEIGHT,
			deviceScaleFactor: 1
		});

		 // スクロール位置をリセット
		await this.page.evaluate(() => {
            window.scrollTo(0, 0);
        });

		this.domTree = await this.page.evaluate(() => {
			function getOnlyText(element: Element): string {
				let text = '';
				for (let i = 0; i < element.childNodes.length; i++) {
					const node = element.childNodes[i];
					if (node.nodeType === Node.TEXT_NODE) {
						text += node.textContent?.trim() || '';
					}
				}
				const childElements = element.getElementsByTagName('*');
				for (let i = 0; i < childElements.length; i++) {
					const childText = childElements[i].textContent || '';
					text = text.replace(childText, '');
				}
				return text.trim();
			}
			function createNode(element: Element): TreeNode {
				const rect = element.getBoundingClientRect();
				const styles = window.getComputedStyle(element);
				const marginTop = Math.ceil(parseFloat(styles.marginTop));
				const marginBottom = Math.ceil(parseFloat(styles.marginBottom));
				const paddingTop = Math.ceil(parseFloat(styles.paddingTop));
				const paddingBottom = Math.ceil(parseFloat(styles.paddingBottom));
				const height = rect.height;
				const topOffset = rect.top + window.scrollY;
				const bottomOffset = rect.bottom + window.scrollY;
				let actualHeight = height;
				if (element.children.length > 0) {
					const lastChild = element.children[element.children.length - 1];
					const lastChildRect = lastChild.getBoundingClientRect();
					actualHeight = lastChildRect.bottom - rect.top;
				}
				const attributes = Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
				const isHidden = styles.display === 'none' || styles.visibility === 'hidden';
				const node: TreeNode = {
					tag: element.tagName.toLowerCase(),
					directTextContent: getOnlyText(element),
					height: actualHeight,
					topOffset: topOffset,
					bottomOffset: bottomOffset,
					marginTop: marginTop,
					marginBottom: marginBottom,
					paddingTop: paddingTop,
                    paddingBottom: paddingBottom,
					divideHere: false,
					attributes: attributes,
					isHidden: isHidden,
					children: Array.from(element.children).map(createNode)
				};
				return node;
			}
			// document.body.style.fontFamily = 'Arial, sans-serif'; 
			return createNode(document.getElementsByClassName("content-column")[0]);
		});
	}

	private async getOptimalSettings(): Promise<void> {
		// this.logToFile("getOptimalSettings function is called");
		let bestResult: {fontSize: number, numDivisions: number} | null = null;
		for (let numDivisions = this.MIN_NUM_DIVISIONS; numDivisions <= this.MAX_NUM_DIVISIONS; numDivisions++) {
			for (let fontSize = this.MAX_FONT_SIZE; fontSize >= this.MIN_FONT_SIZE; fontSize--) {
				this.currentFontSize = fontSize;
				this.currentNumDivisions = numDivisions;
				try {
					await this.setDomTree();
					const fits = this.contentFitsInDivisions(numDivisions);
					if (fits) {
						bestResult = { fontSize: fontSize, numDivisions: numDivisions };
						// this.logToFile(`Found optimal settings: fontSize=${fontSize}, divisions=${numDivisions}`);
						this.optimalFontSize = bestResult.fontSize;
						this.optimalDivisions = bestResult.numDivisions;
						// this.logToFile(`\n${JSON.stringify(this.domTree, null, 4)}`);
						return;
					}
				} catch (error) {
					console.log(`Error occurred: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
		if (!bestResult) {
			bestResult = { fontSize: this.MIN_FONT_SIZE, numDivisions: this.MAX_NUM_DIVISIONS };
			// this.logToFile("No optimal settings found, using minimum values");
		}
		this.optimalFontSize = bestResult.fontSize;
		this.optimalDivisions = bestResult.numDivisions;
		// this.logToFile(`\n${JSON.stringify(this.domTree, null, 4)}`);
	}

	private contentFitsInDivisions(divisions: number): boolean {
		let usedDivisions = 1;			// 使用された分割数を追跡
		let lastDivideOffset = 0;
		// 新しい分割を開始する関数
		const startNewDivision = (node: TreeNode): boolean => {
			if (usedDivisions < divisions) {
				node.divideHere = true;
				usedDivisions++;
				lastDivideOffset = node.topOffset;
				// console.log(`========================== New Division at ${lastDivideOffset} ==========================`);
				return true;
			}
			return false;
		};
		// 深さ優先探索でツリーを走査する関数
		const dfs = (node: TreeNode): boolean => {
			if (node.isHidden) {
				return true;
			}

			// const effectiveMarginTop = calculateEffectiveMargin(node.marginTop);
			const nodeRelativeOffset = node.topOffset - lastDivideOffset;
			const relativeBottomOffset = node.bottomOffset - lastDivideOffset;

			// 末端ノード（子を持たないノード）の場合のみ分割を考慮
			if (node.children.length === 0) {
				// ノードが高さ制限を超える場合、新しい分割を開始
				if (relativeBottomOffset > this.MAX_HEIGHT) {
					if (!startNewDivision(node)) {
						return false;  // これ以上分割できない場合
					}
				}
				// prevMarginBottom = node.marginBottom;
				// console.log(`Leaf ${node.tag} | Top: ${nodeRelativeOffset} | Bottom: ${relativeBottomOffset} | Height: ${node.height} | ${node.directTextContent.length > 10 ? node.directTextContent.substring(0, 10) + '...' : node.directTextContent}`);
			} else {
				// 内部ノードの場合、子ノードを処理
				for (const child of node.children) {
					if (!dfs(child)) {
						return false;
					}
				}
				// 内部ノードの処理後、高さが1080pxを超えていないか確認
				const lastChild = node.children[node.children.length - 1];
				const lastChildRelativeBottom = lastChild.bottomOffset - lastDivideOffset;
				if (lastChildRelativeBottom > this.MAX_HEIGHT) {
					if (!startNewDivision(node)) {
						return false;
					}
				}
			}
            return true;
		};
		if (this.domTree === null) {
			throw new Error('domTree is null in contentFitsInDvisions');
		}
		const result = dfs(this.domTree);
		// console.log(`========== Divisions: ${divisions}. Font size: ${this.currentFontSize}. Columns used: ${usedDivisions}. ==========`);
		return result && usedDivisions <= divisions;
	}

	// DOMツリーを分割するメインメソッド
	private divideTree(): void {
		// console.log("開始: divideTree()"); // デバッグ出力
		// ---------------------------------- //
		if (this.domTree === null) {
			return;
		}
		const dividedTrees: TreeNode[] = [];	// 探索済みで分割された部分木たち
		let exploredTree: TreeNode = {...this.domTree, children: []};	// 探索済みでコピーされた部分木
		let unexploredTree: TreeNode = JSON.parse(JSON.stringify(this.domTree));	// 未探索の木
		// ---------------------------------- //

		// 再帰的に木構造を探索し、分割する関数
		const traverse = (unexploredNode: TreeNode, exploredNode: TreeNode): boolean => {
			for (let i = 0; i < unexploredNode.children.length; i++) {
				const childNode = unexploredNode.children[i];
				const exploredChildNode = {...childNode, children: []};
				exploredNode.children.push(exploredChildNode);

				if (childNode.divideHere) {
					// 分割ポイントに達した場合、現在の探索済みの木を結果に追加
					dividedTrees.push(JSON.parse(JSON.stringify(exploredTree)));
					// console.log(`=============== ${childNode.tag}で分割しました ===============`); // デバッグ出力
					// this.logToFile(`現在の分割結果\n${JSON.stringify(dividedTrees, null, 4)}`);
					// this.logToFile(`現在の未探索の部分木\n${JSON.stringify(unexploredTree, null, 4)}`);
					// 探索済みの木をリセット
					unexploredNode.children.splice(0, i+1);
                    exploredTree = {...this.domTree!, children: []};
                    // exploredNode = exploredTree;
					return true;
				} 
				if (traverse(childNode, exploredChildNode)) {
					return true;
				}
				// 探索済みの木をリセット
				unexploredNode.children.splice(i, 1);
				i--;
				// unexploredNode.children.shift();
			}
			unexploredNode.children = [];
			return false;
		};
		while (unexploredTree.children.length > 0) {
			traverse(unexploredTree, exploredTree);
		}
		
		// 最後の部分木を追加
		if (exploredTree.children.length > 0) {
			dividedTrees.push(JSON.parse(JSON.stringify(exploredTree)));
		}

		// 最後の部分木を追加（未探索の木に子ノードが残っているか、分割された木が一つもない場合）
		// this.logToFile(`未探索の部分木\n${JSON.stringify(unexploredTree, null, 4)}`);
		// this.logToFile(`最後の探索済みの部分木\n${JSON.stringify(exploredTree, null, 4)}`);
		this.dividedDomTrees = dividedTrees;
		// this.logToFile(`分割結果\n${JSON.stringify(this.dividedDomTrees, null, 4)}`); // デバッグ出力
        // console.log("終了: divideTree()"); // デバッグ出力
	}

	private createHtml(): string {
		function escapeHtml(unsafe: string): string {
			return unsafe
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot')
					.replace(/'/g, '&#039;');
		}
		function treeToHtml(node: TreeNode) {
			if (node.isHidden) {
				return '';
			}
			let html = `<${node.tag}`;
			if (node.attributes) {
				html += ` ${node.attributes}`;
			}
			html += '>';
			if (node.directTextContent.trim()) {
				html += escapeHtml(node.directTextContent.trim());
                // html += `(${node.topOffset}|${node.height}|${node.bottomOffset})`;
                // html += `(${node.bottomOffset})`;
			}
			if (node.children.length > 0) {
				html += '\n';
				for (const child of node.children) {
					html += treeToHtml(child);
				}
			}
			html += `</${node.tag}>`;
			return html;
		}
		const columnWidth = this.MAX_WIDTH / this.dividedDomTrees.length;
		console.log(`Column Width: ${columnWidth}`);
		let html = '';
		html += `<div class="divided-content" style="width: ${this.MAX_WIDTH}px; font-size: ${this.optimalFontSize}px;">`;
		for (const tree of this.dividedDomTrees) {
			html += `<div class="content-column" style="max-width: ${columnWidth}px;">`;
			for (const child of tree.children) {
				html += `${treeToHtml(child)}`;
			}
			html += '</div>';
		}
		html += '</div>';
		return html;
	}

	// private logResults(): void {
		// this.logToFile('========== Optimal Settings ==========');
		// this.logToFile(`\t\tFont Size: ${this.optimalFontSize}px`);
		// this.logToFile(`\t\tNum Divisions: ${this.optimalDivisions}`);
		// this.logToFile(`\t\tColumn Width: ${this.MAX_WIDTH / this.optimalDivisions}px`);
		// this.logToFile('======================================');
		// console.log('========== Optimal Settings ==========');
		// console.log(`\tFont Size: ${this.optimalFontSize}px`);
		// console.log(`\tNum Divisions: ${this.optimalDivisions}`);
		// console.log(`\tColumn Width: ${this.MAX_WIDTH / this.optimalDivisions}px`);
		// console.log('======================================');
		// this.logToFile('============== DOM Tree ==============');
		// if (this.domTree === null ) {
		// 	throw new Error("domTree is null.");
		// }
		// this.logToFile(`\n${this.printTreeStructure(this.domTree)}`);
		// this.logToFile('======================================');
	// }

	// private printTreeStructure(node: TreeNode | null = null, depth: number = 0): void {
	// 	if (node === null) {
	// 		return;
	// 	}
	// 	const indent = "\t" + "\t".repeat(depth++);
		// this.logToFile(`${indent}<${node.tag}>`);
		// if (node.divideHere) {
			// this.logToFile(`${indent}divideHere: true`);
			// console.log(`Divide here set to true for node: <${node.tag}>${node.directTextContent}</${node.tag}> in printTreeStructure.`); 
		// }
		// if (node.directTextContent){
			// this.logToFile(`${indent}${node.directTextContent}`);
		// }
		// for (const child of node.children) {
		// 	this.printTreeStructure(child, depth);
		// }
		// this.logToFile(`${indent}</${node.tag}>`);
		// return;
	// }

	// private logToFile(message: string): void {
	// 	const editor = vscode.window.activeTextEditor;
	// 	if (!editor) {
	// 		vscode.window.showErrorMessage('No active editor found.');
	// 		return;
	// 	}
	// 	const logFilePath = path.join(path.dirname(editor.document.uri.fsPath), 'out', 'app.log');
	// 	try {
	// 		fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
	// 		fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`);
	// 	} catch (error) {
	// 		console.error('Error writing to log file:', error);
    //         vscode.window.showErrorMessage('Failed to write to log file.');
	// 	}
	// }
}
