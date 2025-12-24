/**
 * ══════════════════════════════════════════════════════════════════════════════
 * FIGMA API ENDPOINT
 * Проксирует запросы к Figma API
 * 
 * SECURITY: Требует авторизации админа для предотвращения:
 * - Злоупотребления API ключом Figma
 * - Утечки конфиденциальных макетов
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { getFile, getNode, exportImages, extractFileKey, extractNodeId } from "@/lib/figma";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // ═══ ADMIN AUTHENTICATION ═══
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const action = searchParams.get("action") || "file";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const fileKey = extractFileKey(url);
  if (!fileKey) {
    return NextResponse.json({ error: "Invalid Figma URL" }, { status: 400 });
  }

  try {
    switch (action) {
      case "file": {
        const file = await getFile(fileKey);
        return NextResponse.json({
          ok: true,
          name: file.name,
          lastModified: file.lastModified,
          thumbnailUrl: file.thumbnailUrl,
          pages: file.document.children?.map((page) => ({
            id: page.id,
            name: page.name,
            framesCount: page.children?.length || 0,
          })),
        });
      }

      case "node": {
        const nodeId = extractNodeId(url);
        if (!nodeId) {
          return NextResponse.json({ error: "No node-id in URL" }, { status: 400 });
        }
        const result = await getNode(fileKey, nodeId);
        return NextResponse.json({ ok: true, node: result.nodes[nodeId]?.document });
      }

      case "export": {
        const nodeId = extractNodeId(url);
        if (!nodeId) {
          return NextResponse.json({ error: "No node-id in URL" }, { status: 400 });
        }
        const format = (searchParams.get("format") as "png" | "svg") || "png";
        const scale = parseInt(searchParams.get("scale") || "2", 10);
        const images = await exportImages(fileKey, [nodeId], { format, scale });
        return NextResponse.json({ ok: true, images: images.images });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Figma API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

