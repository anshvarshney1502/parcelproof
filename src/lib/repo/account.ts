import { ObjectId } from "mongodb";
import { collections } from "../db";
import { deleteCase } from "./cases";

/** Deletes every record the user owns, then the Auth.js user, accounts and sessions. */
export async function deleteAccountData(ownerId: string) {
  const c = await collections();
  const cases = await c.cases.find({ ownerId }, { projection: { _id: 1 } }).toArray();
  for (const k of cases) await deleteCase(ownerId, k._id);
  // Sweep anything not reachable through a case (e.g. a half-finished upload).
  for (const bucket of [c.files, c.audio]) {
    const stray = await bucket.find({ "metadata.ownerId": ownerId }).toArray();
    for (const f of stray) await bucket.delete(f._id).catch(() => {});
  }
  await Promise.all([
    c.evidence.deleteMany({ ownerId }),
    c.analyses.deleteMany({ ownerId }),
    c.briefings.deleteMany({ ownerId }),
    c.settings.deleteMany({ ownerId }),
    c.usage.deleteMany({ ownerId }),
    c.audit.deleteMany({ ownerId }),
  ]);
  if (ObjectId.isValid(ownerId)) {
    const uid = new ObjectId(ownerId);
    await Promise.all([
      c.db.collection("accounts").deleteMany({ userId: uid }),
      c.db.collection("sessions").deleteMany({ userId: uid }),
      c.db.collection("users").deleteOne({ _id: uid }),
    ]);
  }
}
