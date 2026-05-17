"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { NetworkContact } from "@/lib/bdo/types";
import { useBdoStore } from "@/stores/bdo-store";

export default function BdoRelationshipsPage() {
  const contacts = useBdoStore((s) => s.contacts);
  const add = useBdoStore((s) => s.addContact);
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState<NetworkContact["archetype"]>("investor");
  const [strength, setStrength] = useState(7);
  const [weight, setWeight] = useState(8);
  const [lastIx, setLastIx] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    add({
      name: name.trim(),
      archetype,
      strength,
      strategicWeight: weight,
      lastInteraction: lastIx.trim() || new Date().toISOString().slice(0, 10),
      notes,
    });
    setName("");
    setNotes("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Relationships & Network</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Track trust like a scarce asset. Strategic weight is explicit — gossip and conference badges are irrelevant.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] sm:col-span-2" />
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Archetype</span>
          <select value={archetype} onChange={(e) => setArchetype(e.target.value as NetworkContact["archetype"])} className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]">
            {(["investor", "mentor", "founder", "supplier", "operator", "clinic", "other"] as const).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <input placeholder="Last interaction (ISO or text)" value={lastIx} onChange={(e) => setLastIx(e.target.value)} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" />
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Strength 1–10</span>
          <input type="number" min={1} max={10} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px]" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Strategic weight 1–10</span>
          <input type="number" min={1} max={10} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px]" />
        </label>
        <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] sm:col-span-2" />
        <Button type="submit" className="justify-self-start bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 sm:col-span-2">
          Add relationship
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Strength</th>
              <th className="px-4 py-2 font-medium">Strategic weight</th>
              <th className="px-4 py-2 font-medium">Last ix</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-[var(--muted-foreground)]">No contacts yet.</td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 font-medium text-[var(--foreground)]">{c.name}</td>
                  <td className="px-4 py-2 capitalize text-[var(--muted-foreground)]">{c.archetype}</td>
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-[var(--foreground)]">{c.strength}</td>
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-[var(--foreground)]">{c.strategicWeight}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{c.lastInteraction}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {contacts.some((c) => c.notes) && (
          <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
            {contacts.filter((c) => c.notes).map((c) => (
              <p key={`n-${c.id}`} className="text-[12px] text-[var(--muted-foreground)]"><span className="font-medium text-[var(--foreground)]">{c.name}:</span> {c.notes}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
