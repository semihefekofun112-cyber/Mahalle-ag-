
module.exports = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({
        error: true,
        message: 'Geçerli enlem ve boylam gerekli.'
      });
    }

    const radiusKm = Math.min(250, Math.max(25, Number(req.query.radius) || 150));
    const dLat = radiusKm / 111.32;
    const dLon = radiusKm / (111.32 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      start: start.toISOString().slice(0, 19),
      end: end.toISOString().slice(0, 19),
      minlat: (lat - dLat).toFixed(4),
      maxlat: (lat + dLat).toFixed(4),
      minlon: (lon - dLon).toFixed(4),
      maxlon: (lon + dLon).toFixed(4),
      limit: '1000',
      format: 'json',
      orderby: 'timedesc'
    });

    const upstream = await fetch(
      'https://deprem.afad.gov.tr/apiv2/event/filter?' + params,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      }
    );

    const body = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        error: true,
        message: 'AFAD servisi HTTP ' + upstream.status + ' yanıtı verdi.'
      });
    }

    let events;
    try {
      events = JSON.parse(body);
    } catch {
      return res.status(502).json({
        error: true,
        message: 'AFAD servisi geçerli JSON döndürmedi.'
      });
    }

    if (!Array.isArray(events)) {
      return res.status(502).json({
        error: true,
        message: 'AFAD yanıt biçimi beklenenden farklı.'
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    return res.status(200).json({
      source: 'AFAD',
      radiusKm,
      events
    });
  } catch (error) {
    return res.status(502).json({
      error: true,
      message: 'AFAD verisi alınamadı: ' + (error.message || 'Bağlantı hatası')
    });
  }
};
