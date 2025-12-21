import { NextRequest, NextResponse } from "next/server";

// Increase max duration for long-running RPC requests (confirmTransaction polling)
export const maxDuration = 60; // 60 seconds

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

    // Use AbortController for timeout (55 seconds to stay under maxDuration)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      return NextResponse.json(data, {
        status: response.status,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("RPC proxy error:", error);

    // Check if it's a timeout/abort error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: "RPC request timed out" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "RPC request failed" },
      { status: 502 }
    );
  }
}
