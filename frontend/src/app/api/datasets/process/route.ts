import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export const maxDuration = 120; // long-running pipeline

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const filename = formData.get("filename");
  const dedupThreshold = formData.get("dedup_threshold") ?? "0.85";
  const chunkSize = formData.get("chunk_size") ?? "500";
  const chunkOverlap = formData.get("chunk_overlap") ?? "50";

  if (!(file instanceof File) || typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json(
      { message: "File and filename are required." },
      { status: 400 }
    );
  }

  const fresh = new FormData();
  fresh.append("file", file, file.name);
  fresh.append("filename", filename.trim());
  fresh.append("dedup_threshold", String(dedupThreshold));
  fresh.append("chunk_size", String(chunkSize));
  fresh.append("chunk_overlap", String(chunkOverlap));

  try {
    const res = await backendFetch("/datasets/process", {
      method: "POST",
      token,
      body: fresh,
    });

    const data = await res.json();

    if (!res.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === "string" ? detail : detail?.message ?? "Processing failed";
      return NextResponse.json({ message }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Pipeline failed" }, { status: 500 });
  }
}
