// Тянет данные по каждому объявлению из Facebook Marketing API.
// Нужен токен с доступом ads_read. Аккаунты перечисляются в FB_AD_ACCOUNTS через запятую.

const GRAPH = "https://graph.facebook.com/v21.0";

function numFromActions(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + Number(a.value || 0), 0);
}

async function fetchAccount(accountId, from, to, token) {
  const params = new URLSearchParams({
    level: "ad",
    fields: "ad_id,ad_name,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions",
    time_range: JSON.stringify({ since: from, until: to }),
    limit: "500",
    access_token: token
  });
  let url = `${GRAPH}/act_${accountId}/insights?${params}`;
  const out = [];
  for (let guard = 0; guard < 40 && url; guard++) {
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Facebook ${accountId}: ${res.status} ${t.slice(0, 300)}`);
    }
    const json = await res.json();
    (json.data || []).forEach(r => {
      out.push({
        adId: String(r.ad_id),
        creative: r.ad_name || r.ad_id,
        campaign: r.campaign_name || "",
        channel: "Facebook",
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.inline_link_clicks || r.clicks || 0),
        leadsFb: numFromActions(r.actions, ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"])
      });
    });
    url = json.paging && json.paging.next ? json.paging.next : null;
  }
  return out;
}

export async function fetchFacebook(from, to) {
  const token = process.env.FB_TOKEN;
  const accounts = (process.env.FB_AD_ACCOUNTS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!token || !accounts.length) throw new Error("Не заданы FB_TOKEN или FB_AD_ACCOUNTS");
  const all = [];
  for (const acc of accounts) {
    const rows = await fetchAccount(acc, from, to, token);
    all.push(...rows);
  }
  return all; // массив по объявлениям
}
