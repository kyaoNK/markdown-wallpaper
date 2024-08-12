# Markdown WallPaperImage

This Visual Studio Code extension allows you to generate desktop wallpaper images from your markdown files, with extensive customization options.

## Features

- Generate wallpaper images from active markdown files
- Support for multiple wallpaper sizes
- Custom CSS styling for wallpaper generation
- Option to use previously selected wallpaper size
- Customizable wallpaper design through CSS and background image

## Use Case

This extension is perfect for users who maintain a single markdown file for task management and note-taking. With Markdown WallPaperImage, you can easily convert your important information into a desktop wallpaper. This allows you to:

- Keep your tasks and important notes always visible on your desktop
- Create a visually appealing and personalized desktop environment
- Quickly reference your information without switching between applications
- Stay organized and motivated by having your goals and reminders constantly in view

For example, if you have a markdown file with your weekly goals, to-do lists, and important reminders, you can generate a wallpaper from this file. This way, every time you look at your desktop, you'll see your priorities and stay focused on your objectives.

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "Markdown WallPaperImage"
4. Click Install

## Usage

1. Open a markdown file in VS Code
2. Use one of the following commands:
    - Generate Wallpaper with Selected Size: Choose a wallpaper size and generate the image
    - Generate Wallpaper with Last Used Size: Generate a wallpaper using the previously selected size

## Customization

This extension offers powerful customization options for users who understand HTML and CSS:

1. **wallpaper-css folder**: Upon first use, the extension creates a `wallpaper-css` folder in your workspace. This folder is used for customization files.

2. **style.css**: Inside the `wallpaper-css` folder, you'll find a `style.css` file. You can modify this file to customize the appearance of your wallpaper.

3. **background-image.png**: You can place an image file named `background-image.png` in the `wallpaper-css` folder to use as a background for your wallpaper.

4. **HTML Output**: The extension generates an HTML file before creating the final wallpaper image. This allows you to see the structure of your wallpaper and make further customizations if needed.

By leveraging these features, you can create highly personalized wallpapers that match your style and preferences.

## Commands

- `extension.generateWallpaperWithSelectedWallpaperSize`: Generate a wallpaper by selecting a size
- `extension.generateWallpaperWithLastUsedWallpaperSize`: Generate a wallpaper using the last selected size

## Keyboard Shortcuts

This extension does not define any default keyboard shortcuts. However, you can add custom keyboard shortcuts for the commands in VS Code:

1. Open the Keyboard Shortcuts editor (File > Preferences > Keyboard Shortcuts)
2. Search for the command you want to add a shortcut to (e.g., "Generate Wallpaper with Selected Size")
3. Click on the plus icon next to the command
4. Press the desired key combination for the shortcut

For example, you might set:

- `Ctrl+Alt+W` for "Generate Wallpaper with Selected Size"
- `Ctrl+Shift+Alt+W` for "Generate Wallpaper with Last Used Size"

## Requirements

- Visual Studio Code v1.91.0 or higher
- Node.js and npm installed on your system

## Extension Settings

This extension does not contribute any settings to VS Code.

## Known Issues

No known issues at this time. If you encounter any problems, please [open an issue](https://github.com/yourusername/markdown-wallpaperimage/issues) on our GitHub repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Release Notes

### 2.0.1

Initial release of Markdown Wallpaper Image Generator

- Added support for multiple wallpaper sizes
- Implemented custom CSS styling for wallpaper generation
- Introduced option to use previously selected wallpaper size
- Added customization options through `wallpaper-css` folder

## Future Plans

- Add support for more wallpaper sizes
- Implement theme-based wallpaper generation
- Improve performance for large markdown files
- Add customization options for font styles and colors
- Provide templates for common wallpaper layouts

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped with this project
- Inspired by the need for customizable, content-rich wallpapers and improved productivity