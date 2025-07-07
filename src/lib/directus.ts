import { Pack } from "@/types/pack";

export async function fetchPacks(): Promise<Pack[]> {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/items/pack_coins`, {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
      },
      cache: 'no-cache',
    });
  
    const json = await res.json();
    return json.data;
}

export async function getPacks(): Promise<Pack[]> {
    return fetchPacks();
}
  