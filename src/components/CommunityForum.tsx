import React, { useState, useEffect } from "react";
import {
  MessageSquare, ArrowBigUp, Plus, X, ShieldCheck, Clock,
  ChevronLeft, Send, Trash2, Users, TrendingUp, BadgeCheck
} from "lucide-react";
import { Seller, CommunityTopic, CommunityReply, COMMUNITY_CATEGORIES } from "../types";

interface CommunityForumProps {
  seller: Seller;
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function VerifiedBadge({ tier, isOfficial }: { tier?: string; isOfficial?: boolean }) {
  if (isOfficial) {
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
        <BadgeCheck className="w-2.5 h-2.5 shrink-0" />
        TamuBah Team
      </span>
    );
  }
  if (tier === "Gold") return <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "#d4af37" }} />;
  if (tier === "Silver") return <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "#c0c0c0" }} />;
  if (tier === "Bronze") return <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "#cd7f32" }} />;
  return null;
}

function Avatar({ name, logoUrl }: { name?: string; logoUrl?: string }) {
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300/60 flex items-center justify-center text-slate-800 font-bold text-xs shrink-0">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        name?.charAt(0) || "T"
      )}
    </div>
  );
}

export default function CommunityForum({ seller }: CommunityForumProps) {
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<"new" | "top">("new");

  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<CommunityTopic | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [postingReply, setPostingReply] = useState(false);

  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState(COMMUNITY_CATEGORIES[0]);
  const [postingTopic, setPostingTopic] = useState(false);

  const fetchTopics = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sellerId: seller.id, sort });
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    fetch(`/api/community/topics?${params.toString()}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load community.");
        setTopics(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!activeTopicId) fetchTopics();
  }, [categoryFilter, sort, activeTopicId]);

  const fetchTopicDetail = (topicId: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/community/topics/${topicId}?sellerId=${seller.id}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load topic.");
        setActiveTopic(data.topic);
        setReplies(data.replies);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleOpenTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    fetchTopicDetail(topicId);
  };

  const handleBackToList = () => {
    setActiveTopicId(null);
    setActiveTopic(null);
    setReplies([]);
  };

  const handleVote = async (topicId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/community/topics/${topicId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, voteCount: data.voteCount, hasVoted: data.voted } : t)));
      if (activeTopic?.id === topicId) {
        setActiveTopic({ ...activeTopic, voteCount: data.voteCount, hasVoted: data.voted });
      }
    } catch (err) {
      console.error("Failed to vote", err);
    }
  };

  const handlePostTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) {
      setError("Please fill in both a title and a description.");
      return;
    }
    setPostingTopic(true);
    setError(null);
    try {
      const res = await fetch("/api/community/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, title: newTitle, body: newBody, category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post topic.");
      setShowNewTopic(false);
      setNewTitle("");
      setNewBody("");
      setNewCategory(COMMUNITY_CATEGORIES[0]);
      fetchTopics();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingTopic(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTopicId) return;
    setPostingReply(true);
    try {
      const res = await fetch(`/api/community/topics/${activeTopicId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: seller.id, body: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply.");
      setReplies((prev) => [...prev, data.reply]);
      setReplyText("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostingReply(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm("Delete this topic and all its replies?")) return;
    try {
      await fetch(`/api/community/topics/${topicId}?sellerId=${seller.id}`, { method: "DELETE" });
      handleBackToList();
      fetchTopics();
    } catch (err) {
      console.error("Failed to delete topic", err);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!window.confirm("Delete this reply?")) return;
    try {
      await fetch(`/api/community/replies/${replyId}?sellerId=${seller.id}`, { method: "DELETE" });
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
    } catch (err) {
      console.error("Failed to delete reply", err);
    }
  };

  // ---------------- Topic detail view ----------------
  if (activeTopicId) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-4 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Community
        </button>

        {loading && !activeTopic ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : activeTopic ? (
          <>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-5">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => handleVote(activeTopic.id, e)}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      activeTopic.hasVoted ? "bg-slate-700 border-slate-700 text-white" : "border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <ArrowBigUp className="w-4 h-4" fill={activeTopic.hasVoted ? "currentColor" : "none"} />
                  </button>
                  <span className="text-xs font-bold text-slate-700">{activeTopic.voteCount}</span>
                </div>

                <div className="flex-grow min-w-0">
                  <span className="inline-block bg-slate-100 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide mb-2">
                    {activeTopic.category}
                  </span>
                  <h1 className="text-xl font-extrabold text-slate-900 mb-3 leading-snug">{activeTopic.title}</h1>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">{activeTopic.body}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar name={activeTopic.businessName} logoUrl={activeTopic.sellerLogoUrl} />
                      <div>
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          {activeTopic.businessName}
                          <VerifiedBadge tier={activeTopic.sellerVerificationTier} isOfficial={activeTopic.sellerIsOfficial} />
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {timeAgo(activeTopic.createdAt)}
                        </span>
                      </div>
                    </div>
                    {activeTopic.sellerId === seller.id && (
                      <button
                        onClick={() => handleDeleteTopic(activeTopic.id)}
                        className="text-slate-300 hover:text-rose-500 cursor-pointer"
                        title="Delete topic"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-slate-1000" />
              {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
            </h3>

            <div className="space-y-3 mb-6">
              {replies.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.businessName} logoUrl={r.sellerLogoUrl} />
                      <div>
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          {r.businessName}
                          <VerifiedBadge tier={r.sellerVerificationTier} isOfficial={r.sellerIsOfficial} />
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(r.createdAt)}</span>
                      </div>
                    </div>
                    {r.sellerId === seller.id && (
                      <button onClick={() => handleDeleteReply(r.id)} className="text-slate-300 hover:text-rose-500 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap ml-10">{r.body}</p>
                </div>
              ))}
              {replies.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No replies yet — be the first to respond!</p>
              )}
            </div>

            <form onSubmit={handlePostReply} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-2.5">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Share your thoughts..."
                className="flex-grow px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 transition text-sm"
              />
              <button
                type="submit"
                disabled={postingReply || !replyText.trim()}
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Reply
              </button>
            </form>
          </>
        ) : null}
      </div>
    );
  }

  // ---------------- Topic list view ----------------
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="p-2 bg-slate-200 rounded-xl text-slate-700">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-extrabold text-slate-900 text-lg">TamuBah Community</h2>
          <p className="text-xs text-slate-500">Sellers-only space to talk business, share ideas, and swap stories.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 my-5">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
              categoryFilter === "all" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Topics
          </button>
          {COMMUNITY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                categoryFilter === cat ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setSort("new")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                sort === "new" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              }`}
            >
              <Clock className="w-3 h-3" /> New
            </button>
            <button
              onClick={() => setSort("top")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                sort === "top" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              }`}
            >
              <TrendingUp className="w-3 h-3" /> Top
            </button>
          </div>
          <button
            onClick={() => setShowNewTopic(true)}
            className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Topic
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl mb-4 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Loading community topics...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-700 text-sm">No topics yet</p>
          <p className="text-xs text-slate-400 mt-1">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <div
              key={t.id}
              onClick={() => handleOpenTopic(t.id)}
              className="bg-white rounded-2xl border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all p-4 cursor-pointer flex gap-3"
            >
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => handleVote(t.id, e)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    t.hasVoted ? "bg-slate-700 border-slate-700 text-white" : "border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700"
                  }`}
                >
                  <ArrowBigUp className="w-3.5 h-3.5" fill={t.hasVoted ? "currentColor" : "none"} />
                </button>
                <span className="text-[11px] font-bold text-slate-700">{t.voteCount}</span>
              </div>

              <div className="min-w-0 flex-grow">
                <span className="inline-block bg-slate-100 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mb-1.5">
                  {t.category}
                </span>
                <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1.5">{t.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-1 mb-2">{t.body}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-600">
                    <Avatar name={t.businessName} logoUrl={t.sellerLogoUrl} />
                    {t.businessName}
                    <VerifiedBadge tier={t.sellerVerificationTier} isOfficial={t.sellerIsOfficial} />
                  </span>
                  <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(t.createdAt)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> {t.replyCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Topic Modal */}
      {showNewTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Start a New Topic</h3>
              <button onClick={() => setShowNewTopic(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePostTopic} className="p-5 space-y-3.5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 text-sm bg-white"
                >
                  {COMMUNITY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  maxLength={150}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What do you want to discuss?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Details</label>
                <textarea
                  rows={5}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Share the details, your question, or your story..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={postingTopic}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 cursor-pointer"
              >
                {postingTopic ? "Posting..." : "Post Topic"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
