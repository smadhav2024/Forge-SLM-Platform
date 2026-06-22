import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";
import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import type { ModelSummary } from "@/types/api";

export async function GET() {
  return proxyAuthenticatedGet<ModelSummary[]>("/models/");
}

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { display_name, dataset_id, base_model_key } = await req.json();

  try {
    const model = await backendFetchJson<ModelSummary>(
      `/models/?display_name=${encodeURIComponent(display_name)}&dataset_id=${dataset_id}&base_model_key=${base_model_key ?? "tinyllama"}`,
      { method: "POST", token }
    );
    return NextResponse.json(model, { status: 201 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to register model" }, { status: 500 });
  }
}