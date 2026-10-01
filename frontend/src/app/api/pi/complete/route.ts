import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, txid } = body;

    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "Missing required paymentId or txid parameter." },
        { status: 400 }
      );
    }

    const piServerApiKey = process.env.PI_SERVER_API_KEY;

    // Sandbox / Mock fallback if PI_SERVER_API_KEY is not yet set
    if (!piServerApiKey) {
      console.info(`[Pi API Complete Mock] Payment ${paymentId} completed with txid ${txid}.`);
      return NextResponse.json({
        success: true,
        paymentId,
        txid,
        status: "completed",
        note: "PI_SERVER_API_KEY not configured. Auto-completed in sandbox environment.",
      });
    }

    // Call official Pi Platform Backend API to complete payment
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Key ${piServerApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Pi Core Team API completion error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, payment: data });
  } catch (error: any) {
    console.error("Payment completion error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
