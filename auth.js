(() => {
  "use strict";

  const dialog = document.getElementById("auth-dialog");
  const trigger = document.getElementById("hero-login");
  const close = document.getElementById("auth-close");
  const googleButton = document.getElementById("google-signin-button");
  const status = document.getElementById("auth-status");
  const profile = document.getElementById("auth-profile");
  const profileName = document.getElementById("auth-profile-name");
  const signOutButton = document.getElementById("auth-signout");
  if (!dialog || !trigger || !googleButton) return;

  const firebaseConfig = {
    apiKey: "AIzaSyC1amWOGolwX8sjqRkwBGMPsCnxLCgDqVs",
    authDomain: "cms-buddy-1589a.firebaseapp.com",
    projectId: "cms-buddy-1589a",
    storageBucket: "cms-buddy-1589a.firebasestorage.app",
    messagingSenderId: "74046300646",
    appId: "1:74046300646:web:d485b9d2c3055a70c03627",
    measurementId: "G-1EY4MM6XZV"
  };
  const sdkBase = "https://www.gstatic.com/firebasejs/13.1.0";
  let firebasePromise;

  function setStatus(message) {
    status.textContent = message;
  }

  function showUser(user) {
    const signedIn = Boolean(user);
    profile.classList.toggle("hidden", !signedIn);
    googleButton.classList.toggle("hidden", signedIn);
    profileName.textContent = signedIn ? user.displayName || user.email || "Google account" : "";
    trigger.innerHTML = signedIn
      ? 'My Account <span aria-hidden="true">&rarr;</span>'
      : 'Login / Register <span aria-hidden="true">&rarr;</span>';
    if (signedIn) setStatus("Signed in with Google. Your study progress is saved on this device.");
  }

  function authErrorMessage(error) {
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") return "";
    if (error?.code === "auth/unauthorized-domain") return "Add this website's domain to Firebase Authentication authorized domains.";
    if (error?.code === "auth/operation-not-allowed") return "Enable the Google provider in Firebase Authentication to use sign-in.";
    if (error?.code === "auth/network-request-failed") return "Could not connect to Google. Check your connection and try again.";
    if (error?.code === "auth/popup-blocked") return "Allow pop-ups for this website and try again.";
    return "Google sign-in is unavailable right now. Please try again.";
  }

  function initializeFirebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = (async () => {
      const [appSdk, authSdk] = await Promise.all([
        import(`${sdkBase}/firebase-app.js`),
        import(`${sdkBase}/firebase-auth.js`)
      ]);
      const app = appSdk.initializeApp(firebaseConfig);
      const auth = authSdk.getAuth(app);
      authSdk.onAuthStateChanged(auth, showUser, error => setStatus(authErrorMessage(error)));

      import(`${sdkBase}/firebase-analytics.js`).then(async analyticsSdk => {
        if (await analyticsSdk.isSupported()) analyticsSdk.getAnalytics(app);
      }).catch(() => { /* Authentication remains available if Analytics is blocked. */ });

      return { auth, authSdk };
    })().catch(error => {
      firebasePromise = null;
      throw error;
    });
    return firebasePromise;
  }

  trigger.addEventListener("click", () => {
    dialog.showModal();
    if (!/^https?:$/.test(location.protocol)) {
      setStatus("Open CMS Buddy on localhost or HTTPS to use Google sign-in.");
    }
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  googleButton.addEventListener("click", async () => {
    if (!/^https?:$/.test(location.protocol)) return;
    googleButton.disabled = true;
    setStatus("Connecting to Google…");
    try {
      const { auth, authSdk } = await initializeFirebase();
      await authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider());
    } catch (error) {
      setStatus(authErrorMessage(error));
    } finally {
      googleButton.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      const { auth, authSdk } = await initializeFirebase();
      await authSdk.signOut(auth);
      showUser(null);
      setStatus("Signed out. Your study progress remains on this device.");
    } catch (error) {
      setStatus("Could not sign out. Please try again.");
    } finally {
      signOutButton.disabled = false;
    }
  });

  if (/^https?:$/.test(location.protocol)) {
    initializeFirebase().catch(() => setStatus("Google sign-in could not load. Check your connection and try again."));
  }
})();
