import * as path from 'path';
import * as AWS from 'aws-sdk';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PromiseResult } from 'aws-sdk/lib/request';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AwsService {
  private readonly awsS3: AWS.S3;
  public readonly S3_BUCKET_NAME: string;

  constructor(
    @InjectRepository(User) 
    private readonly userRepository : Repository<User>
  ) {
    this.awsS3 = new AWS.S3({
      accessKeyId: process.env.S3ACCESSKEY, 
      secretAccessKey: process.env.S3SECERTKEY,
      region: process.env.S3REGION,
    });
    this.S3_BUCKET_NAME = process.env.S3BUCKET; 
  }

  async uploadFileToS3 (folder: string, file: Express.Multer.File): Promise<{
    key: string;
    s3Object: PromiseResult<AWS.S3.PutObjectOutput, AWS.AWSError>;
    contentType: string;
    url: string;
  }> {
    try {
      const key = `${folder}/${Date.now()}_${path.basename(file.originalname,)}`.replace(/ /g, ''); // 공백을 제거해주는 정규식

      const s3Object = await this.awsS3
        .putObject({
          Bucket: this.S3_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ACL: 'public-read',
          ContentType: file.mimetype,
        }).promise();
        
      const imgUrl = `https://${this.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;  
      //phtatoland
      return { key, s3Object, contentType: file.mimetype, url: imgUrl };
    
    } catch (error) {
      throw new BadRequestException(`File upload failed : ${error}`);
    }
  }

  async deleteS3Object(key: string,callback?: (err: AWS.AWSError, data: AWS.S3.DeleteObjectOutput) => void): Promise<{ success: true }> {
    try {
      await this.awsS3
        .deleteObject(
          {
            Bucket: this.S3_BUCKET_NAME,
            Key: key,
          },
          callback,
        )
        .promise();
      return { success: true };
    } catch (error) {
      throw new BadRequestException(`Failed to delete file : ${error}`);
    }
  }

  public getAwsS3FileUrl(objectKey: string) {
    return `https://${this.S3_BUCKET_NAME}.s3.amazonaws.com/${objectKey}`;
  }
}