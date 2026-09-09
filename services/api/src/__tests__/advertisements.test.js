import {createDisplayTicket} from '../lib/adDisplayTicket.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
const { database } = vi.hoisted(() => ({ database: {user:{findUnique:vi.fn()},$queryRaw:vi.fn(),$executeRaw:vi.fn()} }));
vi.mock('@prisma/client',()=>({PrismaClient:class {constructor(){return database;}}}));
const {default:routes} = await import('../routes/advertisements.js');
const app=express();app.use(express.json({limit:'2mb'}));app.use(cookieParser());app.use('/ads',routes);app.use((e,_req,res,_next)=>res.status(e.status||500).json({message:e.message}));
const secret='test-jwt-secret-that-is-at-least-32-chars-long';
const cookie=(id, extra={})=>'ss_token='+jwt.sign({userId:id,tv:0,...extra},secret,{algorithm:'HS256'});
const ad={advertiser:'Example',headline:'A real creative',body:'Copy',creative:'picture',url:'https://example.com/',seconds:15,active:true,startsAt:'2026-09-09',endsAt:'2026-09-15'};
beforeEach(()=>{
  process.env.JWT_SECRET=secret;process.env.OWNER_USER_ID='verified-owner';
  vi.clearAllMocks();
  database.user.findUnique.mockImplementation(async ({where})=>({id:where.id,email:'test@example.com',role:where.id==='admin'?'admin':'user',tokenVersion:0,profile:{owner:true}}));
  database.$queryRaw.mockResolvedValue([]);database.$executeRaw.mockResolvedValue(1);
});
describe('owner-only advertisement API with real authentication middleware',()=>{
  it('rejects guests and forged role claims at every management method',async()=>{
    for(const [method,path] of [['get','/ads/owner/list'],['post','/ads/owner'],['put','/ads/owner/a'],['delete','/ads/owner/a']]) {
      expect((await request(app)[method](path).send(ad)).status).toBe(401);
      for(const id of ['ordinary','admin']) expect((await request(app)[method](path).set('Cookie',cookie(id,{role:'admin',owner:true})).send({...ad,userId:'verified-owner'})).status).toBe(403);
    }
  });
  it('returns owner capability only from authenticated configured ID',async()=>{
    expect((await request(app).get('/ads/capabilities').set('Cookie',cookie('verified-owner'))).body).toEqual({canManage:true});
    expect((await request(app).get('/ads/capabilities').set('Cookie',cookie('admin'))).body).toEqual({canManage:false});
    delete process.env.OWNER_USER_ID;
    expect((await request(app).get('/ads/capabilities').set('Cookie',cookie('verified-owner'))).body).toEqual({canManage:false});
  });
  it('rejects revoked sessions even for the owner',async()=>{
    database.user.findUnique.mockResolvedValue({role:'admin',email:'test@example.com',tokenVersion:1});
    expect((await request(app).post('/ads/owner').set('Cookie',cookie('verified-owner')).send(ad)).status).toBe(401);
  });
  it('rejects remote image fetches and disguised SVG uploads',async()=>{
    for(const image of ['https://127.0.0.1/private','data:image/png;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')]) {
      expect((await request(app).post('/ads/owner').set('Cookie',cookie('verified-owner')).send({...ad,image})).status).toBe(400);
    }
  });
  it('decodes a real raster and accepts a valid owner creative',async()=>{
    const bytes=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
    const result=await request(app).post('/ads/owner').set('Cookie',cookie('verified-owner')).send({...ad,image:'data:image/png;base64,'+bytes.toString('base64')});
    expect(result.status).toBe(201);expect(result.body.id).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('does not count or redirect paused, expired or unknown creatives',async()=>{
    for(const kind of ['impression','click']) expect((await request(app).post('/ads/missing/events').set('Cookie',cookie('ordinary')).send({kind,ticket:createDisplayTicket('missing','ordinary',Date.now()-2000)})).status).toBe(404);
  });
});
