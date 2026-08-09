import { describe, test, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import path from "path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Read rules file
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: "fairtab-rules-test",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: rules
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Firestore Security Rules - users/{userId}", () => {
  const aliceId = "user-alice";
  const aliceEmail = "alice@example.com";
  const bobId = "user-bob";

  // Generates a profile payload using serverTimestamp placeholders for time properties
  const getValidProfile = (uid: string, email: string) => ({
    uid,
    displayName: "Test User",
    displayNameLower: "test user",
    email,
    photoURL: "",
    defaultCurrency: "INR",
    locale: "en-IN",
    timeZone: "Asia/Kolkata",
    onboardingCompleted: false,
    accountStatus: "active",
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    version: 1,
    schemaVersion: 1
  });

  test("unauthenticated access denial", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthDb, "users", aliceId);

    await assertFails(getDoc(docRef));
    // Without credentials, create should fail
    await assertFails(setDoc(docRef, getValidProfile(aliceId, aliceEmail)));
  });

  test("another user's profile read/write denial", async () => {
    const bobDb = testEnv.authenticatedContext(bobId, { email: "bob@example.com" }).firestore();
    const aliceDocRef = doc(bobDb, "users", aliceId);

    await assertFails(getDoc(aliceDocRef));
    await assertFails(setDoc(aliceDocRef, getValidProfile(aliceId, aliceEmail)));
  });

  test("valid own-profile creation", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await assertSucceeds(setDoc(docRef, getValidProfile(aliceId, aliceEmail)));
  });

  test("creation with mismatched UID", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    const payload = getValidProfile(aliceId, aliceEmail);
    payload.uid = "user-malicious";

    await assertFails(setDoc(docRef, payload));
  });

  test("creation with mismatched email", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    const payload = getValidProfile(aliceId, "malicious@example.com");

    await assertFails(setDoc(docRef, payload));
  });

  test("creation with invalid accountStatus or onboarding status", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    const payload = getValidProfile(aliceId, aliceEmail);
    payload.accountStatus = "suspended" as unknown as "active";
    await assertFails(setDoc(docRef, payload));

    const payload2 = getValidProfile(aliceId, aliceEmail);
    payload2.onboardingCompleted = true;
    await assertFails(setDoc(docRef, payload2));
  });

  test("creation with unknown-field injection", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    const payload = {
      ...getValidProfile(aliceId, aliceEmail),
      maliciousField: "hacked"
    };

    await assertFails(setDoc(docRef, payload));
  });

  test("valid own-profile update of permitted fields", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    // Bootstrap first with disabled rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Set valid initial document (createdAt/updatedAt can be literal dates here for tests or placeholders)
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    // Update display name with proper serverTimestamp matching request.time
    await assertSucceeds(
      updateDoc(docRef, {
        displayName: "Alice New",
        displayNameLower: "alice new",
        updatedAt: serverTimestamp(),
        updatedBy: aliceId,
        version: 2
      })
    );
  });

  test("update with modification of immutable uid or email", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    // Cannot change email or uid
    await assertFails(updateDoc(docRef, { email: "new-email@example.com", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(docRef, { uid: "user-bob", updatedAt: serverTimestamp() }));
  });

  test("update with modification of creation metadata", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    await assertFails(updateDoc(docRef, { createdBy: "user-bob", updatedAt: serverTimestamp() }));
  });

  test("update with invalid version increment", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    // Version must increment by exactly one (from 1 to 2)
    await assertFails(
      updateDoc(docRef, {
        displayName: "Alice New",
        version: 5,
        updatedAt: serverTimestamp(),
        updatedBy: aliceId
      })
    );
  });

  test("update with invalid updatedBy matching", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    // updatedBy must match editor
    await assertFails(
      updateDoc(docRef, {
        displayName: "Alice New",
        version: 2,
        updatedAt: serverTimestamp(),
        updatedBy: "user-bob"
      })
    );
  });

  test("profile delete denial", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const docRef = doc(aliceDb, "users", aliceId);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceId), {
        uid: aliceId,
        displayName: "Test User",
        displayNameLower: "test user",
        email: aliceEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1
      });
    });

    await assertFails(deleteDoc(docRef));
  });

  test("unrelated collection denial", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupsRef = doc(aliceDb, "groups", "group-1");

    await assertFails(getDoc(groupsRef));
    await assertFails(setDoc(groupsRef, { name: "Hacker Group" }));
  });
});
