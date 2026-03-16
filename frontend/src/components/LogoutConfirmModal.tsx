import React from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative max-w-md w-full mx-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <LogOut className="w-8 h-8 text-white/90" />
          </div>
        </div>

        {/* Content */}
        <div className="bg-black/60 border border-white/10 rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.9)]">
          <div className="p-6 space-y-4">
            <h2 className="text-2xl font-semibold text-white/90 text-center">
              Log Out?
            </h2>
            <p className="text-sm text-white/60 text-center">
              Are you sure you want to log out of your account?
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-sm font-medium text-white/90 hover:bg-white/15 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white text-[#070505] text-sm font-medium hover:bg-white/90 transition-all"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
