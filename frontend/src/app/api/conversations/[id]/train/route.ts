import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { dataset_path, base_model_key } = await req.json();

  try {
    const result = await backendFetchJson(
      `/models/${id}/train?dataset_path=${encodeURIComponent(dataset_path)}&base_model_key=${base_model_key ?? "tinyllama"}`,
      { method: "POST", token }
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to start training" }, { status: 500 });
  }
}