export type CriteriaKey = 'v'|'r'|'a1'|'a2'|'k'

export type GuidanceEntry = {
  key: string
  shortHelp: string
  longHelp: string
  examples?: string[]
  criteriaKeys?: CriteriaKey[]
}

// Labels/omschrijvingen voor VRAAK-criteria (voor tooltips)
export const VRAAK_META: Record<CriteriaKey, { label: string; description: string }> = {
  v: { label: 'Variatie', description: 'Spreiding over tijd, soorten bewijs en perspectieven.' },
  r: { label: 'Relevantie', description: 'Aansluiting op de leeruitkomst (EVL) of casus/doel.' },
  a1: { label: 'Authenticiteit', description: 'Hoe echt/praktijkgetrouw is het bewijs en de context?' },
  a2: { label: 'Actualiteit', description: 'Recente prestatie of aanwijsbare actualisatie.' },
  k: { label: 'Kwantiteit', description: 'In totaal voldoende bewijs over de periode.' }
}

// Voorbeeldinhoud – samen verder aanvullen
export const GUIDANCE: Record<string, GuidanceEntry> = {
  'step:name': {
    key: 'step:name',
    shortHelp: 'Geef een herkenbare, specifieke naam.',
    longHelp: 'Kies een naam die meteen duidelijk maakt wat het bewijsstuk is en in welke context het is gemaakt. Vermijd vage titels als "opdracht".',
    examples: ['Reflectieverslag stageweek 4 – casus X', 'Practicum: ECG interpretatie – week 7']
  },
  'step:week': {
    key: 'step:week',
    shortHelp: 'Spreid bewijs over de tijd; week is later aan te passen/verschuiven.',
    longHelp: 'Spreiding in de tijd maakt je ontwikkeling zichtbaar: je legt de puzzel stap voor stap. Een redelijke verdeling van datapunten over de periode draagt bij aan de variatie in je portfolio. Je kunt de lesweek later altijd wijzigen of het bewijsstuk in de matrix naar een andere week slepen.',
    examples: ['Week 5 – eerste spreekuur', 'Week 12 – casuspresentatie'],
    criteriaKeys: ['v']
  },
  'step:kind': {
    key: 'step:kind',
    shortHelp: 'Mix van soorten maakt je portfolio robuuster.',
    longHelp: 'Verzamel verschillende soorten bewijs (bijv. schriftelijk, gesprek, performance, toets). Elk type heeft voor- en nadelen. Een mix geeft een rijker beeld en maakt je portfolio sterker.',
    examples: ['Kennistoets + reflectie', 'Performance + feedbackverslag'],
    criteriaKeys: ['v']
  },
  'step:persp': {
    key: 'step:persp',
    shortHelp: 'Combineer meerdere perspectieven voor breed zicht.',
    longHelp: 'Meerdere perspectieven (bijv. docent, stagebegeleider, ouderejaars, peers, zelfreflectie) geven samen een vollediger beeld. Indicatieve weging: docent/stagebegeleider zwaarder dan ouderejaars, dan peers, dan zelfreflectie. Elk perspectief voegt waarde toe; plan momenten om feedback te vragen. Tip: Perspectieven, Relevantie en Authenticiteit bepalen samen de “omvang” van dit datapunt (zie stap 6).',
    examples: ['Feedback docent + zelfreflectie', 'Stagebegeleider + peer-feedback'],
    criteriaKeys: ['v']
  },
  'step:note': {
    key: 'step:note',
    shortHelp: 'Geef context, aanpak en bijzonderheden kort en concreet.',
    longHelp: 'Licht toe wat er belangrijk is om dit bewijsstuk te begrijpen: context (situatie, doel), aanpak (wat deed je, waarom zo), en bijzonderheden of reflectie (wat ging goed, leerpunten, vervolg). Houd het beknopt en inhoudelijk.',
    examples: [
      'Context: spreekuur interne geneeskunde week 7; doel: differentiëren dyspneu.',
      'Aanpak: ABCDE, aanvullend lab en X‑thorax aangevraagd, differentiaal besproken.',
      'Reflectie: miste vroege saturatiedaling → in vervolg direct zuurstof en herbeoordelen.'
    ]
  },
  'step:cases': {
    key: 'step:cases',
    shortHelp: 'Kies casussen/thema’s die de context en relevantie van je bewijs tonen.',
    longHelp: 'Door casussen of thema’s te koppelen maak je duidelijk in welke context je hebt geopereerd en waarom het bewijs past bij de leeruitkomsten. Een goede spreiding over verschillende casussen kan bijdragen aan variatie; vooral de inhoudelijke aansluiting draagt bij aan relevatie.',
    examples: ['Casus: COPD‑exacerbatie — acute zorg', 'Thema: communicatie met mantelzorgers'],
    criteriaKeys: ['r','v']
  },
  'step:knowledge': {
    key: 'step:knowledge',
    shortHelp: 'Koppel relevante kennisdomeinen om dekking zichtbaar te maken.',
    longHelp: 'Kennisdomeinen helpen aantonen dat je bewijs ook de benodigde kennisbasis raakt. Streef naar dekking van de domeinen die voor jouw EVL’s relevant zijn. Over de periode gezien wil je voldoende (kwantiteit) en passende (relevantie) dekking opbouwen.',
    examples: ['Farmacologie — antibioticabeleid', 'Ethiek — gezamenlijke besluitvorming'],
    criteriaKeys: ['r','k']
  },
  'step:rel': {
    key: 'step:rel',
    shortHelp: 'Hoe goed sluit dit bewijs aan op de leerdoelen van deze cursus?',
    longHelp: 'Geef aan in welke mate het bewijsstuk relevant is voor dit portfolio. Voorbeelden: een product dat slechts een klein stukje kennis aantoont → lage relevantie (schuif links). Een datapunt met screening, anamnese, onderzoek en behandeling → hogere relevantie (verder naar rechts). Relevantie gaat om aansluiting bij deze cursus (het kan elders wel zinvol zijn). Tip: Relevantie, Authenticiteit en Perspectieven bepalen samen de “omvang” van dit datapunt (zie stap 6).',
    examples: ['Klein deelaspect → links', 'Meerdere onderdelen/EVL’s in één datapunt → verder naar rechts'],
    criteriaKeys: ['r']
  },
  'step:auth': {
    key: 'step:auth',
    shortHelp: 'Hoe echt/praktijkgetrouw is bewijs en context?',
    longHelp: 'Volgt later. Tip: Authenticiteit, Relevantie en Perspectieven bepalen samen de “omvang” van dit datapunt (zie stap 6).',
    criteriaKeys: ['a1']
  },
  'step:actual': {
    key: 'step:actual',
    shortHelp: 'Recent bewijs is sterker dan bewijs van (lang) geleden.',
    longHelp: 'Standaard staat actualiteit op “prestatie in geselecteerde lesweek” omdat dit vrijwel altijd klopt. Heb je bewijs uit een eerdere periode (bijv. na herkansing of na een tussenjaar), kies dan de juiste periode. Vraag je af: is dit bewijs nog actueel voor de leerdoelen die nu gelden?',
    criteriaKeys: ['a2']
  }
}


