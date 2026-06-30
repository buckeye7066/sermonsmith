/**
 * Canonical denomination belief engine.
 *
 * SermonSmith generates sermons "from the viewpoint of a given denomination."
 * To do that with real fidelity (not just dropping a label into the prompt),
 * each tradition here carries a preloaded BELIEF PROFILE describing how that
 * tradition actually reads Scripture, understands salvation, practices the
 * ordinances, preaches, and where it would object to being mischaracterized.
 *
 * Two consumers:
 *   1. UI dropdowns        — DENOMINATION_OPTIONS (grouped by family).
 *   2. AI prompt injection — denominationPromptBlock(name) returns a compact
 *      instruction block so Larry/Arlynn preach from inside the tradition's
 *      own logic.
 *
 * Stored `user.denomination` values come from the onboarding taxonomy and may
 * be a family ("Baptist"), a specific body ("Southern Baptist"), or free text.
 * resolveDenominationProfile() handles all three: exact → specific-alias →
 * family → generic-evangelical fallback. Nothing here ever throws on an
 * unknown string; it degrades to a sensible generic profile.
 */

// ---------------------------------------------------------------------------
// Belief profiles, keyed by family id.
// ---------------------------------------------------------------------------

export const DENOMINATION_PROFILES = {
  catholic: {
    id: 'catholic',
    name: 'Catholic',
    family: 'Catholic',
    summary: 'Roman Catholic — Scripture and Sacred Tradition under the Magisterium.',
    authority:
      'Scripture and Sacred Tradition together, authoritatively interpreted by the Magisterium (Pope and bishops). Use the Catholic canon (incl. deuterocanonical books). The Catechism of the Catholic Church is a key reference.',
    soteriology:
      'Salvation by grace received through faith and the sacraments, cooperating with grace; justification involves both initial grace (baptism) and growth in holiness. Avoid "faith alone" framing.',
    sacraments:
      'Seven sacraments. The Eucharist is the true Body and Blood of Christ (transubstantiation) and the source and summit of the faith. Infant baptism. Confession/Reconciliation.',
    distinctives:
      'Sacramental worldview, communion of saints, intercession of Mary and the saints, apostolic succession, the Mass, purgatory, social teaching on the dignity of the human person.',
    preaching:
      'Homily flows from the lectionary readings and ties to the liturgical season; Christ-centered, sacramentally rich, drawing on the Church Fathers and the Catechism.',
    cautions:
      'Do not present salvation as a one-time "sinner\'s prayer," do not treat tradition as opposed to Scripture, and do not frame Mary or the saints as objects of worship (they are honored and asked to intercede).',
  },

  orthodox: {
    id: 'orthodox',
    name: 'Eastern Orthodox',
    family: 'Orthodox',
    summary: 'Eastern Orthodox — Holy Tradition, the Fathers, and theosis.',
    authority:
      'Holy Tradition, of which Scripture is the heart, received through the seven Ecumenical Councils and the Church Fathers. Read Scripture liturgically and patristically rather than as a private text.',
    soteriology:
      'Salvation as theosis — union with God and participation in the divine life — a lifelong, synergistic healing of human nature, not merely a legal/forensic verdict.',
    sacraments:
      'The Mysteries (sacraments), centered on the Eucharist as the true Body and Blood of Christ. Infant baptism by immersion with chrismation.',
    distinctives:
      'The Holy Trinity, the Incarnation, icons as windows to heaven, apophatic theology, the communion of saints, liturgical worship, fasting, and the role of the Church as the Body of Christ.',
    preaching:
      'Rooted in the liturgical Gospel reading and the Fathers (Chrysostom, Basil, the Cappadocians); emphasizes mystery, the Incarnation, and the transformation of the whole person.',
    cautions:
      'Avoid Western legal/penal framings of the atonement as the whole story, avoid "once saved" language, and never speak of icons as idols.',
  },

  anglican: {
    id: 'anglican',
    name: 'Anglican / Episcopal',
    family: 'Anglican/Episcopal',
    summary: 'Anglican — Scripture, tradition, and reason; Book of Common Prayer.',
    authority:
      'Scripture as supreme, balanced with tradition and reason (the "three-legged stool"). The Book of Common Prayer and the historic creeds shape worship and doctrine; the 39 Articles inform the evangelical stream.',
    soteriology:
      'Justification by grace through faith, held within a sacramental and liturgical life. Breadth across evangelical (more Reformation-shaped) and Anglo-Catholic (more sacramental) wings.',
    sacraments:
      'Two gospel sacraments (Baptism and the Eucharist), with five other sacramental rites. Infant baptism. Real spiritual presence in Communion.',
    distinctives:
      'Common prayer and liturgy, the church calendar, via media (a middle way), episcopal governance, lectionary preaching, and a posture of comprehensiveness.',
    preaching:
      'Anchored in the lectionary and the prayer book; thoughtful, liturgically aware, pastoral, and Christ-centered.',
    cautions:
      'Hold the breadth of the tradition charitably; do not flatten it into either purely Catholic or purely low-church Protestant categories.',
  },

  lutheran: {
    id: 'lutheran',
    name: 'Lutheran',
    family: 'Lutheran',
    summary: 'Lutheran — justification by grace through faith; Law and Gospel.',
    authority:
      'Scripture alone (sola scriptura), confessed through the Book of Concord (Augsburg Confession, Luther\'s Catechisms). Christ is the center and content of all Scripture.',
    soteriology:
      'Justification by grace alone, through faith alone, on account of Christ alone — a forensic declaration received as pure gift, never earned.',
    sacraments:
      'Means of grace: Baptism (including infants, which works forgiveness) and the Lord\'s Supper (the true Body and Blood "in, with, and under" the bread and wine — sacramental union).',
    distinctives:
      'The proper distinction of Law and Gospel, the theology of the cross, simul justus et peccator (saint and sinner at once), vocation, and the bondage of the will.',
    preaching:
      'Always rightly divides Law (which convicts) and Gospel (which forgives), driving the hearer from self to Christ; cross-centered and sacramental.',
    cautions:
      'Do not turn the Gospel into a new set of demands; do not present the Supper as mere symbol; keep the emphasis on what God does, not what we do.',
  },

  reformed: {
    id: 'reformed',
    name: 'Reformed / Presbyterian',
    family: 'Reformed',
    summary: 'Reformed — sovereignty of God, covenant theology, the five solas.',
    authority:
      'Scripture alone, summarized in the Westminster Standards or the Three Forms of Unity (Heidelberg, Belgic, Dort). Read covenantally and redemptive-historically (the whole Bible points to Christ).',
    soteriology:
      'Monergistic salvation by sovereign grace: unconditional election, particular redemption, effectual calling, and perseverance of the saints (the doctrines of grace / TULIP).',
    sacraments:
      'Two sacraments: Baptism (including covenant children) as the sign of the covenant, and the Lord\'s Supper (the real spiritual presence of Christ received by faith).',
    distinctives:
      'The sovereignty of God in all things, covenant theology, God\'s glory as the chief end, regulative principle of worship, and the unity of the covenant of grace across both Testaments.',
    preaching:
      'Expository, Christ-centered, doctrinally rich; traces the text within the unfolding covenant and presses both the indicatives of grace and the imperatives of obedience.',
    cautions:
      'Avoid an Arminian free-will framing of salvation, avoid divorcing law and grace, and do not present election as cold fatalism — it is the ground of assurance and worship.',
  },

  baptist: {
    id: 'baptist',
    name: 'Baptist',
    family: 'Baptist',
    summary: 'Baptist — biblical authority, believer\'s baptism, regenerate church.',
    authority:
      'Scripture as the sole, sufficient, and inerrant authority for faith and practice. Soul competency — each believer can read and respond to Scripture before God.',
    soteriology:
      'Salvation by grace through personal faith in Christ; a conscious, individual conversion. (Calvinist and Arminian streams both exist; default to a broadly evangelical "grace through faith" frame unless a specific body is named.)',
    sacraments:
      'Two ordinances, understood as symbols of obedience rather than means of grace: believer\'s baptism by full immersion (not infants) and the Lord\'s Supper (memorial).',
    distinctives:
      'Believer\'s baptism, a regenerate church membership, local-church autonomy, congregational governance, the priesthood of all believers, religious liberty, and the separation of church and state.',
    preaching:
      'Expository and evangelistic; high view of the biblical text, clear gospel invitation, and direct, practical application calling for personal response.',
    cautions:
      'Never present infant baptism or baptism as saving; keep baptism and the Supper as symbols of an already-received salvation.',
  },

  methodist: {
    id: 'methodist',
    name: 'Methodist / Wesleyan',
    family: 'Methodist',
    summary: 'Wesleyan — prevenient grace, sanctification, faith working through love.',
    authority:
      'Scripture as primary, interpreted through the Wesleyan Quadrilateral (Scripture, tradition, reason, experience), with Scripture holding final authority.',
    soteriology:
      'Arminian grace: prevenient grace that draws all, salvation by grace through faith freely received and resistible, and the real pursuit of sanctification — being made perfect in love.',
    sacraments:
      'Two sacraments: Baptism (including infants, as a sign of prevenient grace) and Holy Communion (a genuine means of grace, real spiritual presence, open table).',
    distinctives:
      'Sanctification and holiness of heart and life, social holiness and works of mercy, the assurance of the Spirit, free grace for all, and "faith working through love."',
    preaching:
      'Warm, transformational, and practical; emphasizes both personal holiness and social compassion, inviting the hearer into a grace-empowered life of love.',
    cautions:
      'Do not present salvation as unconditional election or irresistible grace; hold together personal piety and social justice rather than pitting them against each other.',
  },

  pentecostal: {
    id: 'pentecostal',
    name: 'Pentecostal / Charismatic',
    family: 'Pentecostal',
    summary: 'Pentecostal — Spirit baptism, spiritual gifts, expectant faith.',
    authority:
      'Scripture as the inspired, authoritative Word, read with expectancy that the Spirit still speaks and acts today as in the book of Acts.',
    soteriology:
      'Salvation by grace through faith in Christ, with an emphasis on the new birth and a subsequent baptism in the Holy Spirit empowering the believer for witness and holiness.',
    sacraments:
      'Ordinances of believer\'s baptism by immersion and the Lord\'s Supper (memorial). Strong emphasis on water baptism and Spirit baptism as distinct experiences.',
    distinctives:
      'Baptism in the Holy Spirit, the gifts of the Spirit (tongues, prophecy, healing), divine healing, vibrant worship, expectant prayer, and active evangelism.',
    preaching:
      'Passionate, Spirit-led, and faith-building; expects God to move in the moment, calls for response, and ties Scripture to present-day power and testimony.',
    cautions:
      'Do not present the miraculous gifts as having ceased; keep healing and the Spirit\'s power as live expectations while remaining biblically grounded and pastorally honest.',
  },

  holiness: {
    id: 'holiness',
    name: 'Holiness (Nazarene / Wesleyan-Holiness)',
    family: 'Holiness',
    summary: 'Holiness — entire sanctification and a heart made perfect in love.',
    authority:
      'Scripture as the fully reliable revelation of God\'s will, read within the Wesleyan-holiness tradition.',
    soteriology:
      'Wesleyan-Arminian: prevenient grace, salvation by grace through faith, and entire sanctification — a second work of grace cleansing the heart and empowering holy living.',
    sacraments:
      'Baptism and the Lord\'s Supper as means of grace; strong stress on a holy, consecrated life and victory over sin.',
    distinctives:
      'Heart holiness, entire sanctification, consecration, the witness of the Spirit, and practical, disciplined Christian living.',
    preaching:
      'Earnest and invitational; presses toward full consecration, victory over sin, and a life wholly devoted to God in love.',
    cautions:
      'Hold holiness as grace-empowered relationship, not legalistic perfectionism or mere rule-keeping.',
  },

  anabaptist: {
    id: 'anabaptist',
    name: 'Anabaptist (Mennonite / Brethren / Amish)',
    family: 'Anabaptist',
    summary: 'Anabaptist — discipleship, peace, and the community of the church.',
    authority:
      'Scripture, read with the teaching and example of Jesus (especially the Sermon on the Mount) as the interpretive center, within the discerning community.',
    soteriology:
      'Salvation by grace through faith expressed in costly, visible discipleship — following Jesus in daily life, not merely assenting to doctrine.',
    sacraments:
      'Believer\'s baptism upon a confession of faith (the movement\'s namesake), the Lord\'s Supper, and often footwashing; understood as community ordinances.',
    distinctives:
      'Discipleship (Nachfolge), nonviolence and peacemaking, the church as a committed community, simplicity, mutual aid, and separation from worldly coercion.',
    preaching:
      'Christ-centered and ethically concrete; emphasizes following Jesus, reconciliation, peace, and the shared life of the body.',
    cautions:
      'Keep grace and discipleship together (discipleship flows from grace, not toward earning it); honor the peace witness rather than treating it as optional.',
  },

  restoration: {
    id: 'restoration',
    name: 'Restoration / Church of Christ',
    family: 'Church of Christ',
    summary: 'Restoration — "the Bible alone," New Testament church pattern.',
    authority:
      'The Bible alone as the complete and sufficient pattern; "speak where the Bible speaks, be silent where it is silent." Strong New Testament focus for church practice.',
    soteriology:
      'Salvation by grace through faith expressed in obedience — hearing, believing, repenting, confessing, and being baptized for the remission of sins; baptism understood as the point of receiving forgiveness.',
    sacraments:
      'Believer\'s baptism by immersion (held as essential to salvation) and the Lord\'s Supper observed weekly as a memorial.',
    distinctives:
      'Restoration of the New Testament church, weekly Communion, congregational autonomy, no creed but the Bible, and (in a cappella bodies) singing without instruments.',
    preaching:
      'Text-driven and pattern-conscious; calls hearers to obedient faith and conformity to the New Testament church.',
    cautions:
      'Present baptism\'s role carefully and graciously; respect the non-creedal, Bible-only self-understanding and the a cappella conviction where it applies.',
  },

  adventist: {
    id: 'adventist',
    name: 'Seventh-day Adventist',
    family: 'Adventist',
    summary: 'Adventist — Sabbath, second coming, the whole person.',
    authority:
      'Scripture as the supreme authority and standard; the writings of Ellen G. White are valued as a continuing prophetic gift that points back to the Bible.',
    soteriology:
      'Salvation by grace through faith in Christ, expressed in obedience to God\'s commandments and a life of grateful discipleship.',
    sacraments:
      'Believer\'s baptism by immersion and the Lord\'s Supper (with footwashing); a strong emphasis on the body as God\'s temple (health and wholeness).',
    distinctives:
      'Seventh-day (Saturday) Sabbath, the soon and literal second coming of Christ, the sanctuary and investigative judgment, conditional immortality, and holistic health.',
    preaching:
      'Prophetic and Christ-centered; emphasizes the Sabbath, the second advent, present truth, and wholehearted obedience.',
    cautions:
      'Honor the Saturday Sabbath conviction and the advent hope; keep grace primary so obedience is response to salvation, not its price.',
  },

  quaker: {
    id: 'quaker',
    name: 'Quaker (Friends)',
    family: 'Quaker',
    summary: 'Quaker — the Inner Light and direct experience of God.',
    authority:
      'Scripture honored and read in the light of the living Spirit; primacy given to the direct, present guidance of Christ\'s Light within, tested by Scripture and the gathered meeting.',
    soteriology:
      'Salvation as the transforming work of the Inward Light of Christ in every person, drawing toward truth, righteousness, and peace.',
    sacraments:
      'Generally no outward sacraments; all of life is sacramental. Worship is often waiting silence until someone is led to minister.',
    distinctives:
      'The Inner Light, that of God in everyone, the testimonies (Simplicity, Peace, Integrity, Community, Equality, Stewardship), and Spirit-led ministry.',
    preaching:
      'In pastoral Friends meetings, plain and Spirit-led; emphasizes inward transformation, integrity, peace, and equality, leaving room for the Spirit.',
    cautions:
      'Respect the peace testimony and the inward, experiential emphasis; avoid heavy sacramental or clerical framing.',
  },

  nondenom: {
    id: 'nondenom',
    name: 'Non-Denominational Evangelical',
    family: 'Other',
    summary: 'Non-denominational evangelical — Bible-centered, gospel-focused.',
    authority:
      'The Bible as the inspired, authoritative Word of God — the final rule for faith and life, taught plainly and applied directly.',
    soteriology:
      'Salvation by grace alone through personal faith in Jesus Christ; a clear new birth and a personal relationship with God.',
    sacraments:
      'Two ordinances as symbols: believer\'s baptism by immersion and the Lord\'s Supper (memorial), observed in obedience to Christ.',
    distinctives:
      'Biblical authority, the centrality of the gospel and the cross, a personal relationship with Jesus, the priesthood of all believers, and active mission and discipleship.',
    preaching:
      'Expository and practical; clear, accessible, application-driven, and gospel-centered, inviting personal response without heavy denominational machinery.',
    cautions:
      'Stay broadly evangelical and avoid taking hard sides on secondary in-house debates (e.g., Calvinism vs. Arminianism, spiritual gifts) unless asked.',
  },

  generic: {
    id: 'generic',
    name: 'Historic Christian (Ecumenical)',
    family: 'Other',
    summary: 'Mere Christianity — the consensus of the historic creeds.',
    authority:
      'Scripture as the authoritative Word of God, read in continuity with the historic creeds (Apostles\', Nicene) and the broad Christian tradition.',
    soteriology:
      'Salvation by God\'s grace through faith in Jesus Christ, crucified and risen, received and lived out in His church.',
    sacraments:
      'Baptism and the Lord\'s Supper as Christ-given practices of the church (leave the mode/meaning at the level the broad tradition shares).',
    distinctives:
      'The Trinity, the Incarnation, the bodily resurrection, salvation in Christ, the authority of Scripture, and the hope of Christ\'s return — the things "believed everywhere, always, by all."',
    preaching:
      'Christ-centered, biblically faithful, and charitable across traditions; emphasizes the core gospel that unites the church.',
    cautions:
      'Stay on the shared ground of historic orthodoxy; avoid pressing distinctives unique to any single tradition.',
  },
};

// ---------------------------------------------------------------------------
// Family + specific-body aliases.
//
// Maps the onboarding taxonomy (families and specific denominations) and
// common spellings onto a profile id. Keys are lower-cased for matching.
// ---------------------------------------------------------------------------

const ALIAS_TO_PROFILE = {
  // Catholic
  catholic: 'catholic', 'roman catholic': 'catholic', 'eastern catholic': 'catholic', 'other catholic': 'catholic',

  // Orthodox
  orthodox: 'orthodox', 'eastern orthodox': 'orthodox', 'greek orthodox': 'orthodox',
  'russian orthodox': 'orthodox', 'oriental orthodox': 'orthodox', 'other orthodox': 'orthodox',

  // Anglican / Episcopal
  'anglican/episcopal': 'anglican', anglican: 'anglican', episcopal: 'anglican',
  'episcopal church': 'anglican', 'anglican church in north america (acna)': 'anglican', 'other anglican': 'anglican',

  // Lutheran
  lutheran: 'lutheran', 'evangelical lutheran church in america (elca)': 'lutheran',
  'lutheran church-missouri synod': 'lutheran', 'wisconsin evangelical lutheran synod': 'lutheran', 'other lutheran': 'lutheran',

  // Reformed / Presbyterian / Calvinist
  reformed: 'reformed', 'reformed / calvinist': 'reformed', calvinist: 'reformed', presbyterian: 'reformed',
  'presbyterian church (usa)': 'reformed', 'presbyterian church in america (pca)': 'reformed',
  'orthodox presbyterian church': 'reformed', 'cumberland presbyterian': 'reformed', 'other presbyterian': 'reformed',
  'christian reformed church': 'reformed', 'reformed church in america': 'reformed', 'dutch reformed': 'reformed',
  'other reformed': 'reformed', 'reformed baptist': 'reformed',

  // Baptist
  baptist: 'baptist', 'southern baptist': 'baptist', 'american baptist': 'baptist', 'national baptist': 'baptist',
  'progressive national baptist': 'baptist', 'freewill baptist': 'baptist', 'primitive baptist': 'baptist',
  'independent baptist': 'baptist', 'missionary baptist': 'baptist', 'other baptist': 'baptist',

  // Methodist / Wesleyan
  methodist: 'methodist', 'methodist / wesleyan': 'methodist', wesleyan: 'methodist', 'united methodist': 'methodist',
  'african methodist episcopal (ame)': 'methodist', 'african methodist episcopal zion (ame zion)': 'methodist',
  'christian methodist episcopal (cme)': 'methodist', 'free methodist': 'methodist', 'other methodist': 'methodist',

  // Pentecostal / Charismatic
  pentecostal: 'pentecostal', 'pentecostal / charismatic': 'pentecostal', charismatic: 'pentecostal',
  'assemblies of god': 'pentecostal', 'church of god (cleveland, tn)': 'pentecostal', 'church of god of prophecy': 'pentecostal',
  'church of god in christ (cogic)': 'pentecostal', 'international pentecostal holiness church': 'pentecostal',
  'pentecostal assemblies of the world': 'pentecostal', 'united pentecostal church international': 'pentecostal',
  'foursquare church': 'pentecostal', 'other pentecostal': 'pentecostal', vineyard: 'pentecostal',

  // Holiness
  holiness: 'holiness', 'church of the nazarene': 'holiness', nazarene: 'holiness',
  'church of god (anderson, in)': 'holiness', 'salvation army': 'holiness', 'pilgrim holiness church': 'holiness',
  'other holiness': 'holiness',

  // Anabaptist
  anabaptist: 'anabaptist', mennonite: 'anabaptist', amish: 'anabaptist', brethren: 'anabaptist',
  'church of the brethren': 'anabaptist', moravian: 'anabaptist',

  // Restoration / Church of Christ
  'church of christ': 'restoration', 'church of christ (a cappella)': 'restoration',
  'church of christ (instrumental)': 'restoration', 'international church of christ': 'restoration',
  'united church of christ': 'restoration', 'other church of christ': 'restoration',
  restoration: 'restoration', 'disciples of christ': 'restoration',

  // Adventist
  adventist: 'adventist', 'seventh-day adventist': 'adventist', 'seventh day adventist': 'adventist',

  // Quaker
  quaker: 'quaker', 'quaker (friends)': 'quaker', friends: 'quaker',

  // Generic / non-denominational
  'non-denominational': 'nondenom', 'non denominational': 'nondenom', nondenominational: 'nondenom',
  'non-denominational evangelical': 'nondenom', evangelical: 'nondenom', 'community church': 'nondenom',
  'bible church': 'nondenom', 'calvary chapel': 'nondenom',
  interdenominational: 'generic', ecumenical: 'generic', christian: 'generic', other: 'generic',
};

// ---------------------------------------------------------------------------
// Dropdown options — grouped by family, but a single flat value (the label)
// that round-trips cleanly with stored `user.denomination` strings.
// ---------------------------------------------------------------------------

export const DENOMINATION_GROUPS = [
  {
    family: 'Non-Denominational & Ecumenical',
    options: ['Non-Denominational', 'Interdenominational', 'Historic Christian (Ecumenical)'],
  },
  {
    family: 'Baptist',
    options: ['Baptist', 'Southern Baptist', 'American Baptist', 'Independent Baptist', 'Reformed Baptist', 'Freewill Baptist'],
  },
  {
    family: 'Reformed / Presbyterian',
    options: ['Reformed / Calvinist', 'Presbyterian Church in America (PCA)', 'Presbyterian Church (USA)', 'Christian Reformed Church'],
  },
  {
    family: 'Methodist / Wesleyan',
    options: ['Methodist / Wesleyan', 'United Methodist', 'Free Methodist', 'Wesleyan'],
  },
  {
    family: 'Lutheran',
    options: ['Lutheran', 'Lutheran Church-Missouri Synod', 'Evangelical Lutheran Church in America (ELCA)'],
  },
  {
    family: 'Pentecostal / Charismatic',
    options: ['Pentecostal / Charismatic', 'Assemblies of God', 'Church of God in Christ (COGIC)', 'Foursquare Church', 'Vineyard'],
  },
  {
    family: 'Holiness',
    options: ['Holiness', 'Church of the Nazarene', 'Salvation Army'],
  },
  {
    family: 'Anglican / Episcopal',
    options: ['Anglican / Episcopal', 'Episcopal Church', 'Anglican Church in North America (ACNA)'],
  },
  {
    family: 'Catholic & Orthodox',
    options: ['Catholic', 'Roman Catholic', 'Eastern Orthodox', 'Greek Orthodox'],
  },
  {
    family: 'Restoration / Church of Christ',
    options: ['Church of Christ', 'Disciples of Christ'],
  },
  {
    family: 'Other Traditions',
    options: ['Anabaptist (Mennonite / Brethren)', 'Seventh-day Adventist', 'Quaker (Friends)'],
  },
];

// Flat list of every selectable label, in group order.
export const DENOMINATION_OPTIONS = DENOMINATION_GROUPS.flatMap((g) => g.options);

// ---------------------------------------------------------------------------
// Resolution + prompt building.
// ---------------------------------------------------------------------------

/**
 * Resolve any denomination string (family, specific body, free text, or
 * empty) to its preloaded belief profile. Never throws; falls back to the
 * generic non-denominational evangelical profile.
 */
export function resolveDenominationProfile(name) {
  const raw = String(name || '').trim();
  if (!raw) return DENOMINATION_PROFILES.nondenom;

  const key = raw.toLowerCase();

  // 1) Exact alias hit (covers families + specific bodies).
  if (ALIAS_TO_PROFILE[key]) return DENOMINATION_PROFILES[ALIAS_TO_PROFILE[key]];

  // 2) Substring match against known aliases (handles "Other Baptist", typed
  //    variants like "PCA Presbyterian", etc.). Longest alias wins so
  //    "reformed baptist" beats "baptist".
  let best = null;
  let bestLen = 0;
  for (const alias of Object.keys(ALIAS_TO_PROFILE)) {
    if ((key.includes(alias) || alias.includes(key)) && alias.length > bestLen) {
      best = ALIAS_TO_PROFILE[alias];
      bestLen = alias.length;
    }
  }
  if (best) return DENOMINATION_PROFILES[best];

  // 3) Unknown but non-empty (a real tradition we haven't profiled): use the
  //    ecumenical profile but keep the user's label so the prompt still names it.
  return { ...DENOMINATION_PROFILES.generic, name: raw, summary: `${raw} (historic Christian tradition).` };
}

/**
 * Build the prompt block that teaches Larry/Arlynn to preach from inside the
 * named tradition. Returned as a fenced section so it reads as data, not as an
 * instruction the model can be talked out of.
 */
export function denominationPromptBlock(name) {
  const p = resolveDenominationProfile(name);
  const label = String(name || p.name).trim() || p.name;

  return [
    '----- DENOMINATIONAL VIEWPOINT (write the sermon from INSIDE this tradition) -----',
    `Tradition: ${label}`,
    `In brief: ${p.summary}`,
    `View of Scripture & authority: ${p.authority}`,
    `Salvation: ${p.soteriology}`,
    `Baptism & the Lord's Supper: ${p.sacraments}`,
    `Distinctive emphases to honor: ${p.distinctives}`,
    `Preaching style for this tradition: ${p.preaching}`,
    `Avoid mischaracterizing the tradition: ${p.cautions}`,
    'Frame doctrine, application, and altar/response language so a pastor in this tradition could preach it as-is. Remain biblically faithful and never fabricate Scripture.',
    '-------------------------------------------------------------------------------',
  ].join('\n');
}
