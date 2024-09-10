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

## Automatic Wallpaper Updating (Windows)

For Windows users who want their wallpaper to update automatically when changes are made, follow these steps:

1. Create a PowerShell script (e.g., `DesktopBackgroundUpdater.ps1`) with the following content:
    ```powershell
    # Specify the folder path
    $folderPath = "C:\Users\YourUsername\Documents\Wallpapers\wallpaper\"
    $fileName = "background-image.png"  # File pattern to watch

    # Function to set desktop background
    function Set-Wallpaper($imagePath) {
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Wallpaper {
            [DllImport("user32.dll", CharSet = CharSet.Auto)]
            public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
        }
    "@
        $SPI_SETDESKWALLPAPER = 0x0014
        $SPIF_UPDATEINIFILE = 0x01
        $SPIF_SENDCHANGE = 0x02
        [Wallpaper]::SystemParametersInfo($SPI_SETDESKWALLPAPER, 0, $imagePath, $SPIF_UPDATEINIFILE -bor $SPIF_SENDCHANGE)
    }

    # Set up FileSystemWatcher
    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $folderPath
    $watcher.Filter = $fileName
    $watcher.IncludeSubdirectories = $false
    $watcher.EnableRaisingEvents = $true

    # Define event handler
    $action = {
        $path = $Event.SourceEventArgs.FullPath
        $changeType = $Event.SourceEventArgs.ChangeType
        $timeStamp = (Get-Date).ToString("yyyy/MM/dd HH:mm:ss")
        
        Write-Host "[$timeStamp] File ${changeType}: $path"
        
        if ($changeType -eq 'Changed' -or $changeType -eq 'Created') {
            Set-Wallpaper $path
            Write-Host "Desktop background updated to: $path"
        }
    }

    # Register events
    Register-ObjectEvent $watcher "Created" -Action $action
    Register-ObjectEvent $watcher "Changed" -Action $action

    Write-Host "Watching for PNG file changes in $folderPath"
    Write-Host "Press Ctrl+C to exit"

    # Keep the script running
    try {
        while ($true) {
            Start-Sleep -Seconds 1
        }
    } finally {
        # Unregister event handlers when the script exits
        Unregister-Event -SourceIdentifier $watcher.Created
        Unregister-Event -SourceIdentifier $watcher.Changed
    }
    ```

2. Set up a Windows Task Scheduler task to run this script:
    - Open Task Scheduler
    - Select "Create Task"
    - In the "General" tab, enter a name and check "Run with highest privileges"
    - In the "Triggers" tab, click "New" and select "At log on"
    - In the "Actions" tab, click "New" and set:
        - Program/script: `powershell.exe`
        - Add arguments: `-ExecutionPolicy Bypass -File "C:\Path\To\Your\DesktopBackgroundUpdater.ps1"`
    - Click "OK" to save the task

This setup will automatically update your desktop wallpaper whenever the extension generates a new wallpaper image.

## Commands

- `extension.generatWallpaperWithLastUsedWallpaperSize`: Generate wallpaper image and html with last used wallpaper size from markdown
- `extension.generatWallpaperWithSelectedWallpaperSize`: Generate wallpaper image and html with selected wallpaper size from markdown

## Keyboard Shortcuts

The extension defines the following default keyboard shortcuts:

- `Ctrl+Alt+W` (Windows/Linux) or `Cmd+Alt+W` (Mac): Generate wallpaper with last used wallpaper size
- `Ctrl+Shift+Alt+W` (Windows/Linux) or `Cmd+Shift+Alt+W` (Mac): Generate wallpaper with selected wallpaper size

You can customize these shortcuts in VS Code's Keyboard Shortcuts editor.

## Requirements

- Visual Studio Code v1.91.0 or higher
- Node.js and npm installed on your system
- PowerShell (for automatic updating on Windows)

## Extension Settings

This extension contributes the following settings:

- `markdown-wallpaperimage.defaultWallpaperSizeName`: Default wallpaper size name (e.g., FHD, 4K)
- `markdown-wallpaperimage.outputDirectory`: Directory where generated wallpaper images will be saved
- `markdown-wallpaperimage.outputFileName`: Base name for the output wallpaper file
- `markdown-wallpaperimage.inputDirectory`: Directory containing input files for wallpaper generation
- `markdown-wallpaperimage.readStyleCss`: Name of the CSS file to be used for styling the wallpaper
- `markdown-wallpaperimage.readBakgroundImage`: Name of the background image file to be used in the wallpaper
- `markdown-wallpaperimage.minNumColumns`: Minimum number of columns for text layout in the wallpaper
- `markdown-wallpaperimage.maxNumColumns`: Maximum number of columns for text layout in the wallpaper
- `markdown-wallpaperimage.minFontSize`: Minimum font size (in pixels) for text in the wallpaper
- `markdown-wallpaperimage.maxFontSize`: Maximum font size (in pixels) for text in the wallpaper

## Known Issues

No known issues at this time. If you encounter any problems, please [open an issue](https://github.com/kyaoNK/markdown-wallpaperimage/issues) on our GitHub repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Release Notes

### 2.1.0

- Updated to version 2.1.0
- Added new configuration options for customizing wallpaper generation
- Improved documentation and usage instructions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped with this project
- Inspired by the need for customizable, content-rich wallpapers and improved productivity