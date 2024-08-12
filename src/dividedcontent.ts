import { PuppeteerController } from './puppeteercontroller';
import { WallpaperSize } from './wallpapersize';

interface TreeNode {
	tag: string;
	directTextContent: string;
	bottomOffset: number;
	attributes?: string;
	isHidden: boolean;
	children: TreeNode[];
}

export class ContentDivider {
	private readonly MAX_NUM_COLUMNS: number = 6;
	private readonly MIN_NUM_COLUMNS: number = 1;
	private readonly MAX_FONTSIZE: number = 24;
	private readonly MIN_FONTSIZE: number = 14;

	private htmlContent: string;
	private cssContent: string;
	private wallpaperSize: WallpaperSize;

	private domTree: TreeNode | null = null;

	private puppeteerController: PuppeteerController;

	private optimalFontSize: number = 0;
	private optimalNumColumns: number = 0;

	constructor(htmlContent: string, cssContent: string, wallpaperSize: WallpaperSize) {
		this.htmlContent = htmlContent;
		this.cssContent = cssContent;
		this.wallpaperSize = wallpaperSize;
		this.puppeteerController = new PuppeteerController({accessWorkspace: false});
	}

	public async initialize(): Promise<void> {
		await this.puppeteerController.initialize(this.wallpaperSize.width, this.wallpaperSize.height);
	}

	public async close(): Promise<void> {
		await this.puppeteerController.close();
	}

	public async run(): Promise<string> {
		if (!this.puppeteerController.isActive()) { await this.initialize(); }
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
		if (!this.puppeteerController.isPageActive()) { throw new Error('Page not initialized.'); }
	
		const columnWidth = this.wallpaperSize.width / numColumns;
		const bodyContentRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
		const newBodyContent = `<body>\n<div class="container"><div class="content" style="max-width: ${columnWidth}px; font-size: ${fontSize}px;">\n$1\n</div>\n</div>\n</body>`;
		let modifiedHtml = this.htmlContent.replace(bodyContentRegex, newBodyContent);

		modifiedHtml = modifiedHtml.replace('</head>', `<style>${this.cssContent}</style></head>`);

		await this.puppeteerController.setContent(modifiedHtml);

		this.domTree = await this.puppeteerController.getPage().evaluate(() => {
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
				const styles = window.getComputedStyle(element);
				const node: TreeNode = {
					tag: element.tagName.toLowerCase(),
					directTextContent: getOnlyText(element),
					bottomOffset: element.getBoundingClientRect().bottom + window.scrollY,
					attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '),
					isHidden: styles.display === 'none' || styles.visibility === 'hidden',
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
					const fits = this.contentFitsInColumns(numColumns);
					console.log(`numColumns: ${numColumns} | fontSize: ${fontSize} | result: ${fits ? "true" : "false"}`);
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
		if (lastLeafBottom < numColumns * (this.wallpaperSize.height - 20)) {
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
