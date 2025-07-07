"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { Pack } from "@/types/pack";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface StripePaymentFormProps {
  pack: Pack;
  user_id: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StripePaymentForm({ pack, user_id, onClose, onSuccess }: StripePaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const initializeStripe = async () => {
      if (!stripePromise) {
        setError('Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.');
        return;
      }

      try {
        const stripeInstance = await stripePromise;
        if (stripeInstance) {
          setStripe(stripeInstance);
          const elementsInstance = stripeInstance.elements();
          setElements(elementsInstance);
          
          const card = elementsInstance.create('card', {
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          });
          
          card.mount('#card-element');
          setCardElement(card);
        } else {
          setError('Failed to load Stripe. Please check your configuration.');
        }
      } catch (err) {
        console.error('Stripe initialization error:', err);
        setError('Failed to initialize Stripe. Please check your configuration.');
      }
    };

    initializeStripe();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!stripe || !elements || !cardElement) {
      setError('Stripe not loaded');
      setLoading(false);
      return;
    }

    try {
      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (paymentMethodError) {
        setError(paymentMethodError.message || 'Payment method creation failed');
        setLoading(false);
        return;
      }

      // Process payment
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id,
          pack_id: pack.id,
          paymentMethodId: paymentMethod.id,
          pack,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        // No reload, just show success and close after 5s
      } else {
        setError(result.error || 'Payment failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Payment error:', err);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Complete Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <h3 className="font-medium">{pack.subject}</h3>
          <p className="text-teal-600 text-lg font-semibold">{pack.coins} coins - ${pack.pricing.toFixed(2)}</p>
        </div>

        {success ? (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded text-center">
            <div className="text-2xl mb-2">✅</div>
            <div className="font-semibold text-lg">Payment successful!</div>
            <div className="text-sm mt-2">Your purchase has been completed.<br />This window will close automatically.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Information
              </label>
              <div
                id="card-element"
                className="border border-gray-300 rounded-md p-3 min-h-[40px]"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50"
                disabled={loading || !stripe}
              >
                {loading ? 'Processing...' : `Pay $${pack.pricing.toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
