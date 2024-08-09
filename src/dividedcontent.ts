import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface TreeNode {
	tag: string;
	directTextContent: string;
	height: number;
	divideHere: boolean;
	attributes?: string;
	children: TreeNode[];
}

export class ContentDivider {

	private readonly MAX_WIDTH : number = 1920;
	private readonly MAX_HEIGHT: number = 1080;
	private readonly MAX_NUM_DIVISIONS: number = 5;
	private readonly MIN_NUM_DIVISIONS: number = 1;
	private readonly MAX_FONT_SIZE: number = 24;
	private readonly MIN_FONT_SIZE: number = 14;

	private htmlString: string;

	private currentFontSize: number = 0;
	private currentNumDivisions: number = 0;

	private domTree: TreeNode | null = null;
	private dividedDomTrees: TreeNode[] = [];

	private browser: puppeteer.Browser | null = null;
	private page: puppeteer.Page | null = null;

	private optimalFontSize: number = 0;
	private optimalDivisions: number = 0;

	constructor(htmlString: string) {
		this.htmlString = htmlString;
		this.currentFontSize = this.MAX_FONT_SIZE;
	}

	public async initialize(): Promise<void> {
		if (this.browser) {
			await this.close();
		}
		this.browser = await puppeteer.launch({ args:['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] });
		this.page = await this.browser.newPage();
		await this.page.setViewport({ width: this.MAX_WIDTH, height: this.MAX_HEIGHT, deviceScaleFactor: 1 });
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

	private async updateFontSize(): Promise<void> {
		if (!this.page) {
			throw new Error('Page not initialized.');
		}
		await this.page.evaluate((fontSize) => {
			document.body.style.fontSize = `${fontSize}px`;
		}, this.currentFontSize);
	}

	private async updateWidth(): Promise<void> {
		if (!this.page) {
			throw new Error('Page not initialized.');
		}
		await this.page.evaluate((width) => {
			document.body.style.width = `${this.MAX_WIDTH / width}px`;
		}, this.currentNumDivisions);
	}

	public async run(): Promise<string> {
		if (!this.browser || !this.page) {
			await this.initialize();
		}
		await this.getOptimalSettings();

		this.divideTree();
		this.logResults();

		// const isValid = this.validateDividedTrees();
		// this.logToFile(`Divided tree validation result: ${isValid ? 'Valid' : 'Invalid'}`);
		// console.log("Finished!!!");
		return this.createHtml();
		// return this.htmlString;
	}

	private async getOptimalSettings(): Promise<void> {
		this.logToFile("getOptimalSettings function is called");
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
						this.logToFile(`\n${JSON.stringify(this.domTree, null, 4)}`);
						return;
					}
				} catch (error) {
					console.log(`Error occurred: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
		if (!bestResult) {
			bestResult = { fontSize: this.MIN_FONT_SIZE, numDivisions: this.MAX_NUM_DIVISIONS };
			this.logToFile("No optimal settings found, using minimum values");
		}
		this.optimalFontSize = bestResult.fontSize;
		this.optimalDivisions = bestResult.numDivisions;
		this.logToFile(`\n${JSON.stringify(this.domTree, null, 4)}`);
	}

	private contentFitsInDivisions(divisions: number): boolean {
		let currentColumnHeight = 0;
		let usedColumns = 1;
		const dfs = (node: TreeNode | null = null): boolean => {
			if (node === null) {
				throw new Error('node is null in dfs in contentFitsInDvisions');
			}
			if (node.children.length === 0) {
				// console.log(`\t${node?.tag} | current column height+node height: ${currentColumnHeight}+${node.height}=${currentColumnHeight+node.height} | ${node?.directTextContent}`);
				if (currentColumnHeight + node.height > this.MAX_HEIGHT) {
					if (usedColumns < divisions) {
						// console.log(`==================================================  divide here ==================================================`);
						node.divideHere = true;
						usedColumns++;
						currentColumnHeight = node.height;
					} else {
						return false;
					}
				} else {
					currentColumnHeight += node.height;
				}
			}
			for (const child of node.children) {
				if (!dfs(child)) {
					return false;
				}
			}
			return true;
		};
		if (this.domTree === null) {
			throw new Error('domTree is null in contentFitsInDvisions');
		}
		const result = dfs(this.domTree);
		console.log(`Divisions: ${divisions}. Font size: ${this.currentFontSize}. Columns used: ${usedColumns}.`);
		return result;
	}

	private async setDomTree(): Promise<void> {
		if (!this.page) {
			throw new Error('Page not initialized.');
		}
		await this.page.setContent(this.htmlString);
		await this.updateFontSize();
		await this.updateWidth();
		await this.page.waitForSelector('body');

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
				const rects = element.getClientRects();
				const height = Array.from(rects).reduce((sum, rect) => sum + rect.height, 0);
				const attributes = Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
				return {
					tag: element.tagName.toLowerCase(),
					directTextContent: getOnlyText(element),
					height: height,
					divideHere: false,
					attributes: attributes,
					children: Array.from(element.children).map(createNode)
				};
			}
			document.body.style.fontFamily = 'Arial, sans-serif'; 
			return createNode(document.body);
		});
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
			// for (let i = 0; i < node.children.length; i++) {
			// console.log(`${JSON.stringify(unexploredNode)}`);
			// while (unexploredNode.children.length > 0) {
			for (let i = 0; i < unexploredNode.children.length; i++) {
				const childNode = unexploredNode.children[i];
				const exploredChildNode = {...childNode, children: []};
				exploredNode.children.push(exploredChildNode);

				if (childNode.divideHere) {
					// 分割ポイントに達した場合、現在の探索済みの木を結果に追加
					dividedTrees.push(JSON.parse(JSON.stringify(exploredTree)));
					// console.log(`=============== ${childNode.tag}で分割しました ===============`); // デバッグ出力
					this.logToFile(`現在の分割結果\n${JSON.stringify(dividedTrees, null, 4)}`);
					this.logToFile(`現在の未探索の部分木\n${JSON.stringify(unexploredTree, null, 4)}`);
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
		this.logToFile(`未探索の部分木\n${JSON.stringify(unexploredTree, null, 4)}`);
		this.logToFile(`最後の探索済みの部分木\n${JSON.stringify(exploredTree, null, 4)}`);
		this.dividedDomTrees = dividedTrees;
		this.logToFile(`分割結果\n${JSON.stringify(this.dividedDomTrees, null, 4)}`); // デバッグ出力
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
			let html = `<${node.tag}`;
			if (node.attributes) {
				html += ` ${node.attributes}`;
			}
			html += '>';
			if (node.directTextContent.trim()) {
				html += escapeHtml(node.directTextContent.trim());
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
			html += `<div class="content-column" style="width: ${columnWidth}px;">`;
			for (const child of tree.children) {
				html += `${treeToHtml(child)}`;
			}
			html += '</div>';
		}
		html += '</div>';
		return html;
	}

	private logResults(): void {
		this.logToFile('========== Optimal Settings ==========');
		this.logToFile(`\t\tFont Size: ${this.optimalFontSize}px`);
		this.logToFile(`\t\tNum Divisions: ${this.optimalDivisions}`);
		this.logToFile(`\t\tColumn Width: ${this.MAX_WIDTH / this.optimalDivisions}px`);
		this.logToFile('======================================');
		console.log('========== Optimal Settings ==========');
		console.log(`\tFont Size: ${this.optimalFontSize}px`);
		console.log(`\tNum Divisions: ${this.optimalDivisions}`);
		console.log(`\tColumn Width: ${this.MAX_WIDTH / this.optimalDivisions}px`);
		console.log('======================================');
		this.logToFile('============== DOM Tree ==============');
		if (this.domTree === null ) {
			throw new Error("domTree is null.");
		}
		this.logToFile(`\n${this.printTreeStructure(this.domTree)}`);
		this.logToFile('======================================');
		// this.logToFile('========== Divided DOM Tree ==========');
		// for (let i = 0; i < this.dividedDomTrees.length; i++) {
		// 	console.log(`Printing tree structure for division ${i+1}`);
		// 	this.logToFile(`=== division: ${i+1} ===`);
		// 	this.logToFile(`${this.printTreeStructure(this.dividedDomTrees[i])}`);
		// }
		// this.logToFile('======================================');
	}

	private printTreeStructure(node: TreeNode | null = null, depth: number = 0): void {
		if (node === null) {
			return;
		}
		const indent = "\t" + "\t".repeat(depth++);
		this.logToFile(`${indent}<${node.tag}>`);
		if (node.divideHere) {
			this.logToFile(`${indent}divideHere: true`);
			console.log(`Divide here set to true for node: <${node.tag}>${node.directTextContent}</${node.tag}> in printTreeStructure.`); 
		}
		if (node.directTextContent){
			this.logToFile(`${indent}${node.directTextContent}`);
		}
		for (const child of node.children) {
			this.printTreeStructure(child, depth);
		}
		this.logToFile(`${indent}</${node.tag}>`);
		return;
	}

	private logToFile(message: string): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found.');
			return;
		}
		const logFilePath = path.join(path.dirname(editor.document.uri.fsPath), 'out', 'app.log');
		try {
			fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
			fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`);
		} catch (error) {
			console.error('Error writing to log file:', error);
            vscode.window.showErrorMessage('Failed to write to log file.');
		}
	}
}
