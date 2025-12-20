import { NextRequest, NextResponse } from "next/server";

// RPC endpoint constructed from env vars (API key stays server-side)
const RPC_URL = process.env.SOLANA_RPC_URL;
const RPC_API_KEY = process.env.SOLANA_RPC_API_KEY;

function getRpcEndpoint(): string | null {
  if (RPC_URL && RPC_API_KEY) {
    // Append API key as query param
    const url = new URL(RPC_URL);
    url.searchParams.set("api-key", RPC_API_KEY);
    return url.toString();
  }
  if (RPC_URL) {
    return RPC_URL;
  }
  return null;
}

/**
 * POST /api/rpc
 * Proxy JSON-RPC requests to the Solana RPC endpoint
 * This keeps the API key server-side
 */
export async function POST(request: NextRequest) {
  const endpoint = getRpcEndpoint();

  if (!endpoint) {
    return NextResponse.json(
      { error: "RPC not configured. Set SOLANA_RPC_URL and SOLANA_RPC_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("RPC proxy error:", error);
    return NextResponse.json(
      { error: "RPC request failed" },
      { status: 502 }
    );
  }
}
