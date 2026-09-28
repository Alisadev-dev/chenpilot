import { Router } from 'express';
import atomiq from './atomiq.routes';
import troves from './troves.routes';
import vesu from './vesu.routes';
import xverse from './xverse.routes';
import dataExport from '../services/dataExport.routes';

const router = Router();

router.use('/atomiq', atomiq);
router.use('/troves', troves);
router.use('/vesu', vesu);
router.use('/xverse', xverse);
router.use('/export', dataExport);

export default router;
