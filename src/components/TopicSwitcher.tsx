"use client";

import type { Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

const topics: Topic[] = ["COVID-19", "Dengue", "Haze"];

const topicMeta: Record<Topic, { emoji: string; color: string; active: string }> = {
  "COVID-19": {
    emoji: "🦠",
    color: "text-slate-600",
    active: "bg-blue-600 text-white shadow-sm",
  },
  Dengue: {
    emoji: "🦟",
    color: "text-slate-600",
    active: "bg-amber-500 text-white shadow-sm",
  },
  Haze: {
    emoji: "🌫️",
    color: "text-slate-600",
    active: "bg-slate-600 text-white shadow-sm",
  },
};

type Props = {
  selected: Topic;
  onChange: (topic: Topic) => void;
};

export default function TopicSwitcher({ selected, onChange }: Props) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 mr-2 uppercase tracking-wide">
          Active Topic
        </span>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {topics.map((topic) => {
            const meta = topicMeta[topic];
            const isActive = selected === topic;
            return (
              <button
                key={topic}
                onClick={() => onChange(topic)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  isActive ? meta.active : `${meta.color} hover:bg-slate-200`
                )}
              >
                <span>{meta.emoji}</span>
                {topic}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
