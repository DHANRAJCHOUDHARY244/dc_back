import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@config/s3";
const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;
class S3Service {
    async uploadFile(fileBuffer: Buffer, key: string, contentType: string = "application/octet-stream") {
      try {
        const params = {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        };
        const urlData =await s3Client.send(new PutObjectCommand(params));
        const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
       console.log("File uploaded successfully:", fileUrl);
       return fileUrl;
      } catch (error) {
        console.error("Upload error:", error);
      }
    }
  
    async getFileUrl(key: string, expiresIn: number = 3600) {
      try {
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
        return await getSignedUrl(s3Client, command, { expiresIn });
      } catch (error) {
        console.error("Error getting file URL:", error);
      }
    }
  
    async deleteFile(key: string) {
      try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        console.log("File deleted successfully");
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  
  async listFiles(prefix: string = "", continuationToken?: string, pageSize: number = 20) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: pageSize, // page size
      ContinuationToken: continuationToken, // fetch next page if token passed
    });

    const response = await s3Client.send(command);

    return {
      files: response.Contents?.map((file) => file.Key) || [],
      nextToken: response.IsTruncated ? response.NextContinuationToken : null,
      isTruncated: response.IsTruncated ?? false,
    };
  } catch (error) {
    console.error("Error listing files:", error);
    throw error;
  }
}

  
    async copyFile(sourceKey: string, destinationKey: string) {
      try {
        const params = {
          Bucket: BUCKET_NAME,
          CopySource: `/${BUCKET_NAME}/${sourceKey}`,
          Key: destinationKey,
        };
        await s3Client.send(new CopyObjectCommand(params));
        console.log("File copied successfully");
      } catch (error) {
        console.error("Error copying file:", error);
      }
    }
  async signedUrl (url: string, expiresIn: number = 3600) {
    try {
      const key = url.split(`https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`)[1];
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error("Error getting signed URL:", error);
    }
  }
  }
  
export const s3Service = new S3Service();