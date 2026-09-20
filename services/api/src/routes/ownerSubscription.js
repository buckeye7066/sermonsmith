import {Router} from 'express';
import {ownerSubscription} from '../lib/ownerSubscription.js';
import {authenticateToken} from '../middleware/auth.js';
const router=Router();
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/status',authenticateToken,(_req,res)=>{
  if(!ownerSubscription.isOwner())return res.status(403).json({message:'Owner access required'});
  return res.json(ownerSubscription.status());
});
router.use('/worker',(req,res,next)=>{
  if(!ownerSubscription.authorized(req.get('authorization')))return res.status(401).json({error:'unauthorized'});
  next();
});
router.post('/worker/poll',(req,res)=>res.json(ownerSubscription.poll(req.body)));
router.post('/worker/result',(req,res)=>res.status(ownerSubscription.result(req.body)?200:409).json({received:true}));
export default router;
