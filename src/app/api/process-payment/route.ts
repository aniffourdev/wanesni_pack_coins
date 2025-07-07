import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Check if Stripe secret key is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-06-30.basil',
    })
  : null;

export async function POST(req: Request) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      console.error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
      return NextResponse.json({ 
        error: 'Payment service not configured. Please contact support.' 
      }, { status: 500 });
    }

    // --- Get access token from cookies ---
    const cookieHeader = req.headers.get('cookie') || '';
    const accessTokenMatch = cookieHeader.match(/access_token=([^;]+)/);
    const userAccessToken = accessTokenMatch ? accessTokenMatch[1] : null;
    if (!userAccessToken) {
      console.error('No access token found in cookies');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // --- Get user id from /users/me ---
    const userMeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
      },
    });
    if (!userMeRes.ok) {
      const errorText = await userMeRes.text();
      console.error('Failed to fetch /users/me:', errorText);
      return NextResponse.json({ error: 'Failed to get user info' }, { status: 401 });
    }
    const userMe = await userMeRes.json();
    const user_id = userMe.data?.id;
    if (!user_id) {
      console.error('No user id found in /users/me response:', userMe);
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // --- Continue with payment logic ---
    const { pack_id, paymentMethodId, pack } = await req.json();

    console.log('Processing payment:', { user_id, pack_id, paymentMethodId, pack });

    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pack.pricing * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
    });

    console.log('Payment intent created:', paymentIntent.id, 'Status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // Get payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId) as Stripe.PaymentMethod;
      
      console.log('Payment method retrieved:', {
        card_type: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year
      });

      // Save purchase to Directus
      const purchaseData = {
        user_created: user_id,
        pack_id: pack_id,
        card_type: paymentMethod.card?.brand || 'unknown',
        last4: paymentMethod.card?.last4 || '',
        exp_month: paymentMethod.card?.exp_month || 0,
        exp_year: paymentMethod.card?.exp_year || 0,
        stripe_payment_intent_id: paymentIntent.id,
        amount: pack.pricing,
        status: 'completed'
      };

      console.log('Saving to Directus:', purchaseData);

      const directusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/items/purchase_history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        },
        body: JSON.stringify(purchaseData),
      });

      if (!directusRes.ok) {
        const errorText = await directusRes.text();
        console.error('Failed to save to Directus:', errorText);
        console.error('Directus response status:', directusRes.status);
        return NextResponse.json({ 
          error: 'Payment successful but failed to save purchase record. Please contact support.' 
        }, { status: 500 });
      }

      const directusResult = await directusRes.json();
      console.log('Directus save successful:', directusResult);

      // --- Update user's coins field ---
      // 1. Fetch current user data from /items/users/{user_id}
      const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        },
      });
      if (!userRes.ok) {
        const errorText = await userRes.text();
        console.error('Failed to fetch user:', errorText);
        return NextResponse.json({ 
          error: 'Payment successful but failed to update user coins. Please contact support.' 
        }, { status: 500 });
      }
      const userData = await userRes.json();
      const currentCoins = typeof userData.data?.coins === 'number' ? userData.data.coins : 0;
      const newCoins = currentCoins + (pack.coins || 0);
      // 2. Update user coins
      const updateRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
        },
        body: JSON.stringify({ coins: newCoins }),
      });
      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('Failed to update user coins:', errorText);
        return NextResponse.json({ 
          error: 'Payment successful but failed to update user coins. Please contact support.' 
        }, { status: 500 });
      }
      const updateResult = await updateRes.json();
      console.log('User coins updated:', updateResult);
      // --- End update user's coins ---

      return NextResponse.json({ 
        success: true, 
        paymentIntentId: paymentIntent.id,
        message: 'Payment successful!' 
      });
    } else {
      console.log('Payment failed with status:', paymentIntent.status);
      return NextResponse.json({ 
        error: 'Payment failed', 
        status: paymentIntent.status 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    
    // Provide more specific error messages
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ 
        error: `Payment failed: ${error.message}` 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Payment processing failed. Please try again.' 
    }, { status: 500 });
  }
} 