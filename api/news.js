module.exports = async (req, res) => {
  try {
    const clean = value => String(value || '').replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    const neighborhood = clean(req.query.neighborhood);
    const district = clean(req.query.district);
    const city = clean(req.query.city);
    const label = clean(req.query.label);
    const country = clean(req.query.country).toLowerCase();
    const locality = [neighborhood, district].filter((x, i, a) => x.length > 2 && a.findIndex(y => y.toLocaleLowerCase('tr') === x.toLocaleLowerCase('tr')) === i);
    let query = '';
    if (locality.length > 1) query = '(' + locality.map(x => '"' + x + '"').join(' OR ') + ')';
    else if (locality.length === 1) query = '"' + locality[0] + '"';
    else if (city) query = '"' + city + '"';
    if (city && !locality.some(x => x.toLocaleLowerCase('tr') === city.toLocaleLowerCase('tr'))) query += ' "' + city + '"';
    if (!query.trim()) query = '"' + label.split(',').slice(0, 3).join(' ') + '"';
    if (country === 'tr') query += ' sourcecountry:turkey';
    if (!query.trim()) return res.status(400).json({ error: true, message: 'Haber araması için yeterli konum bilgisi yok.' });
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.search = new URLSearchParams({ query, mode: 'ArtList', format: 'json', maxrecords: '40', sort: 'DateDesc', timespan: '7d' });
    const upstream = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(18000) });
    const body = await upstream.text();
    if (!upstream.ok) {
      const rateLimited = /too fast|rate.?limit|queries.*fast/i.test(body);
      return res.status(rateLimited ? 429 : 502).json({ error: true, message: rateLimited ? 'GDELT arama sınırına ulaşıldı.' : 'GDELT HTTP ' + upstream.status + ' yanıtı verdi.' });
    }
    let data;
    try { data = JSON.parse(body); } catch {
      return res.status(502).json({ error: true, message: 'GDELT geçerli JSON döndürmedi.' });
    }
    if (!Array.isArray(data.articles)) return res.status(502).json({ error: true, message: 'GDELT yanıtında makale listesi bulunamadı.' });
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    return res.status(200).json({ source: 'GDELT DOC 2.0', query, articles: data.articles });
  } catch (error) {
    return res.status(502).json({ error: true, message: 'Haber verisi alınamadı: ' + (error.message || 'Bağlantı hatası') });
  }
};
