import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== 'dentago-os-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('os-auth', 'dentago-os-2026', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
