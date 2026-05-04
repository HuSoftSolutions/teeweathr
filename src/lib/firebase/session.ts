import { adminAuth, db } from "./admin";

export interface SessionUser {
  uid: string;
  email: string;
  role: "admin" | "business" | "none";
  businessId: string | null;
}

export async function verifySession(sessionCookie: string): Promise<SessionUser | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (adminDoc.exists) {
      return { uid: decoded.uid, email: decoded.email || "", role: "admin", businessId: null };
    }

    const businessSnap = await db
      .collection("businesses")
      .where("firebaseUid", "==", decoded.uid)
      .limit(1)
      .get();
    if (!businessSnap.empty) {
      return {
        uid: decoded.uid,
        email: decoded.email || "",
        role: "business",
        businessId: businessSnap.docs[0].id,
      };
    }

    return { uid: decoded.uid, email: decoded.email || "", role: "none", businessId: null };
  } catch {
    return null;
  }
}
