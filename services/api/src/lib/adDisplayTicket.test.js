import {it,expect} from 'vitest';
import {createDisplayTicket,verifyDisplayTicket} from './adDisplayTicket.js';
it('binds display proof to creative, viewer and minimum dwell and expires it',()=>{
  process.env.JWT_SECRET='test-only-ticket-secret';
  const token=createDisplayTicket('ad','viewer',10000);
  expect(verifyDisplayTicket(token,'ad','viewer','impression',10999)).toBeNull();
  expect(verifyDisplayTicket(token,'ad','viewer','impression',11000)).toBeTruthy();
  expect(verifyDisplayTicket(token,'other','viewer','impression',11000)).toBeNull();
  expect(verifyDisplayTicket(token,'ad','other','impression',11000)).toBeNull();
  expect(verifyDisplayTicket(token+'a','ad','viewer','impression',11000)).toBeNull();
  expect(verifyDisplayTicket(token,'ad','viewer','click',130001)).toBeNull();
});
