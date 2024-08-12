import * as vscode from 'vscode';
import * as puppeteer from 'puppeteer';

interface TreeNode {
	tag: string;
	directTextContent: string;
	height: number;
	topOffset: number;
	bottomOffset: number;
	attributes?: string;
	isHidden: boolean;
	children: TreeNode[];
}

export class ContentDivider {

	private readonly MAX_WIDTH : number = 1920;
	private readonly MAX_HEIGHT: number = 1080;
	private readonly MAX_NUM_COLUMNS: number = 6;
	private readonly MIN_NUM_COLUMNS: number = 1;
	private readonly MAX_FONTSIZE: number = 24;
	private readonly MIN_FONTSIZE: number = 14;

	private htmlContent: string;
	private cssContent: string;

	private domTree: TreeNode | null = null;

	private browser: puppeteer.Browser | null = null;
	private page: puppeteer.Page | null = null;

	private optimalFontSize: number = 0;
	private optimalNumColumns: number = 0;

	constructor(htmlContent: string, cssContent: string) {
		this.htmlContent = `<html><head></head><body>${htmlContent}</body></html>`;
		this.cssContent = cssContent;
	}

	public async initialize(): Promise<void> {
		if (this.browser) { await this.close(); }
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

	public async run(): Promise<string> {
		if (!this.browser || !this.page) { await this.initialize(); }
		try {
			await this.getOptimalSettings();
			console.log(`Optimal FontSize: ${this.optimalFontSize}`);
			console.log(`Optimal NumColumns: ${this.optimalNumColumns}`);
			return this.createHtml();
		} finally {
			await this.close();
		}
	}

	private async setDomTree(fontSize: number, numColumns: number): Promise<void> {
		if (!this.page) { throw new Error('Page not initialized.'); }
	
		const columnWidth = this.MAX_WIDTH / numColumns;
		const bodyContentRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
		const newBodyContent = `<body>\n<div class="container"><div class="content" style="max-width: ${columnWidth}px; font-size: ${fontSize}px;">\n$1\n</div>\n</div>\n</body>`;
		let modifiedHtml = this.htmlContent.replace(bodyContentRegex, newBodyContent);

		modifiedHtml = modifiedHtml.replace('</head>', `<style>${this.cssContent}</style></head>`);

		await this.page.setContent(modifiedHtml, {waitUntil: 'domcontentloaded'});

		await this.page.setViewport({
			width: this.MAX_WIDTH,
			height: this.MAX_HEIGHT,
			deviceScaleFactor: 1
		});

		await this.page.evaluate(() => { window.scrollTo(0, 0); });

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
					attributes: attributes,
					isHidden: isHidden,
					children: Array.from(element.children).map(createNode)
				};
				return node;
			}
			return createNode(document.getElementsByClassName("content")[0]);
		});

	}

	private async getOptimalSettings(): Promise<void> {
		let bestResult: {fontSize: number, numColumns: number} | null = null;
		for (let numColumns = this.MIN_NUM_COLUMNS; numColumns <= this.MAX_NUM_COLUMNS; numColumns++) {
			for (let fontSize = this.MAX_FONTSIZE; fontSize >= this.MIN_FONTSIZE; fontSize--) {
				try {
					await this.setDomTree(fontSize, numColumns);
					console.log(`numColumns: ${numColumns} | fontSize: ${fontSize}`);
					const fits = this.contentFitsInColumns(numColumns);
					if (fits) {
						bestResult = { fontSize, numColumns };
						this.optimalFontSize = bestResult.fontSize;
						this.optimalNumColumns = bestResult.numColumns;
						return;
					}
				} catch (error) {
					console.log(`Error occurred: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
		if (!bestResult) { bestResult = { fontSize: this.MIN_FONTSIZE, numColumns: this.MAX_NUM_COLUMNS }; }
		this.optimalFontSize = bestResult.fontSize;
		this.optimalNumColumns = bestResult.numColumns;
		return;
	}

	private contentFitsInColumns(numColumns: number): boolean {
		if (this.domTree === null) {
			throw new Error('domTree is null in contentFitsInColumns');
		}

		function getLastLeafNode(node: TreeNode): TreeNode {
			if (!node) { throw new Error('Invalid node in getLastLeafNode'); }
			if (node.children.length === 0) { return node; }
			return getLastLeafNode(node.children[node.children.length - 1]);
		}

		const lastLeaf = getLastLeafNode(this.domTree);
		if (lastLeaf === null) { throw new Error('The last leaf node could not be found.'); }
		const lastLeafBottom = lastLeaf.bottomOffset;
		console.log(`MAX_HEIGHT:${numColumns * this.MAX_HEIGHT} | Last Leaf ${lastLeaf.tag} | bottom:${lastLeaf.bottomOffset} | ${lastLeaf.directTextContent}`);
		if (lastLeafBottom < numColumns * (this.MAX_HEIGHT - 20)) {
			return true;
		} else {
			return false;
		}
	}

	private createHtml(): string {
		const bodyRegex = /(<body[^>]*>)([\s\S]*?)(<\/body>)/i;
		let modifiedHtml = this.htmlContent.replace(bodyRegex, (match, openingTag, content, closingTag) => {
			return `${openingTag}\n<div class="container"><div class="content" style="font-size: ${this.optimalFontSize}px; column-count: ${this.optimalNumColumns};">\n${content}</div>\n</div>${closingTag}`;
		});
		modifiedHtml = modifiedHtml.replace('</head>', `<style>${this.cssContent}</style></head>`);
		return modifiedHtml;
	}
}
