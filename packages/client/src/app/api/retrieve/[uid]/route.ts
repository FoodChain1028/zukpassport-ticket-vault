import { NextResponse } from 'next/server';
import { getVerificationData } from '../../../../utils/db'; // Adjust path as necessary

type Params = {
  uid: string;
};

export async function GET(request: Request, context: { params: Params }) {
  try {
    const uid = context.params.uid;

    if (!uid) {
      return NextResponse.json({ message: 'UID parameter is required' }, { status: 400 });
    }

    console.log(`Retrieving data for UID: ${uid}`);
    const data = await getVerificationData(uid);

    if (data) {
      return NextResponse.json({ status: 'success', data: data });
    } else {
      console.log(`No data found for UID: ${uid}`);
      return NextResponse.json({ message: 'Data not found or expired' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error retrieving verification data:', error);
    return NextResponse.json(
      {
        message: 'Error retrieving verification data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
