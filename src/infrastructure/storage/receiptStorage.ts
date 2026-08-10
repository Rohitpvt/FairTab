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
    _groupId: string,
    _receiptId: string,
    _file: File | Blob,
    _fileName: string,
    _version: number
  ): Promise<ReceiptStorageMetadata> {
    console.log("S3 Bucket:", import.meta.env.VITE_S3_BUCKET_NAME || "fairtab-48340-receipts");
    console.log("S3 Region:", import.meta.env.VITE_S3_REGION || "ap-south-1");
    throw new Error("BLOCKED — awaiting trusted signing endpoint from Step 4");
  }

  async getReceiptBlob(_objectKey: string): Promise<Blob> {
    throw new Error("BLOCKED — awaiting trusted signing endpoint from Step 4");
  }
}

export const receiptStorage: ReceiptStorageProvider = new S3ReceiptStorageProvider();
