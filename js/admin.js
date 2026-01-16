import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const loginForm = document.getElementById("adminLoginForm");
const emailEl = document.getElementById("adminEmail");
const passEl = document.getElementById("adminPassword");
const msgEl = document.getElementById("adminMsg");

const dashboard = document.getElementById("dashboard");
const bookingsWrap = document.getElementById("bookings");
const logoutBtn = document.getElementById("logoutBtn");

function setMsg(text, ok = true) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = ok ? "msg ok" : "msg err";
}

async function isAdmin(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildConfirmedEmailHtml(b) {
  const adminMsg = (b.adminMessage || "").trim();

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hi ${escapeHtml(b.customerName || "there")},</h2>
      <p>Your service has been <b>successfully confirmed</b> ✅</p>

      ${
        adminMsg
          ? `<p><b>Message from our team:</b><br/>${escapeHtml(adminMsg).replace(
              /\n/g,
              "<br/>"
            )}</p>`
          : ""
      }

      <h3>Booking details</h3>
      <ul>
        <li><b>Service:</b> ${escapeHtml(b.service || "")}</li>
        <li><b>Date:</b> ${escapeHtml(b.date || "")}</li>
        <li><b>Time:</b> ${escapeHtml(b.time || "")}</li>
        <li><b>Phone:</b> ${escapeHtml(b.phone || "")}</li>
      </ul>

      <p>If you need to reschedule, reply to this email.</p>
      <p>— Dolet Car Wash</p>
    </div>
  `;
}

async function confirmBookingAndSendEmail(bookingId, adminMessage) {
  const bookingRef = doc(db, "bookings", bookingId);
  const bookingSnap = await getDoc(bookingRef);

  if (!bookingSnap.exists()) throw new Error("Booking not found.");

  const b = bookingSnap.data();

  if (!b.email) {
    throw new Error("This booking has no customer email, so I can't send confirmation.");
  }

  const updatedBooking = {
    ...b,
    status: "confirmed",
    adminMessage: adminMessage || "",
  };

  // 1) Update booking
  await updateDoc(bookingRef, {
    status: "confirmed",
    adminMessage: adminMessage || "",
    confirmedAt: serverTimestamp(),
  });

  // 2) Queue email
  const subject = "✅ Your service is confirmed — Dolet Car Wash";
  const html = buildConfirmedEmailHtml(updatedBooking);

  await setDoc(doc(db, "mail", `${bookingId}_confirmed`), {
    to: b.email,
    message: { subject, html },
  });
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Logging in...", true);

  try {
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  } catch (err) {
    console.error(err);
    setMsg(err.message, false);
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    dashboard?.classList.add("hidden");
    loginForm?.classList.remove("hidden");
    return;
  }

  const ok = await isAdmin(user.uid);
  if (!ok) {
    setMsg("Not authorized (not an admin).", false);
    await signOut(auth);
    return;
  }

  loginForm?.classList.add("hidden");
  dashboard?.classList.remove("hidden");
  setMsg("");

  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snap) => {
    bookingsWrap.innerHTML = "";

    if (snap.empty) {
      bookingsWrap.innerHTML = `<p class="muted">No bookings yet.</p>`;
      return;
    }

    snap.forEach((d) => {
      const b = d.data();
      const status = b.status || "pending";

      const canConfirm = status !== "confirmed" && status !== "cancelled";
      const canComplete = status === "confirmed";
      const canCancel = status !== "cancelled" && status !== "completed";

      const card = document.createElement("div");
      card.className = "booking-card";

      card.innerHTML = `
        <div class="row">
          <div>
            <h3>${escapeHtml(b.customerName || "Unknown")}</h3>
            <p class="muted">
              ${escapeHtml(b.phone || "")}
              ${b.email ? " • " + escapeHtml(b.email) : ""}
            </p>
          </div>
          <span class="badge">${escapeHtml(status)}</span>
        </div>

        <p><b>Service:</b> ${escapeHtml(b.service || "")}</p>
        <p><b>Date:</b> ${escapeHtml(b.date || "")} <b>Time:</b> ${escapeHtml(
        b.time || ""
      )}</p>
        ${b.notes ? `<p><b>Notes:</b> ${escapeHtml(b.notes)}</p>` : ""}

        <div class="admin-note">
          <label class="muted" style="display:block; margin-top:10px; margin-bottom:6px;">
            Message to customer (optional)
          </label>
          <textarea
            class="admin-message"
            rows="3"
            placeholder="Eg: Please arrive 10 mins early. We’ll call you if anything changes."
            style="width:100%; resize:vertical;"
            ${canConfirm ? "" : "disabled"}
          >${escapeHtml(b.adminMessage || "")}</textarea>
        </div>

        <div class="actions" style="margin-top:10px;">
          <button class="btn small" data-id="${d.id}" data-action="confirm" ${
        canConfirm ? "" : "disabled"
      }>
            Confirm + Send Email
          </button>

          <button class="btn small" data-id="${d.id}" data-action="complete" ${
        canComplete ? "" : "disabled"
      }>
            Complete
          </button>

          <button class="btn small danger" data-id="${d.id}" data-action="cancel" ${
        canCancel ? "" : "disabled"
      }>
            Cancel
          </button>
        </div>

        <p class="muted" data-statusline="${d.id}" style="margin-top:8px;"></p>
      `;

      bookingsWrap.appendChild(card);
    });

    // Single event listener for all buttons (clean + fast)
    bookingsWrap.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");

        const card = btn.closest(".booking-card");
        const statusLine = bookingsWrap.querySelector(`[data-statusline="${id}"]`);
        const textarea = card?.querySelector("textarea.admin-message");

        const setLine = (t) => {
          if (statusLine) statusLine.textContent = t || "";
        };

        btn.disabled = true;
        setLine("Working...");

        try {
          if (action === "confirm") {
            const adminMessage = textarea ? textarea.value.trim() : "";
            setMsg("Confirming + sending email...", true);

            await confirmBookingAndSendEmail(id, adminMessage);

            setLine("Confirmed ✅ Email queued.");
            setMsg("Confirmed ✅ Email queued.", true);
            return;
          }

          if (action === "complete") {
            await updateDoc(doc(db, "bookings", id), {
              status: "completed",
              completedAt: serverTimestamp(),
            });
            setLine("Completed ✅");
            setMsg("Completed ✅", true);
            return;
          }

          if (action === "cancel") {
            const reason = window.prompt("Cancel reason (optional):") || "";
            await updateDoc(doc(db, "bookings", id), {
              status: "cancelled",
              cancelReason: reason.trim(),
              cancelledAt: serverTimestamp(),
            });
            setLine("Cancelled ✅");
            setMsg("Cancelled ✅", true);
            return;
          }
        } catch (err) {
          console.error(err);
          const msg = err?.message || "Something went wrong.";
          setLine(msg);
          setMsg(msg, false);
        } finally {
          btn.disabled = false;
        }
      });
    });
  });
});
