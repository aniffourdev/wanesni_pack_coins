"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { UserService } from "@/lib/user";

interface Purchase {
  id: number;
  status: string | null;
  date_created: string | null;
  pack_id: {
    pricing: number;
    coins: number;
  };
}

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fetchPurchaseHistory = async () => {
      const token = Cookies.get('access_token');
      if (!token) return;
      try {
        // Step 1: Get current user ID
        const user = await UserService.getCurrentUser();
        const userId = user.id;
        // Step 2: Fetch purchase history for that user
        const historyRes = await axios.get(
          `https://wanesni.com/items/purchase_history?fields=id,status,date_created,pack_id.pricing,pack_id.coins&filter[user_created][_eq]=${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setPurchases(historyRes.data.data);
      } catch (err) {
        console.error('Error fetching purchase history:', err);
      }
    };
    fetchPurchaseHistory();
  }, []);
  if (!mounted) return null;

  return (
    <div className="max-w-xl mx-auto mt-6">
      <h2 className="text-center text-xl font-bold text-yellow-600 mb-4">TRANSACTION HISTORY</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="flex justify-between items-center border-b px-4 py-3 text-sm">
            <span className="text-gray-600 w-1/4">{purchase.date_created?.split('T')[0] ?? '-'}</span>
            <div className="flex justify-start items-center gap-1 text-black font-bold w-1/4">
              <img src="https://wanesni.com/assets/1937baf1-d99a-4486-ac1d-de3b3bb8ed98" className='w-4' /> <span>{Number(purchase.pack_id.coins).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <span className="font-bold w-1/4">
              {purchase.pack_id.pricing.toFixed(2)} USD
            </span>
            <span className={`w-1/4 text-right font-semibold ${purchase.status === 'Complete' ? 'text-green-500' : 'text-yellow-500'}`}>
              {purchase.status === 'Complete' ? 'Payment complete' : 'Under review'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
