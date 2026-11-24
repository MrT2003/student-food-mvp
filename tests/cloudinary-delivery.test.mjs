import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('../lib/cloudinary/delivery.ts', import.meta.url), 'utf8')).replace('export function', 'function');
const optimize = new Function(source + ';return cloudinaryDeliveryUrl;')();
test('adds delivery optimization without changing asset version, path or extension', () => {
 const input='https://res.cloudinary.com/my-cloud/image/upload/v123/student-food/avatar/a.png';
 const result=optimize(input);
 assert.equal(result,'https://res.cloudinary.com/my-cloud/image/upload/f_auto,q_auto/v123/student-food/avatar/a.png');
 assert.equal(optimize(result), result);
 assert.equal(optimize('https://res.cloudinary.com/my-cloud/image/upload/sample.jpg'),'https://res.cloudinary.com/my-cloud/image/upload/f_auto,q_auto/sample.jpg');
});
test('preserves external, local, signed, private and intentionally transformed URLs', () => {
 for (const url of ['/local.png','blob:https://app.test/id','data:image/png;base64,AAAA','https://lh3.googleusercontent.com/a.jpg',
  'https://res.cloudinary.com.evil.test/cloud/image/upload/a.jpg',
  'https://res.cloudinary.com/cloud/image/private/a.jpg',
  'https://res.cloudinary.com/cloud/image/upload/s--signature--/v123/a.jpg',
  'https://res.cloudinary.com/cloud/image/upload/w_100/a.jpg',
  'https://res.cloudinary.com/cloud/image/upload/f_webp,q_80/a.jpg',
  'https://res.cloudinary.com/cloud/image/upload/a.jpg?token=secret']) assert.equal(optimize(url),url);
});
