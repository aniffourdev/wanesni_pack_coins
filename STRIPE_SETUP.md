# Stripe Payment Integration Setup

This application now includes a complete Stripe payment integration with credit card form and Directus purchase history tracking.

## Environment Variables Required

Create a `.env.local` file in your project root with the following variables:

```env
# Directus Configuration
NEXT_PUBLIC_API_URL=https://your-directus-instance.com
DIRECTUS_TOKEN=your-directus-token

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Base URL for your application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Stripe Setup

1. **Create a Stripe Account**: Sign up at https://stripe.com
2. **Get API Keys**: 
   - Go to Stripe Dashboard → Developers → API Keys
   - Copy your Publishable Key and Secret Key
   - Use test keys for development (start with `pk_test_` and `sk_test_`)

## Directus Collection Setup

Make sure your `purchase_history` collection has these fields:

- `user_created` (String) - User ID
- `pack_id` (Many-to-One relationship with pack_coins)
- `card_type` (String) - Credit card brand (visa, mastercard, etc.)
- `last4` (String) - Last 4 digits of card
- `exp_month` (Integer) - Expiration month
- `exp_year` (Integer) - Expiration year
- `stripe_payment_intent_id` (String) - Stripe payment intent ID
- `amount` (Float) - Payment amount
- `status` (String) - Payment status

## How It Works

1. **User clicks "Buy Now"** → Opens Stripe payment form popup
2. **User enters card details** → Stripe Elements handles secure card input
3. **User clicks "Pay"** → Creates payment method and processes payment
4. **Payment successful** → Saves purchase record to Directus with card details
5. **User sees success message** → Form closes and page refreshes

## Test Cards

Use these Stripe test cards for testing:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

Any future expiry date and any 3-digit CVC will work.

## Security Notes

- Card details are never stored in your database
- Only card metadata (type, last4, expiry) is saved
- Stripe handles all PCI compliance
- Use HTTPS in production 