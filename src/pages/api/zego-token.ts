import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// TODO: Replace these with your actual ZegoCloud AppID and Server Secret from https://console.zegocloud.com/
const APP_ID = 1043089575; // <-- Replace with your real AppID
const SERVER_SECRET = 'de73ca1d2ccf7ac08c56ddb810ae8c3b'; // <-- Replace with your real Server Secret

console.log('ZegoCloud APP_ID:', APP_ID);
console.log('ZegoCloud SERVER_SECRET length:', SERVER_SECRET.length);

function generateToken(appId: number, userId: string, serverSecret: string, effectiveTimeInSeconds: number, payload: object = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expire = now + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);
  const payloadStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadStr).toString('base64');
  const stringToSign = `${appId}${userId}${serverSecret}${expire}${nonce}${base64Payload}`;
  const hash = crypto.createHmac('sha256', serverSecret).update(stringToSign).digest('hex');
  return `${appId}:${userId}:${expire}:${nonce}:${hash}:${base64Payload}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for obviously missing credentials
  if (!APP_ID || !SERVER_SECRET || SERVER_SECRET.length < 10) {
    return res.status(500).json({ error: 'ZegoCloud credentials are missing or invalid. Please update APP_ID and SERVER_SECRET in src/pages/api/zego-token.ts.' });
  }

  const { roomID, userID, userName } = req.body;

  if (!roomID || !userID || !userName) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const token = generateToken(APP_ID, userID, SERVER_SECRET, 3600, { room_id: roomID, user_name: userName });
    console.log('Generated token:', token); // Debug log
    return res.status(200).json({ token });
  } catch (error) {
    console.error('Token generation error:', error); // Debug log
    return res.status(500).json({ error: 'Token generation failed', details: error instanceof Error ? error.message : error });
  }
}
