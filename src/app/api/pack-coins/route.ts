import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Get access token from cookies
  const cookieHeader = req.headers.get('cookie') || '';
  const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
  const userAccessToken = accessTokenMatch ? accessTokenMatch[1] : null;
  console.log('API /api/pack-coins called. Access token:', userAccessToken ? '[present]' : '[missing]');
  if (!userAccessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/items/pack_coins`, {
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
    },
    cache: 'no-cache',
  });

  const json = await res.json();
  return NextResponse.json(json.data);
}
