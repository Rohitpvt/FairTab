import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Image as ImageIcon } from "lucide-react";

interface ReceiptUploaderProps {
  onFileSelected: (file: File) => void;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({ onFileSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const validateAndSelectFile = (file: File) => {
    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large!", {
        description: "Receipt uploads are capped at a maximum of 5MB.",
      });
      return;
    }

    // MIME type allowlist
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported file type!", {
        description: "Only JPEG, PNG images, and PDF documents are allowed.",
      });
      return;
    }

    onFileSelected(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? "border-sky-400 bg-sky-500/10 scale-[0.98]"
          : "border-white/20 bg-white/5 hover:border-white/35 hover:bg-white/10"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="p-4 rounded-full bg-white/5 border border-white/10 text-white/60">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Drag & drop receipt image or PDF</p>
          <p className="text-xs text-white/50 mt-1">or click to browse from device</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/40 mt-2">
          <span className="flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" /> JPEG / PNG
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> PDF Document
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span>Max size: 5MB</span>
        </div>
      </div>
    </div>
  );
};
