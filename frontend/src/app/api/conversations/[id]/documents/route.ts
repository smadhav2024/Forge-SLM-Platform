import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import { BackendError } from "@/lib/api/backend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  // Forward the multipart/form-data directly — don't parse it, just pipe it
  const formData = await req.formData();

  try {
    const upstream = await backendFetch(
      `/conversations/${id}/documents`,
      { method: "POST", token, body: formData }
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}