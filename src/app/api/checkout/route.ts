import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Get access token from cookies
  const cookieHeader = req.headers.get('cookie') || '';
  const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
  const userAccessToken = accessTokenMatch ? accessTokenMatch[1] : null;
  if (!userAccessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { user_id, pack_id } = await req.json();

  const flowUrl = `${process.env.NEXT_PUBLIC_API_URL}/flows/trigger/d9305660-b10c-41b6-8276-c03f25fb4f50`; // Replace with your actual flow ID

  const res = await fetch(flowUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userAccessToken}`,
    },
    body: JSON.stringify({ user_id, pack_id }),
  });

  const json = await res.json();

  if (json?.url) {
    return NextResponse.json({ url: json.url });
  }

  return NextResponse.json({ error: 'Checkout failed' }, { status: 400 });
}
