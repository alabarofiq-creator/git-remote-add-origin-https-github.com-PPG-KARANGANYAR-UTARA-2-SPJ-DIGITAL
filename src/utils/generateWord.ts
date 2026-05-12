import { 
  Document, Packer, Paragraph, TextRun, AlignmentType, 
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun 
} from "docx";
import { saveAs } from "file-saver";

export const exportToWord = async (data: any) => {
  const formatIndo = (dateStr: string) => {
    if (!dateStr) return "..........";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  };

  const tglLengkap = formatIndo(data.tanggal);

  // --- LOGIKA DOKUMENTASI (FOTO MAXIMAL 2 PER LEMBAR) ---
  const imageParagraphs: any[] = [];
  if (data.images && data.images.length > 0) {
    data.images.forEach((img: string, index: number) => {
      if (index % 2 === 0) {
        imageParagraphs.push(new Paragraph({ text: "", pageBreakBefore: true }));
        imageParagraphs.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "LAMPIRAN DOKUMENTASI KEGIATAN", bold: true, size: 28 })], // Font diperbesar
        }));
        imageParagraphs.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: (data.judul || "Nama Kegiatan").toUpperCase(), bold: true, size: 24 })], // Font diperbesar
        }));
        imageParagraphs.push(new Paragraph({ text: "" })); 
      }
      imageParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: img, transformation: { width: 550, height: 350 } } as any)],
      }));
      imageParagraphs.push(new Paragraph({ text: "" })); 
    });
  }

  // Helper Tabel Detail (Font Isi Tabel diperbesar ke size 24 / 12pt)
  const createDetailRow = (label: string, value: string) => {
    return new TableRow({
      children: [
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: label === "Nama Kegiatan", size: 24 })] })] }),
        new TableCell({ width: { size: 3, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: ":", size: 24 })] })] }),
        new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value || "-", bold: label === "Nama Kegiatan", size: 24 })] })] }),
      ],
    });
  };

  const doc = new Document({
    sections: [{
      children: [
        // --- KOP SURAT (DI-PERBESAR) ---
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "BERITA ACARA PELAKSANAAN KEGIATAN", bold: true, size: 32 })], // 16pt
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: (data.penyelenggara || "").toUpperCase(), bold: true, size: 28 })], // 14pt
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: data.alamat || "", size: 20 })], // 10pt
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "__________________________________________________________________________", bold: true })],
        }),
        new Paragraph({ text: "" }),
        
        // Narasi Pembuka (Size 24 = 12pt)
        new Paragraph({ children: [new TextRun({ text: `Pada hari ini ${tglLengkap}, telah dilaksanakan kegiatan:`, size: 24 })] }),
        new Paragraph({ text: "" }),

        // TABEL DETAIL
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            createDetailRow("Nama Kegiatan", data.judul),
            createDetailRow("Hari / Tanggal", tglLengkap),
            createDetailRow("Waktu", data.waktu),
            createDetailRow("Tempat", data.tempat),
            createDetailRow("Penyelenggara", data.penyelenggara),
            createDetailRow("Peserta", data.peserta),
          ],
        }),

        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "Uraian Singkat Kegiatan:", bold: true, underline: {}, size: 24 })] }),
        new Paragraph({ children: [new TextRun({ text: data.uraian || "-", size: 24 })] }),
        new Paragraph({ text: "" }),
        
        // Narasi Tujuan (Size 24 = 12pt)
        new Paragraph({ 
          children: [new TextRun({ text: `Bahwa kegiatan tersebut dilaksanakan dengan tujuan ${data.tujuan || "-"}. Kegiatan berjalan dengan lancar, tertib, dan sesuai dengan rencana.`, size: 24 })] 
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ 
          children: [new TextRun({ text: "Demikian Berita Acara ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.", size: 24 })] 
        }),
        new Paragraph({ text: "" }),

        // TANDA TANGAN (Size 24 = 12pt)
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mengetahui,", size: 24 })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Ketua,", size: 24 })] }),
                    new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "( ____________________ )", bold: true, size: 24 })] }),
                ]}),
                new TableCell({ children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Penanggung Jawab,", size: 24 })] }),
                    new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `( ${data.penyelenggara || "__________"} )`, bold: true, size: 24 })] }),
                ]}),
              ],
            }),
          ],
        }),

        ...imageParagraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `BA_${data.judul || "Kegiatan"}.docx`);
};