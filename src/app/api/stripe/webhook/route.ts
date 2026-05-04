import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-04-22.dahlia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Requires a service role key to bypass RLS when updating profiles from a webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('Webhook Error: Missing signature or webhook secret');
      return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // userId was passed via client_reference_id or metadata
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer as string;

        if (userId) {
          console.log(`User ${userId} successfully subscribed. Stripe Customer: ${customerId}`);
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({ 
              is_vip: true,
              stripe_customer_id: customerId
            })
            .eq('id', userId);
            
          if (error) console.error("Error updating profile to VIP:", error);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        console.log(`Subscription deleted for customer: ${customerId}`);
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ is_vip: false })
          .eq('stripe_customer_id', customerId);
          
        if (error) console.error("Error removing VIP status:", error);
        break;
      }
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing failed:", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
