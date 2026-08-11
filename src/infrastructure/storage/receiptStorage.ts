export interface ReceiptStorageMetadata {
  storageProvider: "s3";
  bucket: string;
  region: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
}

export interface ReceiptStorageProvider {
  uploadReceipt(
    groupId: string,
    receiptId: string,
    file: File | Blob,
    fileName: string,
    version: number
  ): Promise<ReceiptStorageMetadata>;
  getReceiptBlob(objectKey: string): Promise<Blob>;
}

export class S3ReceiptStorageProvider implements ReceiptStorageProvider {
  async uploadReceipt(
    groupId: string,
    receiptId: string,
    file: File | Blob,
    fileName: string,
    version: number
  ): Promise<ReceiptStorageMetadata> {
    void version;
    const bucket = import.meta.env.VITE_S3_BUCKET_NAME || "fairtab-48340-receipts";
    const region = import.meta.env.VITE_S3_REGION || "ap-south-1";
    const objectKey = `groups/${groupId}/receipts/${receiptId}/v${version}/${fileName}`;

    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
      return {
        storageProvider: "s3",
        bucket,
        region,
        objectKey,
        contentType: file.type || "image/jpeg",
        sizeBytes: file.size,
      };
    }

    const { receiptService } = await import("../firebase/receiptService");

    // 1. Get presigned upload parameters from Vercel trusted backend
    const result = await receiptService.presignUpload({
      groupId,
      receiptId,
      fileName,
      fileType: file.type || "image/jpeg",
    }) as { url: string; fields: Record<string, string>; objectKey: string };
    const { url, fields } = result;

    // 2. Perform direct upload from browser to private AWS S3
    const formData = new FormData();
    Object.entries(fields).forEach(([key, val]) => {
      formData.append(key, val as string);
    });
    formData.append("file", file);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`S3 direct upload failed: ${response.statusText}`);
    }

    return {
      storageProvider: "s3",
      bucket,
      region,
      objectKey,
      contentType: file.type || "image/jpeg",
      sizeBytes: file.size,
    };
  }

  async getReceiptBlob(objectKey: string): Promise<Blob> {
    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
      return new Blob(["mock-image-data"], { type: "image/jpeg" });
    }

    const parts = objectKey.split("/");
    // objectKey layout: groups/{groupId}/receipts/{receiptId}/v{version}/{fileName}
    const groupId = parts[1];
    const receiptId = parts[3];

    const { receiptService } = await import("../firebase/receiptService");
    const result = await receiptService.presignDownload({
      groupId,
      receiptId,
    }) as { downloadUrl: string };
    const { downloadUrl } = result;

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from S3: ${response.statusText}`);
    }

    return response.blob();
  }
}

export const receiptStorage: ReceiptStorageProvider = new S3ReceiptStorageProvider();
