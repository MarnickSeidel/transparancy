import type { Lang } from "@/lib/i18n"

/** Variant pools for listing narrative NLG (not merged into uiText). */
export const narrativeCopy = {
  es: {
    leadGood: [
      "En {place}, este {type} de {area} m² pide ~{pct}% menos por m² que anuncios parecidos.",
      "El precio/m² de este {type} ({area} m², {place}) queda ~{pct}% bajo la referencia del barrio.",
      "Frente a comparables en {place}, el aviso se ve ~{pct}% más barato por m² — {type}, {area} m².",
      "Hay un margen a favor del comprador: ~{pct}% bajo la mediana comparable para este {type} en {place}.",
    ],
    leadFair: [
      "Este {type} de {area} m² en {place} se mueve cerca de lo que piden anuncios similares.",
      "En {place}, el precio/m² de este {type} ({area} m²) está alineado con la mediana local.",
      "Nada extremo en el ticket: {type} de {area} m² en {place}, en línea con el mercado de publicación.",
      "Comparado con avisos parecidos en {place}, este {type} de {area} m² no destaca ni hacia arriba ni hacia abajo.",
    ],
    leadOver: [
      "En {place}, este {type} de {area} m² pide ~{pct}% más por m² que la referencia de comparables.",
      "El precio/m² queda ~{pct}% por encima de anuncios similares — {type}, {area} m² en {place}.",
      "Frente al barrio, el aviso se ve caro: ~{pct}% sobre la mediana comparable ({type}, {area} m²).",
      "Para {place}, el ticket de este {type} ({area} m²) supera en ~{pct}% lo que suelen pedir avisos parecidos.",
    ],
    leadInsufficient: [
      "En {place} aún escasean avisos parecidos a este {type} de {area} m² para fijar una referencia sólida.",
      "Con pocos comparables cerca, el análisis de este {type} ({area} m², {place}) es solo orientativo.",
      "Falta muestra en {place}: no hay suficientes anuncios similares a este {type} de {area} m².",
    ],
    supportHigh: [
      "Lo leemos con {count} avisos activos ({method}).",
      "Base sólida: {count} comparables por {method}.",
      "Hay {count} anuncios similares en la muestra ({method}).",
    ],
    supportMedium: [
      "Hay {count} comparables ({method}); conviene mirar el barrio con calma.",
      "Muestra intermedia — {count} avisos por {method}.",
      "Con {count} similares ({method}), el contraste sigue siendo útil.",
    ],
    supportLow: [
      "Ojo: solo {count} comparables ({method}).",
      "Muestra chica ({count}, {method}) — toma el % con cautela.",
      "Pocos pares cercanos: {count} avisos ({method}).",
    ],
    supportNone: [
      "Sin muestra suficiente, el puntaje es solo una guía.",
      "Aquí el número es orientativo hasta tener más avisos parecidos.",
    ],
    snapshotBeds: [
      "Perfil del aviso: {beds} alcobas y {baths} baños{estratoPart}.",
      "En ficha: {beds} hab., {baths} baños{estratoPart}.",
    ],
    snapshotEstrato: [
      "Estrato {estrato} en {place}.",
      "Zona estrato {estrato}.",
    ],
    priceDrop: [
      "Además, el precio de publicación bajó ~{pct}% hace poco.",
      "Hubo un recorte reciente de ~{pct}% en el aviso.",
      "El vendedor ya bajó el ticket ~{pct}%.",
    ],
    longDom: [
      "Lleva {days} días publicado — suele haber más margen de negociación.",
      "Con {days} días en mercado, el aviso no es nuevo.",
      "Tiempo en portal: {days} días.",
    ],
    nearbyPark: [
      "A {dist} queda {place} — aire libre cerca.",
      "Verde a mano: {place} (~{dist}).",
    ],
    nearbyGrocery: [
      "Compras cotidianas: {place} a unos {dist}.",
      "A {dist} está {place} para el mercado del día a día.",
    ],
    nearbyFood: [
      "Para comer o un café: {place} a unos {dist}.",
      "A {dist} queda {place}.",
    ],
    nearbySports: [
      "Deporte y ocio cerca: {place} (~{dist}).",
      "A {dist} está {place}.",
    ],
    nearbyServices: [
      "Bancos y cajeros a mano: {place} (~{dist}).",
      "A {dist} queda {place}.",
    ],
    nearbyTransit: [
      "Moverse es fácil: {place} a ~{dist}.",
      "Transporte cercano — {place} (~{dist}).",
    ],
    nearbyEducation: [
      "Educación a tiro de piedra: {place} (~{dist}).",
      "A {dist} está {place}.",
    ],
    nearbyHealth: [
      "Salud cerca: {place} a unos {dist}.",
      "A {dist} queda {place}.",
    ],
    nearbyTwo: [
      "Alrededor: {place1} (~{dist1}) y {place2} (~{dist2}).",
      "En el entorno inmediato aparecen {place1} a {dist1} y {place2} a {dist2}.",
      "Cerca conviven {place1} ({dist1}) y {place2} ({dist2}).",
    ],
    nearbyCategories: [
      "En ~1 km el mapa marca {categories}.",
      "El entorno suma {categories} a poca distancia.",
    ],
    walkIntro: [
      "Ubicación cómoda a pie: servicios básicos quedan cerca.",
      "Barrio práctico para el día a día — lo esencial está a poca distancia.",
      "Entorno bien conectado: varios servicios a distancia caminable.",
    ],
    walkBody: [
      "Colegios desde {education}, salud desde {health}, supermercados desde {groceries}, parques desde {parks} y transporte desde {transit}.",
      "A pie: educación a {education}, salud a {health}, compras a {groceries}, parques a {parks} y transporte a {transit}.",
      "Lo más cercano: colegios ({education}), salud ({health}), supermercado ({groceries}), parque ({parks}) y transporte ({transit}).",
    ],
    walkBodyPartial: [
      "A distancia caminable: {parts}.",
      "Servicios cerca: {parts}.",
    ],
    walkPartEducation: ["colegios desde {dist}"],
    walkPartHealth: ["salud desde {dist}"],
    walkPartGroceries: ["supermercados desde {dist}"],
    walkPartParks: ["parques desde {dist}"],
    walkPartTransit: ["transporte desde {dist}"],
    buildingAmenities: [
      "En el conjunto o edificio: {amenities}.",
      "Comodidades del aviso: {amenities}.",
      "También suma {amenities} en el inmueble.",
    ],
  },
  en: {
    leadGood: [
      "In {place}, this {type} ({area} m²) asks ~{pct}% less per m² than similar listings.",
      "Price/m² sits ~{pct}% under the local reference — {type}, {area} m² in {place}.",
      "Against comps in {place}, the ask looks ~{pct}% cheaper per m² for this {area} m² {type}.",
      "Buyer-leaning ticket: ~{pct}% below the comparable median for a {type} in {place}.",
    ],
    leadFair: [
      "This {area} m² {type} in {place} tracks what similar listings ask.",
      "In {place}, price/m² for this {type} ({area} m²) lines up with the local median.",
      "No extreme ask: {type}, {area} m² in {place}, in line with published comps.",
      "Versus similar ads in {place}, this {area} m² {type} sits near the middle.",
    ],
    leadOver: [
      "In {place}, this {type} ({area} m²) asks ~{pct}% more per m² than the comparable reference.",
      "Price/m² runs ~{pct}% above similar listings — {type}, {area} m² in {place}.",
      "Versus the neighborhood, the ask looks rich: ~{pct}% over the comparable median.",
      "For {place}, this {area} m² {type} clears similar asks by ~{pct}%.",
    ],
    leadInsufficient: [
      "In {place} there still aren’t enough similar {type} listings ({area} m²) for a firm reference.",
      "With thin comps nearby, the read on this {area} m² {type} in {place} is only indicative.",
      "Sparse sample in {place}: not enough peers for this {type} of {area} m².",
    ],
    supportHigh: [
      "We read it against {count} active listings ({method}).",
      "Solid base: {count} comps via {method}.",
      "{count} similar ads in the sample ({method}).",
    ],
    supportMedium: [
      "{count} comps ({method}) — worth a second look at the barrio.",
      "Mid-sized sample: {count} listings via {method}.",
      "With {count} peers ({method}), the contrast still helps.",
    ],
    supportLow: [
      "Caution: only {count} comps ({method}).",
      "Thin sample ({count}, {method}) — treat the % carefully.",
      "Few nearby peers: {count} listings ({method}).",
    ],
    supportNone: [
      "Without enough comps, the score is only a guide.",
      "Treat the number as indicative until more similar ads appear.",
    ],
    snapshotBeds: [
      "Listing profile: {beds} beds and {baths} baths{estratoPart}.",
      "On the sheet: {beds} bed, {baths} bath{estratoPart}.",
    ],
    snapshotEstrato: [
      "Estrato {estrato} in {place}.",
      "Estrato {estrato} area.",
    ],
    priceDrop: [
      "The asking price also dropped ~{pct}% recently.",
      "There was a recent ~{pct}% cut on the listing.",
      "The seller already lowered the ask by ~{pct}%.",
    ],
    longDom: [
      "It’s been listed {days} days — often more room to negotiate.",
      "With {days} days on market, this isn’t a fresh post.",
      "Time on portal: {days} days.",
    ],
    nearbyPark: [
      "{place} is ~{dist} away — green space nearby.",
      "Outdoor space close by: {place} (~{dist}).",
    ],
    nearbyGrocery: [
      "Daily errands: {place} about {dist} away.",
      "{place} is ~{dist} for everyday shopping.",
    ],
    nearbyFood: [
      "Food or coffee nearby: {place} about {dist} away.",
      "{place} is ~{dist} away.",
    ],
    nearbySports: [
      "Sports and leisure close by: {place} (~{dist}).",
      "{place} is about {dist} away.",
    ],
    nearbyServices: [
      "Banks and ATMs nearby: {place} (~{dist}).",
      "{place} is ~{dist} away.",
    ],
    nearbyTransit: [
      "Easy to move around: {place} ~{dist} away.",
      "Transit nearby — {place} (~{dist}).",
    ],
    nearbyEducation: [
      "Schooling close by: {place} (~{dist}).",
      "{place} is about {dist} away.",
    ],
    nearbyHealth: [
      "Care nearby: {place} about {dist} away.",
      "{place} is ~{dist} away.",
    ],
    nearbyTwo: [
      "Around the home: {place1} (~{dist1}) and {place2} (~{dist2}).",
      "Right nearby you’ll find {place1} at {dist1} and {place2} at {dist2}.",
      "Close by: {place1} ({dist1}) and {place2} ({dist2}).",
    ],
    nearbyCategories: [
      "Within ~1 km the map shows {categories}.",
      "The area adds {categories} within a short walk.",
    ],
    walkIntro: [
      "Convenient on foot — everyday services sit nearby.",
      "A practical neighborhood for daily life, with essentials close by.",
      "Well connected surroundings: several services within walking distance.",
    ],
    walkBody: [
      "Schools from {education}, healthcare from {health}, supermarkets from {groceries}, parks from {parks}, and transit from {transit}.",
      "On foot: schools at {education}, healthcare at {health}, groceries at {groceries}, parks at {parks}, and transit at {transit}.",
      "Nearest spots: schools ({education}), healthcare ({health}), supermarket ({groceries}), park ({parks}), and transit ({transit}).",
    ],
    walkBodyPartial: [
      "Within walking distance: {parts}.",
      "Nearby services: {parts}.",
    ],
    walkPartEducation: ["schools from {dist}"],
    walkPartHealth: ["healthcare from {dist}"],
    walkPartGroceries: ["supermarkets from {dist}"],
    walkPartParks: ["parks from {dist}"],
    walkPartTransit: ["transit from {dist}"],
    buildingAmenities: [
      "Building / complex amenities: {amenities}.",
      "On the listing: {amenities}.",
      "It also offers {amenities}.",
    ],
  },
} as const satisfies Record<Lang, Record<string, readonly string[]>>
