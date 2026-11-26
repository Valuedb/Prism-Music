export interface FolderBreadcrumb {
  displayName: string;
  parentLabel?: string;
}

const IGNORED_FOLDER_NAMES = new Set([
  '$recycle.bin',
  'system volume information',
  '__macosx',
  '.git',
  '.svn',
  '.hg',
  '.ds_store',
  'node_modules',
  '.thumbs',
  '.trash',
  '.trashes',
]);

/**
 * تشخیص پوشه‌های سیستمی یا مخفی غیرمرتبط با کتابخانه موسیقی
 */
export const isIgnoredFolderName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (IGNORED_FOLDER_NAMES.has(lower)) return true;
  if (lower.startsWith('.trash')) return true;
  return false;
};

/**
 * تبدیل مسیر نسبی پوشه (مثل Music/Rock/Live) به عنوان تمیز پوشه و زیرعنوان مسیر والد
 */
export const formatFolderBreadcrumb = (folderName: string): FolderBreadcrumb => {
  const parts = folderName
    .split(/[\\/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { displayName: parts[0] || folderName.trim() };
  }
  const displayName = parts[parts.length - 1];
  const parentLabel = parts.slice(0, -1).join(' / ');
  return { displayName, parentLabel };
};

/**
 * استخراج نام پوشه ریشه از فایل‌های انتخاب‌شده در حالت پشتیبان مرورگر (webkitRelativePath)
 */
export const inferFolderLocationNameFromFiles = (files: readonly File[]): string => {
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes('/')) {
      const root = rel.split('/').filter(Boolean)[0];
      if (root) return root;
    }
  }
  return 'Music Folder';
};

/**
 * ساخت شناسه پایدار و نرمال‌شده برای پوشه متصل مرورگر
 */
export const buildBrowserFolderLocationId = (folderName: string): string => {
  const clean = folderName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff_-]/g, '');
  return `browser-folder://${clean || 'music'}`;
};
