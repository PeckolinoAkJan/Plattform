import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Token-Übernahme aus Browser-URLs wird nicht unterstützt.' },
    { status: 410 },
  );
}
