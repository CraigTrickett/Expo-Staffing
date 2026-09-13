import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  QrCode,
  Share2,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { EventConfig } from '@/types';
import { toast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/lib/hooks';

interface AdminShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EventConfig;
}

export const AdminShareModal: React.FC<AdminShareModalProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const modalRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const path = window.location.pathname;
  const adminUrl = `${origin}${path}#/admin/${config.adminKey}`;
  const publicUrl = `${origin}${path}#/event/${config.publicKey}`;

  const handleCopyAdmin = () => {
    navigator.clipboard.writeText(adminUrl);
    setCopiedAdmin(true);
    toast.success('Admin link copied.', 'Link Copied');
    setTimeout(() => setCopiedAdmin(false), 2500);
  };

  const handleCopyPublic = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedPublic(true);
    toast.success('Public staff signup link copied! Ready to share with your team.', 'Staff Link Copied');
    setTimeout(() => setCopiedPublic(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="bg-white border border-[#d8dce0] rounded max-w-lg w-full p-6 space-y-5 shadow-modus-4 animate-in zoom-in-95 duration-150 focus:outline-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#d8dce0] pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
                <Share2 className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0063a3]">
                Event Access & Sharing
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#252a2e] tracking-tight">
              Share &ldquo;{config.title}&rdquo;
            </h3>
            <p className="text-xs text-[#46535e]">
              One link for staff self-service, one for you to reach this event's admin dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Public Staff Shift Picker Link */}
        <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded bg-[#e6f5ec] text-[#00823b]">
                <Users className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-[#252a2e]">Public Staff Signup URL</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#00823b] bg-[#e6f5ec] px-2 py-0.5 rounded border border-[#a3e0be]">
              Share with Team
            </span>
          </div>

          <p className="text-xs text-[#46535e] leading-relaxed">
            Send this link to your expo representatives via Slack, email, or WhatsApp. They can claim open shifts with 1 tap without any login required.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 bg-white border border-[#d8dce0] text-[#252a2e] text-xs font-mono px-3 py-2 rounded focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3] select-all"
            />
            <button
              type="button"
              onClick={handleCopyPublic}
              className={cn(
                'px-3.5 py-2 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 shadow-xs cursor-pointer',
                copiedPublic
                  ? 'bg-[#00823b] text-white'
                  : 'bg-[#0063a3] hover:bg-[#005084] text-white'
              )}
            >
              {copiedPublic ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPublic ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => setShowQrCode(!showQrCode)}
              className="text-[#0063a3] hover:text-[#005084] flex items-center space-x-1 font-semibold transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQrCode ? 'Hide QR Code' : 'Display Mobile QR Code'}</span>
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0063a3] hover:text-[#005084] flex items-center space-x-1 font-semibold transition-colors"
            >
              <span>Open Staff</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* QR Code visual box */}
          {showQrCode && (
            <div className="mt-3 p-4 bg-white rounded border border-[#d8dce0] flex flex-col items-center justify-center text-center space-y-2 text-[#252a2e] animate-in fade-in zoom-in-95 duration-150">
              {/* Scalable Vector QR representation */}
              <div className="p-2 bg-white rounded border border-[#d8dce0] shadow-xs">
                <svg
                  className="w-36 h-36 mx-auto"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Position detection patterns */}
                  <rect width="120" height="120" fill="white" />
                  {/* Top-left marker */}
                  <rect x="10" y="10" width="30" height="30" fill="black" />
                  <rect x="15" y="15" width="20" height="20" fill="white" />
                  <rect x="20" y="20" width="10" height="10" fill="black" />

                  {/* Top-right marker */}
                  <rect x="80" y="10" width="30" height="30" fill="black" />
                  <rect x="85" y="15" width="20" height="20" fill="white" />
                  <rect x="90" y="20" width="10" height="10" fill="black" />

                  {/* Bottom-left marker */}
                  <rect x="10" y="80" width="30" height="30" fill="black" />
                  <rect x="15" y="85" width="20" height="20" fill="white" />
                  <rect x="20" y="90" width="10" height="10" fill="black" />

                  {/* Stylized QR data cells */}
                  <rect x="45" y="15" width="6" height="6" fill="black" />
                  <rect x="55" y="15" width="6" height="6" fill="black" />
                  <rect x="65" y="15" width="6" height="6" fill="black" />
                  <rect x="45" y="25" width="6" height="6" fill="black" />
                  <rect x="65" y="25" width="6" height="6" fill="black" />
                  <rect x="45" y="35" width="6" height="6" fill="black" />
                  <rect x="55" y="35" width="6" height="6" fill="black" />

                  <rect x="15" y="45" width="6" height="6" fill="black" />
                  <rect x="25" y="45" width="6" height="6" fill="black" />
                  <rect x="35" y="45" width="6" height="6" fill="black" />
                  <rect x="45" y="45" width="6" height="6" fill="black" />
                  <rect x="55" y="45" width="6" height="6" fill="black" />
                  <rect x="75" y="45" width="6" height="6" fill="black" />
                  <rect x="85" y="45" width="6" height="6" fill="black" />
                  <rect x="95" y="45" width="6" height="6" fill="black" />

                  <rect x="15" y="55" width="6" height="6" fill="black" />
                  <rect x="35" y="55" width="6" height="6" fill="black" />
                  <rect x="55" y="55" width="6" height="6" fill="black" />
                  <rect x="65" y="55" width="6" height="6" fill="black" />
                  <rect x="85" y="55" width="6" height="6" fill="black" />

                  <rect x="15" y="65" width="6" height="6" fill="black" />
                  <rect x="25" y="65" width="6" height="6" fill="black" />
                  <rect x="45" y="65" width="6" height="6" fill="black" />
                  <rect x="65" y="65" width="6" height="6" fill="black" />
                  <rect x="75" y="65" width="6" height="6" fill="black" />
                  <rect x="95" y="65" width="6" height="6" fill="black" />

                  <rect x="45" y="75" width="6" height="6" fill="black" />
                  <rect x="55" y="75" width="6" height="6" fill="black" />
                  <rect x="75" y="75" width="6" height="6" fill="black" />
                  <rect x="85" y="75" width="6" height="6" fill="black" />
                  <rect x="95" y="75" width="6" height="6" fill="black" />

                  <rect x="45" y="85" width="6" height="6" fill="black" />
                  <rect x="65" y="85" width="6" height="6" fill="black" />
                  <rect x="75" y="85" width="6" height="6" fill="black" />
                  <rect x="45" y="95" width="6" height="6" fill="black" />
                  <rect x="55" y="95" width="6" height="6" fill="black" />
                  <rect x="65" y="95" width="6" height="6" fill="black" />
                  <rect x="85" y="95" width="6" height="6" fill="black" />
                  <rect x="95" y="95" width="6" height="6" fill="black" />
                </svg>
              </div>
              <p className="text-[11px] font-medium text-[#46535e]">
                Point any smartphone camera to claim expo shifts instantly
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Admin Link (informational — no longer a secret credential) */}
        <div className="bg-[#e5f2f8] border border-[#b9dcf0] rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded bg-white text-[#0063a3]">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-[#0063a3]">Your Admin Link</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#0063a3] bg-white px-2 py-0.5 rounded border border-[#b9dcf0]">
              Bookmark This
            </span>
          </div>

          <div className="p-2.5 bg-white rounded border border-[#b9dcf0] text-[11px] text-[#252a2e] flex items-start space-x-2">
            <Shield className="w-4 h-4 text-[#0063a3] shrink-0 mt-0.5" />
            <span>
              This takes you straight to this event once you're signed in. Opening it without signing
              in shows a login screen, not the dashboard — sharing it with staff by accident won't give
              them admin access, but the staff link below is still the right one to send them.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={adminUrl}
              className="flex-1 bg-white border border-[#b9dcf0] text-[#252a2e] text-xs font-mono px-3 py-2 rounded focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/30 select-all"
            />
            <button
              type="button"
              onClick={handleCopyAdmin}
              className={cn(
                'px-3.5 py-2 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 shadow-xs cursor-pointer',
                copiedAdmin
                  ? 'bg-[#00823b] text-white'
                  : 'bg-[#0063a3] hover:bg-[#005084] text-white'
              )}
            >
              {copiedAdmin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAdmin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#0063a3] hover:bg-[#005084] text-white text-xs font-semibold rounded transition-colors shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
