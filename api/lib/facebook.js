// Тянет сделки из amoCRM API v4.
// Нужен долгоживущий токен интеграции. Метка креатива (ad_id) лежит в кастомном поле сделки,
// его id задаётся в AMO_ADID_FIELD_ID. Этапы квала и продажи задаются id статусов.

export async function fetchAmo() {
  const sub = process.env.AMO_SUBDOMAIN;      // например mycompany
  const token = process.env.AMO_TOKEN;
  const adFieldId = String(process.env.AMO_ADID_FIELD_ID || "");
  const qualIds = (process.env.AMO_QUAL_STATUS_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  const wonId = String(process.env.AMO_WON_STATUS_ID || "142"); // 142 = стандартный "Успешно реализовано"
  if (!sub || !token) throw new Error("Не заданы AMO_SUBDOMAIN или AMO_TOKEN");

  const base = `https://${sub}.amocrm.ru/api/v4/leads`;
  const out = [];
  let page = 1;
  for (; page <= 100; page++) {
    const url = `${base}?limit=250&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 204) break;            // пустая страница, конец
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`amoCRM: ${res.status} ${t.slice(0, 300)}`);
    }
    const json = await res.json();
    const leads = (json._embedded && json._embedded.leads) || [];
    if (!leads.length) break;
    leads.forEach(l => {
      let adId = "";
      const cf = l.custom_fields_values || [];
      const f = cf.find(x => String(x.field_id) === adFieldId);
      if (f && f.values && f.values[0]) adId = String(f.values[0].value || "").trim();
      const status = String(l.status_id);
      out.push({
        adId,
        stageId: status,
        amount: Number(l.price || 0),
        isQual: qualIds.includes(status) || status === wonId ? 1 : 0,
        isSale: status === wonId ? 1 : 0
      });
    });
    if (!json._links || !json._links.next) break;
  }
  return out; // массив по сделкам
}
