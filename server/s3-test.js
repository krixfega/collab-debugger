require('dotenv').config();
console.log('Loaded AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function listBuckets() {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  try {
    const result = await s3.send(new ListBucketsCommand({}));
    console.log('✅ Buckets:', result.Buckets.map(b => b.Name));
  } catch (err) {
    console.error('S3 error:', err.message);
  }
}

listBuckets();