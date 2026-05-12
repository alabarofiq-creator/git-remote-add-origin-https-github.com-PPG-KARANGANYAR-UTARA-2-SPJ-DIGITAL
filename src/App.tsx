import { useForm } from "react-hook-form";
import { exportToWord } from "./utils/generateWord";
import { useEffect, useMemo, useState } from "react";

import { jsPDF } from "jspdf";
import {
  ensureDefaultAdminSet,
  getSessionUsername,
  loginAdmin,
  logoutAdmin,
} from "./utils/adminAuth";

import type { ExportFormData } from "./types/spj";

const HISTORY_KEY = 'spj_history_v1';

type SpjHistoryItem = {
  id: string;
  createdAt: string; // ISO
  fileType: 'WORD' | 'PDF';
  judul?: string;
  tanggal?: string;
  waktu?: string;
  tempat?: string;
  penyelenggara?: string;
  peserta?: string;
  alamat?: string;
};

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const { register, handleSubmit } = useForm();
  const [images, setImages] = useState<string[]>([]);

  const [historyItems, setHistoryItems] = useState<SpjHistoryItem[]>([]);

  const loadHistory = () => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [] as SpjHistoryItem[];
    try {
      return JSON.parse(raw) as SpjHistoryItem[];
    } catch {
      return [] as SpjHistoryItem[];
    }
  };

  const persistHistory = (next: SpjHistoryItem[]) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await ensureDefaultAdminSet();
      const u = getSessionUsername();
      if (!mounted) return;
      setAuthUsername(u);
      // history tidak bergantung auth, tapi kita muat saja saat app start
      setHistoryItems(loadHistory());
      setAuthLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);


  const isAuthenticated = useMemo(() => !!authUsername, [authUsername]);

  const onLogin = async () => {
    setLoginError(null);
    const ok = await loginAdmin(loginUsername, loginPassword);
    if (!ok) {
      setLoginError("Username atau password salah.");
      return;
    }
    // session tersimpan di adminAuth; update state
    setAuthUsername(getSessionUsername());
  };

  const onLogout = () => {
    logoutAdmin();
    setAuthUsername(null);
    setLoginPassword("");
    setLoginUsername("");
    setLoginError(null);
  };










  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      filesArray.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => setImages((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const pushHistory = (item: Omit<SpjHistoryItem, 'id' | 'createdAt'>) => {
    const next: SpjHistoryItem[] = [
      {
        id: `${new Date().getTime()}`, 
        createdAt: new Date().toISOString(),
        ...item,
      },
      ...historyItems,
    ].slice(0, 50);

    setHistoryItems(next);
    persistHistory(next);
  };

  // --- FUNGSI GENERATE PDF (VERSI FINAL: FIX TERPOTONG & SIMETRIS TANDA TANGAN) ---
  const exportToPDF = (data: ExportFormData & { images: string[] }) => {
    const bidang = data.bidang || '';
    const penyelenggaraOtomatis = bidang ? bidang : (data.penyelenggara || '-');

    const merged: ExportFormData & { images: string[] } = {
      ...data,
      penyelenggara: penyelenggaraOtomatis,
    };


    const doc = new jsPDF('p', 'mm', 'a4');

    // pakai penyelenggara yang sudah di-derive
    const penyelenggara = merged.penyelenggara || '-';
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginSize = 20; // Margin standar kiri-kanan
    const contentWidth = pageWidth - (marginSize * 2); 
    
    const getFullDate = (dateString: string) => {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    };

    const tglLengkap = getFullDate(data.tanggal || "");
    let currentY = 20;

    // --- HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("LAPORAN PELAKSANAAN KEGIATAN", pageWidth / 2, currentY, { align: "center" });
    currentY += 6;
    doc.text(`${String(penyelenggara).toUpperCase() || "-"}`, pageWidth / 2, currentY, { align: "center" });
    currentY += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(data.alamat || "-", pageWidth / 2, currentY, { align: "center" });
    
    currentY += 2;
    doc.line(marginSize, currentY, pageWidth - marginSize, currentY); 
    
    currentY += 10;
    doc.text(`Pada hari ini ${tglLengkap}, telah dilaksanakan kegiatan:`, marginSize, currentY);
    
    // --- DETAIL (FIXED RIGHT MARGIN) ---
    const leftX = 20;  
    const separatorX = 55; 
    const rightX = 58; 
    const maxDetailWidth = pageWidth - rightX - marginSize; // Kunci lebar nilai agar tidak meluber ke kanan
    
    currentY += 10;
    const fields = [
      { label: "Nama Kegiatan", value: data.judul },
      { label: "Hari / Tanggal", value: tglLengkap },
      { label: "Waktu", value: data.waktu },
      { label: "Tempat", value: data.tempat },
      { label: "Penyelenggara", value: data.penyelenggara },
      { label: "Peserta", value: data.peserta }
    ];

    fields.forEach(field => {
      doc.setFont("helvetica", "bold");
      doc.text(field.label, leftX, currentY);
      doc.text(":", separatorX, currentY);
      doc.setFont("helvetica", "normal");
      
      // Paksa teks detail turun ke bawah jika terlalu panjang
      const valLines = doc.splitTextToSize(`${field.value || "-"}`, maxDetailWidth);
      doc.text(valLines, rightX, currentY);
      currentY += (valLines.length * 5) + 2; 
    });

    // --- URAIAN (JUSTIFIED DENGAN MAX WIDTH) ---
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Uraian Singkat Kegiatan:", marginSize, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    
    // splitTextToSize adalah kunci agar teks tidak terpotong ke kanan
    const uraianLines = doc.splitTextToSize(data.uraian || "-", contentWidth);
    doc.text(uraianLines, marginSize, currentY, { align: 'justify', maxWidth: contentWidth });
    
    currentY += (uraianLines.length * 5) + 8; 

    // --- PENUTUP ---
    const penutup1 = `Bahwa kegiatan tersebut dilaksanakan dengan tujuan ${data.tujuan || "-"}.`;
    const penutup1Lines = doc.splitTextToSize(penutup1, contentWidth);
    doc.text(penutup1Lines, marginSize, currentY, { align: 'justify', maxWidth: contentWidth });
    
    currentY += (penutup1Lines.length * 5) + 6;
    const penutup2 = "Demikian Laporan Pelaksanaan Kegiatan ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.";
    const penutup2Lines = doc.splitTextToSize(penutup2, contentWidth);
    doc.text(penutup2Lines, marginSize, currentY, { align: 'justify', maxWidth: contentWidth });

    // --- TANDA TANGAN (MATEMATIKA PRESISI) ---
    currentY += 35;
    if (currentY > 250) { doc.addPage(); currentY = 30; }
    
    // Titik pusat kolom kiri dan kanan
    const colLeftCenter = marginSize + (contentWidth / 4);
    const colRightCenter = pageWidth - marginSize - (contentWidth / 4);

    doc.setFont("helvetica", "normal");
    // Gunakan koordinat pusat dan align: center agar teks lurus vertikal
    doc.text("Mengetahui,", colLeftCenter, currentY, { align: "center" });
    doc.text("Penanggung Jawab,", colRightCenter, currentY, { align: "center" });
    
    currentY += 28; // Jarak tanda tangan
    
    doc.text("( ____________________ )", colLeftCenter, currentY, { align: "center" });
    doc.text(`( ${data.penyelenggara || "-"} )`, colRightCenter, currentY, { align: "center" });

    // --- LAMPIRAN ---
    if (images.length > 0) {
      images.forEach((img, index) => {
        if (index % 2 === 0) {
          doc.addPage();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("LAMPIRAN DOKUMENTASI KEGIATAN", pageWidth / 2, 20, { align: "center" });
          doc.text(data.judul?.toUpperCase() || "-", pageWidth / 2, 26, { align: "center" });
          currentY = 40;
        }
        doc.addImage(img, 'JPEG', 25, currentY, 160, 100, undefined, 'MEDIUM');
        currentY += 110; 
      });
    }

    const bidangName = (data.penyelenggara || penyelenggara || '-').toString();
    const filePrefix = bidangName
      .replace('PPG ', 'Bid. ')
      .replace('Bidang ', 'Bid. ')
      // jika hasilnya masih 'Bid. Bid.' -> ganti prefix awalnya jadi 'SPJ'
      .replace(/^Bid\.\s*Bid\.\s*/i, 'SPJ ')
      .replace(/\t/g, ' ')
      .trim();

    const fileName = `${filePrefix}-${data.judul || 'Laporan'}.pdf`;

    doc.save(fileName);

    pushHistory({
      fileType: 'PDF',
      judul: data.judul,
      tanggal: data.tanggal,
      waktu: data.waktu,
      tempat: data.tempat,
      penyelenggara: data.penyelenggara || penyelenggara,
      peserta: data.peserta,
      alamat: data.alamat,
    });
  };

  if (authLoading) {
    return (
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          minHeight: '100vh',
          padding: '15px',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          minHeight: '100vh',
          padding: '15px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <header style={{ textAlign: 'center', padding: '20px 0' }}>
            <h1
              style={{
                fontSize: '28px',
                margin: 0,
                background: 'linear-gradient(to right, #38bdf8, #818cf8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: '800',
              }}
            >
              SPJ SMART PRO
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Admin Login</p>
          </header>

          <div style={{ backgroundColor: '#300824', padding: '20px', borderRadius: '16px', border: '1px solid #000000' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 12 }}>Username</label>
              <input
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder=""
                autoComplete="username"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ffffff', backgroundColor: '#000000', color: '#f8fafc' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 12 }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder=""
                autoComplete="current-password"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ffffff', backgroundColor: '#000000', color: '#f8fafc' }}
              />
            </div>

            {loginError && (
              <div style={{ marginBottom: 12, color: '#fca5a5', fontSize: 13, fontWeight: 700 }}>
                {loginError}
              </div>
            )}

            <button type="button" onClick={onLogin} style={{ width: '100%', padding: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>
              Login
            </button>


          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '15px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <header style={{ textAlign: 'center', padding: '20px 0' }}>
          <h1 style={{ fontSize: '28px', margin: 0, background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '800' }}>
            SPJ SMART PRO
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Laporan Pelaksanaan Kegiatan Digital</p>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>by Sekretariat PPG Karanganyar Utara 2</p>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>
              Logged as: <b>{authUsername}</b>
            </div>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '10px 14px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </header>


        <div style={{ marginBottom: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>🕘 RIWAYAT LAPORAN</h3>
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm('Hapus semua riwayat laporan?');
                if (!ok) return;
                const next: SpjHistoryItem[] = [];
                setHistoryItems(next);
                persistHistory(next);
              }}
              style={{
                padding: '8px 10px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Hapus Riwayat
            </button>
          </div>

          {historyItems.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '10px 0' }}>Belum ada riwayat laporan.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historyItems.slice(0, 10).map((it) => (
                <div
                  key={it.id}
                  style={{
                    backgroundColor: '#300824',
                    border: '1px solid #000000',
                    padding: 12,
                    borderRadius: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>
                      {it.judul ? it.judul : '-'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800 }}>
                      {it.fileType}
                    </div>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
                    {it.tanggal || '-'} {it.waktu ? `• ${it.waktu}` : ''}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                    Exported: {new Date(it.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
              {historyItems.length > 10 && (
                <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>Menampilkan 10 riwayat terakhir</div>
              )}
            </div>
          )}
        </div>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Section Detail */}
          <div style={cardStyle}>
            <h3 style={labelHeader}>📌 DETAIL KEGIATAN</h3>
            <input {...register("judul")} placeholder="Nama Kegiatan" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input {...register("tanggal")} type="date" style={inputStyle} />
              <input {...register("waktu")} placeholder="Jam (10.00 WIB)" style={inputStyle} />
            </div>
            <input {...register("tempat")} placeholder="Tempat / Lokasi" style={inputStyle} />
          </div>

          {/* Section Penyelenggara */}
          <div style={cardStyle}>
            <h3 style={labelHeader}>🏢 PENYELENGGARA</h3>

            <select
              {...register('penyelenggara')}
              style={inputStyle}
              defaultValue=""
            >
              <option value="" disabled>
                Nama Instansi/Bidang
              </option>
              {[
                'PPG Bidang Kesekretariatan/Umum',
                'PPG Bidang Kurikulum',
                'PPG Bidang Penggalangan Dana',
                'PPG Bidang Sarana Prasarana',
                'PPG Bidang Tenaga Pendidik',
                'PPG Bidang Muda-Mudi',
                'PPG Bidang Olahraga dan Seni',
                'PPG Bidang Kemandirian',
                'PPG Bidang Keputrian',
                'PPG Bidang Bimbingan Konseling',
                'PPG Bidang Tahfidz',
              ].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>


            <select
              {...register("alamat")}
              style={inputStyle}
              defaultValue=""
            >
              <option value="" disabled>
                Alamat Instansi/Daerah
              </option>
              <option value="Karanganyar Utara 2">Karanganyar Utara 2</option>
            </select>
            <input {...register("peserta")} placeholder="Daftar Peserta" style={inputStyle} />


          </div>

          {/* Section Narasi */}
          <div style={cardStyle}>
            <h3 style={labelHeader}>📝 NARASI LAPORAN</h3>
            <input {...register("tujuan")} placeholder="Tujuan kegiatan" style={inputStyle} />
            <textarea
              {...register("uraian")}
              placeholder={`Contoh isian (Uraian Singkat):\n\nMC: (Nama MC)\nPembukaan: (Uraian singkat pembukaan)\nMateri: (Uraian materi kegiatan)\nNarasumber: (Nama narasumber)\nPenutup: (Uraian singkat penutup)\nBiaya yang timbul: (Rincian singkat biaya)\n\nCatatan tambahan: ...`}
              style={{ ...inputStyle, height: '100px', resize: 'none' }}
            />
          </div>

          {/* Section Dokumentasi */}
          <div style={{ ...cardStyle, border: '2px dashed #38bdf8', textAlign: 'center', backgroundColor: '#1e293b' }}>
            <h3 style={{ ...labelHeader, color: '#38bdf8' }}>📸 DOKUMENTASI</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
              Pilih foto dari galeri atau ambil foto baru
            </p>
            <input type="file" accept="image/*" multiple onChange={handleImageChange} id="upload-photo" style={{ display: 'none' }} />
            <label htmlFor="upload-photo" style={uploadBtn}>
              Tambah Foto
            </label>

            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '15px' }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={img} style={{ width: '100%', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #38bdf8' }} />
                    <button type="button" onClick={() => removeImage(i)} style={deleteBtn}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSubmit((data) => {
                const bidangName = (data.penyelenggara || data.bidang || '-').toString();
                const filePrefix = bidangName
                  .replace('PPG ', 'Bid. ')
                  .replace('Bidang ', 'Bid. ')
                  .replace(/\t/g, ' ')
                  .trim();

                const wordFileName = `${filePrefix}-${data.judul || 'Laporan'}.docx`;

                // sanitize agar prefix 'Bid.' tidak dobel (contoh: 'Bid. Bid. ...')
                const sanitized = wordFileName.replace(/^Bid\.\s*Bid\.\s*/i, 'Bid. ');
                exportToWord({ ...(data as ExportFormData), images, fileName: sanitized });

                pushHistory({
                  fileType: 'WORD',
                  judul: data.judul,
                  tanggal: data.tanggal,
                  waktu: data.waktu,
                  tempat: data.tempat,
                  penyelenggara: typeof data.penyelenggara === 'string' ? data.penyelenggara : undefined,
                  peserta: data.peserta,
                  alamat: data.alamat,
                });
              })}
              style={{ ...submitBtn, flex: 1 }}
            >
              WORD (.DOCX)
            </button>
            <button
              type="button"
              onClick={handleSubmit((d) => exportToPDF({ ...(d as ExportFormData), images }))}
              style={{ ...submitBtn, backgroundColor: '#ef4444', flex: 1 }}
            >
              PDF (.PDF)
            </button>
          </div>

        </form>
      </div>


      {/* Footer */}
      <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '1px solid #334155', paddingTop: '20px' }}>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '10px' }}>Support & Follow Us:</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <a href="https://www.tiktok.com/@rofiiiqbs" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', color: '#ff0050' }}>
            <span style={{ fontSize: '20px' }}>📱</span>
            <span style={{ fontWeight: 'bold' }}>TikTok</span>
          </a>
          <a href="https://www.instagram.com/rofiiiqbs" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', color: '#e1306c' }}>
            <span style={{ fontSize: '20px' }}>📸</span>
            <span style={{ fontWeight: 'bold' }}>Instagram</span>
          </a>
        </div>
        <p style={{ fontSize: '12px', color: '#475569', marginTop: '15px' }}>© 2026 Rofiiiqbs. All rights reserved.</p>
      </div>
    </div>
  );
}

const cardStyle = { backgroundColor: '#300824', padding: '20px', borderRadius: '16px', border: '1px solid #000000' };
const labelHeader = { fontSize: '12px', color: '#94a3b8', marginBottom: '15px' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ffffff', backgroundColor: '#000000', color: '#f8fafc', marginBottom: '10px' };
const uploadBtn = { display: 'inline-block', padding: '10px 20px', backgroundColor: '#38bdf8', color: '#ffffff', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' };
const submitBtn = { width: '100%', padding: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' };
const deleteBtn = { position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px' } as const;

export default App;

