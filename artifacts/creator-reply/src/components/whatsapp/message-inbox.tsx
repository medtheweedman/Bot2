import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListWhatsAppInboxQueryKey,
  getGetWhatsAppStatusQueryKey,
  useDismissWhatsAppInboxMessage,
  useGenerateWhatsAppInboxDraft,
  useListWhatsAppInbox,
  useSaveWhatsAppInboxDraft,
  useSendWhatsAppInboxReply,
} from "@workspace/api-client-react";
import type { WhatsAppInboxMessage } from "@workspace/api-client-react";
import {
  AlertCircle,
  Check,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
  }
  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Couldn’t reach WhatsApp. Check the connection and try again.";
    }
    return error.message.replace(/^HTTP \d{3}\s*[^:]*:\s*/, "");
  }
  return "The inbox action could not be completed. Please try again.";
}

function formatReceivedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Received recently";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type InboxMessageCardProps = {
  message: WhatsAppInboxMessage;
  generating: boolean;
  saving: boolean;
  sending: boolean;
  dismissing: boolean;
  onGenerate: () => void;
  onSave: (reply: string) => void;
  onSend: (reply: string) => void;
  onDismiss: () => void;
};

function InboxMessageCard({
  message,
  generating,
  saving,
  sending,
  dismissing,
  onGenerate,
  onSave,
  onSend,
  onDismiss,
}: InboxMessageCardProps) {
  const [reply, setReply] = useState(message.replyDraft ?? "");
  const busy = generating || saving || sending || dismissing;
  const uncertain = message.status === "uncertain";
  const activelySending = message.status === "sending";
  const replied = message.status === "replied";

  return (
    <article
      className="rounded-[14px] border border-[hsl(var(--border))] bg-[hsl(var(--background)/.72)] p-4 sm:p-5"
      data-testid={`card-whatsapp-inbox-${message.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-[12px] font-bold"
            data-testid={`text-inbox-sender-${message.id}`}
          >
            {message.displayName || message.phoneNumber}
          </p>
          {message.displayName && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {message.phoneNumber}
            </p>
          )}
          <p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Clock3 size={11} />
            <time dateTime={message.receivedAt}>
              {formatReceivedAt(message.receivedAt)}
            </time>
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.08em] ${
            uncertain
              ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
              : replied
                ? "bg-[hsl(158_34%_43%/.12)] text-[hsl(158_34%_33%)]"
                : activelySending
                  ? "bg-[hsl(var(--muted))] text-muted-foreground"
                  : "bg-[hsl(35_48%_59%/.15)] text-[hsl(35_48%_34%)]"
          }`}
          data-testid={`status-inbox-message-${message.id}`}
        >
          {uncertain
            ? "Check WhatsApp"
            : replied
              ? "Replied"
              : activelySending
                ? "Sending"
                : "Needs review"}
        </span>
      </div>

      <div
        className="mt-3 whitespace-pre-wrap break-words rounded-[11px] bg-[hsl(var(--card))] px-3.5 py-3 text-[12px] leading-[1.65]"
        data-testid={`text-inbox-message-${message.id}`}
      >
        {message.messageText}
      </div>

      {replied ? (
        <div className="mt-3 rounded-[10px] border border-[hsl(158_34%_43%/.16)] bg-[hsl(158_34%_43%/.06)] px-3.5 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[hsl(158_34%_33%)]">
            Reply sent
          </p>
          {message.replyDraft && (
            <p
              className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed"
              data-testid={`text-inbox-sent-reply-${message.id}`}
            >
              {message.replyDraft}
            </p>
          )}
          <button
            type="button"
            disabled={dismissing}
            onClick={onDismiss}
            data-testid={`button-dismiss-replied-inbox-message-${message.id}`}
            className="mt-2 flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))] disabled:opacity-50"
          >
            {dismissing ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Dismiss conversation
          </button>
        </div>
      ) : activelySending ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-[9px] bg-[hsl(var(--muted)/.68)] px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground"
        >
          <LoaderCircle size={13} className="mt-0.5 shrink-0 animate-spin" />
          A reply is being sent. Please wait for it to leave this inbox.
        </div>
      ) : uncertain ? (
        <div
          role="alert"
          className="mt-3 rounded-[9px] border border-[hsl(var(--accent-foreground)/.14)] bg-[hsl(var(--accent)/.5)] px-3 py-2.5 text-[10px] leading-relaxed text-[hsl(var(--accent-foreground))]"
          data-testid={`status-inbox-uncertain-${message.id}`}
        >
          Delivery could not be confirmed. Check the WhatsApp chat before
          dismissing this item. Do not send the reply again unless you confirm it
          was not delivered.
          {message.replyDraft && (
            <p className="mt-2 border-t border-[hsl(var(--accent-foreground)/.14)] pt-2">
              Reply submitted: {message.replyDraft}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {!message.isAdultApproved && (
            <p
              role="note"
              className="mb-3 rounded-[9px] bg-[hsl(var(--muted)/.68)] px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground"
              data-testid={`status-inbox-ai-adult-gate-${message.id}`}
            >
              AI drafts and automatic replies are limited to contacts approved
              as adults. You can still write and send a manual reply here.
            </p>
          )}
          <label
            htmlFor={`inbox-reply-${message.id}`}
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground"
          >
            Reply to review
          </label>
          <textarea
            id={`inbox-reply-${message.id}`}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Generate a suggestion or write your own reply…"
            data-testid={`input-inbox-reply-${message.id}`}
            className="w-full resize-y rounded-[10px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-[12px] leading-[1.6] outline-none transition focus:border-[hsl(var(--primary)/.55)] focus:ring-2 focus:ring-[hsl(var(--primary)/.09)] placeholder:text-muted-foreground/65"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !message.isAdultApproved}
              title={
                message.isAdultApproved
                  ? "Generate an AI reply draft"
                  : "AI drafts are limited to adult-approved contacts"
              }
              onClick={onGenerate}
              data-testid={`button-generate-inbox-reply-${message.id}`}
              className="flex h-9 items-center gap-2 rounded-[9px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-[10px] font-bold transition hover:border-[hsl(var(--primary)/.4)] disabled:cursor-wait disabled:opacity-50"
            >
              {generating ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <WandSparkles size={13} />
              )}
              {generating
                ? "Drafting…"
                : message.isAdultApproved
                  ? "Generate AI draft"
                  : "AI draft unavailable"}
            </button>
            <button
              type="button"
              disabled={busy || !reply.trim() || reply.trim() === (message.replyDraft ?? "")}
              onClick={() => onSave(reply)}
              data-testid={`button-save-inbox-draft-${message.id}`}
              className="flex h-9 items-center gap-2 rounded-[9px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-[10px] font-bold transition hover:border-[hsl(var(--primary)/.4)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={busy || !reply.trim()}
              onClick={() => onSend(reply)}
              data-testid={`button-send-inbox-reply-${message.id}`}
              className="flex h-9 items-center gap-2 rounded-[9px] bg-[hsl(var(--primary))] px-3.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              {sending ? "Sending…" : "Confirm & send"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              data-testid={`button-dismiss-inbox-message-${message.id}`}
              className="flex h-9 items-center gap-2 rounded-[9px] px-3 text-[10px] font-semibold text-muted-foreground transition hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))] disabled:opacity-50"
            >
              {dismissing ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              Dismiss
            </button>
          </div>
        </div>
      )}

      {uncertain && (
        <button
          type="button"
          disabled={dismissing}
          onClick={onDismiss}
          data-testid={`button-dismiss-uncertain-inbox-message-${message.id}`}
          className="mt-3 flex h-9 items-center gap-2 rounded-[9px] border border-[hsl(var(--border))] px-3 text-[10px] font-bold disabled:opacity-50"
        >
          {dismissing ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
          Dismiss after checking WhatsApp
        </button>
      )}
    </article>
  );
}

type MessageInboxProps = {
  connection: string | undefined;
  autoReplyEnabled: boolean;
};

export function MessageInbox({
  connection,
  autoReplyEnabled,
}: MessageInboxProps) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const inbox = useListWhatsAppInbox({
    query: {
      queryKey: getListWhatsAppInboxQueryKey(),
      refetchInterval: connection === "connected" ? 5000 : false,
    },
  });
  const generateDraft = useGenerateWhatsAppInboxDraft();
  const saveDraft = useSaveWhatsAppInboxDraft();
  const sendReply = useSendWhatsAppInboxReply();
  const dismissMessage = useDismissWhatsAppInboxMessage();
  const messages = inbox.data ?? [];
  const pendingCount = messages.filter((message) => message.status === "pending").length;

  const refreshInbox = () => {
    void queryClient.invalidateQueries({ queryKey: getListWhatsAppInboxQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
  };

  const handleGenerate = (inboxId: number) => {
    setActionError("");
    setActionMessage("");
    generateDraft.mutate(
      { inboxId },
      {
        onSuccess: () => {
          setActionMessage("AI draft ready. Review it before sending.");
          refreshInbox();
        },
        onError: (error) => setActionError(getErrorMessage(error)),
      },
    );
  };

  const handleSave = (inboxId: number, reply: string) => {
    setActionError("");
    setActionMessage("");
    saveDraft.mutate(
      { inboxId, data: { reply: reply.trim() } },
      {
        onSuccess: () => {
          setActionMessage("Reply draft saved.");
          refreshInbox();
        },
        onError: (error) => setActionError(getErrorMessage(error)),
      },
    );
  };

  const handleSend = (message: WhatsAppInboxMessage, reply: string) => {
    const recipient = message.displayName || message.phoneNumber;
    if (
      !window.confirm(
        `Send this reviewed reply to ${recipient} on WhatsApp?\n\n${reply.trim()}`,
      )
    ) {
      return;
    }
    setActionError("");
    setActionMessage("");
    sendReply.mutate(
      { inboxId: message.id, data: { reply: reply.trim() } },
      {
        onSuccess: () => {
          setActionMessage("Reply sent. The conversation remains in the inbox.");
          refreshInbox();
        },
        onError: (error) => {
          setActionError(getErrorMessage(error));
          void queryClient.invalidateQueries({
            queryKey: getListWhatsAppInboxQueryKey(),
          });
        },
      },
    );
  };

  const handleDismiss = (message: WhatsAppInboxMessage) => {
    const confirmation =
      message.status === "uncertain"
        ? "Have you checked WhatsApp? This only removes the inbox item and will not retry the reply."
        : message.status === "replied"
          ? "Remove this replied conversation from the inbox?"
          : "Dismiss this incoming message? No reply will be sent.";
    if (!window.confirm(confirmation)) return;
    setActionError("");
    setActionMessage("");
    dismissMessage.mutate(
      { inboxId: message.id },
      {
        onSuccess: () => {
          setActionMessage("Message dismissed from the inbox.");
          refreshInbox();
        },
        onError: (error) => setActionError(getErrorMessage(error)),
      },
    );
  };

  return (
    <section
      className="mt-5 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]"
      data-testid="section-whatsapp-message-inbox"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-[17px] sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[hsl(var(--primary)/.09)] text-[hsl(var(--primary))]">
            <MessageSquareText size={16} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold tracking-[-.02em]">
              Incoming messages
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Every incoming direct text message appears here.
            </p>
          </div>
        </div>
        <span
          className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground"
          data-testid="status-inbox-pending-count"
        >
          {pendingCount} waiting
        </span>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Incoming direct text messages appear here whether or not the contact
          is approved. You can always write a manual reply and confirm before
          sending. AI drafts and automatic replies require an adult-approved
          contact.
        </p>

        {autoReplyEnabled && (
          <div
            role="status"
            className="rounded-[10px] border border-[hsl(var(--accent-foreground)/.13)] bg-[hsl(var(--accent)/.48)] px-3.5 py-3 text-[10px] leading-relaxed text-[hsl(var(--accent-foreground))]"
            data-testid="status-inbox-auto-reply-enabled"
          >
            Automatic replies are on for adult-approved contacts. Those replies
            are still recorded here; messages from other contacts stay waiting
            for your manual review.
          </div>
        )}

        {connection !== "connected" && (
          <p className="rounded-[10px] bg-[hsl(var(--muted)/.68)] px-3.5 py-3 text-[10px] leading-relaxed text-muted-foreground">
            Connect WhatsApp to receive new messages. Previously received
            messages stay here while disconnected.
          </p>
        )}

        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[9px] bg-[hsl(var(--destructive)/.08)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--destructive))]"
            data-testid="status-inbox-action-error"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionMessage && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-[9px] bg-[hsl(158_34%_43%/.08)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(158_34%_33%)]"
            data-testid="status-inbox-action-success"
          >
            <Check size={14} className="shrink-0" />
            {actionMessage}
          </p>
        )}

        {inbox.isLoading ? (
          <div
            role="status"
            aria-label="Loading incoming messages"
            data-testid="status-inbox-loading"
            className="space-y-3"
          >
            <div className="skeleton h-24 rounded-[14px]" />
            <div className="skeleton h-24 rounded-[14px]" />
          </div>
        ) : inbox.isError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-[10px] bg-[hsl(var(--destructive)/.08)] p-3 text-[11px] text-[hsl(var(--destructive))]"
            data-testid="status-inbox-load-error"
          >
            <span>{getErrorMessage(inbox.error)}</span>
            <button
              type="button"
              onClick={() => inbox.refetch()}
              data-testid="button-retry-inbox"
              className="shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : messages.length ? (
          <div className="space-y-3" data-testid="list-whatsapp-inbox">
            {messages.map((message) => (
              <InboxMessageCard
                key={message.id}
                message={message}
                generating={
                  generateDraft.isPending &&
                  generateDraft.variables?.inboxId === message.id
                }
                saving={
                  saveDraft.isPending &&
                  saveDraft.variables?.inboxId === message.id
                }
                sending={
                  sendReply.isPending &&
                  sendReply.variables?.inboxId === message.id
                }
                dismissing={
                  dismissMessage.isPending &&
                  dismissMessage.variables?.inboxId === message.id
                }
                onGenerate={() => handleGenerate(message.id)}
                onSave={(reply) => handleSave(message.id, reply)}
                onSend={(reply) => handleSend(message, reply)}
                onDismiss={() => handleDismiss(message)}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded-[12px] border border-dashed border-[hsl(var(--border))] px-4 py-7 text-center"
            data-testid="status-inbox-empty"
          >
            <span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-muted-foreground">
              <Sparkles size={15} />
            </span>
            <p className="text-[11px] font-semibold">No messages in the inbox yet.</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[10px] leading-relaxed text-muted-foreground">
              New incoming direct text messages will appear here, including
              messages from contacts you have not approved.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}