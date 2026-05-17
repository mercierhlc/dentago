import 'dotenv/config';
import { decrypt } from '@/lib/crypto';

const creds = [
  { label: 'Karuna - Henry Schein',    supplier: 'Henry Schein', username: 'karuna.giri',                        enc: 'v2:kkrZi+Zpkt5kdynQxo9lSTQDzQzUvCwpp7v9tcX6jgMN6xcvrT4=' },
  { label: 'Jerome - Kent Express',    supplier: 'Kent Express', username: 'jerome@thedentistgallery.com',       enc: 'v2:bEZ6JF0v81bYNua9ra+j/ufujCmaKjamW92LyA3cqcGVaTaUdfQ=' },
  { label: 'Townhouse - Henry Schein', supplier: 'Henry Schein', username: 'Townhousedentalpractice',            enc: 'IAAAAAALXRg=' },
  { label: 'Townhouse - Kent Express', supplier: 'Kent Express', username: '70530254',                           enc: 'KQQaGA4EBBxS' },
];

for (const c of creds) {
  try {
    const password = decrypt(c.enc);
    console.log(`${c.label} | user=${c.username} | pass=${password}`);
  } catch (e: any) {
    console.log(`${c.label} | ERROR: ${e.message}`);
  }
}
