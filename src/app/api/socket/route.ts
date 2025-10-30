import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // This endpoint should not be called directly
  // Socket.IO connections are handled by the server.js
  return NextResponse.json({ 
    error: 'Socket.IO connections should be handled by the main server',
    message: 'Make sure you are running the app with npm run dev'
  }, { status: 400 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Socket.IO connections should be handled by the main server',
    message: 'Make sure you are running the app with npm run dev'
  }, { status: 400 });
}