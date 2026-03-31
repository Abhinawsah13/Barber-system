import SystemSettings from '../models/SystemSettings.js';

export const getSettings = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }
        res.status(200).json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const { 
            basic_commission, 
            premium_commission, 
            premium_subscription_price,
            refund_2h_more,
            refund_1h_to_2h,
            refund_less_than_1h,
            refund_barber_on_way
        } = req.body;
        
        // Ensure values are numbers and valid
        if (basic_commission < 0 || basic_commission > 100 || premium_commission < 0 || premium_commission > 100) {
            return res.status(400).json({ success: false, message: 'Commission rates must be between 0 and 100' });
        }

        const refundFields = [refund_2h_more, refund_1h_to_2h, refund_less_than_1h, refund_barber_on_way];
        for (const val of refundFields) {
            if (val !== undefined && (val < 0 || val > 100)) {
                return res.status(400).json({ success: false, message: 'Refund percentages must be between 0 and 100' });
            }
        }

        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }

        settings.basic_commission = basic_commission ?? settings.basic_commission;
        settings.premium_commission = premium_commission ?? settings.premium_commission;
        settings.premium_subscription_price = premium_subscription_price ?? settings.premium_subscription_price;
        
        settings.refund_2h_more = refund_2h_more ?? settings.refund_2h_more;
        settings.refund_1h_to_2h = refund_1h_to_2h ?? settings.refund_1h_to_2h;
        settings.refund_less_than_1h = refund_less_than_1h ?? settings.refund_less_than_1h;
        settings.refund_barber_on_way = refund_barber_on_way ?? settings.refund_barber_on_way;

        await settings.save();

        res.status(200).json({ success: true, message: 'Settings updated successfully', settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update system settings' });
    }
};
