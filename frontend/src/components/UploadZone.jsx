// Büyük sürükle-bırak yükleme alanı (foolproof: tıkla veya sürükle)
import { useRef, useState } from 'react';
import { ScanLine, Loader2, Images, FileSpreadsheet, PlusCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const UploadZone = ({ onFiles, onExcelImport, onAddManualRow, uploading, count, maxFiles = 200 }) => {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const excelInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();
  const openCamera = (e) => {
    e.stopPropagation();
    cameraInputRef.current?.click();
  };
  const openExcelPicker = (e) => {
    e.stopPropagation();
    excelInputRef.current?.click();
  };

  return (
    <section className="space-y-4" aria-label="Fiş yükleme alanı">
      <div
        data-testid="receipt-upload-dropzone"
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-xl border-2 border-dashed bg-card p-8 md:p-12 text-center cursor-pointer select-none',
          'shadow-[var(--shadow-soft)] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/30',
          dragOver ? 'border-primary bg-accent/60 ring-4 ring-sky-500/20' : 'border-border hover:border-primary/60'
        )}
      >
        <div className="mx-auto h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
          {uploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <ScanLine className="h-8 w-8 text-primary" />
          )}
        </div>
        <h2 className="font-heading text-xl md:text-2xl font-semibold">Fişleri buraya sürükle veya tıkla</h2>
        <p className="mt-2 text-sm md:text-base text-muted-foreground">
          JPG, PNG, HEIC veya WEBP • Tek seferde en fazla {maxFiles} fiş
        </p>
        {uploading && (
          <p className="mt-3 text-sm font-medium text-primary" data-testid="upload-in-progress-text">
            Fişler yükleniyor, lütfen bekleyin...
          </p>
        )}
        {!uploading && count > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground bg-secondary rounded-full px-3 py-1">
            <Images className="h-4 w-4" />
            Listede {count} fiş var — üzerine ekleyebilirsiniz
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={openCamera} className="h-10 text-xs sm:text-sm" data-testid="camera-capture-button">
          <Camera className="h-4 w-4 mr-1.5" />
          Kamera ile Fiş Çek
        </Button>
        <Button variant="outline" onClick={openExcelPicker} className="h-10 text-xs sm:text-sm" data-testid="import-excel-button">
          <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
          Excel Dosyası (.xlsx) Yükle
        </Button>
        <Button variant="outline" onClick={onAddManualRow} className="h-10 text-xs sm:text-sm" data-testid="add-manual-row-button">
          <PlusCircle className="h-4 w-4 mr-1.5 text-primary" />
          Boş / Manuel Satır Ekle
        </Button>
      </div>

      <input
        ref={inputRef}
        data-testid="receipt-upload-file-input"
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Telefonda arka kamerayı direkt açar (canlı çekim); masaüstünde normal dosya seçer */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            onExcelImport(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />
    </section>
  );
};
