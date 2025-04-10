import { NextResponse } from 'next/server';
// import { kv } from '@vercel/kv';

export async function POST(request: Request) {
  try {
    const { userId, options } = await request.json();

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    if (!options) {
      return NextResponse.json({ message: 'Options are required' }, { status: 400 });
    }

    console.log('Saving options for user:', userId, options);
    // Store the options in Vercel KV with a 30-minute expiration
    // await kv.set(userId, JSON.stringify(options), { ex: 1800 }); // 1800 seconds = 30 minutes

    return NextResponse.json({ message: 'Options saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving options:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
