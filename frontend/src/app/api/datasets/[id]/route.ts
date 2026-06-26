import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api/session";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

async function getToken() {
  const token = await getSessionToken();
  if (!token) throw new Error("unauthenticated");
  return token;
}

// GET /api/datasets/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = await getToken();
    const res = await fetch(`${BACKEND}/api/datasets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
}

// DELETE /api/datasets/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = await getToken();
    const res = await fetch(`${BACKEND}/api/datasets/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
}
