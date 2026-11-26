export interface ContextMenuPosition {
  left: number;
  top: number;
  originY: 'top' | 'bottom';
  originX: 'left' | 'right';
}

export interface ClampContextMenuInput {
  clientX: number;
  clientY: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;
  bottomReserve?: number;
  isRTL?: boolean;
}

/**
 * محاسبه مختصات منوی راست‌کلیک در کنار نشانگر با جلوگیری از بیرون‌زدگی از لبه‌های پنجره دسکتاپ/وب
 */
export const clampContextMenuPosition = ({
  clientX,
  clientY,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  padding = 12,
  bottomReserve = 16,
  isRTL = false,
}: ClampContextMenuInput): ContextMenuPosition => {
  const safeMaxLeft = Math.max(padding, viewportWidth - menuWidth - padding);
  const safeMaxTop = Math.max(padding, viewportHeight - menuHeight - bottomReserve);

  let originX: 'left' | 'right' = isRTL ? 'right' : 'left';
  let rawLeft = isRTL ? clientX - menuWidth : clientX;

  if (!isRTL && clientX + menuWidth + padding > viewportWidth) {
    rawLeft = clientX - menuWidth;
    originX = 'right';
  } else if (isRTL && clientX - menuWidth < padding) {
    rawLeft = clientX;
    originX = 'left';
  }

  let originY: 'top' | 'bottom' = 'top';
  let rawTop = clientY;
  if (clientY + menuHeight + bottomReserve > viewportHeight && clientY - menuHeight >= padding) {
    rawTop = clientY - menuHeight;
    originY = 'bottom';
  }

  return {
    left: Math.round(Math.max(padding, Math.min(safeMaxLeft, rawLeft))),
    top: Math.round(Math.max(padding, Math.min(safeMaxTop, rawTop))),
    originY,
    originX,
  };
};

export interface AnchorMenuInput {
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  isRTL?: boolean;
  gap?: number;
  padding?: number;
  bottomReserve?: number;
  topReserve?: number;
}

/**
 * محاسبه مختصات منوی سه‌نقطه متصل به دکمه با تطبیق خودکار RTL/LTR و بالا/پایین پنجره
 */
export const computeAnchorMenuPosition = ({
  rect,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  isRTL = false,
  gap = 6,
  padding = 12,
  bottomReserve = 108,
  topReserve = 64,
}: AnchorMenuInput): ContextMenuPosition => {
  const safeMaxLeft = Math.max(padding, viewportWidth - menuWidth - padding);
  const rawLeft = isRTL ? rect.left : rect.right - menuWidth;
  const left = Math.round(Math.max(padding, Math.min(safeMaxLeft, rawLeft)));
  const originX: 'left' | 'right' = isRTL ? 'left' : 'right';

  const spaceBelow = viewportHeight - rect.bottom - bottomReserve;
  const spaceAbove = rect.top - topReserve;
  const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

  if (openUp) {
    const top = Math.round(Math.max(padding, rect.top - menuHeight - gap));
    return { left, top, originY: 'bottom', originX };
  }

  const maxTop = Math.max(padding, viewportHeight - menuHeight - padding);
  const top = Math.round(Math.min(rect.bottom + gap, maxTop));
  return { left, top, originY: 'top', originX };
};
