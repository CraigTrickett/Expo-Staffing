import { hrefs } from '@/lib/route';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck, UserPlus, X } from 'lucide-react';
import {
  grantAdminUser,
  listAdminUsers,
  revokeAdminUser,
  sendAdminPasswordReset,
  type AdminUserList,
} from '@/lib/firebase';
import { usePageFocus } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';

interface UserManagerPageProps {
  /** The signed-in admin. Their own row cannot be revoked. */
  currentEmail: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UserManagerPage: React.FC<UserManagerPageProps> = ({ currentEmail }) => {
  const modalRef = usePageFocus();
  const uid = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const me = currentEmail.toLowerCase();

  const refresh = useCallback(async () => {
    const result = await listAdminUsers();
    if (result.ok === false) {
      setLoadError(result.error);
      return;
    }
    setLoadError('');
    setList(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      toast.error('Enter a valid email address.', 'Not granted');
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await grantAdminUser(address);
    if (result.ok === false) {
      setBusy(false);
      toast.error(result.error, 'Not granted');
      return;
    }
    if (result.data.alreadyAdmin) {
      toast.info(`${address} is already an admin.`);
    } else if (result.data.accountCreated) {
      // A new account has no password yet. The reset email is how they set one.
      const sent = await sendAdminPasswordReset(address);
      toast.success(
        sent
          ? `${address} is now an admin. They have been emailed a link to set a password.`
          : `${address} is now an admin, but the password email could not be sent. They can use "Forgot password" on the sign-in screen.`);
    } else {
      toast.success(`${address} is now an admin and can sign in with their existing account.`);
    }
    setAnnouncement(`${address} granted admin access.`);
    setEmail('');
    await refresh();
    setBusy(false);
    emailRef.current?.focus();
  };

  const revoke = async (address: string) => {
    setBusy(true);
    const result = await revokeAdminUser(address);
    setBusy(false);
    setConfirming(null);
    if (result.ok === false) {
      toast.error(result.error, 'Not revoked');
      return;
    }
    toast.success(`${address} no longer has admin access.`);
    setAnnouncement(`${address} admin access revoked.`);
    await refresh();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby={`${uid}-title`} className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="flex items-start gap-3.5 border-b border-[#d8dce0] bg-[#f8f9fa] p-4 sm:p-5">
          <a
            href={hrefs.home}
            aria-label="Back to menu"
            title="Back to menu"
            className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white p-2 text-[#46535e] transition-colors hover:border-[#b9dcf0] hover:bg-[#e5f2f8] hover:text-[#0063a3]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </a>
          <div>
            <h1 id={`${uid}-title`} className="flex items-center gap-2 text-lg font-bold text-[#252a2e]">
              <ShieldCheck className="h-5 w-5 text-[#0063a3]" aria-hidden="true" />
              User manager
            </h1>
            <p className="mt-0.5 text-xs text-[#46535e]">
              Admins can see and change everything, and can grant or revoke access for others. Owners cannot be revoked.
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5">
          <form onSubmit={grant} aria-label="Grant admin access" className="flex flex-wrap items-end gap-2 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
            <div className="min-w-[240px] flex-1">
              <label htmlFor={`${uid}-email`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
                Email address
              </label>
              <input
                id={`${uid}-email`}
                ref={emailRef}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={formFieldClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="focus-ring flex cursor-pointer items-center gap-1.5 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084] disabled:cursor-default disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
              Grant admin access
            </button>
            <p className="w-full text-[11px] text-[#5b6770]">
              If they do not have an account yet, one is created and they are emailed a link to set a password.
            </p>
          </form>

          {loadError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded border border-[#f2b8b5] bg-[#fdecec] px-3 py-2 text-xs text-[#9e1b16]">
              <span>{loadError}</span>
              <button type="button" onClick={refresh} className="focus-ring cursor-pointer rounded px-2 py-0.5 font-semibold underline">
                Try again
              </button>
            </div>
          )}

          {!list && !loadError && (
            <p className="flex items-center gap-2 py-6 text-xs text-[#46535e]" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading admins&hellip;
            </p>
          )}

          {list && (
            <div className="overflow-x-auto rounded border border-[#d8dce0] bg-white shadow-2xs">
              <table className="w-full min-w-[560px] text-left text-xs">
                <caption className="sr-only">People with admin access</caption>
                <thead className="bg-[#f8f9fa] text-[11px] text-[#5b6770]">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Email</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Role</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Added</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7eaef]">
                  {list.owners.map((owner) => (
                    <tr key={owner}>
                      <th scope="row" className="px-3 py-2 font-semibold text-[#252a2e]">
                        {owner}
                        {owner.toLowerCase() === me && <span className="ml-2 font-normal text-[#5b6770]">(you)</span>}
                      </th>
                      <td className="px-3 py-2">
                        <span className="rounded border border-[#b9dcf0] bg-[#e5f2f8] px-1.5 py-0.5 text-[11px] font-semibold text-[#004f83]">Owner</span>
                      </td>
                      <td className="px-3 py-2 text-[#5b6770]">&ndash;</td>
                      <td className="px-3 py-2 text-right text-[11px] text-[#5b6770]">Cannot be revoked</td>
                    </tr>
                  ))}
                  {list.admins.map((a) => {
                    const self = a.email.toLowerCase() === me;
                    return (
                      <tr key={a.email}>
                        <th scope="row" className="px-3 py-2 font-semibold text-[#252a2e]">
                          {a.email}
                          {self && <span className="ml-2 font-normal text-[#5b6770]">(you)</span>}
                        </th>
                        <td className="px-3 py-2">
                          <span className="rounded border border-[#d8dce0] bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#46535e]">Admin</span>
                        </td>
                        <td className="px-3 py-2 text-[#46535e]">
                          {a.addedAt ? formatDate(a.addedAt.slice(0, 10)) : '\u2013'}
                          {a.addedBy && <span className="block text-[11px] text-[#5b6770]">by {a.addedBy}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {self ? (
                            <span className="text-[11px] text-[#5b6770]">You cannot revoke yourself</span>
                          ) : confirming === a.email ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-[#252a2e]">Revoke access?</span>
                              <button type="button" disabled={busy} onClick={() => revoke(a.email)} className="focus-ring cursor-pointer rounded bg-[#da3832] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#b82d28] disabled:opacity-60" aria-label={`Confirm revoking ${a.email}`}>
                                Revoke
                              </button>
                              <button type="button" onClick={() => setConfirming(null)} className="focus-ring cursor-pointer rounded border border-[#d8dce0] px-2 py-1 text-[11px] font-semibold text-[#46535e] hover:border-[#0063a3]">
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirming(a.email)} className="focus-ring cursor-pointer rounded border border-[#f2b8b5] px-2 py-1 text-[11px] font-semibold text-[#9e1b16] hover:bg-[#fdecec]" aria-label={`Revoke admin access for ${a.email}`}>
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {list.admins.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[11px] text-[#5b6770]">
                        No one else has admin access yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="sr-only" aria-live="polite">
            {announcement}
          </div>
        </div>
      </section>
    </div>
  );
};
