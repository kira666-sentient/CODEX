"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import type { Profile, DebtRequest, Settlement, SharedItem, Friendship } from "@/lib/app-types";
import type { FriendSummary, ActivityItem } from "@/lib/types";
import { formatCurrency, formatDateTime, formatDate, formatDateOnly, readableProfile } from "@/lib/helpers";
import { Avatar, PersonIdentity } from "./ui";

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  totalOwedToYou: number;
  totalYouOwe: number;
  onOpenProfile: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}

export function MobileSidebar(props: MobileSidebarProps) {
  if (!props.isOpen) return null;
  const { onClose, profile, totalOwedToYou, totalYouOwe, onOpenProfile, onRefresh, onSignOut } = props;

  return (
    <div className="mobile-only">
      <div className="mobile-sidebar-backdrop" onClick={onClose} />
      <aside className="mobile-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sidebar-header">
          <img className="mobile-sidebar-logo" src="/fnb-logo.svg" alt="F&B" />
          <button className="ghost-button mobile-sidebar-close" onClick={onClose} type="button">Close</button>
        </div>
        <div className="mobile-sidebar-profile">
          <Avatar profile={profile} size="medium" />
          <div>
            <strong>{readableProfile(profile)}</strong>
            <p className="muted mobile-sidebar-username">@{profile?.username ?? "not-set"}</p>
          </div>
        </div>
        <div className="mobile-sidebar-stats">
          <div className="mobile-sidebar-stat owed-to-you">
            <span>They owe you</span>
            <strong>{formatCurrency(totalOwedToYou)}</strong>
          </div>
          <div className="mobile-sidebar-stat you-owe">
            <span>You owe</span>
            <strong>{formatCurrency(totalYouOwe)}</strong>
          </div>
        </div>
        <div className="mobile-sidebar-nav">
          <button className="ghost-button" onClick={() => { onClose(); onOpenProfile(); }} type="button">Profile and UPI setup</button>
          <button className="ghost-button" onClick={() => { onClose(); onRefresh(); }} type="button">Refresh data</button>
          <button className="ghost-button danger-ghost-button" onClick={onSignOut} type="button">Sign out</button>
        </div>
      </aside>
    </div>
  );
}

export interface MobileHomeProps {
  profile: Profile | null;
  pendingCount: number;
  balancesCount: number;
  recentActivityCount: number;
  sharedItemsCount: number;
  onNavigate: (page: "network" | "approvals" | "money" | "activity" | "items") => void;
  onOpenSidebar: () => void;
}

export function MobileHome(props: MobileHomeProps) {
  const { profile, pendingCount, balancesCount, recentActivityCount, sharedItemsCount, onNavigate, onOpenSidebar } = props;

  return (
    <>
      <header className="mobile-welcome mobile-only">
        <div className="mobile-welcome-text">
          <h2>Hello, {profile?.full_name?.split(" ")[0] || "Friend"}</h2>
          <p className="muted">You have {pendingCount} items to review.</p>
        </div>
        <button className="mobile-welcome-avatar" onClick={onOpenSidebar} type="button">
          <Avatar profile={profile} size="medium" />
        </button>
      </header>

      <div className="mobile-home-grid mobile-only">
        <button className="mobile-nav-card" onClick={() => onNavigate("network")} type="button">
          <span className="nav-card-icon">NW</span>
          <span className="nav-card-label">Your Network</span>
          <span className="nav-card-badge">{balancesCount} friends</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("approvals")} type="button">
          <span className="nav-card-icon">AP</span>
          <span className="nav-card-label">Approvals</span>
          <span className="nav-card-badge">{pendingCount} pending</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("money")} type="button">
          <span className="nav-card-icon">RS</span>
          <span className="nav-card-label">Money Actions</span>
        </button>
        <button className="mobile-nav-card" onClick={() => onNavigate("activity")} type="button">
          <span className="nav-card-icon">LG</span>
          <span className="nav-card-label">Activity</span>
          <span className="nav-card-badge">{recentActivityCount}</span>
        </button>
        <button className="mobile-nav-card items-card" onClick={() => onNavigate("items")} type="button">
          <span className="nav-card-icon">IT</span>
          <span className="nav-card-label">Item Tracker</span>
          <span className="nav-card-badge">{sharedItemsCount} items</span>
        </button>
      </div>
    </>
  );
}

export interface MobileNetworkPageProps {
  balances: FriendSummary[];
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  onSendInvite: () => void;
  mutating: boolean;
  incomingInvites: Friendship[];
  outgoingInvites: Friendship[];
  profilesById: Map<string, Profile>;
  onViewStatement: (friendId: string) => void;
  onRespondInvite: (id: string, accept: boolean) => void;
  onBack: () => void;
}

export function MobileNetworkPage(props: MobileNetworkPageProps) {
  const { balances, inviteUsername, setInviteUsername, onSendInvite, mutating, incomingInvites, outgoingInvites, profilesById, onViewStatement, onRespondInvite, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">Back</button>
        <h2>Your Network</h2>
      </div>
      <div className="mobile-page-content">
        <section className="mobile-section">
          <span className="profile-label subpanel-label">Invite by username</span>
          <div className="inline-form-row">
            <input aria-label="Invite by username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="friend_username" />
            <button className="primary-button inline-form-submit" onClick={onSendInvite} disabled={mutating} type="button">Send</button>
          </div>
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">Your friends <span className="count-chip">{balances.length}</span></h3>
          {balances.length === 0 ? (
            <p className="empty-state">No accepted friends yet.</p>
          ) : (
            <div className="stack mini-stack">
              {balances.map((friend) => (
                <button className="friend-card" key={friend.friendshipId} onClick={() => onViewStatement(friend.profile.id)} type="button">
                  <PersonIdentity profile={friend.profile} />
                  <div className="friend-card-side">
                    <span className={`amount-badge ${friend.balanceInPaise > 0 ? "positive" : friend.balanceInPaise < 0 ? "negative" : ""}`}>{formatCurrency(friend.balanceInPaise)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">Incoming invites <span className="count-chip">{incomingInvites.length}</span></h3>
          {incomingInvites.length === 0 ? (
            <p className="empty-state">No incoming invites right now.</p>
          ) : (
            <div className="stack mini-stack">
              {incomingInvites.map((invite) => (
                <div className="list-card" key={invite.id}>
                  <PersonIdentity profile={profilesById.get(invite.requester_id)} />
                  <div className="row-actions">
                    <button className="primary-button compact-action-button" onClick={() => onRespondInvite(invite.id, true)} disabled={mutating} type="button">Accept</button>
                    <button className="ghost-button compact-action-button" onClick={() => onRespondInvite(invite.id, false)} disabled={mutating} type="button">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mobile-section">
          <h3 className="mobile-section-title">Outgoing invites <span className="count-chip">{outgoingInvites.length}</span></h3>
          {outgoingInvites.length === 0 ? (
            <p className="empty-state">No pending invites sent.</p>
          ) : (
            <div className="stack mini-stack">
              {outgoingInvites.map((invite) => (
                <div className="list-card" key={invite.id}>
                  <PersonIdentity profile={profilesById.get(invite.addressee_id)} />
                  <span className="pill">Waiting</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export interface MobileApprovalsPageProps {
  pendingApprovals: DebtRequest[];
  pendingSettlements: Settlement[];
  pendingItems: SharedItem[];
  profilesById: Map<string, Profile>;
  mutating: boolean;
  onRespondDebt: (id: string, approve: boolean) => void;
  onRespondSettlement: (id: string, approve: boolean) => void;
  onRespondItem: (id: string, action: "approve" | "reject" | "return_confirm") => void;
  onBack: () => void;
}

export function MobileApprovalsPage(props: MobileApprovalsPageProps) {
  const { pendingApprovals, pendingSettlements, pendingItems, profilesById, mutating, onRespondDebt, onRespondSettlement, onRespondItem, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">Back</button>
        <h2>Pending Approvals</h2>
      </div>
      <div className="mobile-page-content">
        {pendingApprovals.length === 0 && pendingSettlements.length === 0 && pendingItems.length === 0 ? (
          <p className="empty-state">No approvals waiting for you.</p>
        ) : (
          <div className="stack mini-stack">
            {pendingApprovals.map((request) => (
              <div className="list-card dense" key={request.id}>
                <div>
                  <PersonIdentity profile={profilesById.get(request.creator_id)} />
                  <p>{formatCurrency(request.amount_in_paise)} for {request.reason}</p>
                  <small>Debt date {formatDateOnly(new Date(request.debt_date))} - Due {formatDate(request.due_at)}</small>
                </div>
                <div className="row-actions">
                  <button className="primary-button compact-action-button" onClick={() => onRespondDebt(request.id, true)} disabled={mutating} type="button">Approve</button>
                  <button className="ghost-button compact-action-button" onClick={() => onRespondDebt(request.id, false)} disabled={mutating} type="button">Reject</button>
                </div>
              </div>
            ))}
            {pendingSettlements.map((settlement) => (
              <div className="list-card dense" key={settlement.id}>
                <div>
                  <PersonIdentity profile={profilesById.get(settlement.payer_id)} />
                  <p>{formatCurrency(settlement.amount_in_paise)} payment</p>
                  <small>{settlement.note || "No note"}</small>
                </div>
                <div className="row-actions">
                  <button className="primary-button compact-action-button" onClick={() => onRespondSettlement(settlement.id, true)} disabled={mutating} type="button">Approve</button>
                  <button className="ghost-button compact-action-button" onClick={() => onRespondSettlement(settlement.id, false)} disabled={mutating} type="button">Reject</button>
                </div>
              </div>
            ))}
            {pendingItems.map((item) => {
              const isReturn = item.status === "pending_return";
              return (
                <div className="list-card dense" key={item.id}>
                  <div>
                    <PersonIdentity profile={profilesById.get(item.owner_id)} />
                    <p><strong>{item.item_name}</strong> request</p>
                    <small>{isReturn ? "Wants to confirm this item was returned" : (item.type === "gave" ? "Wants to lend this to you" : "Wants to borrow this from you")}</small>
                  </div>
                  <div className="row-actions">
                    <button className="primary-button compact-action-button" onClick={() => onRespondItem(item.id, isReturn ? "return_confirm" : "approve")} disabled={mutating} type="button">
                      {isReturn ? "Confirm" : "Approve"}
                    </button>
                    <button className="ghost-button compact-action-button" onClick={() => onRespondItem(item.id, "reject")} disabled={mutating} type="button">Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileMoneyPage({ onOpenDebt, onOpenSettlement, onBack }: { onOpenDebt: () => void; onOpenSettlement: () => void; onBack: () => void }) {
  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">Back</button>
        <h2>Money Actions</h2>
      </div>
      <div className="mobile-page-content">
        <div className="mobile-action-grid">
          <button className="action-option-card" onClick={onOpenDebt} type="button">
            <span className="profile-label">Approval flow</span>
            <strong>Create debt</strong>
            <p>Log a shared expense or cash loan. Your friend approves it from their side.</p>
          </button>
          <button className="action-option-card" onClick={onOpenSettlement} type="button">
            <span className="profile-label">Direct payment</span>
            <strong>Record settlement</strong>
            <p>Note a payment already made outside the app so balances stay accurate.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export interface MobileItemsPageProps {
  sharedItems: SharedItem[];
  profiles: Profile[];
  userId: string;
  onOpenItemsDialog: () => void;
  onOpenApprovals: () => void;
  onCancelItem: (id: string) => void;
  onRequestReturn: (id: string, e?: React.MouseEvent) => void;
  onBack: () => void;
}

export function MobileItemsPage(props: MobileItemsPageProps) {
  const { sharedItems, profiles, userId, onOpenItemsDialog, onOpenApprovals, onCancelItem, onRequestReturn, onBack } = props;

  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">Back</button>
        <h2>Shared Items</h2>
        <button className="ghost-button mobile-page-add-button" onClick={onOpenItemsDialog} type="button">+</button>
      </div>
      <div className="mobile-page-content">
        {sharedItems.length === 0 ? (
          <p className="empty-state">No shared items tracked.</p>
        ) : (
          <div className="stack mini-stack">
            {sharedItems.map((item) => (
              <div className="list-card dense item-row-card" key={item.id}>
                <div>
                  <div className="item-row-header">
                    <strong>{item.item_name}</strong>
                    <span className={`pill pill-tiny status-${item.status}`}>{item.status}</span>
                  </div>
                  <p className="muted item-row-copy">
                    {item.type === "gave" ? "Lent to" : "Borrowed from"} {profiles.find((p) => p.id === item.friend_id)?.full_name || "friend"}
                  </p>
                </div>
                <div className="row-actions">
                  {item.status === "pending" && item.owner_id === userId && (
                    <button className="ghost-button danger-ghost-button compact-action-button" onClick={() => onCancelItem(item.id)} type="button">Cancel</button>
                  )}
                  {item.status === "active" && (
                    ((item.type === "gave" && item.friend_id === userId) || (item.type === "borrowed" && item.owner_id === userId)) ? (
                      <button className="ghost-button compact-action-button" onClick={(e) => onRequestReturn(item.id, e)} type="button">Return</button>
                    ) : null
                  )}
                  {((item.status === "pending" && item.friend_id === userId) || (item.status === "pending_return" && item.owner_id === userId)) && (
                    <button className="ghost-button compact-action-button review-link-button" onClick={onOpenApprovals} type="button">Review</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileActivityPage({ recentActivity, onBack }: { recentActivity: ActivityItem[]; onBack: () => void }) {
  return (
    <div className="mobile-page mobile-only">
      <div className="mobile-page-header">
        <button className="mobile-back-btn" onClick={onBack} type="button">Back</button>
        <h2>Recent Activity</h2>
      </div>
      <div className="mobile-page-content">
        {recentActivity.length === 0 ? (
          <p className="empty-state">No activity yet.</p>
        ) : (
          <div className="stack mini-stack">
            {recentActivity.map((item) => (
              <div className="list-card dense" key={`${item.kind}-${item.id}`}>
                <div className="person-block">
                  <PersonIdentity profile={item.profile} />
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                  <small>{formatDateTime(new Date(item.createdAt))}</small>
                </div>
                <div className="activity-side">
                  <span className="amount-badge neutral">{formatCurrency(item.amountInPaise)}</span>
                  <span className={`pill status-${item.status}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
