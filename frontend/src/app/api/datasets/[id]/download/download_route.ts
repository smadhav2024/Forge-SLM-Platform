import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const res = await backendFetch(`/datasets/${id}/download`, { token });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: data?.detail ?? "Download failed" },
        { status: res.status }
      );
    }

    // Forward the file stream with correct headers
    const contentDisposition = res.headers.get("content-disposition") ?? `attachment; filename="dataset-${id}.jsonl"`;
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Download failed" }, { status: 500 });
  }
}