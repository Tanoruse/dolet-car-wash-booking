import { db, storage } from "./firebase.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/* ===== SERVICES ===== */
const SERVICES = [
  "Routine Body Wash + Vacuum — Cars",
  "Routine Body Wash + Vacuum — SUVs",
  "Complete Detailing — Cars 🚗",
  "Complete Detailing — SUVs",
  "Routine Body Wash + Vacuum — Hilux / Hiace / Coastal Bus",
  "Complete Detailing — Hilux / Hiace / Coastal Bus",
];

/* ===== BUSINESS HOURS ===== */
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const SLOT_MINUTES = 60;

/* ===== EMAIL SETTINGS ===== */
const BUSINESS_EMAIL = "booking@doletcarwash.com";

/* ===== ELEMENTS ===== */
const elService = document.getElementById("service");
const elDate = document.getElementById("date");
const elTime = document.getElementById("time");
const elForm = document.getElementById("bookingForm");
const elPhotos = document.getElementById("photos");
const elPreview = document.getElementById("preview");
const elSubmitBtn = document.getElementById("submitBtn");

/* ===== MODAL ===== */
const modal = document.getElementById("successModal");
const closeModalBtn = document.getElementById("closeModal");

closeModalBtn?.addEventListener("click", () => {
  modal?.classList.add("hidden");
});

/* ===== HELPERS ===== */
function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ===== INIT ===== */
for (const s of SERVICES) {
  const opt = document.createElement("option");
  opt.value = s;
  opt.textContent = s;
  elService.appendChild(opt);
}

elDate.valueAsDate = new Date();

function generateSlots() {
  elTime.innerHTML = "";
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const t = `${pad(hour)}:${pad(m)}`;
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      elTime.appendChild(opt);
    }
  }
}
generateSlots();

/* ===== IMAGE PREVIEW ===== */
elPhotos.addEventListener("change", () => {
  elPreview.innerHTML = "";
  [...elPhotos.files].forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "thumb";
    elPreview.appendChild(img);
  });
});

/* ===== UPLOAD ===== */
async function uploadPhotos(files, bookingKey) {
  const uploaded = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `booking_photos/${bookingKey}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    uploaded.push({ url, path });
  }

  return uploaded;
}

/* ===== EMAIL HTML BUILDERS ===== */
function buildCustomerEmailHtml({
  customerName,
  service,
  date,
  time,
  phone,
  notes,
  bookingId,
}) {
  const safeName = escapeHtml(customerName || "there");
  const safeService = escapeHtml(service);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safePhone = escapeHtml(phone || "-");
  const safeNotes = notes ? escapeHtml(notes) : "";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hi ${safeName},</h2>
      <p>We’ve received your booking request. Here are the details:</p>
      <ul>
        <li><b>Service:</b> ${safeService}</li>
        <li><b>Date:</b> ${safeDate}</li>
        <li><b>Time:</b> ${safeTime}</li>
        <li><b>Phone:</b> ${safePhone}</li>
      </ul>
      ${safeNotes ? `<p><b>Notes:</b> ${safeNotes}</p>` : ""}
      <p><b>Booking ID:</b> ${escapeHtml(bookingId)}</p>
      <p>We’ll contact you shortly to confirm your appointment.</p>
      <p>— Dolet Car Wash</p>
    </div>
  `;
}

function buildAdminEmailHtml({
  customerName,
  email,
  service,
  date,
  time,
  phone,
  notes,
  bookingId,
}) {
  const safeName = escapeHtml(customerName || "-");
  const safeEmail = escapeHtml(email || "-");
  const safeService = escapeHtml(service);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safePhone = escapeHtml(phone || "-");
  const safeNotes = notes ? escapeHtml(notes) : "";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>New booking received</h2>
      <ul>
        <li><b>Customer:</b> ${safeName}</li>
        <li><b>Email:</b> ${safeEmail}</li>
        <li><b>Phone:</b> ${safePhone}</li>
        <li><b>Service:</b> ${safeService}</li>
        <li><b>Date:</b> ${safeDate}</li>
        <li><b>Time:</b> ${safeTime}</li>
      </ul>
      ${safeNotes ? `<p><b>Notes:</b> ${safeNotes}</p>` : ""}
      <p><b>Booking ID:</b> ${escapeHtml(bookingId)}</p>
    </div>
  `;
}

/* ===== SUBMIT ===== */
elForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  elSubmitBtn.disabled = true;
  elSubmitBtn.textContent = "Submitting...";

  try {
    const bookingKey = `${elDate.value}_${elTime.value.replace(":", "-")}`;

    const customerName = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim(); // REQUIRED
    const notes = document.getElementById("notes").value.trim();

    // ✅ Validate email
    if (!email || !isValidEmail(email)) {
      alert("Please enter a valid email address (required).");
      return;
    }

    // ✅ Upload photos (optional)
    const photos =
      elPhotos.files.length > 0
        ? await uploadPhotos([...elPhotos.files], bookingKey)
        : [];

    // ✅ 1) Save booking to Firestore
    const bookingRef = await addDoc(collection(db, "bookings"), {
      service: elService.value,
      date: elDate.value,
      time: elTime.value,
      customerName,
      phone,
      email,
      notes,
      photos,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    // ✅ 2) Queue customer confirmation email (extension listens to "mail")
    const customerSubject = "✅ Booking received — Dolet Car Wash";
    const customerHtml = buildCustomerEmailHtml({
      customerName,
      service: elService.value,
      date: elDate.value,
      time: elTime.value,
      phone,
      notes,
      bookingId: bookingRef.id,
    });

    await setDoc(doc(db, "mail", `${bookingRef.id}_customer`), {
      to: email,
      message: {
        subject: customerSubject,
        html: customerHtml,
      },
    });

    // ✅ 3) Queue admin notification email (to booking@doletcarwash.com)
    const adminSubject = `📩 New booking — ${customerName || "New Customer"} (${elDate.value} ${elTime.value})`;
    const adminHtml = buildAdminEmailHtml({
      customerName,
      email,
      service: elService.value,
      date: elDate.value,
      time: elTime.value,
      phone,
      notes,
      bookingId: bookingRef.id,
    });

    await setDoc(doc(db, "mail", `${bookingRef.id}_admin`), {
      to: BUSINESS_EMAIL,
      message: {
        subject: adminSubject,
        html: adminHtml,
      },
    });

    // ✅ Reset UI
    elForm.reset();
    elPreview.innerHTML = "";
    elDate.valueAsDate = new Date();
    generateSlots();

    // ✅ Show success modal (optional)
    modal?.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("Something went wrong. Please try again.");
  } finally {
    elSubmitBtn.disabled = false;
    elSubmitBtn.textContent = "Submit booking";
  }
});
