import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";
import type { ConversationMessage } from "@/types/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyAuthenticatedGet<ConversationMessage[]>(
    `/conversations/${id}/messages`
  );
}