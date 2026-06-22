import { NextRequest, NextResponse } from "next/server";
import { BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

/**
 * Handles user-uploaded GGUF / safetensors model files.
 * The backend doesn't have a dedicated file upload route for models yet,
 * so we register the model metadata via /models/ and store the file reference.
 * When the backend gains a proper upload endpoint, swap the body here.
 */
export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload form." }, { status: 400 });
  }

  const displayName = formData.get("display_name");
  const baseModelKey = formData.get("base_model_key");
  const file = formData.get("file");

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ message: "display_name is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required." }, { status: 400 });
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

  try {
    // Register the model via the standard /models/ endpoint.
    // dataset_id is 0 (null sentinel) for user-uploaded models — adjust if the
    // backend requires a real dataset.
    const res = await fetch(
      `${API_URL}/models/?display_name=${encodeURIComponent(displayName)}&dataset_id=0&base_model_key=${encodeURIComponent(String(baseModelKey ?? "custom"))}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { message: data?.detail ?? data?.message ?? "Registration failed" },
        { status: res.status }
      );
    }

    // Attach a flag so the client can identify user-uploaded models
    return NextResponse.json({ ...data, is_uploaded: true }, { status: 201 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to upload model" }, { status: 500 });
  }
}
