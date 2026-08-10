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
    void groupId;
    void receiptId;
    void file;
    void fileName;
    void version;
    throw new Error("BLOCKED — awaiting trusted signing endpoint from Step 4");
  }

  async getReceiptBlob(objectKey: string): Promise<Blob> {
    void objectKey;
    throw new Error("BLOCKED — awaiting trusted signing endpoint from Step 4");
  }
}

export const receiptStorage: ReceiptStorageProvider = new S3ReceiptStorageProvider();
