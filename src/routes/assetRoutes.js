const express = require('express');
const router = express.Router();
const AssetController = require('../controllers/assetController');

router.get('/', AssetController.getAllAssets);
router.post('/', AssetController.createAsset);
router.post('/sample', AssetController.addSampleAssets);
router.get('/:id', AssetController.getAssetById);
router.put('/:id', AssetController.updateAsset);
router.delete('/:id', AssetController.deleteAsset);

module.exports = router;
