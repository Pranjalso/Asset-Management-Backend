const AssetModel = require('../models/assetModel');

class AssetController {
    static async getAllAssets(req, res, next) {
        try {
            const assets = await AssetModel.findAll();
            res.json({
                success: true,
                data: assets,
                count: assets.length
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAssetById(req, res, next) {
        try {
            const { id } = req.params;
            const asset = await AssetModel.findById(id);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            res.json({ success: true, data: asset });
        } catch (error) {
            next(error);
        }
    }

    static async createAsset(req, res, next) {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, error: 'Asset name is required' });
            }
            
            const asset = await AssetModel.create(req.body);
            res.status(201).json({
                success: true,
                message: 'Asset created successfully',
                data: asset
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateAsset(req, res, next) {
        try {
            const { id } = req.params;
            const asset = await AssetModel.update(id, req.body);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            res.json({
                success: true,
                message: 'Asset updated successfully',
                data: asset
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteAsset(req, res, next) {
        try {
            const { id } = req.params;
            const asset = await AssetModel.delete(id);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            res.json({
                success: true,
                message: 'Asset deleted successfully',
                data: asset
            });
        } catch (error) {
            next(error);
        }
    }

    static async addSampleAssets(req, res, next) {
        try {
            const sampleAssets = [
                ['Laptop Dell XPS 13', 'High-end development laptop', 'Electronics', 5, 1299.99, 'active'],
                ['Office Chair Herman Miller', 'Ergonomic office chair', 'Furniture', 10, 850.00, 'active'],
                ['Projector Epson', '4K projector for presentations', 'Electronics', 2, 899.00, 'active'],
                ['Whiteboard Large', 'Magnetic whiteboard 4x6 feet', 'Office Supplies', 3, 150.00, 'active'],
                ['Server Rack', '42U server rack for data center', 'Hardware', 1, 1200.00, 'active']
            ];

            await AssetModel.createMany(sampleAssets);

            res.json({
                success: true,
                message: 'Sample assets added successfully!'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AssetController;
