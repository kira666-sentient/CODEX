"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getAppOrigin,
  getSupabaseBrowserClient,
  hasSupabaseEnv
} from "@/lib/supabase";
import type {
  DebtRequest,
  Friendship,
  Profile,
  Settlement
} from "@/lib/app-types";

type FriendSummary = {
  friendshipId: string;
  profile: Profile;
  balanceInPaise: number;
};

type ActivityItem = {
  id: string;
  kind: "debt" | "settlement";
  createdAt: string;
  profile: Profile | null;
  label: string;
  detail: string;
  status: string;
  amountInPaise: number;
};

type StatementEntry = {
  id: string;
  createdAt: string;
  kind: "debt" | "settlement";
  title: string;
  detail: string;
  status: string;
  amountInPaise: number;
  balanceDeltaInPaise: number;
};

type DashboardData = {
  profile: Profile | null;
  friendships: Friendship[];
  profiles: Profile[];
  debtRequests: DebtRequest[];
  settlements: Settlement[];
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium"
});

function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return dateTime.format(new Date(value));
}

function formatUsernameCandidate(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function makeStarterUsername(user: User) {
  const emailPart = user.email?.split("@")[0] ?? "friend";
  const base = formatUsernameCandidate(emailPart) || "friend";
  const suffix = user.id.replace(/-/g, "").slice(0, 4);
  return `${base}_${suffix}`;
}

function readableProfile(profile?: Profile | null) {
  return profile?.full_name || profile?.username || "Friend";
}

function initialsFor(profile?: Profile | null) {
  const source = readableProfile(profile).trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "FB";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getErrorMessage(cause: unknown) {
  if (typeof cause === "string") {
    return cause;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  return "Something went wrong. Please try again.";
}

export default function FnbApp() {
  const supabase = getSupabaseBrowserClient();
  const envReady = hasSupabaseEnv();

  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUsername, startSavingUsername] = useTransition();
  const [mutating, startMutation] = useTransition();

  const [dashboard, setDashboard] = useState<DashboardData>({
    profile: null,
    friendships: [],
    profiles: [],
    debtRequests: [],
    settlements: []
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [debtForm, setDebtForm] = useState({
    friendId: "",
    amount: "",
    reason: "",
    debtDate: new Date().toISOString().slice(0, 10),
    dueAt: ""
  });
  const [settlementForm, setSettlementForm] = useState({
    friendId: "",
    amount: "",
    note: ""
  });
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState("");

  function openProfileDialog() {
    setUsernameDraft(dashboard.profile?.username ?? "");
    setIsProfileDialogOpen(true);
  }

  function openStatementDialog(friendId: string) {
    setSelectedFriendId(friendId);
    setIsStatementDialogOpen(true);
  }

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setBooting(false);
      return;
    }

    const readyClient = client;

    let active = true;

    async function bootstrap() {
      const {
        data: { session: currentSession }
      } = await readyClient.auth.getSession();

      if (!active) {
        return;
      }

      setSession(currentSession);

      if (currentSession?.user) {
        await ensureProfile(currentSession.user);
        await loadDashboard(currentSession.user.id);
      }

      if (active) {
        setBooting(false);
      }
    }

    bootstrap().catch((cause: unknown) => {
      if (active) {
        setError(getErrorMessage(cause));
        setBooting(false);
      }
    });

    const {
      data: { subscription }
    } = readyClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event !== "TOKEN_REFRESHED") {
        setError(null);
        setFeedback(null);
      }

      if (!nextSession?.user) {
        setDashboard({
          profile: null,
          friendships: [],
          profiles: [],
          debtRequests: [],
          settlements: []
        });
        return;
      }

      const shouldSyncProfile =
        event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION";

      void (async () => {
        try {
          if (shouldSyncProfile) {
            await ensureProfile(nextSession.user);
          }

          await loadDashboard(nextSession.user.id, { silent: true });
        } catch (cause: unknown) {
          setError(getErrorMessage(cause));
        }
      })();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const refreshSilently = () => {
      void loadDashboard(session.user.id, { silent: true }).catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
    };

    const intervalId = window.setInterval(refreshSilently, 5000);

    const handleFocus = () => {
      refreshSilently();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.user?.id]);

  async function ensureProfile(user: User) {
    const client = supabase;

    if (!client) {
      return;
    }

    const profilePayload = {
      id: user.id,
      full_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ??
        "Friend",
      avatar_url: user.user_metadata?.avatar_url ?? null
    };

    const { error: upsertError } = await client
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }

    const { data: existingProfile, error: readError } = await client
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .single();

    if (readError) {
      throw readError;
    }

    if (!existingProfile.username) {
      const { error: usernameError } = await client
        .from("profiles")
        .update({ username: makeStarterUsername(user) })
        .eq("id", user.id)
        .is("username", null);

      if (usernameError) {
        throw usernameError;
      }
    }
  }

  async function loadDashboard(userId: string, options?: { silent?: boolean }) {
    const client = supabase;

    if (!client) {
      return;
    }

    const silent = options?.silent ?? false;

    if (!silent) {
      setRefreshing(true);
    }

    const [profileResult, friendshipsResult, debtsResult, settlementsResult] =
      await Promise.all([
        client
          .from("profiles")
          .select("id, username, full_name, avatar_url, created_at")
          .eq("id", userId)
          .single(),
        client
          .from("friendships")
          .select(
            "id, requester_id, addressee_id, status, created_at, responded_at"
          )
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("debt_requests")
          .select(
            "id, creator_id, approver_id, amount_in_paise, currency, reason, debt_date, due_at, status, approved_at, rejected_at, created_at"
          )
          .or(`creator_id.eq.${userId},approver_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("settlements")
          .select(
            "id, payer_id, receiver_id, amount_in_paise, currency, note, settled_at, created_at"
          )
          .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("settled_at", { ascending: false })
      ]);

    if (profileResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw profileResult.error;
    }

    if (friendshipsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw friendshipsResult.error;
    }

    if (debtsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw debtsResult.error;
    }

    if (settlementsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw settlementsResult.error;
    }

    const friendships = (friendshipsResult.data ?? []) as Friendship[];
    const debtRequests = (debtsResult.data ?? []) as DebtRequest[];
    const settlements = (settlementsResult.data ?? []) as Settlement[];

    const relatedProfileIds = new Set<string>();

    friendships.forEach((friendship) => {
      relatedProfileIds.add(friendship.requester_id);
      relatedProfileIds.add(friendship.addressee_id);
    });

    debtRequests.forEach((request) => {
      relatedProfileIds.add(request.creator_id);
      relatedProfileIds.add(request.approver_id);
    });

    settlements.forEach((settlement) => {
      relatedProfileIds.add(settlement.payer_id);
      relatedProfileIds.add(settlement.receiver_id);
    });

    const ids = [...relatedProfileIds];
    let profiles: Profile[] = [];

    if (ids.length > 0) {
      const profilesResult = await client
        .from("profiles")
        .select("id, username, full_name, avatar_url, created_at")
        .in("id", ids);

      if (profilesResult.error) {
        if (!silent) {
          setRefreshing(false);
        }
        throw profilesResult.error;
      }

      profiles = (profilesResult.data ?? []) as Profile[];
    }

    setDashboard({
      profile: profileResult.data as Profile,
      friendships,
      profiles,
      debtRequests,
      settlements
    });
    if (!silent) {
      setRefreshing(false);
    }
  }

  async function refreshData() {
    if (!session?.user) {
      return;
    }

    try {
      await loadDashboard(session.user.id);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    }
  }

  const profilesById = useMemo(() => {
    return new Map(dashboard.profiles.map((profile) => [profile.id, profile]));
  }, [dashboard.profiles]);

  const acceptedFriends = useMemo<FriendSummary[]>(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships
      .filter((friendship) => friendship.status === "accepted")
      .map((friendship) => {
        const friendId =
          friendship.requester_id === session.user.id
            ? friendship.addressee_id
            : friendship.requester_id;

        return {
          friendshipId: friendship.id,
          profile: profilesById.get(friendId) ?? {
            id: friendId,
            username: null,
            full_name: "Unknown friend",
            avatar_url: null
          },
          balanceInPaise: 0
        };
      });
  }, [dashboard.friendships, profilesById, session?.user]);

  const balances = useMemo(() => {
    if (!session?.user) {
      return acceptedFriends;
    }

    const byFriend = new Map(
      acceptedFriends.map((friend) => [
        friend.profile.id,
        { ...friend, balanceInPaise: 0 }
      ])
    );

    dashboard.debtRequests
      .filter((request) => request.status === "approved")
      .forEach((request) => {
        const friendId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;
        const item = byFriend.get(friendId);

        if (!item) {
          return;
        }

        item.balanceInPaise +=
          request.creator_id === session.user.id
            ? request.amount_in_paise
            : -request.amount_in_paise;
      });

    dashboard.settlements.forEach((settlement) => {
      const friendId =
        settlement.payer_id === session.user.id
          ? settlement.receiver_id
          : settlement.payer_id;
      const item = byFriend.get(friendId);

      if (!item) {
        return;
      }

      item.balanceInPaise +=
        settlement.payer_id === session.user.id
          ? settlement.amount_in_paise
          : -settlement.amount_in_paise;
    });

    return [...byFriend.values()].sort(
      (left, right) =>
        Math.abs(right.balanceInPaise) - Math.abs(left.balanceInPaise)
    );
  }, [acceptedFriends, dashboard.debtRequests, dashboard.settlements, session?.user]);

  useEffect(() => {
    if (balances.length === 0) {
      setSelectedFriendId("");
      return;
    }

    const stillExists = balances.some(
      (friend) => friend.profile.id === selectedFriendId
    );

    if (!stillExists) {
      setSelectedFriendId(balances[0].profile.id);
    }
  }, [balances, selectedFriendId]);

  const selectedFriend = useMemo(() => {
    return balances.find((friend) => friend.profile.id === selectedFriendId) ?? null;
  }, [balances, selectedFriendId]);

  const friendStatement = useMemo<StatementEntry[]>(() => {
    if (!session?.user || !selectedFriend) {
      return [];
    }

    const friendId = selectedFriend.profile.id;
    const statementFromDebts = dashboard.debtRequests
      .filter((request) => {
        const otherId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;

        return otherId === friendId;
      })
      .map((request) => ({
        id: request.id,
        createdAt: request.created_at,
        kind: "debt" as const,
        title:
          request.creator_id === session.user.id
            ? `You logged a debt for ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} logged a debt for you`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise,
        balanceDeltaInPaise:
          request.status === "approved"
            ? request.creator_id === session.user.id
              ? request.amount_in_paise
              : -request.amount_in_paise
            : 0
      }));

    const statementFromSettlements = dashboard.settlements
      .filter((settlement) => {
        const otherId =
          settlement.payer_id === session.user.id
            ? settlement.receiver_id
            : settlement.payer_id;

        return otherId === friendId;
      })
      .map((settlement) => ({
        id: settlement.id,
        createdAt: settlement.settled_at,
        kind: "settlement" as const,
        title:
          settlement.payer_id === session.user.id
            ? `You paid ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: "settled",
        amountInPaise: settlement.amount_in_paise,
        balanceDeltaInPaise:
          settlement.payer_id === session.user.id
            ? settlement.amount_in_paise
            : -settlement.amount_in_paise
      }));

    return [...statementFromDebts, ...statementFromSettlements].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [
    dashboard.debtRequests,
    dashboard.settlements,
    selectedFriend,
    session?.user
  ]);

  const incomingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.addressee_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const outgoingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.requester_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const pendingApprovals = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.debtRequests.filter(
      (request) =>
        request.status === "pending" && request.approver_id === session.user.id
    );
  }, [dashboard.debtRequests, session?.user]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    if (!session?.user) {
      return [];
    }

    const debtItems = dashboard.debtRequests.map((request) => {
      const otherProfile = profilesById.get(
        request.creator_id === session.user.id
          ? request.approver_id
          : request.creator_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: request.id,
        kind: "debt" as const,
        createdAt: request.created_at,
        profile: otherProfile ?? null,
        label:
          request.creator_id === session.user.id
            ? `${otherName} owes you`
            : `You owe ${otherName}`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise
      };
    });

    const settlementItems = dashboard.settlements.map((settlement) => {
      const otherProfile = profilesById.get(
        settlement.payer_id === session.user.id
          ? settlement.receiver_id
          : settlement.payer_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: settlement.id,
        kind: "settlement" as const,
        createdAt: settlement.settled_at,
        profile: otherProfile ?? null,
        label:
          settlement.payer_id === session.user.id
            ? `You paid ${otherName}`
            : `${otherName} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: "settled",
        amountInPaise: settlement.amount_in_paise
      };
    });

    return [...debtItems, ...settlementItems]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 10);
  }, [dashboard.debtRequests, dashboard.settlements, profilesById, session?.user]);

  const totalOwedToYou = balances.reduce((sum, friend) => {
    return friend.balanceInPaise > 0 ? sum + friend.balanceInPaise : sum;
  }, 0);

  const totalYouOwe = balances.reduce((sum, friend) => {
    return friend.balanceInPaise < 0 ? sum + Math.abs(friend.balanceInPaise) : sum;
  }, 0);

  async function signInWithGoogle() {
    const client = supabase;

    if (!client) {
      return;
    }

    setError(null);
    const redirectTo = getAppOrigin();

    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signOut() {
    const client = supabase;

    if (!client) {
      return;
    }

    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }

  function resetMessages() {
    setError(null);
    setFeedback(null);
  }

  function setFailure(cause: unknown) {
    setFeedback(null);
    setError(getErrorMessage(cause));
  }

  async function saveUsername() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const sanitized = formatUsernameCandidate(usernameDraft);

    if (!sanitized || sanitized.length < 3) {
      setError("Pick a username with at least 3 letters or numbers.");
      return;
    }

    resetMessages();

    startSavingUsername(async () => {
      const { error: updateError } = await readyClient
        .from("profiles")
        .update({ username: sanitized })
        .eq("id", session.user.id);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback("Username updated.");
      setIsProfileDialogOpen(false);
      await refreshData();
    });
  }

  async function sendInvite() {
    const client = supabase;

    if (!client || !session?.user || !dashboard.profile) {
      return;
    }

    const readyClient = client;

    const username = formatUsernameCandidate(inviteUsername);

    if (!username) {
      setError("Enter your friend's username.");
      return;
    }

    if (username === dashboard.profile.username) {
      setError("You cannot invite yourself.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { data: targetProfile, error: targetError } = await readyClient
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("username", username)
        .single();

      if (targetError || !targetProfile) {
        setFailure("That username was not found.");
        return;
      }

      const { data: existing, error: existingError } = await readyClient
        .from("friendships")
        .select("id, status")
        .or(
          `and(requester_id.eq.${session.user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${session.user.id})`
        )
        .limit(1);

      if (existingError) {
        setFailure(existingError);
        return;
      }

      if ((existing ?? []).length > 0) {
        setFailure("A friend request or friendship already exists.");
        return;
      }

      const { error: insertError } = await readyClient.from("friendships").insert({
        requester_id: session.user.id,
        addressee_id: targetProfile.id,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setInviteUsername("");
      setFeedback(`Invite sent to @${targetProfile.username}.`);
      await refreshData();
    });
  }

  async function respondToInvite(friendshipId: string, accept: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const patch = accept
        ? { status: "accepted", responded_at: new Date().toISOString() }
        : { status: "blocked", responded_at: new Date().toISOString() };

      const { error: updateError } = await readyClient
        .from("friendships")
        .update(patch)
        .eq("id", friendshipId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(accept ? "Friend request accepted." : "Friend request declined.");
      await refreshData();
    });
  }

  async function createDebt() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(debtForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!debtForm.friendId) {
      setError("Choose a friend first.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    if (!debtForm.reason.trim()) {
      setError("Add a reason so both sides understand the debt.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("debt_requests").insert({
        creator_id: session.user.id,
        approver_id: debtForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        reason: debtForm.reason.trim(),
        debt_date: debtForm.debtDate,
        due_at: debtForm.dueAt ? new Date(debtForm.dueAt).toISOString() : null,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setDebtForm({
        friendId: "",
        amount: "",
        reason: "",
        debtDate: new Date().toISOString().slice(0, 10),
        dueAt: ""
      });
      setIsDebtDialogOpen(false);
      setFeedback("Debt request created and waiting for approval.");
      await refreshData();
    });
  }

  async function respondToDebt(requestId: string, approve: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const { error: updateError } = await readyClient
        .from("debt_requests")
        .update(
          approve
            ? { status: "approved", approved_at: new Date().toISOString() }
            : { status: "rejected", rejected_at: new Date().toISOString() }
        )
        .eq("id", requestId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(approve ? "Debt approved." : "Debt rejected.");
      await refreshData();
    });
  }

  async function createSettlement() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(settlementForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!settlementForm.friendId) {
      setError("Choose who received the payment.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid settlement amount.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("settlements").insert({
        payer_id: session.user.id,
        receiver_id: settlementForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        note: settlementForm.note.trim() || null
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setSettlementForm({
        friendId: "",
        amount: "",
        note: ""
      });
      setIsSettlementDialogOpen(false);
      setFeedback("Settlement recorded.");
      await refreshData();
    });
  }

  const profileNeedsSetup =
    !dashboard.profile?.username || dashboard.profile.username.length < 3;
  const debtFriendSelected = Boolean(debtForm.friendId);
  const settlementFriendSelected = Boolean(settlementForm.friendId);

  useEffect(() => {
    if (!booting && session?.user && dashboard.profile && profileNeedsSetup) {
      setUsernameDraft(dashboard.profile?.username ?? "");
      setIsProfileDialogOpen(true);
    }
  }, [booting, dashboard.profile, profileNeedsSetup, session?.user]);

  useEffect(() => {
    if (!isProfileDialogOpen) {
      setUsernameDraft(dashboard.profile?.username ?? "");
    }
  }, [dashboard.profile?.username, isProfileDialogOpen]);

  if (!envReady) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Setup required</p>
          <h1>Connect Supabase to launch F&B</h1>
          <p className="lede">
            Add your Supabase URL and anon key in <code>.env.local</code>, then
            enable Google auth in the Supabase dashboard.
          </p>
          <div className="panel inline-panel">
            <p>Required variables:</p>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </div>
        </section>
      </main>
    );
  }

  if (booting) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">F&B</p>
          <h1>Loading your balances</h1>
          <p className="lede">
            Pulling your session, profile, friends, debts, and settlements.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell landing-shell">
        <div aria-hidden="true" className="landing-world">
          <div className="landing-world-side landing-world-left">
            <LandingBearScene />
          </div>
          <div className="landing-world-side landing-world-right">
            <LandingWaterfallScene />
          </div>
        </div>

        <section className="hero landing-hero">
          <div className="landing-hero-copy">
            <p className="eyebrow">F&B</p>
            <h1 className="landing-title">
              <span>Track</span>
              <span>shared</span>
              <span>money</span>
              <span>without</span>
              <span>making</span>
              <span>friendships</span>
              <span>awkward.</span>
            </h1>
            <p className="lede">
              F&B keeps every split, payback, and approval in one place so both
              sides always see the same story.
            </p>

            <div className="landing-cta-stack">
              <button
                className="primary-button landing-google-button"
                onClick={signInWithGoogle}
                type="button"
              >
                Continue with Google
              </button>
              <div className="landing-cta-note">
                <span className="label">Fast start</span>
                <strong>Sign in, pick a username, invite your first friend.</strong>
              </div>
            </div>

            <div className="hero-card landing-meta-grid">
              <div>
                <span className="label">Approvals</span>
                <strong>Both sides stay aligned</strong>
              </div>
              <div>
                <span className="label">Money actions</span>
                <strong>Debts and settlements in dialogs</strong>
              </div>
              <div>
                <span className="label">Where it works</span>
                <strong>Stable on phone and desktop</strong>
              </div>
            </div>
          </div>

          <div className="landing-preview-card">
            <div className="landing-preview-head">
              <div>
                <span className="profile-label">Live with less chaos</span>
                <h2>One dashboard, clear next actions</h2>
              </div>
              <span className="pill">Warm by design</span>
            </div>

            <div className="landing-preview-dashboard">
              <article className="landing-preview-focus-card">
                <div className="landing-preview-focus-copy">
                  <span className="label">Pending approval</span>
                  <strong>Cab ride home</strong>
                  <p>
                    Arjun logged tonight&apos;s ride. Review it before it lands in the
                    balance.
                  </p>
                </div>

                <div className="landing-preview-focus-side">
                  <span className="amount-badge neutral">{formatCurrency(46000)}</span>
                  <div className="landing-preview-decision-row">
                    <span className="landing-preview-decision landing-preview-decision-approve">
                      Approve
                    </span>
                    <span className="landing-preview-decision landing-preview-decision-reject">
                      Reject
                    </span>
                  </div>
                </div>
              </article>

              <div className="landing-preview-main-grid">
                <article className="landing-preview-tile landing-preview-balance-tile">
                  <span className="label">Live balance</span>
                  <strong>You are up {formatCurrency(124000)}</strong>
                  <p>Dinner is approved. Movie tickets are still waiting on one reply.</p>
                  <div className="landing-preview-balance-bar">
                    <span className="landing-preview-balance-fill" />
                  </div>
                </article>

                <article className="landing-preview-tile landing-preview-network-tile">
                  <span className="label">Network</span>
                  <strong>4 friends connected</strong>
                  <div className="landing-preview-avatars">
                    <span>NK</span>
                    <span>AR</span>
                    <span>SM</span>
                    <span>+1</span>
                  </div>
                  <p>Invite by username and open statements only when you need detail.</p>
                </article>
              </div>

              <div className="landing-preview-activity-list">
                <div className="landing-preview-activity-row">
                  <div>
                    <strong>Dinner split</strong>
                    <p>Neha owes you</p>
                  </div>
                  <span className="amount-badge positive">{formatCurrency(124000)}</span>
                </div>
                <div className="landing-preview-activity-row">
                  <div>
                    <strong>Recent activity</strong>
                    <p>UPI payback recorded after lunch</p>
                  </div>
                  <span className="pill status-approved">settled</span>
                </div>
                <div className="landing-preview-activity-row">
                  <div>
                    <strong>Invite flow</strong>
                    <p>@riya.m is waiting for your invite to land</p>
                  </div>
                  <span className="pill status-pending">sent</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="landing-scroll-cue">
          <span className="landing-scroll-dot" />
          Scroll the flow
        </div>

        <section className="landing-grid">
          <article className="panel landing-panel landing-story-panel">
            <div className="section-head landing-section-head">
              <div>
                <p className="eyebrow">Scroll the flow</p>
                <h2>A debt turns into clarity in three calm beats.</h2>
                <p className="muted landing-panel-lede">
                  The app does less talking and more organizing, so the next move is
                  always obvious.
                </p>
              </div>
            </div>

            <div className="landing-feature-list">
              <div className="landing-feature-item">
                <span className="landing-feature-step">01</span>
                <div>
                  <strong>Add people by username</strong>
                  <p>Your network stays intentional, searchable, and free of contact-list mess.</p>
                </div>
              </div>
              <div className="landing-feature-item">
                <span className="landing-feature-step">02</span>
                <div>
                  <strong>Approve before it affects the balance</strong>
                  <p>Nothing becomes truth until the other side confirms it.</p>
                </div>
              </div>
              <div className="landing-feature-item">
                <span className="landing-feature-step">03</span>
                <div>
                  <strong>Record settlements after payment happens</strong>
                  <p>Once someone pays back, the balance closes cleanly without extra drama.</p>
                </div>
              </div>
            </div>
          </article>

          <article className="panel landing-panel landing-panel-soft landing-proof-panel">
            <div className="section-head landing-section-head">
              <div>
                <p className="eyebrow">What stays visible</p>
                <h2>The dashboard keeps the next move in plain sight.</h2>
                <p className="muted landing-panel-lede">
                  Strong hierarchy up top, calm detail below, and dialogs whenever the
                  page should stay stable.
                </p>
              </div>
            </div>

            <div className="landing-check-grid">
              <div className="landing-check-card">
                <strong>Profile strip</strong>
                <p>Your identity lives below the header, where it is visible but not noisy.</p>
              </div>
              <div className="landing-check-card">
                <strong>Money actions</strong>
                <p>Debt and settlement flows stay inside dialogs so the main layout never jumps.</p>
              </div>
              <div className="landing-check-card">
                <strong>Right-column focus</strong>
                <p>Pending approvals and recent activity stay easy to scan at a glance.</p>
              </div>
              <div className="landing-check-card">
                <strong>Friend statements</strong>
                <p>Open the full history with one person only when you actually want the detail.</p>
              </div>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="shell app-shell">
      <section className="topbar">
        <div className="topbar-main">
          <div className="identity-lockup">
            <img className="brand-logo" src="/fnb-logo.svg" alt="F&B logo" />
            <div className="brand-copy">
              <p className="eyebrow">F&B</p>
              <h1 className="app-title">Friends and Benefits</h1>
            </div>
          </div>
        </div>
      </section>

      {(error || feedback) && (
        <section className={`banner ${error ? "error-banner" : "success-banner"}`}>
          <p>{error ?? feedback}</p>
        </section>
      )}

      <section className="profile-strip">
        <div className="profile-strip-identity">
          <Avatar profile={dashboard.profile} size="medium" />
          <div className="profile-strip-copy">
            <span className="profile-label">Your profile</span>
            <strong>{dashboard.profile?.full_name ?? session.user.email}</strong>
            <p>@{dashboard.profile?.username ?? "not-set"}</p>
          </div>
        </div>

        <div className="profile-strip-actions">
          <button
            className="primary-button profile-strip-button"
            onClick={openProfileDialog}
            type="button"
          >
            Edit profile
          </button>
          <button
            aria-busy={refreshing}
            aria-label={refreshing ? "Refreshing data" : "Refresh data"}
            className={`ghost-button topbar-icon-button refresh-button ${
              refreshing ? "button-is-loading" : ""
            }`}
            onClick={refreshData}
            disabled={refreshing}
            title="Refresh"
            type="button"
          >
            <RefreshIcon />
          </button>
          <button
            className="ghost-button danger-ghost-button topbar-compact-button topbar-signout-button"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </section>

      {isProfileDialogOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsProfileDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>{profileNeedsSetup ? "Finish your profile" : "Your profile"}</h2>
                <p className="muted">
                  {profileNeedsSetup
                    ? "We generated a starter username, but you should pick one your friends can type easily."
                    : "This username is what your friends use to find you. You can change it anytime."}
                </p>
              </div>
              <button
                aria-label="Close profile dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsProfileDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="dialog-profile">
              <Avatar profile={dashboard.profile} size="large" />
              <div>
                <strong>{readableProfile(dashboard.profile)}</strong>
                <p className="muted">@{dashboard.profile?.username ?? "not-set"}</p>
              </div>
            </div>

            <div className="form-grid compact-grid">
              <label>
                <span>Username</span>
                <input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  placeholder="for example: kiran_07"
                />
              </label>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                onClick={saveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? "Saving..." : "Save username"}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="stat-grid">
        <article className="stat-card">
          <span>Total friends</span>
          <strong>{balances.length}</strong>
        </article>
        <article className="stat-card success">
          <span>They owe you</span>
          <strong>{formatCurrency(totalOwedToYou)}</strong>
        </article>
        <article className="stat-card warning">
          <span>You owe</span>
          <strong>{formatCurrency(totalYouOwe)}</strong>
        </article>
        <article className="stat-card">
          <span>Pending approvals</span>
          <strong>{pendingApprovals.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-column">
          <article className="panel">
            <div className="section-head">
              <div>
                <h2>Invite friend</h2>
                <p className="muted">
                  Invite friends by their F&B username. Yours is @
                  {dashboard.profile?.username ?? "not-set"}.
                </p>
              </div>
            </div>

            <div className="form-grid compact-grid">
              <label className="field-no-label">
                <input
                  aria-label="Invite by username"
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                  placeholder="friend_username"
                />
              </label>
            </div>

            <div className="action-row">
              <button className="primary-button" onClick={sendInvite} disabled={mutating}>
                Send invite
              </button>
            </div>
          </article>

          <article className="panel panel-network">
            <div className="section-head">
              <div>
                <h2>Your network</h2>
                <p className="muted">
                  Friends, incoming invites, and outgoing requests stay organized here.
                </p>
              </div>
            </div>

            <div className="panel-scroll panel-scroll-network">
              <div className="section-stack">
                <section className="subpanel">
                  <div className="subpanel-head">
                    <h3>Your friends</h3>
                    <span className="count-chip">{balances.length}</span>
                  </div>
                  {balances.length === 0 ? (
                    <p className="empty-state">No accepted friends yet.</p>
                  ) : (
                    <div className="stack mini-stack">
                      {balances.map((friend) => (
                        <button
                          className={`friend-card ${
                            selectedFriendId === friend.profile.id ? "friend-card-active" : ""
                          }`}
                          key={friend.friendshipId}
                          onClick={() => openStatementDialog(friend.profile.id)}
                        >
                          <PersonIdentity profile={friend.profile} />
                          <div className="friend-card-side">
                            <span
                              className={`amount-badge ${
                                friend.balanceInPaise > 0
                                  ? "positive"
                                  : friend.balanceInPaise < 0
                                    ? "negative"
                                    : ""
                              }`}
                            >
                              {formatCurrency(friend.balanceInPaise)}
                            </span>
                            <small>View statement</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="subpanel">
                  <div className="subpanel-head">
                    <h3>Incoming invites</h3>
                    <span className="count-chip">{incomingInvites.length}</span>
                  </div>
                  {incomingInvites.length === 0 ? (
                    <p className="empty-state">No incoming invites right now.</p>
                  ) : (
                    <div className="stack mini-stack">
                      {incomingInvites.map((invite) => {
                        const friend = profilesById.get(invite.requester_id);

                        return (
                          <div className="list-card" key={invite.id}>
                            <PersonIdentity profile={friend} />
                            <div className="row-actions">
                              <button
                                className="primary-button"
                                onClick={() => respondToInvite(invite.id, true)}
                                disabled={mutating}
                              >
                                Accept
                              </button>
                              <button
                                className="ghost-button"
                                onClick={() => respondToInvite(invite.id, false)}
                                disabled={mutating}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="subpanel">
                  <div className="subpanel-head">
                    <h3>Outgoing invites</h3>
                    <span className="count-chip">{outgoingInvites.length}</span>
                  </div>
                  {outgoingInvites.length === 0 ? (
                    <p className="empty-state">No pending invites sent.</p>
                  ) : (
                    <div className="stack mini-stack">
                      {outgoingInvites.map((invite) => {
                        const friend = profilesById.get(invite.addressee_id);

                        return (
                          <div className="list-card" key={invite.id}>
                            <PersonIdentity profile={friend} />
                            <span className="pill">Waiting</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </article>
        </div>

        <div className="dashboard-column">
          <article className="panel panel-money">
            <div className="section-head">
              <div>
                <h2>Money actions</h2>
                <p className="muted">
                  Open a focused flow for either creating a debt or recording a direct
                  settlement.
                </p>
              </div>
            </div>

            <div className="action-option-grid">
              <button
                className="action-option-card"
                onClick={() => setIsDebtDialogOpen(true)}
                type="button"
              >
                <span className="profile-label">Approval flow</span>
                <strong>Create debt</strong>
                <p>
                  Log a shared expense or cash loan. Your friend approves it from their
                  side.
                </p>
              </button>

              <button
                className="action-option-card"
                onClick={() => setIsSettlementDialogOpen(true)}
                type="button"
              >
                <span className="profile-label">Direct payment</span>
                <strong>Record settlement</strong>
                <p>
                  Note a payment already made outside the app so balances stay accurate.
                </p>
              </button>
            </div>
          </article>

          <section className="panel inbox-panel">
            <div className="section-head">
              <div>
                <h2>Pending approvals</h2>
                <p className="muted">These requests need your decision.</p>
              </div>
              <span className="count-chip count-chip-strong">{pendingApprovals.length}</span>
            </div>

            {pendingApprovals.length === 0 ? (
              <p className="empty-state">No debt approvals waiting for you.</p>
            ) : (
              <div className="panel-scroll panel-scroll-approvals">
                <div className="stack mini-stack">
                  {pendingApprovals.map((request) => {
                    const creator = profilesById.get(request.creator_id);

                    return (
                      <div className="list-card dense" key={request.id}>
                        <div>
                          <PersonIdentity profile={creator} />
                          <p>
                            {formatCurrency(request.amount_in_paise)} for {request.reason}
                          </p>
                          <small>
                            Debt date {dateOnly.format(new Date(request.debt_date))} - Due{" "}
                            {formatDate(request.due_at)}
                          </small>
                        </div>
                        <div className="row-actions">
                          <button
                            className="primary-button"
                            onClick={() => respondToDebt(request.id, true)}
                            disabled={mutating}
                          >
                            Approve
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => respondToDebt(request.id, false)}
                            disabled={mutating}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="panel activity-panel">
            <div className="section-head">
              <div>
                <h2>Recent activity</h2>
                <p className="muted">Latest debts and settlements across your network.</p>
              </div>
            </div>

            {recentActivity.length === 0 ? (
              <p className="empty-state">No activity yet.</p>
            ) : (
              <div className="panel-scroll panel-scroll-activity">
                <div className="stack mini-stack">
                  {recentActivity.map((item) => (
                    <div className="list-card dense" key={`${item.kind}-${item.id}`}>
                      <div className="person-block">
                        <PersonIdentity profile={item.profile} />
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                        <small>{dateTime.format(new Date(item.createdAt))}</small>
                      </div>
                      <div className="activity-side">
                        <span className="amount-badge neutral">
                          {formatCurrency(item.amountInPaise)}
                        </span>
                        <span className={`pill status-${item.status}`}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      {isDebtDialogOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsDebtDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card form-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>Create debt</h2>
                <p className="muted">
                  Log a debt request, then let your friend approve it from their side.
                </p>
              </div>
              <button
                aria-label="Close create debt dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsDebtDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="dialog-body">
              <div className="form-grid compact-grid">
                <label>
                  <span>Friend</span>
                  <FriendPicker
                    friends={balances}
                    selectedId={debtForm.friendId}
                    onSelect={(friendId) =>
                      setDebtForm((current) => ({
                        ...current,
                        friendId
                      }))
                    }
                    placeholder="Choose a friend"
                  />
                </label>
              </div>

              {balances.length === 0 ? (
                <p className="empty-state action-hint">
                  Add a friend first, then you can create a debt request here.
                </p>
              ) : debtFriendSelected ? (
                <>
                  <div className="hint-banner">
                    Fill in the amount, date, and reason once you know who this is for.
                  </div>
                  <div className="form-grid">
                    <label>
                      <span>Amount in INR</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={debtForm.amount}
                        onChange={(event) =>
                          setDebtForm((current) => ({
                            ...current,
                            amount: event.target.value
                          }))
                        }
                        placeholder="200"
                      />
                    </label>

                    <label>
                      <span>Date</span>
                      <input
                        type="date"
                        value={debtForm.debtDate}
                        onChange={(event) =>
                          setDebtForm((current) => ({
                            ...current,
                            debtDate: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label>
                      <span>Return by</span>
                      <input
                        type="datetime-local"
                        value={debtForm.dueAt}
                        onChange={(event) =>
                          setDebtForm((current) => ({
                            ...current,
                            dueAt: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="full-span">
                      <span>Reason</span>
                      <textarea
                        rows={3}
                        value={debtForm.reason}
                        onChange={(event) =>
                          setDebtForm((current) => ({
                            ...current,
                            reason: event.target.value
                          }))
                        }
                        placeholder="Auto fare, dinner, movie tickets, cash loan..."
                      />
                    </label>
                  </div>

                  <div className="action-row">
                    <button
                      className="primary-button"
                      onClick={createDebt}
                      disabled={mutating}
                    >
                      Create debt request
                    </button>
                  </div>
                </>
              ) : (
                <p className="empty-state action-hint">
                  Choose a friend to reveal the debt form.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {isSettlementDialogOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsSettlementDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card form-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>Record settlement</h2>
                <p className="muted">
                  Note a payment already made directly outside the app.
                </p>
              </div>
              <button
                aria-label="Close settlement dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsSettlementDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="dialog-body">
              <div className="form-grid compact-grid">
                <label>
                  <span>Paid to</span>
                  <FriendPicker
                    friends={balances}
                    selectedId={settlementForm.friendId}
                    onSelect={(friendId) =>
                      setSettlementForm((current) => ({
                        ...current,
                        friendId
                      }))
                    }
                    placeholder="Choose a friend"
                  />
                </label>
              </div>

              {balances.length === 0 ? (
                <p className="empty-state action-hint">
                  Add a friend first, then you can record a settlement here.
                </p>
              ) : settlementFriendSelected ? (
                <>
                  <div className="hint-banner">
                    Add the amount and note only after choosing who you paid back.
                  </div>
                  <div className="form-grid compact-grid">
                    <label>
                      <span>Amount in INR</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={settlementForm.amount}
                        onChange={(event) =>
                          setSettlementForm((current) => ({
                            ...current,
                            amount: event.target.value
                          }))
                        }
                        placeholder="200"
                      />
                    </label>

                    <label className="full-span">
                      <span>Note</span>
                      <input
                        value={settlementForm.note}
                        onChange={(event) =>
                          setSettlementForm((current) => ({
                            ...current,
                            note: event.target.value
                          }))
                        }
                        placeholder="UPI transfer, cash returned, bank transfer..."
                      />
                    </label>
                  </div>

                  <div className="action-row">
                    <button
                      className="primary-button"
                      onClick={createSettlement}
                      disabled={mutating}
                    >
                      Record settlement
                    </button>
                  </div>
                </>
              ) : (
                <p className="empty-state action-hint">
                  Choose a friend to reveal the settlement form.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {isStatementDialogOpen && selectedFriend && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsStatementDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card statement-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>Statement</h2>
                <p className="muted">
                  Full record with {readableProfile(selectedFriend.profile)}.
                </p>
              </div>
              <button
                aria-label="Close statement dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsStatementDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="statement-shell">
              <div className="statement-header">
                <PersonIdentity profile={selectedFriend.profile} />
                <span
                  className={`amount-badge ${
                    selectedFriend.balanceInPaise > 0
                      ? "positive"
                      : selectedFriend.balanceInPaise < 0
                        ? "negative"
                        : ""
                  }`}
                >
                  {formatCurrency(selectedFriend.balanceInPaise)}
                </span>
              </div>

              {friendStatement.length === 0 ? (
                <p className="empty-state">No records yet with this friend.</p>
              ) : (
                <div className="statement-table-wrap">
                  <table className="statement-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Entry</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {friendStatement.map((entry) => (
                        <tr key={`${entry.kind}-${entry.id}`}>
                          <td>{dateTime.format(new Date(entry.createdAt))}</td>
                          <td>
                            <strong>{entry.title}</strong>
                            <p>{entry.detail}</p>
                          </td>
                          <td>
                            <span className={`pill status-${entry.status}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td>
                            <div className="statement-amounts">
                              <strong>{formatCurrency(entry.amountInPaise)}</strong>
                              <small>
                                Balance impact {formatCurrency(entry.balanceDeltaInPaise)}
                              </small>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

    </main>
  );
}

function Avatar({
  profile,
  size = "medium"
}: {
  profile?: Profile | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <div className={`avatar avatar-${size}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={readableProfile(profile)} />
      ) : (
        <span>{initialsFor(profile)}</span>
      )}
    </div>
  );
}

function LandingBearScene() {
  return (
    <svg
      aria-hidden="true"
      className="landing-scene-svg"
      fill="none"
      focusable="false"
      viewBox="0 0 440 560"
    >
      <ellipse
        cx="214"
        cy="504"
        fill="rgba(89, 130, 87, 0.18)"
        rx="164"
        ry="36"
      />
      <rect
        className="scene-tree-trunk"
        fill="#8f5d3b"
        height="220"
        rx="34"
        width="74"
        x="84"
        y="164"
      />
      <g className="scene-tree-canopy">
        <circle cx="76" cy="150" fill="#88b276" r="64" />
        <circle cx="144" cy="118" fill="#7ca56c" r="76" />
        <circle cx="220" cy="148" fill="#8fbf79" r="72" />
        <circle cx="122" cy="198" fill="#749d64" r="58" />
      </g>
      <g className="scene-leaf-group">
        <circle className="scene-leaf scene-leaf-a" cx="258" cy="142" fill="#b06d3d" r="8" />
        <circle className="scene-leaf scene-leaf-b" cx="286" cy="176" fill="#d78b4f" r="6" />
        <circle className="scene-leaf scene-leaf-c" cx="248" cy="204" fill="#e49d5e" r="5" />
      </g>
      <path
        d="M38 430c42-40 86-60 130-60 40 0 66 12 100 30 22 12 58 30 114 32v52H38z"
        fill="rgba(121, 160, 96, 0.25)"
      />
      <g className="scene-bear">
        <ellipse cx="254" cy="398" fill="#6c4a33" rx="86" ry="42" />
        <ellipse cx="320" cy="366" fill="#6c4a33" rx="40" ry="34" />
        <circle cx="338" cy="340" fill="#6c4a33" r="14" />
        <circle cx="306" cy="340" fill="#6c4a33" r="14" />
        <ellipse cx="320" cy="372" fill="#8f6444" rx="22" ry="14" />
        <circle cx="312" cy="366" fill="#1f1a14" r="3.5" />
        <circle cx="328" cy="366" fill="#1f1a14" r="3.5" />
        <path
          d="M315 377c5 4 11 4 16 0"
          stroke="#1f1a14"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <ellipse cx="204" cy="414" fill="#7f583d" rx="20" ry="14" />
        <ellipse cx="252" cy="430" fill="#7f583d" rx="20" ry="14" />
        <ellipse cx="284" cy="430" fill="#7f583d" rx="20" ry="14" />
        <ellipse cx="160" cy="392" fill="#6c4a33" rx="24" ry="20" />
      </g>
      <g className="scene-grass">
        <path
          d="M120 468c10-18 12-32 8-48 18 14 22 34 14 52"
          stroke="#6d9a5d"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          d="M144 470c14-18 18-38 14-58 18 18 22 42 8 60"
          stroke="#82ad69"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d="M338 468c-8-20-8-34-2-48-20 12-28 32-18 50"
          stroke="#7aa562"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </g>
    </svg>
  );
}

function LandingWaterfallScene() {
  return (
    <svg
      aria-hidden="true"
      className="landing-scene-svg"
      fill="none"
      focusable="false"
      viewBox="0 0 440 560"
    >
      <ellipse
        cx="236"
        cy="498"
        fill="rgba(98, 162, 185, 0.15)"
        rx="150"
        ry="34"
      />
      <path
        d="M322 74c36 34 58 86 58 144 0 66-28 130-72 182l-60-22c36-46 60-98 60-162 0-54-14-100-44-142z"
        fill="#8a816f"
      />
      <path
        d="M244 52c-18 44-28 82-28 138 0 78 18 148 54 228l-92 18c-30-84-44-150-44-232 0-60 12-110 40-160z"
        fill="#9a917e"
      />
      <path
        className="scene-waterfall-stream scene-waterfall-stream-back"
        d="M246 68c-16 46-22 84-22 136 0 86 20 166 48 250"
        stroke="#d6eef6"
        strokeLinecap="round"
        strokeWidth="38"
      />
      <path
        className="scene-waterfall-stream scene-waterfall-stream-front"
        d="M220 78c-10 40-14 72-14 122 0 86 22 162 54 244"
        stroke="#b8e6f4"
        strokeLinecap="round"
        strokeWidth="18"
      />
      <path
        className="scene-waterfall-shimmer"
        d="M196 120c8 44 8 86 14 130 8 54 24 118 56 186"
        stroke="rgba(255,255,255,0.55)"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <ellipse cx="216" cy="454" fill="#97d9e8" rx="112" ry="28" />
      <ellipse cx="230" cy="446" fill="rgba(219,244,251,0.8)" rx="78" ry="16" />
      <g className="scene-mist">
        <circle cx="150" cy="418" fill="rgba(255,255,255,0.58)" r="18" />
        <circle cx="174" cy="434" fill="rgba(255,255,255,0.42)" r="13" />
        <circle cx="272" cy="420" fill="rgba(255,255,255,0.54)" r="16" />
        <circle cx="298" cy="434" fill="rgba(255,255,255,0.36)" r="11" />
      </g>
      <g className="scene-fern">
        <path
          d="M104 476c12-18 20-40 18-64 18 18 16 48-6 70"
          stroke="#6d9a5d"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d="M84 478c6-18 6-36 0-54 18 10 24 34 12 56"
          stroke="#7eae66"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M346 478c-10-18-18-38-16-60-18 18-18 44 2 62"
          stroke="#6f9e5a"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </g>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M16.667 10a6.667 6.667 0 1 1-1.953-4.714"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M13.333 3.333h3.334v3.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PersonIdentity({ profile }: { profile?: Profile | null }) {
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

function FriendPicker({
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
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="picker-shell" ref={wrapperRef}>
      <button
        className={`picker-trigger ${open ? "picker-trigger-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedFriend ? (
          <div className="picker-value">
            <PersonIdentity profile={selectedFriend.profile} />
            <span className="picker-caret">{open ? "Hide" : "Select"}</span>
          </div>
        ) : (
          <div className="picker-value">
            <span className="picker-placeholder">{placeholder}</span>
            <span className="picker-caret">Select</span>
          </div>
        )}
      </button>

      {open && (
        <div className="picker-menu">
          {friends.length === 0 ? (
            <p className="empty-state">No friends available yet.</p>
          ) : (
            friends.map((friend) => (
              <button
                className="picker-option"
                key={friend.friendshipId}
                onClick={() => {
                  onSelect(friend.profile.id);
                  setOpen(false);
                }}
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
