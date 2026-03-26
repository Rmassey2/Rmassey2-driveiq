"use client";

import { useEffect, useState } from "react";

interface ContentPost {
  id: string;
  post_type: string;
  title: string;
  body: string;
  platform: string | null;
  scheduled_for: string | null;
  status: string;
  created_at: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  async function loadPosts() {
    const res = await fetch("/api/content");
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function handleGenerateWeek() {
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/cmo/generate-content", { method: "POST" });
    if (res.ok) {
      loadPosts();
    } else {
      const err = await res.json();
      setError(err.error ?? "Generation failed");
    }
    setGenerating(false);
  }

  async function handleApprove(id: string) {
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    loadPosts();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "deleted" }),
    });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    setEditingId(null);
    loadPosts();
  }

  // Group posts by day of week
  function getWeekDay(dateStr: string | null): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay();
    return day === 0 ? 6 : day - 1; // Convert Sun=0 to Mon=0
  }

  const activePosts = posts.filter((p) => p.status !== "deleted");
  const postsByDay: Record<number, ContentPost[]> = {};
  activePosts.forEach((p) => {
    const day = getWeekDay(p.scheduled_for);
    if (!postsByDay[day]) postsByDay[day] = [];
    postsByDay[day].push(p);
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Loading content…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
        <button
          onClick={handleGenerateWeek}
          disabled={generating}
          className="rounded-lg bg-[#c8a951] px-4 py-2 font-semibold text-[#0a1628] hover:bg-[#b8993e] disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Week"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Weekly Calendar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {DAY_NAMES.map((day, idx) => (
          <div key={day} className="rounded-lg bg-[#111d33] p-3">
            <h3 className="mb-2 text-center text-sm font-semibold text-[#c8a951]">
              {day}
            </h3>
            {(postsByDay[idx] ?? []).length === 0 ? (
              <p className="text-center text-xs text-gray-500">No posts</p>
            ) : (
              <div className="space-y-2">
                {(postsByDay[idx] ?? []).map((post) => (
                  <div
                    key={post.id}
                    className="rounded-md border border-gray-700/30 bg-[#0a1628] p-2"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          post.post_type === "driver_spotlight"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {post.post_type === "driver_spotlight"
                          ? "Spotlight"
                          : "Job Post"}
                      </span>
                      <span
                        className={`text-[10px] ${
                          post.status === "approved"
                            ? "text-green-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-white">
                      {post.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Post Cards */}
      <h2 className="text-lg font-semibold text-white">All Posts</h2>
      {activePosts.length === 0 ? (
        <div className="rounded-lg bg-[#111d33] p-8 text-center">
          <p className="text-gray-400">
            No content yet. Click Generate Week to create posts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activePosts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-gray-700/50 bg-[#111d33] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.post_type === "driver_spotlight"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {post.post_type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {post.status}
                    </span>
                    {post.scheduled_for && (
                      <span className="text-xs text-gray-400">
                        Scheduled: {post.scheduled_for}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {post.title}
                  </h3>
                  {editingId === post.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg border border-gray-600 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#c8a951] focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(post.id)}
                          className="rounded-lg bg-[#c8a951] px-3 py-1.5 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e]"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
                      {post.body}
                    </p>
                  )}
                </div>
              </div>

              {editingId !== post.id && (
                <div className="mt-3 flex gap-2">
                  {post.status === "draft" && (
                    <button
                      onClick={() => handleApprove(post.id)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(post.id);
                      setEditBody(post.body);
                    }}
                    className="rounded-lg bg-[#c8a951] px-3 py-1.5 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
