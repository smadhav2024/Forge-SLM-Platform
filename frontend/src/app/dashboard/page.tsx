import { PlaygroundShell } from "@/components/dashboard/playground-shell";
import { ChatWorkspace } from "@/components/playground/chat-workspace";

export default function PlaygroundPage() {
  return (
    <PlaygroundShell>
      <ChatWorkspace />
    </PlaygroundShell>
  );
}