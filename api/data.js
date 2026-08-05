// GET /api/data?from=2026-06-01&to=2026-07-29
// Сливает расход из Facebook и сделки из amoCRM по ad_id, считает метрики по каждому креативу.
import { fetchFacebook } from "../lib/facebook.js";
import { fetchAmo } from "../lib/amocrm.js";

export default async function handler(req, res) {
  try {
    const from = (req.query.from) || defaultFrom();
    const to = (req.query.to) || today();

    const [fb, amo] = await Promise.all([fetchFacebook(from, to), fetchAmo()]);

    // агрегируем сделки по ad_id
    const deals = {};
    for (const d of amo) {
      const k = d.adId || "__no_ad__";
      if (!deals[k]) deals[k] = { leads: 0, qual: 0, sales: 0, revenue: 0 };
      deals[k].leads += 1;
      deals[k].qual += d.isQual;
      deals[k].sales += d.isSale;
      if (d.isSale) deals[k].revenue += d.amount;
    }

    // агрегируем расход по ad_id (на случай нескольких строк одного объявления)
    const ads = {};
    for (const a of fb) {
      if (!ads[a.adId]) ads[a.adId] = { ...a, spend: 0, impressions: 0, clicks: 0 };
      ads[a.adId].spend += a.spend;
      ads[a.adId].impressions += a.impressions;
      ads[a.adId].clicks += a.clicks;
    }

    const rows = Object.values(ads).map(a => {
      const d = deals[a.adId] || { leads: 0, qual: 0, sales: 0, revenue: 0 };
      return {
        adId: a.adId,
        creative: a.creative,
        campaign: a.campaign,
        channel: a.channel,
        spend: round(a.spend),
        impressions: a.impressions,
        clicks: a.clicks,
        leads: d.leads,
        qual: d.qual,
        sales: d.sales,
        revenue: round(d.revenue)
      };
    });

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ from, to, rows, updated: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

const round = n => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
