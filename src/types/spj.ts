export type ExportFormData = {
  judul?: string;
  tanggal?: string;
  waktu?: string;
  tempat?: string;
  // Field instansi/bidang yang bisa dipilih via dropdown anggota
  bidang?: string;
  // penyelenggara sekarang mengikuti bidang (otomatis), tetap ada untuk kompatibilitas
  penyelenggara?: string;
  alamat?: string;
  peserta?: string;
  tujuan?: string;
  uraian?: string;
};


