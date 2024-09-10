export type WallpaperSize = {
    width: number,
    height: number,
    aspectRatio: string,
    category: string,
};

export type WallpaperSizeDict = {
    [name: string]: WallpaperSize
};

/* --- hard code --- */
export const wallpaperSizes: WallpaperSizeDict = {
    // Standard Resolutions
    "SVGA": { width: 800, height: 600, aspectRatio: "4:3", category: "Standard" },
    "XGA": { width: 1024, height: 768, aspectRatio: "4:3", category: "Standard" },
    "WXGA": { width: 1280, height: 720, aspectRatio: "16:9", category: "Standard" },
    "SXGA": { width: 1280, height: 1024, aspectRatio: "5:4", category: "Standard" },
    "HD": { width: 1366, height: 768, aspectRatio: "16:9", category: "Standard" },
    "HD+": { width: 1600, height: 900, aspectRatio: "16:9", category: "Standard" },
    "UXGA": { width: 1600, height: 1200, aspectRatio: "4:3", category: "Standard" },
    "FHD": { width: 1920, height: 1080, aspectRatio: "16:9", category: "Standard" },
    "WUXGA": { width: 1920, height: 1200, aspectRatio: "16:10", category: "Standard" },

    // High Resolutions
    "QHD": { width: 2560, height: 1440, aspectRatio: "16:9", category: "High Resolution" },
    "WQHD": { width: 3440, height: 1440, aspectRatio: "21:9", category: "High Resolution" },
    "4K UHD": { width: 3840, height: 2160, aspectRatio: "16:9", category: "High Resolution" },
    "5K": { width: 5120, height: 2880, aspectRatio: "16:9", category: "High Resolution" },
    "8K UHD": { width: 7680, height: 4320, aspectRatio: "16:9", category: "High Resolution" },

    // Apple Retina Displays
    "MacBook Air 13": { width: 2560, height: 1600, aspectRatio: "16:10", category: "Apple Retina" },
    "MacBook Pro 13": { width: 2560, height: 1600, aspectRatio: "16:10", category: "Apple Retina" },
    "MacBook Pro 14": { width: 3024, height: 1964, aspectRatio: "16:10", category: "Apple Retina" },
    "MacBook Pro 16": { width: 3456, height: 2234, aspectRatio: "16:10", category: "Apple Retina" },
    "iMac 21.5": { width: 4096, height: 2304, aspectRatio: "16:9", category: "Apple Retina" },
    "iMac 27": { width: 5120, height: 2880, aspectRatio: "16:9", category: "Apple Retina" },

    // Ultrawide Resolutions
    "UW-UXGA": { width: 2560, height: 1080, aspectRatio: "21:9", category: "Ultrawide" },
    "UW-QHD": { width: 3440, height: 1440, aspectRatio: "21:9", category: "Ultrawide" },
    "UW-5K2K": { width: 5120, height: 2160, aspectRatio: "21:9", category: "Ultrawide" },
    // Less Common but Still Used
    "WXGA+": { width: 1440, height: 900, aspectRatio: "16:10", category: "Other" },
    "WSXGA+": { width: 1680, height: 1050, aspectRatio: "16:10", category: "Other" },
    "WQXGA": { width: 2560, height: 1600, aspectRatio: "16:10", category: "Other" },
};
/* --- hard code --- */
