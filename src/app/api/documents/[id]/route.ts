import { NextRequest, NextResponse } from 'next/server';
import { unlink, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import db from '@/lib/database';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const documentId = parseInt(id);
    
    // Check if request is FormData (file upload) or JSON (metadata only)
    const contentType = request.headers.get('content-type');
    let newFile: File | null = null;
    let newCaseId: string;
    let newName: string;
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      newFile = formData.get('file') as File | null;
      newCaseId = formData.get('caseId') as string;
      newName = formData.get('documentName') as string;
    } else {
      // Handle JSON request
      const body = await request.json();
      newCaseId = body.caseId?.toString();
      newName = body.documentName;
    }

    if (!newCaseId || !newName) {
      return NextResponse.json({ error: 'Case ID and document name are required' }, { status: 400 });
    }

    // Check if document exists and user has permission
    const documentQuery = db.prepare(`
      SELECT d.*, c.client_id, c.lawyer_id 
      FROM documents d 
      JOIN cases c ON d.case_id = c.id 
      WHERE d.id = ?
    `);
    const document = documentQuery.get(documentId);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions
    const canEdit = decoded.role === 'admin' || 
                   document.uploaded_by === decoded.userId ||
                   (decoded.role === 'lawyer' && document.lawyer_id === decoded.userId);

    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Verify the new case exists and user has access
    const caseQuery = db.prepare(`
      SELECT * FROM cases WHERE id = ? AND (
        ? = 'admin' OR 
        client_id = ? OR 
        lawyer_id = ?
      )
    `);
    const caseExists = caseQuery.get(parseInt(newCaseId), decoded.role, decoded.userId, decoded.userId);

    if (!caseExists) {
      return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
    }

    let filePath = document.file_path;
    let fileSize = document.file_size;

    // Handle file replacement if new file is provided
    if (newFile) {
      // Delete old file
      const oldFilePath = join(process.cwd(), document.file_path);
      try {
        if (existsSync(oldFilePath)) {
          await unlink(oldFilePath);
        }
      } catch (error) {
        console.error('Error deleting old file:', error);
      }

      // Save new file
      const bytes = await newFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Generate new filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = newFile.name.split('.').pop();
      const filename = `${timestamp}-${randomString}.${extension}`;
      
      const uploadDir = join(process.cwd(), 'uploads', 'documents');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }
      
      const newFilePath = join(uploadDir, filename);
      await writeFile(newFilePath, buffer);
      filePath = `uploads/documents/${filename}`;
      fileSize = buffer.length;
    }

    // Update document in database
    const updateQuery = db.prepare(`
      UPDATE documents 
      SET original_name = ?, case_id = ?, file_path = ?, file_size = ?
      WHERE id = ?
    `);
    updateQuery.run(newName, parseInt(newCaseId), filePath, fileSize, documentId);

    return NextResponse.json({ 
      message: 'Document updated successfully',
      document: {
        id: documentId,
        original_name: newName,
        case_id: parseInt(newCaseId),
        file_path: filePath,
        file_size: fileSize
      }
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Fix: Await params before accessing properties
    const { id } = await params;
    const documentId = parseInt(id);

    // Check if document exists and user has permission
    const documentQuery = db.prepare(`
      SELECT d.*, c.client_id, c.lawyer_id 
      FROM documents d 
      JOIN cases c ON d.case_id = c.id 
      WHERE d.id = ?
    `);
    const document = documentQuery.get(documentId);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions
    const canDelete = decoded.role === 'admin' || 
                     document.uploaded_by === decoded.userId ||
                     (decoded.role === 'lawyer' && document.lawyer_id === decoded.userId);

    if (!canDelete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete file from filesystem
    // Fix: Use file_path instead of filename
    const filePath = join(process.cwd(), document.file_path);
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete document from database
    const deleteQuery = db.prepare('DELETE FROM documents WHERE id = ?');
    deleteQuery.run(documentId);

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}