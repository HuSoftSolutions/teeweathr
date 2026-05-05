import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  const snapshot = await db.collection("adCreatives").orderBy("createdAt", "desc").get();
  const ads = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ ads });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sponsor, text, imageUrl, clickUrl, weight, active } = body;

  if (!sponsor || !clickUrl) {
    return NextResponse.json({ error: "sponsor and clickUrl are required" }, { status: 400 });
  }

  const docRef = await db.collection("adCreatives").add({
    sponsor,
    text: text || "",
    imageUrl: imageUrl || "",
    clickUrl,
    weight: Math.min(10, Math.max(1, weight ?? 5)),
    active: active ?? true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: docRef.id }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Whitelist editable fields. Anything else (createdAt, etc.) stays
  // immutable from the admin UI.
  const allowed: Record<string, unknown> = {};
  if (typeof updates.active === "boolean") allowed.active = updates.active;
  if (typeof updates.weight === "number") allowed.weight = Math.min(10, Math.max(1, updates.weight));
  if (typeof updates.sponsor === "string") allowed.sponsor = updates.sponsor.trim();
  if (typeof updates.text === "string") allowed.text = updates.text;
  if (typeof updates.imageUrl === "string") allowed.imageUrl = updates.imageUrl;
  if (typeof updates.clickUrl === "string") allowed.clickUrl = updates.clickUrl.trim();

  if (allowed.sponsor === "" || allowed.clickUrl === "") {
    return NextResponse.json({ error: "sponsor and clickUrl cannot be empty" }, { status: 400 });
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "no editable fields supplied" }, { status: 400 });
  }

  await db.collection("adCreatives").doc(id).update(allowed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.collection("adCreatives").doc(id).delete();
  return NextResponse.json({ ok: true });
}
