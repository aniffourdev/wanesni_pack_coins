"use client";
import React, { useEffect, useState } from 'react';
import { getPacks } from '../lib/directus';
import { Pack } from '../types/pack';
import StripePaymentForm from './StripePaymentForm';
import { UserService } from "@/lib/user";

const Purchase: React.FC = () => {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getPacks()
      .then((data) => setPacks(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load packs'))
      .finally(() => setLoading(false));
    // Fetch user id
    const fetchUser = async () => {
      try {
        const user = await UserService.getCurrentUser();
        setUserId(user.id);
      } catch (err) {
        setUserId(null);
      }
    };
    fetchUser();
  }, []);

  const handleSelectPack = (pack: Pack) => {
    setSelectedPack(pack);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPack(null);
  };

  const handleSuccess = () => {
    // Optionally refresh packs or user coins here
    setShowModal(false);
    setSelectedPack(null);
  };

  if (loading) return <div>Loading packs...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Purchase Coins</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {(Array.isArray(packs) ? packs : []).map((pack) => (
          <div key={pack.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, minWidth: 250 }}>
            <h2>{pack.subject}</h2>
            <p><strong>ID:</strong> {pack.id}</p>
            <p><strong>Pack ID:</strong> {pack.pack_id}</p>
            <p><strong>Coins:</strong> {pack.coins}</p>
            <p><strong>Price:</strong> ${pack.pricing}</p>
            <p><strong>Status:</strong> {pack.status}</p>
            {/* <p><strong>Created At:</strong> {new Date(pack.created_at).toLocaleString()}</p>
            <p><strong>Updated At:</strong> {new Date(pack.updated_at).toLocaleString()}</p> */}
            <button onClick={() => handleSelectPack(pack)}>Select Pack</button>
          </div>
        ))}
      </div>
      {showModal && selectedPack && userId && (
        <StripePaymentForm
          pack={selectedPack}
          user_id={userId}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default Purchase; 