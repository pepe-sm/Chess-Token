import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId parameter." }, { status: 400 });
    }

    const piServerApiKey = process.env.PI_SERVER_API_KEY;

    // Sandbox / Mock fallback if PI_SERVER_API_KEY is not yet set
    if (!piServerApiKey) {
      console.info(`[Pi API Approve Mock] Payment ${paymentId} approved in sandbox mode.`);
      return NextResponse.json({
        success: true,
        paymentId,
        status: "approved",
        note: "PI_SERVER_API_KEY not configured. Auto-approved in sandbox environment.",
      });
    }

    // Call official Pi Platform Backend API
    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Key ${piServerApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Pi Core Team API approval error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, payment: data });
  } catch (error: any) {
    console.error("Payment approval error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
