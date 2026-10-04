import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetWhatsAppStatusQueryKey,
  getListWhatsAppContactsQueryKey,
  useGetWhatsAppStatus,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useUpdateWhatsAppSettings,
  useListWhatsAppContacts,
  useAddWhatsAppContact,
  useDeleteWhatsAppContact,
} from '@workspace/api-client-react';
import type { WhatsAppSettingsInputTone } from '@workspace/api-client-react';
import {
  AlertCircle,
  Check,
  CircleHelp,
  Clock3,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Phone,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';

const toneOptions: { value: WhatsAppSettingsInputTone; label: string; detail: string }[] = [
  { value: 'playful', label: 'Playful', detail: 'Light, teasing energy' },
  { value: 'warm', label: 'Warm', detail: 'Affectionate and easy' },
  { value: 'confident', label: 'Confident', detail: 'Poised and direct' },
  { value: 'soft', label: 'Soft', detail: 'Gentle and thoughtful' },
  { value: 'spicy', label: 'Spicy', detail: 'Bold, teasing, suggestive' },
];

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') return 'Couldn’t reach the WhatsApp service. Check the connection and try again.';
    return error.message.replace(/^HTTP \d{3}\s*[^:]*:\s*/, '');
  }
  return 'Something went wrong. Please try again.';
}

function formatDate(value: string | null) {
  if (!value) return 'No automatic reply sent yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last reply recorded';
  return `Last automatic reply · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
}

function WhatsAppPage() {
  const queryClient = useQueryClient();
  const status = useGetWhatsAppStatus({
    query: {
      queryKey: getGetWhatsAppStatusQueryKey(),
      refetchInterval: (query) =>
        query.state.data?.connection === 'connecting' || query.state.data?.connection === 'awaiting_qr'
          ? 2500
          : 10000,
    },
  });
  const contacts = useListWhatsAppContacts({ query: { queryKey: getListWhatsAppContactsQueryKey() } });
  const connect = useConnectWhatsApp();
  const disconnect = useDisconnectWhatsApp();
  const updateSettings = useUpdateWhatsAppSettings();
  const addContact = useAddWhatsAppContact();
  const deleteContact = useDeleteWhatsAppContact();

  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [contactError, setContactError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [tone, setTone] = useState<WhatsAppSettingsInputTone>('warm');
  const [personaNotes, setPersonaNotes] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (status.data && !initialized.current) {
      initialized.current = true;
      setCreatorName(status.data.creatorName);
      setTone(status.data.tone);
      setPersonaNotes(status.data.personaNotes ?? '');
    }
  }, [status.data]);

  const currentStatus = status.data;
  const approvedContacts = contacts.data ?? [];
  const canAutoReply =
    currentStatus?.connection === 'connected' &&
    approvedContacts.length > 0 &&
    !!creatorName.trim();
  const autoReplyPrerequisite = currentStatus?.connection !== 'connected'
    ? 'Connect WhatsApp before enabling automatic replies.'
    : approvedContacts.length === 0
      ? 'Approve at least one adult contact before enabling automatic replies.'
      : !creatorName.trim()
        ? 'Add your creator name before enabling automatic replies.'
        : 'WhatsApp is connected and you have approved contacts.';
  const refreshWhatsApp = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListWhatsAppContactsQueryKey() });
  };

  const addApprovedContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError('');
    if (!adultConfirmed) {
      setContactError('Confirm that this person is 18 or older before approving them.');
      return;
    }
    addContact.mutate(
      { data: { phoneNumber: phoneNumber.trim(), displayName: displayName.trim() || null, adultConfirmed: true } },
      {
        onSuccess: () => {
          setPhoneNumber('');
          setDisplayName('');
          setAdultConfirmed(false);
          void queryClient.invalidateQueries({ queryKey: getListWhatsAppContactsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
        },
        onError: (error) => setContactError(getErrorMessage(error)),
      },
    );
  };

  const saveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);
    updateSettings.mutate(
      {
        data: {
          autoReplyEnabled: currentStatus?.autoReplyEnabled ?? false,
          creatorName: creatorName.trim(),
          tone,
          personaNotes: personaNotes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
          setSettingsError('');
          setSettingsSaved(true);
        },
        onError: (error) => setSettingsError(getErrorMessage(error)),
      },
    );
  };

  const changeAutoReply = (enabled: boolean) => {
    setSettingsError('');
    setSettingsSaved(false);
    updateSettings.mutate(
      { data: { autoReplyEnabled: enabled, creatorName: creatorName.trim(), tone, personaNotes: personaNotes.trim() || null } },
      {
        onSuccess: () => {
          setConfirmEnable(false);
          void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
        },
        onError: (error) => {
          setConfirmEnable(false);
          setSettingsError(getErrorMessage(error));
        },
      },
    );
  };

  const connectionLabel = currentStatus?.connection === 'connected'
    ? 'Connected'
    : currentStatus?.connection === 'awaiting_qr'
      ? 'Waiting for QR scan'
      : currentStatus?.connection === 'connecting'
        ? 'Starting connection'
        : currentStatus?.connection === 'error'
          ? 'Needs attention'
          : 'Not connected';

  return (
    <main className="studio-grain min-h-[100dvh] overflow-hidden">
      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-5 pb-12 sm:px-8 lg:px-12">
        <section className="mx-auto max-w-[980px] pt-9 sm:pt-12">
          <div className="reveal mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
            <div className="max-w-[630px]">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary))]">
                <span className="h-px w-6 bg-[hsl(var(--primary))]" />a quieter way to keep in touch
              </div>
              <h1 className="font-serif text-[38px] leading-[1.04] tracking-[-.04em] sm:text-[52px]">Your WhatsApp,<br className="hidden sm:block" /> <em className="font-medium text-[hsl(var(--primary))]">on your terms.</em></h1>
              <p className="mt-4 max-w-[490px] text-[14px] leading-[1.7] text-muted-foreground">Pair a device, choose the adult contacts you approve, and decide whether replies should go out automatically.</p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.8)] px-3.5 py-2 sm:self-auto" data-testid="status-whatsapp-connection">
              <span className={`size-2 rounded-full ${currentStatus?.connection === 'connected' ? 'bg-[hsl(158_34%_43%)]' : currentStatus?.connection === 'error' || status.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(35_48%_59%)]'}`} />
              <span className="font-mono text-[10px] uppercase tracking-[.08em] text-muted-foreground">{status.isLoading ? 'checking' : connectionLabel}</span>
            </div>
          </div>

          {status.isLoading ? (
            <div role="status" aria-label="Loading WhatsApp settings" data-testid="status-whatsapp-loading" className="grid gap-5 lg:grid-cols-2"><div className="skeleton h-[340px] rounded-[18px]" /><div className="skeleton h-[340px] rounded-[18px]" /></div>
          ) : status.isError ? (
            <div role="alert" data-testid="status-whatsapp-load-error" className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--card))] p-5 text-sm"><AlertCircle className="mt-0.5 text-[hsl(var(--destructive))]" size={18} /><div className="flex-1"><strong>WhatsApp status couldn’t load.</strong><p className="mt-1 text-xs text-muted-foreground">{getErrorMessage(status.error)}</p></div><button type="button" onClick={() => status.refetch()} data-testid="button-retry-whatsapp-status" className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold">Retry</button></div>
          ) : (
            <>
              <div className="grid items-start gap-5 lg:grid-cols-[.95fr_1.05fr] lg:gap-6">
                <section className="reveal rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
                  <div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-[17px] sm:px-6">
                    <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-[10px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Link2 size={16} /></span><div><h2 className="text-[14px] font-bold tracking-[-.02em]">Link a device</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Your session stays on your own WhatsApp account.</p></div></div>
                    <span className="font-mono text-[10px] text-muted-foreground">01</span>
                  </div>
                  <div className="p-5 sm:p-6">
                    <ol className="space-y-3 text-[11px] leading-[1.6] text-muted-foreground">
                      <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] font-mono text-[9px] text-foreground">1</span><span>Open WhatsApp on your phone.</span></li>
                      <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] font-mono text-[9px] text-foreground">2</span><span>Go to <strong className="text-foreground">Linked devices</strong>, then choose <strong className="text-foreground">Link a device</strong>.</span></li>
                      <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] font-mono text-[9px] text-foreground">3</span><span>Scan the QR code shown here with your phone.</span></li>
                    </ol>

                    {currentStatus?.connection === 'awaiting_qr' && currentStatus.qrDataUrl ? (
                      <div className="my-5 rounded-[14px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-center" data-testid="status-whatsapp-qr">
                        <div className="mx-auto grid size-[240px] max-w-full place-items-center overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-white p-2">
                          <img src={currentStatus.qrDataUrl} alt="WhatsApp device pairing QR code" className="size-full object-contain" data-testid="img-whatsapp-qr" />
                        </div>
                        <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"><QrCode size={13} /> QR refreshes automatically while pairing.</p>
                      </div>
                    ) : currentStatus?.connection === 'connected' ? (
                      <div className="my-5 flex items-center gap-3 rounded-[13px] border border-[hsl(158_34%_43%/.2)] bg-[hsl(158_34%_43%/.07)] p-4" data-testid="status-whatsapp-connected"><span className="grid size-9 place-items-center rounded-full bg-[hsl(158_34%_43%/.14)] text-[hsl(158_34%_33%)]"><Check size={17} /></span><div className="min-w-0"><p className="text-[12px] font-bold text-foreground">Device linked</p><p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{currentStatus.phoneNumber || 'WhatsApp account connected'}</p></div></div>
                    ) : currentStatus?.connection === 'connecting' ? (
                      <div role="status" data-testid="status-whatsapp-connecting" className="my-5 flex items-center gap-3 rounded-[13px] bg-[hsl(var(--muted)/.6)] p-4"><LoaderCircle size={18} className="animate-spin text-[hsl(var(--primary))]" /><div><p className="text-[12px] font-semibold">Preparing a secure pairing…</p><p className="mt-1 text-[10px] text-muted-foreground">This can take a few moments.</p></div></div>
                    ) : (
                      <div className="my-5 grid min-h-[135px] place-items-center rounded-[14px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background)/.65)] px-4 text-center" data-testid="status-whatsapp-not-paired"><div><span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-muted-foreground"><Phone size={16} /></span><p className="text-[11px] font-semibold">Your phone is not linked yet.</p><p className="mt-1 text-[10px] text-muted-foreground">Start pairing to create a fresh QR code.</p></div></div>
                    )}

                    {(connectError || currentStatus?.lastError) && <div role="alert" data-testid="status-whatsapp-connect-error" className="mb-4 flex items-start gap-2 rounded-[9px] bg-[hsl(var(--destructive)/.08)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--destructive))]"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{connectError || currentStatus?.lastError}</span></div>}
                    {connect.isError && !connectError && <div role="alert" className="mb-4 text-[11px] text-[hsl(var(--destructive))]">{getErrorMessage(connect.error)}</div>}
                    {disconnect.isError && <div role="alert" data-testid="status-whatsapp-disconnect-error" className="mb-4 text-[11px] text-[hsl(var(--destructive))]">{getErrorMessage(disconnect.error)}</div>}
                    <div className="flex flex-wrap gap-2">
                      {currentStatus?.connection === 'connected' ? (
                        <button type="button" disabled={disconnect.isPending} onClick={() => { if (window.confirm('Disconnect this WhatsApp device? This removes the saved linked session and turns automatic replies off.')) { setConnectError(''); disconnect.mutate(undefined, { onSuccess: refreshWhatsApp }); } }} data-testid="button-disconnect-whatsapp" className="flex h-10 items-center gap-2 rounded-[9px] border border-[hsl(var(--border))] px-4 text-[11px] font-bold text-foreground transition hover:border-[hsl(var(--destructive)/.35)] hover:text-[hsl(var(--destructive))] disabled:opacity-50">{disconnect.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <WifiOff size={14} />} Disconnect</button>
                      ) : currentStatus?.connection === 'awaiting_qr' ? (
                        <button type="button" onClick={() => void status.refetch()} data-testid="button-refresh-whatsapp-status" className="flex h-10 items-center gap-2 rounded-[9px] border border-[hsl(var(--border))] px-4 text-[11px] font-bold text-foreground transition hover:border-[hsl(var(--primary)/.4)]">{status.isFetching ? <LoaderCircle size={14} className="animate-spin" /> : <QrCode size={14} />} Refresh status</button>
                      ) : (
                        <button type="button" disabled={connect.isPending || currentStatus?.connection === 'connecting'} onClick={() => { setConnectError(''); connect.mutate(undefined, { onSuccess: refreshWhatsApp, onError: (error) => setConnectError(getErrorMessage(error)) }); }} data-testid="button-connect-whatsapp" className="flex h-10 items-center gap-2 rounded-[9px] bg-[hsl(var(--primary))] px-4 text-[11px] font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-105 disabled:opacity-60">{connect.isPending ? <LoaderCircle size={14} className="animate-spin" /> : currentStatus?.connection === 'error' ? <QrCode size={14} /> : <Wifi size={14} />} {currentStatus?.connection === 'error' ? 'Try again' : 'Connect WhatsApp'}</button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="reveal-late rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
                  <div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-[17px] sm:px-6">
                    <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-[10px] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><UserRoundCheck size={16} /></span><div><h2 className="text-[14px] font-bold tracking-[-.02em]">Approved contacts</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Only people you name here can receive automatic replies.</p></div></div>
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground" data-testid="status-approved-contact-count">{approvedContacts.length} approved</span>
                  </div>
                  <div className="p-5 sm:p-6">
                    <form onSubmit={addApprovedContact} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[.8fr_1.2fr]">
                        <div><label htmlFor="contact-display-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Display name <span className="font-normal normal-case tracking-normal">(optional)</span></label><input id="contact-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="e.g. Alex" data-testid="input-contact-name" className="h-10 w-full rounded-[9px] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-[12px] outline-none focus:border-[hsl(var(--primary)/.55)]" /></div>
                        <div><label htmlFor="contact-phone-number" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">International phone number</label><input id="contact-phone-number" type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required maxLength={20} placeholder="+1 415 555 0147" data-testid="input-contact-phone" className="h-10 w-full rounded-[9px] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-[12px] outline-none focus:border-[hsl(var(--primary)/.55)]" /></div>
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] bg-[hsl(var(--muted)/.68)] px-3 py-3"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} data-testid="input-contact-adult-confirmation" className="mt-0.5 size-3.5 accent-[hsl(var(--primary))]" /><span className="text-[10px] leading-[1.5] text-muted-foreground">I confirm this contact is <strong className="text-foreground">18 or older</strong> and has agreed to receive messages.</span></label>
                      {contactError && <div role="alert" data-testid="status-contact-error" className="flex items-start gap-2 rounded-[9px] bg-[hsl(var(--destructive)/.08)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--destructive))]"><AlertCircle size={14} className="mt-0.5 shrink-0" />{contactError}</div>}
                      <button type="submit" disabled={addContact.isPending || !phoneNumber.trim() || !adultConfirmed} data-testid="button-add-approved-contact" className="flex h-10 items-center gap-2 rounded-[9px] bg-[hsl(var(--foreground))] px-4 text-[11px] font-bold text-[hsl(var(--background))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{addContact.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />} Approve contact</button>
                    </form>
                    <div className="my-5 h-px bg-[hsl(var(--border))]" />
                    {contacts.isLoading ? (
                      <div role="status" aria-label="Loading approved contacts" data-testid="status-contacts-loading" className="space-y-2"><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /></div>
                    ) : contacts.isError ? (
                      <div role="alert" data-testid="status-contacts-error" className="flex items-center justify-between gap-3 rounded-lg bg-[hsl(var(--destructive)/.08)] p-3 text-[11px] text-[hsl(var(--destructive))]"><span>{getErrorMessage(contacts.error)}</span><button type="button" onClick={() => contacts.refetch()} data-testid="button-retry-contacts" className="font-semibold underline">Retry</button></div>
                    ) : approvedContacts.length ? (
                      <ul className="space-y-2" data-testid="list-approved-contacts">
                        {approvedContacts.map((contact) => <li key={contact.id} data-testid={`row-approved-contact-${contact.id}`} className="flex items-center justify-between gap-3 rounded-[11px] border border-[hsl(var(--border))] bg-[hsl(var(--background)/.62)] px-3.5 py-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><ShieldCheck size={15} /></span><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{contact.displayName || 'Approved contact'}</p><p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{contact.phoneNumber}</p></div></div><button type="button" disabled={deleteContact.isPending} onClick={() => { if (window.confirm(`Remove ${contact.displayName || contact.phoneNumber} from approved contacts?`)) { deleteContact.mutate({ contactId: contact.id }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListWhatsAppContactsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() }); } }); } }} aria-label={`Remove ${contact.displayName || contact.phoneNumber}`} data-testid={`button-remove-contact-${contact.id}`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--destructive)/.08)] hover:text-[hsl(var(--destructive))] disabled:opacity-40"><Trash2 size={14} /></button></li>)}
                      </ul>
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-[hsl(var(--border))] px-4 py-6 text-center" data-testid="status-contacts-empty"><span className="mx-auto mb-2 grid size-8 place-items-center rounded-full bg-[hsl(var(--muted))] text-muted-foreground"><UserRoundCheck size={15} /></span><p className="text-[11px] font-semibold">No one approved yet.</p><p className="mx-auto mt-1 max-w-[250px] text-[10px] leading-relaxed text-muted-foreground">Add a contact only after confirming they are an adult and have agreed to receive messages.</p></div>
                    )}
                    {deleteContact.isError && <p role="alert" data-testid="status-contact-remove-error" className="mt-3 text-[10px] text-[hsl(var(--destructive))]">{getErrorMessage(deleteContact.error)}</p>}
                  </div>
                </section>
              </div>

              <section className="mt-5 rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]" data-testid="section-auto-reply-settings">
                <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] px-5 py-[17px] sm:flex-row sm:items-center sm:px-6">
                  <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-[10px] bg-[hsl(var(--primary)/.09)] text-[hsl(var(--primary))]"><MessageSquareText size={16} /></span><div><h2 className="text-[14px] font-bold tracking-[-.02em]">Automatic replies</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Starts off. Enabling sends messages without review.</p></div></div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.08em] ${currentStatus?.autoReplyEnabled ? 'bg-[hsl(158_34%_43%/.12)] text-[hsl(158_34%_33%)]' : 'bg-[hsl(var(--muted))] text-muted-foreground'}`} data-testid="status-auto-reply">{currentStatus?.autoReplyEnabled ? 'On' : 'Off'}</span>
                    <button type="button" role="switch" aria-checked={!!currentStatus?.autoReplyEnabled} aria-label="Automatic replies" disabled={!canAutoReply || updateSettings.isPending} onClick={() => { if (currentStatus?.autoReplyEnabled) changeAutoReply(false); else setConfirmEnable(true); }} data-testid="toggle-auto-reply" className={`relative h-7 w-[50px] rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${currentStatus?.autoReplyEnabled ? 'bg-[hsl(158_34%_43%)]' : 'bg-[hsl(var(--muted-foreground)/.35)]'}`}><span className={`block size-5 rounded-full bg-[hsl(var(--card))] shadow-sm transition-transform ${currentStatus?.autoReplyEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`} /></button>
                  </div>
                </div>
                <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[.82fr_1.18fr]">
                  <div>
                    <div className="mb-4 flex items-start gap-2 rounded-[11px] border border-[hsl(var(--accent-foreground)/.12)] bg-[hsl(var(--accent)/.48)] p-3 text-[10px] leading-[1.55] text-[hsl(var(--accent-foreground))]"><CircleHelp size={14} className="mt-0.5 shrink-0" /><span>Only contacts you explicitly approve as adults are eligible. When enabled, replies are generated and sent automatically—there is no review step.</span></div>
                    <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground" data-testid="text-auto-reply-prerequisite">{autoReplyPrerequisite}</p>
                    {confirmEnable && (
                      <div role="alertdialog" aria-labelledby="enable-confirm-title" data-testid="dialog-confirm-auto-reply" className="rounded-[12px] border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--background))] p-4">
                        <h3 id="enable-confirm-title" className="text-[12px] font-bold">Send replies automatically?</h3><p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">Messages from approved contacts will receive an AI-generated reply without your review. You can switch this off any time.</p>
                        <div className="mt-3 flex gap-2"><button type="button" disabled={updateSettings.isPending} onClick={() => changeAutoReply(true)} data-testid="button-confirm-enable-auto-reply" className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{updateSettings.isPending ? 'Enabling…' : 'Yes, enable'}</button><button type="button" onClick={() => setConfirmEnable(false)} data-testid="button-cancel-enable-auto-reply" className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-semibold">Not now</button></div>
                      </div>
                    )}
                    {settingsError && <div role="alert" data-testid="status-settings-error" className="mt-3 flex items-start gap-2 rounded-[9px] bg-[hsl(var(--destructive)/.08)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--destructive))]"><AlertCircle size={14} className="mt-0.5 shrink-0" /><span>{settingsError}{/gemini is not configured/i.test(settingsError) && <span className="mt-1 block">Gemini reply generation must be configured for this project before automatic replies can be enabled.</span>}</span></div>}
                    {settingsSaved && <p role="status" data-testid="status-settings-saved" className="mt-3 flex items-center gap-2 text-[10px] text-[hsl(158_34%_33%)]"><Check size={13} /> Settings saved.</p>}
                    <div className="mt-4 flex items-center gap-2 text-[9px] text-muted-foreground" data-testid="status-last-auto-reply"><Clock3 size={12} />{formatDate(currentStatus?.lastReplyAt ?? null)}</div>
                  </div>
                  <form onSubmit={saveSettings} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label htmlFor="whatsapp-creator-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Creator name</label><input id="whatsapp-creator-name" value={creatorName} onChange={(event) => setCreatorName(event.target.value)} maxLength={80} placeholder="How should you sign?" data-testid="input-whatsapp-creator-name" className="h-10 w-full rounded-[9px] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-[12px] outline-none focus:border-[hsl(var(--primary)/.55)]" /></div>
                      <div><label htmlFor="whatsapp-persona-notes" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Voice notes <span className="font-normal normal-case tracking-normal">(optional)</span></label><input id="whatsapp-persona-notes" value={personaNotes} onChange={(event) => setPersonaNotes(event.target.value)} maxLength={1000} placeholder="A sign-off, preferred style…" data-testid="input-whatsapp-persona-notes" className="h-10 w-full rounded-[9px] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-[12px] outline-none focus:border-[hsl(var(--primary)/.55)]" /></div>
                    </div>
                    <fieldset><legend className="mb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Reply tone</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{toneOptions.map((option) => <button key={option.value} type="button" onClick={() => setTone(option.value)} aria-pressed={tone === option.value} data-testid={`button-whatsapp-tone-${option.value}`} className={`rounded-[10px] border px-2.5 py-2 text-left transition-colors ${tone === option.value ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--accent)/.72)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary)/.3)]'}`}><span className={`block text-[10px] font-bold ${tone === option.value ? 'text-[hsl(var(--primary))]' : 'text-foreground'}`}>{option.label}</span><span className="mt-0.5 block text-[8px] leading-[1.35] text-muted-foreground">{option.detail}</span></button>)}</div></fieldset>
                    <div className="flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] text-muted-foreground">Settings are saved to this workspace.</p><button type="submit" disabled={updateSettings.isPending} data-testid="button-save-whatsapp-settings" className="flex h-9 items-center justify-center gap-2 rounded-[9px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-[10px] font-bold transition hover:border-[hsl(var(--primary)/.4)] disabled:opacity-50">{updateSettings.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Save reply settings</button></div>
                  </form>
                </div>
              </section>

              <footer className="mt-7 flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-4 text-[10px] leading-[1.6] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Approval is explicit. Automatic sending is always your choice.</span><span className="font-mono text-[9px] uppercase tracking-[.08em]">private · adult contacts only</span></footer>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default WhatsAppPage;