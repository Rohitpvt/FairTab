import React, { useEffect, useMemo, useRef, useReducer } from "react";
import { storage } from "../../infrastructure/firebase/firebase";
import { ref, getBlob } from "firebase/storage";
import { FileText, Loader2, RefreshCw } from "lucide-react";

interface ReceiptPreviewProps {
  fileBlob?: Blob | null;
  storagePath?: string | null;
  fileType?: string | null;
}

interface BlobState {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

type BlobAction =
  | { type: "reset" }
  | { type: "loading" }
  | { type: "success"; url: string }
  | { type: "error"; message: string };

function blobReducer(_state: BlobState, action: BlobAction): BlobState {
  switch (action.type) {
    case "reset":
      return { blobUrl: null, isLoading: false, error: null };
    case "loading":
      return { blobUrl: null, isLoading: true, error: null };
    case "success":
      return { blobUrl: action.url, isLoading: false, error: null };
    case "error":
      return { blobUrl: null, isLoading: false, error: action.message };
  }
}

/**
 * Fetches a blob from Firebase Storage and manages its lifecycle.
 * Returns { blobUrl, isLoading, error }.
 */
function useStorageBlob(storagePath: string | null | undefined, skip: boolean) {
  const [state, dispatch] = useReducer(blobReducer, { blobUrl: null, isLoading: false, error: null });
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !storagePath) {
      dispatch({ type: "reset" });
      return;
    }

    let active = true;
    dispatch({ type: "loading" });

    const fetchBlob = async () => {
      try {
        const storageRef = ref(storage, storagePath);
        const blob = await getBlob(storageRef);
        if (active) {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          dispatch({ type: "success", url });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (active) {
          dispatch({ type: "error", message });
        }
      }
    };
    fetchBlob();

    return () => {
      active = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [storagePath, skip]);

  return state;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  fileBlob,
  storagePath,
  fileType,
}) => {
  const activeFileType = fileBlob instanceof File ? fileBlob.type : fileType || "";
  const isPdf = activeFileType.toLowerCase().includes("pdf") || (storagePath && storagePath.toLowerCase().endsWith(".pdf"));

  // Derive local blob URL synchronously via useMemo (no setState in effect)
  const localBlobUrl = useMemo(() => {
    if (fileBlob) {
      return URL.createObjectURL(fileBlob);
    }
    return null;
  }, [fileBlob]);

  // Revoke local blob URL on unmount or change
  useEffect(() => {
    return () => {
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [localBlobUrl]);

  // Fetch remote blob only when storagePath is provided and no local blob
  const { blobUrl: remoteBlobUrl, isLoading, error } = useStorageBlob(storagePath, !!fileBlob);

  const blobUrl = localBlobUrl || remoteBlobUrl;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-2xl h-[400px]">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-2" />
        <p className="text-xs text-white/50">Retrieving file securely from Firebase Storage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-rose-500/5 border border-rose-500/20 text-rose-400 rounded-2xl h-[400px] text-center">
        <RefreshCw className="w-8 h-8 mb-2" />
        <p className="text-xs font-semibold">Error Loading Attachment</p>
        <p className="text-[10px] text-white/40 mt-1 max-w-[250px]">{error}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-2xl h-[400px] text-white/40">
        <FileText className="w-8 h-8 mb-2" />
        <p className="text-xs font-medium">No receipt preview available.</p>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="border border-white/10 rounded-2xl overflow-hidden h-[450px] bg-zinc-900">
        <iframe
          src={`${blobUrl}#toolbar=0`}
          title="PDF Receipt Preview"
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-zinc-900/40 p-2 flex items-center justify-center h-[450px]">
      <img
        src={blobUrl}
        alt="Receipt Attachment Preview"
        className="max-w-full max-h-full object-contain rounded-lg"
      />
    </div>
  );
};
