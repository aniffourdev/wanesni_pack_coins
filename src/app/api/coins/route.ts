import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Get access token from cookies
    const cookieHeader = req.headers.get('cookie') || '';
    const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
    const userAccessToken = accessTokenMatch ? accessTokenMatch[1] : null;
    if (!userAccessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();

    // Forward the request to your Directus extension endpoint
    const directusRes = await fetch(`https://wanesni.com/coins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await directusRes.json();
    return NextResponse.json(data, { status: directusRes.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 