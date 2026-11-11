
import { NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview Temporary migration proxy to bypass CORS for n8n webhook.
 * This route fetches legacy transaction data from a production n8n instance.
 */

const N8N_SOURCE_URL = 'https://quenik16.app.n8n.cloud/webhook/get-finance-records';

export async function GET(request: NextRequest) {
  try {
    // 1. Basic Authorization Check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid token' },
        { status: 401 }
      );
    }

    // 2. Fetch data from n8n with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(N8N_SOURCE_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`n8n Fetch Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { success: false, error: 'Failed to reach migration source' },
        { status: 502 }
      );
    }

    const data = await response.json();
    
    // Support various response structures (data, records, or direct array)
    const records = Array.isArray(data) ? data : data.records || data.Records || data.data || [];

    return NextResponse.json({
      success: true,
      records
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'Request timed out' },
        { status: 504 }
      );
    }
    console.error('Migration Proxy Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
