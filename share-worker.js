// Cloudflare Worker — route: qa-seleris.my.id/*
// Mengubah ?share=ID.pdf menjadi respons file langsung (Content-Type dari file), tanpa HTML/login.
// Syarat: rules Firestore mengizinkan read publik driveShares & driveChunks (sama seperti halaman ?share= sekarang).
const PROJECT_ID = "qa-notes-14208", API_KEY = "AIzaSyBbWlix5EAJ9-osukl-i6e3I_bfX-53DvU";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const get = async p => { const r = await fetch(`${FS}/${p}?key=${API_KEY}`); return r.ok ? r.json() : null; };
const v = f => f && (f.stringValue ?? f.integerValue ?? f.doubleValue);
export default {
  async fetch(req) {
    const u = new URL(req.url), raw = u.searchParams.get("share");
    if (!raw || !/\.pdf$/i.test(raw)) return fetch(req);          // selain link .pdf → app biasa
    const id = raw.replace(/\.pdf$/i, "");
    const d = await get(`driveShares/${encodeURIComponent(id)}`);
    if (!d) return new Response("Link tidak ditemukan", { status: 404 });
    const f = d.fields, exp = Number(v(f.expiresAt) || 0);
    if (exp && Date.now() > exp) return new Response("Link kedaluwarsa", { status: 410 });
    const n = Number(v(f.chunks)), fid = v(f.fid);
    const parts = await Promise.all([...Array(n).keys()].map(i => get(`driveChunks/${fid}_${i}`)));
    if (parts.some(p => !p)) return new Response("Data tidak lengkap", { status: 404 });
    const b64 = parts.map(p => v(p.fields.data)).join(""); // sesuaikan nama field chunk
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Response(bin, { headers: {
      "Content-Type": v(f.mime) || "application/pdf",
      "Content-Disposition": `inline; filename="${(v(f.name) || "dokumen.pdf").replace(/"/g, "")}"`,
      "Cache-Control": "public, max-age=3600" } });
  }
};
