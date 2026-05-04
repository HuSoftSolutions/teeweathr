import { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

const SESSION_EXPIRY = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return Response.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Verify the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Check if user is admin
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    const isAdmin = adminDoc.exists;

    // Check if user is a business owner
    const businessSnap = await db
      .collection("businesses")
      .where("firebaseUid", "==", decoded.uid)
      .limit(1)
      .get();
    const isBusiness = !businessSnap.empty;
    const businessId = isBusiness ? businessSnap.docs[0].id : null;

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY,
    });

    const cookieStore = await cookies();
    cookieStore.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY / 1000,
      path: "/",
    });

    return Response.json({
      role: isAdmin ? "admin" : isBusiness ? "business" : "none",
      businessId,
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("__session");
  return Response.json({ ok: true });
}
