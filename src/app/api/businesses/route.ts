import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifySession } from "@/lib/firebase/session";

// Comment block guards both methods: this file is the admin-side business
// management surface. Self-serve signup lives in /api/auth/signup and
// creates the business doc itself with role-appropriate scope. The admin
// methods here can do things signup can't (skip email verification, set
// arbitrary contact details, look up by email, list all businesses) so
// they need to be gated behind the admin role.
async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;
  if (!session) return { ok: false, status: 401, error: "Not authenticated" };
  const user = await verifySession(session);
  if (!user || user.role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

// Admin-only: create a business + its Firebase Auth user.
// (Self-serve signup goes through /api/auth/signup instead.)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const { name, contactName, contactEmail, phone, website, password } =
      await request.json();

    if (!name || !contactName || !contactEmail) {
      return Response.json(
        { error: "name, contactName, contactEmail required" },
        { status: 400 }
      );
    }

    const businessId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug is taken
    const existing = await db.collection("businesses").doc(businessId).get();
    if (existing.exists) {
      return Response.json({ error: "A business with a similar name already exists" }, { status: 409 });
    }

    // Create Firebase Auth user for this business
    // If password provided, use it. Otherwise generate a random one (admin can reset later).
    const tempPassword = password || crypto.randomUUID().slice(0, 16) + "!A1";
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email: contactEmail,
        password: tempPassword,
        displayName: contactName,
      });
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      if (fbErr.code === "auth/email-already-exists") {
        // User already exists in Firebase Auth — look them up
        firebaseUser = await adminAuth.getUserByEmail(contactEmail);
      } else {
        throw err;
      }
    }

    // Create the business document
    await db.collection("businesses").doc(businessId).set({
      name,
      contactName,
      contactEmail,
      phone: phone || null,
      website: website || null,
      firebaseUid: firebaseUser.uid,
      subscription: { tier: "free", status: "active" },
      courseIds: [],
      embedApiKey: crypto.randomUUID(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      businessId,
      firebaseUid: firebaseUser.uid,
      generatedPassword: !password ? tempPassword : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Business creation error:", error);
    return Response.json({ error: "Failed to create business" }, { status: 500 });
  }
}

// Admin-only: list every business. Leaks contact info + API keys, so the
// role check here is load-bearing.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const snapshot = await db.collection("businesses").get();
    const businesses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
      };
    });
    return Response.json({ businesses });
  } catch (error) {
    console.error("Business list error:", error);
    return Response.json({ error: "Failed to list businesses" }, { status: 500 });
  }
}
