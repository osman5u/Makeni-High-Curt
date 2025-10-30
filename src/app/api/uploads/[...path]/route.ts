import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.bmp': return 'image/bmp';
    case '.svg': return 'image/svg+xml';
    case '.pdf': return 'application/pdf';
    // Audio types
    case '.mp3': return 'audio/mpeg';
    case '.m4a': return 'audio/mp4';
    case '.aac': return 'audio/aac';
    case '.wav': return 'audio/wav';
    case '.ogg':
    case '.oga': return 'audio/ogg';
    case '.opus': return 'audio/opus';
    case '.weba': return 'audio/webm';
    case '.webm': return 'audio/webm';
    // Office/text
    case '.txt': return 'text/plain; charset=utf-8';
    case '.doc': return 'application/msword';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls': return 'application/vnd.ms-excel';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.ppt': return 'application/vnd.ms-powerpoint';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default: return 'application/octet-stream';
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: parts } = await params;

    if (!Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Our uploads live under "<project-root>/uploads"
    const uploadsRoot = path.join(process.cwd(), 'uploads');

    // Reconstruct the requested relative path (e.g. "chat/filename.png")
    const relPath = parts.join(path.sep);

    // Resolve and ensure the final absolute path stays within uploads/
    const absPath = path.resolve(uploadsRoot, relPath);
    if (!absPath.startsWith(path.resolve(uploadsRoot))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!existsSync(absPath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const buffer = await readFile(absPath);
    const contentType = getContentType(absPath);
    const inline = contentType.startsWith('image/') || contentType === 'application/pdf';
    const filename = path.basename(absPath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('File serve error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}