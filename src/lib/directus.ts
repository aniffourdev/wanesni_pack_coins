import { Pack } from "@/types/pack";
import Cookies from "js-cookie"

export async function fetchPacks(): Promise<Pack[]> {
    // Dynamically import js-cookie to avoid SSR issues
    const accessToken = Cookies.get('access_token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://wanesni.com';
    const res = await fetch(`${apiUrl}/items/pack_coins`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-cache',
    });
  
    const json = await res.json();
    return json.data;
}

export async function getPacks(): Promise<Pack[]> {
    return fetchPacks();
}

export async function createVideoCall(callerId: string, receiverId: string, callType: "direct" | "random" = "direct") {
  const accessToken = Cookies.get('access_token');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://wanesni.com';
  const zego_room_id = `call-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)}`;

  const res = await fetch(`${apiUrl}/items/video_calls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      caller_id: callerId,
      receiver_id: receiverId,
      call_type: callType,
      status: "waiting",
      zego_room_id,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // If Directus returned an empty response, try to fetch the record by zego_room_id
    const getRes = await fetch(`${apiUrl}/items/video_calls?filter[zego_room_id][_eq]=${zego_room_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const getData = await getRes.json();
    if (getData && getData.data && getData.data.length > 0) {
      return getData.data[0];
    }
    throw new Error("Directus returned an empty or invalid response and fallback fetch failed");
  }
  if (!data || !data.data) {
    throw new Error(data?.errors?.[0]?.message || "Failed to create video call");
  }
  return data.data;
}
  