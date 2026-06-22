import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";
import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import type { ConversationSummary, CreateConversationRequest } from "@/types/api";

export async function GET() {
  return proxyAuthenticatedGet<ConversationSummary[]>("/conversations/");
}

// keep existing GET export as-is, add:

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json()) as CreateConversationRequest;

  try {
    const conversation = await backendFetchJson<ConversationSummary>(
      "/conversations/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        token,
        body: JSON.stringify(body),
      }
    );
    return NextResponse.json(conversation, { status: 201 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to create conversation" }, { status: 500 });
  }
}