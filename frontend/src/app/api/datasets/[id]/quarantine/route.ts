import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = searchParams.get("page") ?? "1";
  const page_size = searchParams.get("page_size") ?? "15";

  try {
    const res = await backendFetch(
      `/datasets/${id}/quarantine?page=${page}&page_size=${page_size}`,
      { token }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to fetch quarantine" }, { status: 500 });
  }
}
