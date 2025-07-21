"use client";

import { useState, useEffect } from "react";
import StripePaymentForm from "./StripePaymentForm";
import type { Pack } from "@/types/pack";

export default function PackList() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const user_id = "test-user-id-123"; // Not used anymore, but kept for StripePaymentForm

  useEffect(() => {
    const fetchPacks = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pack-coins", {
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to fetch packs");
          setPacks([]);
        } else {
          const data = await res.json();
          setPacks(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        setError("Failed to fetch packs");
        setPacks([]);
      }
      setLoading(false);
    };
    fetchPacks();
  }, []);

  const handleBuy = (pack: Pack) => {
    setSelectedPack(pack);
    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    setSelectedPack(null);
    window.location.reload();
  };

  const handleClosePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedPack(null);
  };

  if (loading) {
    return <div className="text-center py-10">Loading packs...</div>;
  }
  if (error) {
    return (
      <div className="text-center py-10 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {packs.map((pack) => (
          <li
            key={pack.id}
            className="border p-4 rounded shadow flex justify-between items-center"
          >
            <div>
              <h2 className="text-xl font-semibold">{pack.subject}</h2>
              <p>
                {pack.coins} coins - ${pack.pricing.toFixed(2)}
              </p>
            </div>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => handleBuy(pack)}
            >
              Buy Now
            </button>
          </li>
        ))}
      </ul>

      {showPaymentForm && selectedPack && (
        <StripePaymentForm
          pack={selectedPack}
          user_id={user_id}
          onClose={handleClosePaymentForm}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
