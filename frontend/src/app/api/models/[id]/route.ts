import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import type { ModelSummary } from "@/types/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const model = await backendFetchJson<ModelSummary>(`/models/${id}`, { token });
    return NextResponse.json(model);
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to fetch model" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    await backendFetchJson(`/models/${id}`, {
      method: "DELETE",
      token,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to delete model" }, { status: 500 });
  }
}