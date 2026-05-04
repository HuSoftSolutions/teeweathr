import { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Admin-only: create a business + its Firebase Auth user
export async function POST(request: NextRequest) {
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

export async function GET() {
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
