import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  try {
    const res = await backendFetch(`/datasets/${id}/restore`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Restore failed" }, { status: 500 });
  }
}
