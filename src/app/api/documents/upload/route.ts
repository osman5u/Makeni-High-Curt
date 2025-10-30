import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;

    if (!file || !caseId) {
      return NextResponse.json({ error: 'File and case ID are required' }, { status: 400 });
    }

    // Verify the case belongs to the user (client uploads)
    const caseData = await prisma.case.findFirst({
      where: { id: parseInt(caseId, 10), client_id: decoded.userId },
      select: { id: true, lawyer_id: true },
    });
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'documents');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(2)}.${extension}`;
    const filepath = join(uploadsDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Save to database (Prisma)
    const created = await prisma.document.create({
      data: {
        case_id: parseInt(caseId, 10),
        lawyer_id: caseData.lawyer_id,
        file_path: `uploads/documents/${filename}`, // store relative path (forward slashes for consistency)
        original_name: originalName,
        uploaded_by: decoded.userId,
        filename,
        file_size: Number(file.size),
      },
    });

    return NextResponse.json({
      message: 'Document uploaded successfully',
      documentId: created.id,
      filename: originalName
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}