/**
 * ══════════════════════════════════════════════════════════════════════════════
 * FIGMA API CLIENT
 * Утилита для работы с Figma API
 * ══════════════════════════════════════════════════════════════════════════════
 */

const FIGMA_API_BASE = "https://api.figma.com/v1";

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("FIGMA_ACCESS_TOKEN is not set");
  }
  return token;
}

async function figmaFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    headers: {
      "X-Figma-Token": getToken(),
    },
  });

  if (!res.ok) {
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type FigmaFile = {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
};

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  strokeWeight?: number;
  cornerRadius?: number;
  characters?: string;
  style?: FigmaTextStyle;
};

export type FigmaFill = {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
};

export type FigmaTextStyle = {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx: number;
  letterSpacing: number;
};

export type FigmaImageResponse = {
  err: string | null;
  images: Record<string, string>;
};

// ═══════════════════════════════════════════════════════════════════════════
// API МЕТОДЫ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Получить информацию о файле
 */
export async function getFile(fileKey: string): Promise<FigmaFile> {
  return figmaFetch<FigmaFile>(`/files/${fileKey}`);
}

/**
 * Получить конкретный узел из файла
 */
export async function getNode(fileKey: string, nodeId: string): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
  return figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`);
}

/**
 * Экспортировать узлы как изображения
 */
export async function exportImages(
  fileKey: string,
  nodeIds: string[],
  options: {
    format?: "jpg" | "png" | "svg" | "pdf";
    scale?: number;
  } = {}
): Promise<FigmaImageResponse> {
  const { format = "png", scale = 2 } = options;
  const ids = nodeIds.join(",");
  return figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`);
}

/**
 * Получить стили файла
 */
export async function getStyles(fileKey: string): Promise<{ styles: Record<string, unknown> }> {
  return figmaFetch(`/files/${fileKey}/styles`);
}

/**
 * Получить компоненты файла
 */
export async function getComponents(fileKey: string): Promise<{ components: Record<string, unknown> }> {
  return figmaFetch(`/files/${fileKey}/components`);
}

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ ДЛЯ КОНВЕРТАЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Конвертировать цвет Figma в CSS
 */
export function figmaColorToCSS(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? 1;

  if (a === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Конвертировать цвет Figma в HEX
 */
export function figmaColorToHex(color: { r: number; g: number; b: number }): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, "0");
  const g = Math.round(color.g * 255).toString(16).padStart(2, "0");
  const b = Math.round(color.b * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/**
 * Извлечь file key из URL Figma
 */
export function extractFileKey(figmaUrl: string): string | null {
  // https://www.figma.com/file/ABC123/FileName
  // https://www.figma.com/design/ABC123/FileName
  const match = figmaUrl.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
}

/**
 * Извлечь node ID из URL Figma
 */
export function extractNodeId(figmaUrl: string): string | null {
  // ?node-id=123-456 или ?node-id=123:456
  const match = figmaUrl.match(/node-id=([0-9]+[-:][0-9]+)/);
  return match ? match[1].replace("-", ":") : null;
}

