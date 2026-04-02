"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/app-types";
import type { FriendSummary } from "@/lib/types";
import { readableProfile, initialsFor } from "@/lib/helpers";

/* ── Avatar ──────────────────────────────────────────── */

export function Avatar({
  profile,
  size = "medium"
}: {
  profile?: Profile | null;
  size?: "small" | "medium" | "large";
}) {
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div className={`avatar avatar-${size}`}>
      {avatarUrl && !imageFailed ? (
        <img src={avatarUrl} alt={readableProfile(profile)} onError={() => setImageFailed(true)} />
      ) : (
        <span>{initialsFor(profile)}</span>
      )}
    </div>
  );
}

/* ── PersonIdentity ──────────────────────────────────── */

export function PersonIdentity({ profile }: { profile?: Profile | null }) {
  return (
    <div className="person-identity">
      <Avatar profile={profile} />
      <div className="person-copy">
        <strong>{readableProfile(profile)}</strong>
        <p>@{profile?.username ?? "unknown"}</p>
      </div>
    </div>
  );
}

/* ── RefreshIcon ─────────────────────────────────────── */

export function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="button-icon" viewBox="0 0 20 20" fill="none">
      <path d="M16.667 10a6.667 6.667 0 1 1-1.953-4.714" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M13.333 3.333h3.334v3.334" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20" fill="none">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

/* ── FriendPicker ────────────────────────────────────── */

export function FriendPicker({
  friends,
  selectedId,
  onSelect,
  placeholder
}: {
  friends: FriendSummary[];
  selectedId: string;
  onSelect: (friendId: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedFriend =
    friends.find((friend) => friend.profile.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`picker-shell ${open ? "picker-shell-open" : ""}`} ref={wrapperRef}>
      <button
        className={`picker-trigger ${open ? "picker-trigger-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((c) => !c)}
        type="button"
      >
        {selectedFriend ? (
          <div className="picker-value">
            <PersonIdentity profile={selectedFriend.profile} />
            <span className={`picker-caret ${open ? "picker-caret-open" : ""}`}>
              <ChevronDownIcon className="picker-caret-icon" />
            </span>
          </div>
        ) : (
          <div className="picker-value">
            <span className="picker-placeholder">{placeholder}</span>
            <span className={`picker-caret ${open ? "picker-caret-open" : ""}`}>
              <ChevronDownIcon className="picker-caret-icon" />
            </span>
          </div>
        )}
      </button>
      {open && (
        <div className="picker-menu" role="listbox">
          {friends.length === 0 ? (
            <p className="empty-state">No friends available yet.</p>
          ) : (
            friends.map((friend) => (
              <button
                className="picker-option"
                key={friend.friendshipId}
                onClick={() => { onSelect(friend.profile.id); setOpen(false); }}
                role="option"
                aria-selected={friend.profile.id === selectedId}
                type="button"
              >
                <PersonIdentity profile={friend.profile} />
                <small>{friend.profile.username ? `@${friend.profile.username}` : ""}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
