interface GeoEntry {
  code: string;
  en?: string;
  country?: string;
}

interface CountryEntry {
  code: string;
  en?: string;
}

export const GEO_MAPPING = {
  cities: {
    '华盛顿特区': {
      code: 'USA0DC',
      country: 'USA',
      en: 'Washington DC',
    },
    '华盛顿dc': {
      code: 'USA0DC',
      country: 'USA',
      en: 'Washington DC',
    },
    '华盛顿州': {
      code: 'USA0WA',
      country: 'USA',
      en: 'Washington State',
    },
    '华盛顿': {
      code: 'USA0DC',
      country: 'USA',
      en: 'Washington',
    },
    '洛杉矶': {
      code: 'USA0CALAX',
      country: 'USA',
      en: 'Los Angeles',
    },
    '纽约': {
      code: 'USA0NY',
      country: 'USA',
      en: 'New York',
    },
    '芝加哥': {
      code: 'USA0ILCHI',
      country: 'USA',
      en: 'Chicago',
    },
    '旧金山': {
      code: 'USA0CASFO',
      country: 'USA',
      en: 'San Francisco',
    },
    '达拉斯': {
      code: 'USA0TXDAL',
      country: 'USA',
      en: 'Dallas',
    },
    '迈阿密': {
      code: 'USA0FLMIA',
      country: 'USA',
      en: 'Miami',
    },
    '西雅图': {
      code: 'USA0WASEA',
      country: 'USA',
      en: 'Seattle',
    },
    '波士顿': {
      code: 'USA0MA',
      country: 'USA',
      en: 'Boston',
    },
    '阿什本': {
      code: 'USA0VA',
      country: 'USA',
      en: 'Ashburn',
    },
    '圣何塞': {
      code: 'USA0CASJC',
      country: 'USA',
      en: 'San Jose',
    },
    '堪萨斯城': {
      code: 'USA0KS',
      country: 'USA',
      en: 'Kansas City',
    },
    '奥兰多': {
      code: 'USA0FLORT',
      country: 'USA',
      en: 'Orlando',
    },
    '坦帕': {
      code: 'USA0FLTAM',
      country: 'USA',
      en: 'Tampa',
    },
    '奥斯汀': {
      code: 'USA0TXAUS',
      country: 'USA',
      en: 'Austin',
    },
    '圣安东尼奥': {
      code: 'USA0TXSAN',
      country: 'USA',
      en: 'San Antonio',
    },
    '盐湖城': {
      code: 'USA0UT',
      country: 'USA',
      en: 'Salt Lake City',
    },
    '新泽西': {
      code: 'USA0NJ',
      country: 'USA',
      en: 'New Jersey',
    },
    '布鲁克林': {
      code: 'USA0NYBRO',
      country: 'USA',
      en: 'Brooklyn',
    },
    '圣地亚哥': {
      code: 'USA0CACSD',
      country: 'USA',
      en: 'San Diego',
    },
    '萨克拉门托': {
      code: 'USA0CASAC',
      country: 'USA',
      en: 'Sacramento',
    },
    '迪拜': {
      code: 'ARE0000DU',
      country: 'ARE',
      en: 'Dubai',
    },
    '孟买': {
      code: 'IND000MUB',
      country: 'IND',
      en: 'Mumbai',
    },
    '胡志明市': {
      code: 'VNM0000HC',
      country: 'VNM',
      en: 'Ho Chi Minh City',
    },
    '伊斯坦布尔': {
      code: 'TUR000IST',
      country: 'TUR',
      en: 'Istanbul',
    },
    '曼彻斯特': {
      code: 'GBR000MAN',
      country: 'GBR',
      en: 'Manchester',
    },
    '温哥华': {
      code: 'CAN000VAN',
      country: 'CAN',
      en: 'Vancouver',
    },
    '墨尔本': {
      code: 'AUS000MEL',
      country: 'AUS',
      en: 'Melbourne',
    },
    '圣保罗': {
      code: 'BRA0000SP',
      country: 'BRA',
      en: 'São Paulo',
    },
    '亚特兰大': {
      code: 'USA0GAATL',
      country: 'USA',
      en: 'Atlanta',
    },
    '丹佛': {
      code: 'USA0CODEN',
      country: 'USA',
      en: 'Denver',
    },
    '凤凰城': {
      code: 'USA0AZPHX',
      country: 'USA',
      en: 'Phoenix',
    },
    '费城': {
      code: 'USA0PAPHL',
      country: 'USA',
      en: 'Philadelphia',
    },
    '拉斯维加斯': {
      code: 'USA0NVLAS',
      country: 'USA',
      en: 'Las Vegas',
    },
    '休斯顿': {
      code: 'USA0TXHOU',
      country: 'USA',
      en: 'Houston',
    },
    '伦敦': {
      code: 'GBR000LON',
      country: 'GBR',
      en: 'London',
    },
    '东京': {
      code: 'JPN000TYO',
      country: 'JPN',
      en: 'Tokyo',
    },
    '大阪': {
      code: 'JPN000OSA',
      country: 'JPN',
      en: 'Osaka',
    },
    '首尔': {
      code: 'KOR000SEL',
      country: 'KOR',
      en: 'Seoul',
    },
    '新加坡': {
      code: 'SGP000SIN',
      country: 'SGP',
      en: 'Singapore',
    },
    '悉尼': {
      code: 'AUS000SYD',
      country: 'AUS',
      en: 'Sydney',
    },
    '法兰克福': {
      code: 'DEU000FFO',
      country: 'DEU',
      en: 'Frankfurt',
    },
    '巴黎': {
      code: 'FRA000PAR',
      country: 'FRA',
      en: 'Paris',
    },
    '香港': {
      code: 'HKG000HKG',
      country: 'HKG',
      en: 'Hong Kong',
    },
    '台北': {
      code: 'CHN071000',
      country: 'CHN',
      en: 'Taipei',
    },
    '多伦多': {
      code: 'CAN000TOR',
      country: 'CAN',
      en: 'Toronto',
    },
    '莫斯科': {
      code: 'RUS000MOW',
      country: 'RUS',
      en: 'Moscow',
    },
    '柏林': {
      code: 'DEU0000BE',
      country: 'DEU',
      en: 'Berlin',
    },
    '马德里': {
      code: 'ESP000MAD',
      country: 'ESP',
      en: 'Madrid',
    },
    '墨西哥城': {
      code: 'MEX000000',
      country: 'MEX',
      en: 'Mexico City',
    },
    '皇后区': {
      code: 'USA0NYQEE',
      country: 'USA',
      en: 'Queens',
    },
    '名古屋': {
      code: 'JPN000023',
      country: 'JPN',
      en: 'Nagoya',
    },
    '横滨': {
      code: 'JPN000012',
      country: 'JPN',
      en: 'Yokohama',
    },
    '港岛': {
      code: 'CHN081000',
      country: 'CHN',
      en: 'Hong Kong Island',
    },
    '河内': {
      code: 'VNM000000',
      country: 'VNM',
      en: 'Hanoi',
    },
    '曼谷': {
      code: 'THA000000',
      country: 'THA',
      en: 'Bangkok',
    },
    '吉隆坡': {
      code: 'MYS0KLKUL',
      country: 'MYS',
      en: 'Kuala Lumpur',
    },
    '雅加达': {
      code: 'IDN0000JK',
      country: 'IDN',
      en: 'Jakarta',
    },
    '马尼拉': {
      code: 'PHL000MNL',
      country: 'PHL',
      en: 'Manila',
    },
    '仰光': {
      code: 'MMR0000YG',
      country: 'MMR',
      en: 'Yangon',
    },
    '金边': {
      code: 'KHM000PNH',
      country: 'KHM',
      en: 'Phnom Penh',
    },
    '万象': {
      code: 'LAO0000VI',
      country: 'LAO',
      en: 'Vientiane',
    },
    '德里': {
      code: 'IND000000',
      country: 'IND',
      en: 'Delhi',
    },
    '钦奈': {
      code: 'IND000ICD',
      country: 'IND',
      en: 'Chennai',
    },
    '达卡': {
      code: 'BGD000DAC',
      country: 'BGD',
      en: 'Dhaka',
    },
    '伊斯兰堡': {
      code: 'PAK000ISB',
      country: 'PAK',
      en: 'Islamabad',
    },
    '安曼': {
      code: 'JOR0000AM',
      country: 'JOR',
      en: 'Amman',
    },
    '阿布扎比': {
      code: 'ARE000000',
      country: 'ARE',
      en: 'Abu Dhabi',
    },
    '沙迦': {
      code: 'ARE0000SH',
      country: 'ARE',
      en: 'Sharjah',
    },
    '安卡拉': {
      code: 'TUR000000',
      country: 'TUR',
      en: 'Ankara',
    },
    '吉达': {
      code: 'SAU000JED',
      country: 'SAU',
      en: 'Jeddah',
    },
    '利雅得': {
      code: 'SAU0000RD',
      country: 'SAU',
      en: 'Riyadh',
    },
    '阿拉木图': {
      code: 'KAZ000ALA',
      country: 'KAZ',
      en: 'Almaty',
    },
    '高雄': {
      code: 'TWN000KSG',
      country: 'CHN',
      en: 'Kaohsiung',
    },
    '台中': {
      code: 'TWN000TCG',
      country: 'CHN',
      en: 'Taichung',
    },
    '伯明翰': {
      code: 'GBR000BIR',
      country: 'GBR',
      en: 'Birmingham',
    },
    '利物浦': {
      code: 'GBR000LIV',
      country: 'GBR',
      en: 'Liverpool',
    },
    '爱丁堡': {
      code: 'GBR000EDI',
      country: 'GBR',
      en: 'Edinburgh',
    },
    '里昂': {
      code: 'FRA000LYS',
      country: 'FRA',
      en: 'Lyon',
    },
    '马赛': {
      code: 'FRA000MRS',
      country: 'FRA',
      en: 'Marseille',
    },
    '科隆': {
      code: 'DEU000CGN',
      country: 'DEU',
      en: 'Cologne',
    },
    '慕尼黑': {
      code: 'DEU000MUC',
      country: 'DEU',
      en: 'Munich',
    },
    '汉堡': {
      code: 'DEU000HAM',
      country: 'DEU',
      en: 'Hamburg',
    },
    '罗马': {
      code: 'ITA000000',
      country: 'ITA',
      en: 'Rome',
    },
    '米兰': {
      code: 'ITA000MIL',
      country: 'ITA',
      en: 'Milan',
    },
    '巴塞罗那': {
      code: 'ESP000BCN',
      country: 'ESP',
      en: 'Barcelona',
    },
    '阿姆斯特丹': {
      code: 'NLD000000',
      country: 'NLD',
      en: 'Amsterdam',
    },
    '圣彼得堡': {
      code: 'RUS000SPB',
      country: 'RUS',
      en: 'Saint Petersburg',
    },
    '基辅': {
      code: 'UKR0000KV',
      country: 'UKR',
      en: 'Kiev',
    },
    '华沙': {
      code: 'POL000WAW',
      country: 'POL',
      en: 'Warsaw',
    },
    '维也纳': {
      code: 'AUT000VDD',
      country: 'AUT',
      en: 'Vienna',
    },
    '斯德哥尔摩': {
      code: 'SWE0000AB',
      country: 'SWE',
      en: 'Stockholm',
    },
    '塔林': {
      code: 'EST000001',
      country: 'EST',
      en: 'Tallinn',
    },
    '蒙特利尔': {
      code: 'CAN000MTL',
      country: 'CAN',
      en: 'Montreal',
    },
    '渥太华': {
      code: 'CAN000000',
      country: 'CAN',
      en: 'Ottawa',
    },
    '堪培拉': {
      code: 'AUS000000',
      country: 'AUS',
      en: 'Canberra',
    },
    '布里斯班': {
      code: 'AUS000BRI',
      country: 'AUS',
      en: 'Brisbane',
    },
    '奥克兰': {
      code: 'NZL000AUC',
      country: 'NZL',
      en: 'Auckland',
    },
    '开罗': {
      code: 'EGY000CAI',
      country: 'EGY',
      en: 'Cairo',
    },
    '约翰内斯堡': {
      code: 'ZAF000JNB',
      country: 'ZAF',
      en: 'Johannesburg',
    },
    '内罗毕': {
      code: 'KEN0000NA',
      country: 'KEN',
      en: 'Nairobi',
    },
    '阿克拉': {
      code: 'GHA0000GA',
      country: 'GHA',
      en: 'Accra',
    },
    '巴尔的摩': {
      code: 'USA0MDBAL',
      country: 'USA',
      en: 'Baltimore',
    },
    '波特兰': {
      code: 'USA0ORPOR',
      country: 'USA',
      en: 'Portland',
    },
    '底特律': {
      code: 'USA0MIDET',
      country: 'USA',
      en: 'Detroit',
    },
    '新奥尔良': {
      code: 'USA0LAMSY',
      country: 'USA',
      en: 'New Orleans',
    },
    '纳什维尔': {
      code: 'USA0TNNAS',
      country: 'USA',
      en: 'Nashville',
    },
    '克利夫兰': {
      code: 'USA0OHCLE',
      country: 'USA',
      en: 'Cleveland',
    },
    '密尔沃基': {
      code: 'USA0WIMKE',
      country: 'USA',
      en: 'Milwaukee',
    },
    '图森': {
      code: 'USA0AZTUC',
      country: 'USA',
      en: 'Tucson',
    },
    '圣路易斯': {
      code: 'USA0MOSTL',
      country: 'USA',
      en: 'St. Louis',
    },
    '俄克拉荷马城': {
      code: 'USA0OKOKC',
      country: 'USA',
      en: 'Oklahoma City',
    },
    'washington dc': {
      code: 'USA0DC',
      country: 'USA',
    },
    'washington state': {
      code: 'USA0WA',
      country: 'USA',
    },
    dc: {
      code: 'USA0DC',
      country: 'USA',
    },
    washington: {
      code: 'USA0DC',
      country: 'USA',
    },
    'los angeles': {
      code: 'USA0CALAX',
      country: 'USA',
    },
    'new york': {
      code: 'USA0NY',
      country: 'USA',
    },
    chicago: {
      code: 'USA0ILCHI',
      country: 'USA',
    },
    'san francisco': {
      code: 'USA0CASFO',
      country: 'USA',
    },
    dallas: {
      code: 'USA0TXDAL',
      country: 'USA',
    },
    miami: {
      code: 'USA0FLMIA',
      country: 'USA',
    },
    seattle: {
      code: 'USA0WASEA',
      country: 'USA',
    },
    boston: {
      code: 'USA0MA',
      country: 'USA',
    },
    ashburn: {
      code: 'USA0VA',
      country: 'USA',
    },
    orlando: {
      code: 'USA0FLORT',
      country: 'USA',
    },
    austin: {
      code: 'USA0TXAUS',
      country: 'USA',
    },
    dubai: {
      code: 'ARE0000DU',
      country: 'ARE',
    },
    mumbai: {
      code: 'IND000MUB',
      country: 'IND',
    },
    istanbul: {
      code: 'TUR000IST',
      country: 'TUR',
    },
    manchester: {
      code: 'GBR000MAN',
      country: 'GBR',
    },
    vancouver: {
      code: 'CAN000VAN',
      country: 'CAN',
    },
    melbourne: {
      code: 'AUS000MEL',
      country: 'AUS',
    },
    london: {
      code: 'GBR000LON',
      country: 'GBR',
    },
    tokyo: {
      code: 'JPN000TYO',
      country: 'JPN',
    },
    seoul: {
      code: 'KOR000SEL',
      country: 'KOR',
    },
    singapore: {
      code: 'SGP000SIN',
      country: 'SGP',
    },
    sydney: {
      code: 'AUS000SYD',
      country: 'AUS',
    },
    frankfurt: {
      code: 'DEU000FFO',
      country: 'DEU',
    },
    paris: {
      code: 'FRA000PAR',
      country: 'FRA',
    },
    'hong kong': {
      code: 'HKG000HKG',
      country: 'HKG',
    },
    'mexico city': {
      code: 'MEX000000',
      country: 'MEX',
    },
    bangkok: {
      code: 'THA000000',
      country: 'THA',
    },
    jakarta: {
      code: 'IDN0000JK',
      country: 'IDN',
    },
    manila: {
      code: 'PHL000MNL',
      country: 'PHL',
    },
    hanoi: {
      code: 'VNM000000',
      country: 'VNM',
    },
    'kuala lumpur': {
      code: 'MYS0KLKUL',
      country: 'MYS',
    },
    'ho chi minh': {
      code: 'VNM0000HC',
      country: 'VNM',
    },
    delhi: {
      code: 'IND000000',
      country: 'IND',
    },
    chennai: {
      code: 'IND000ICD',
      country: 'IND',
    },
    dhaka: {
      code: 'BGD000DAC',
      country: 'BGD',
    },
    ankara: {
      code: 'TUR000000',
      country: 'TUR',
    },
    riyadh: {
      code: 'SAU0000RD',
      country: 'SAU',
    },
    amsterdam: {
      code: 'NLD000000',
      country: 'NLD',
    },
    warsaw: {
      code: 'POL000WAW',
      country: 'POL',
    },
    vienna: {
      code: 'AUT000VDD',
      country: 'AUT',
    },
    stockholm: {
      code: 'SWE0000AB',
      country: 'SWE',
    },
    rome: {
      code: 'ITA000000',
      country: 'ITA',
    },
    milan: {
      code: 'ITA000MIL',
      country: 'ITA',
    },
    barcelona: {
      code: 'ESP000BCN',
      country: 'ESP',
    },
    munich: {
      code: 'DEU000MUC',
      country: 'DEU',
    },
    hamburg: {
      code: 'DEU000HAM',
      country: 'DEU',
    },
    birmingham: {
      code: 'GBR000BIR',
      country: 'GBR',
    },
    edinburgh: {
      code: 'GBR000EDI',
      country: 'GBR',
    },
    cairo: {
      code: 'EGY000CAI',
      country: 'EGY',
    },
    nairobi: {
      code: 'KEN0000NA',
      country: 'KEN',
    },
    kiev: {
      code: 'UKR0000KV',
      country: 'UKR',
    },
    montreal: {
      code: 'CAN000MTL',
      country: 'CAN',
    },
    toronto: {
      code: 'CAN000TOR',
      country: 'CAN',
    },
    auckland: {
      code: 'NZL000AUC',
      country: 'NZL',
    },
    brisbane: {
      code: 'AUS000BRI',
      country: 'AUS',
    },
    baltimore: {
      code: 'USA0MDBAL',
      country: 'USA',
    },
    portland: {
      code: 'USA0ORPOR',
      country: 'USA',
    },
    detroit: {
      code: 'USA0MIDET',
      country: 'USA',
    },
    'new orleans': {
      code: 'USA0LAMSY',
      country: 'USA',
    },
    nashville: {
      code: 'USA0TNNAS',
      country: 'USA',
    },
    cleveland: {
      code: 'USA0OHCLE',
      country: 'USA',
    },
  } as Record<string, GeoEntry>,

  countries: {
    '美国': { code: 'USA', en: 'United States' },
    '英国': { code: 'GBR', en: 'United Kingdom' },
    '日本': { code: 'JPN', en: 'Japan' },
    '韩国': { code: 'KOR', en: 'South Korea' },
    '德国': { code: 'DEU', en: 'Germany' },
    '法国': { code: 'FRA', en: 'France' },
    '澳大利亚': { code: 'AUS', en: 'Australia' },
    '新加坡': { code: 'SGP', en: 'Singapore' },
    '加拿大': { code: 'CAN', en: 'Canada' },
    '巴西': { code: 'BRA', en: 'Brazil' },
    '印度': { code: 'IND', en: 'India' },
    '中国': { code: 'CHN', en: 'China' },
    '香港': { code: 'HKG', en: 'Hong Kong' },
    '台湾': { code: 'TWN', en: 'Taiwan' },
    '俄罗斯': { code: 'RUS', en: 'Russia' },
    '西班牙': { code: 'ESP', en: 'Spain' },
    '意大利': { code: 'ITA', en: 'Italy' },
    '墨西哥': { code: 'MEX', en: 'Mexico' },
    '菲律宾': { code: 'PHL', en: 'Philippines' },
    '越南': { code: 'VNM', en: 'Vietnam' },
    '泰国': { code: 'THA', en: 'Thailand' },
    '马来西亚': { code: 'MYS', en: 'Malaysia' },
    '印尼': { code: 'IDN', en: 'Indonesia' },
    '印度尼西亚': { code: 'IDN', en: 'Indonesia' },
    '阿联酋': { code: 'ARE', en: 'UAE' },
    '土耳其': { code: 'TUR', en: 'Turkey' },
    '荷兰': { code: 'NLD', en: 'Netherlands' },
    '波兰': { code: 'POL', en: 'Poland' },
    '爱尔兰': { code: 'IRL', en: 'Ireland' },
    '瑞士': { code: 'CHE', en: 'Switzerland' },
    '挪威': { code: 'NOR', en: 'Norway' },
    '瑞典': { code: 'SWE', en: 'Sweden' },
    '丹麦': { code: 'DNK', en: 'Denmark' },
    '芬兰': { code: 'FIN', en: 'Finland' },
    '乌克兰': { code: 'UKR', en: 'Ukraine' },
    '比利时': { code: 'BEL', en: 'Belgium' },
    '奥地利': { code: 'AUT', en: 'Austria' },
    '葡萄牙': { code: 'PRT', en: 'Portugal' },
    '希腊': { code: 'GRC', en: 'Greece' },
    '捷克': { code: 'CZE', en: 'Czech Republic' },
    '匈牙利': { code: 'HUN', en: 'Hungary' },
    '罗马尼亚': { code: 'ROU', en: 'Romania' },
    '保加利亚': { code: 'BGR', en: 'Bulgaria' },
    '拉脱维亚': { code: 'LVA', en: 'Latvia' },
    '立陶宛': { code: 'LTU', en: 'Lithuania' },
    '爱沙尼亚': { code: 'EST', en: 'Estonia' },
    '克罗地亚': { code: 'HRV', en: 'Croatia' },
    '塞尔维亚': { code: 'SRB', en: 'Serbia' },
    '巴基斯坦': { code: 'PAK', en: 'Pakistan' },
    '孟加拉国': { code: 'BGD', en: 'Bangladesh' },
    '孟加拉': { code: 'BGD', en: 'Bangladesh' },
    '哈萨克斯坦': { code: 'KAZ', en: 'Kazakhstan' },
    '缅甸': { code: 'MMR', en: 'Myanmar' },
    '柬埔寨': { code: 'KHM', en: 'Cambodia' },
    '斯里兰卡': { code: 'LKA', en: 'Sri Lanka' },
    '尼泊尔': { code: 'NPL', en: 'Nepal' },
    '以色列': { code: 'ISR', en: 'Israel' },
    '沙特阿拉伯': { code: 'SAU', en: 'Saudi Arabia' },
    '沙特': { code: 'SAU', en: 'Saudi Arabia' },
    '卡塔尔': { code: 'QAT', en: 'Qatar' },
    '科威特': { code: 'KWT', en: 'Kuwait' },
    '伊拉克': { code: 'IRQ', en: 'Iraq' },
    '伊朗': { code: 'IRN', en: 'Iran' },
    '约旦': { code: 'JOR', en: 'Jordan' },
    '黎巴嫩': { code: 'LBN', en: 'Lebanon' },
    '埃及': { code: 'EGY', en: 'Egypt' },
    '南非': { code: 'ZAF', en: 'South Africa' },
    '尼日利亚': { code: 'NGA', en: 'Nigeria' },
    '肯尼亚': { code: 'KEN', en: 'Kenya' },
    '加纳': { code: 'GHA', en: 'Ghana' },
    '新西兰': { code: 'NZL', en: 'New Zealand' },
    '阿根廷': { code: 'ARG', en: 'Argentina' },
    '智利': { code: 'CHL', en: 'Chile' },
    '哥伦比亚': { code: 'COL', en: 'Colombia' },
    '秘鲁': { code: 'PER', en: 'Peru' },
    '多米尼加': { code: 'DOM', en: 'Dominican Republic' },
    '巴拿马': { code: 'PAN', en: 'Panama' },
    '哥斯达黎加': { code: 'CRI', en: 'Costa Rica' },
    '牙买加': { code: 'JAM', en: 'Jamaica' },
    '安哥拉': { code: 'AGO', en: 'Angola' },
    '莫桑比克': { code: 'MOZ', en: 'Mozambique' },
    '老挝': { code: 'LAO', en: 'Laos' },
    '阿尔巴尼亚': { code: 'ALB', en: 'Albania' },
    '白俄罗斯': { code: 'BLR', en: 'Belarus' },
    '摩尔多瓦': { code: 'MDA', en: 'Moldova' },
    '格鲁吉亚': { code: 'GEO', en: 'Georgia' },
    '亚美尼亚': { code: 'ARM', en: 'Armenia' },
    '冰岛': { code: 'ISL', en: 'Iceland' },
    '马耳他': { code: 'MLT', en: 'Malta' },
    '塞浦路斯': { code: 'CYP', en: 'Cyprus' },
    '卢森堡': { code: 'LUX', en: 'Luxembourg' },
    '乌兹别克斯坦': { code: 'UZB', en: 'Uzbekistan' },
    us: { code: 'USA' },
    uk: { code: 'GBR' },
    jp: { code: 'JPN' },
    kr: { code: 'KOR' },
    de: { code: 'DEU' },
    fr: { code: 'FRA' },
    au: { code: 'AUS' },
    sg: { code: 'SGP' },
    mexico: { code: 'MEX' },
    philippines: { code: 'PHL' },
    vietnam: { code: 'VNM' },
    thailand: { code: 'THA' },
    malaysia: { code: 'MYS' },
    indonesia: { code: 'IDN' },
    uae: { code: 'ARE' },
    turkey: { code: 'TUR' },
    netherlands: { code: 'NLD' },
    poland: { code: 'POL' },
    ireland: { code: 'IRL' },
    switzerland: { code: 'CHE' },
    sweden: { code: 'SWE' },
    denmark: { code: 'DNK' },
    ukraine: { code: 'UKR' },
    belgium: { code: 'BEL' },
    austria: { code: 'AUT' },
    portugal: { code: 'PRT' },
    greece: { code: 'GRC' },
    egypt: { code: 'EGY' },
    'south africa': { code: 'ZAF' },
    nigeria: { code: 'NGA' },
    kenya: { code: 'KEN' },
    'new zealand': { code: 'NZL' },
    argentina: { code: 'ARG' },
    chile: { code: 'CHL' },
    colombia: { code: 'COL' },
    peru: { code: 'PER' },
    pakistan: { code: 'PAK' },
    bangladesh: { code: 'BGD' },
    israel: { code: 'ISR' },
    'saudi arabia': { code: 'SAU' },
    qatar: { code: 'QAT' },
    iraq: { code: 'IRQ' },
    iran: { code: 'IRN' },
    jordan: { code: 'JOR' },
    cambodia: { code: 'KHM' },
    myanmar: { code: 'MMR' },
    tw: { code: 'TWN' },
    taiwan: { code: 'TWN' },
  } as Record<string, CountryEntry>,
};

const COUNTRY_CODE_NAMES: Record<string, string> = {
  USA: '美国', GBR: '英国', JPN: '日本',
  KOR: '韩国', DEU: '德国', FRA: '法国',
  AUS: '澳大利亚', SGP: '新加坡', CAN: '加拿大',
  BRA: '巴西', IND: '印度', CHN: '中国',
  HKG: '中国香港', TWN: '中国台湾', MAC: '中国澳门',
  RUS: '俄罗斯', ESP: '西班牙', ITA: '意大利',
  PHL: '菲律宾', VNM: '越南', THA: '泰国',
  MYS: '马来西亚', IDN: '印尼', ARE: '阿联酋',
  TUR: '土耳其', MEX: '墨西哥', NLD: '荷兰',
  POL: '波兰', IRL: '爱尔兰', CHE: '瑞士',
  NOR: '挪威', SWE: '瑞典', DNK: '丹麦',
  FIN: '芬兰', UKR: '乌克兰', BEL: '比利时',
  AUT: '奥地利', PRT: '葡萄牙', GRC: '希腊',
  CZE: '捷克', HUN: '匈牙利', ROU: '罗马尼亚',
  BGR: '保加利亚', LVA: '拉脱维亚', LTU: '立陶宛',
  EST: '爱沙尼亚', HRV: '克罗地亚', SRB: '塞尔维亚',
  PAK: '巴基斯坦', BGD: '孟加拉国', KAZ: '哈萨克斯坦',
  MMR: '缅甸', KHM: '柬埔寨', LKA: '斯里兰卡',
  NPL: '尼泊尔', ISR: '以色列', SAU: '沙特阿拉伯',
  QAT: '卡塔尔', KWT: '科威特', IRQ: '伊拉克',
  IRN: '伊朗', JOR: '约旦', LBN: '黎巴嫩',
  EGY: '埃及', ZAF: '南非', NGA: '尼日利亚',
  KEN: '肯尼亚', GHA: '加纳', NZL: '新西兰',
  ARG: '阿根廷', CHL: '智利', COL: '哥伦比亚',
  PER: '秘鲁', DOM: '多米尼加', PAN: '巴拿马',
  CRI: '哥斯达黎加', JAM: '牙买加', AGO: '安哥拉',
  MOZ: '莫桑比克', LAO: '老挝', ALB: '阿尔巴尼亚',
  BLR: '白俄罗斯', MDA: '摩尔多瓦', GEO: '格鲁吉亚',
  ARM: '亚美尼亚', ISL: '冰岛', MLT: '马耳他',
  CYP: '塞浦路斯', LUX: '卢森堡', UZB: '乌兹别克斯坦',
};

const CITY_CODE_NAMES: Record<string, string> = {
  USA000000: '华盛顿', USA0DCWAS: '华盛顿',
  USA0CALAX: '洛杉矶', USA0CASFO: '旧金山',
  USA0CASJC: '圣何塞', USA0CAELS: '埃尔塞贡多',
  USA0CAIRV: '欧文', USA0CACSD: '圣地亚哥',
  USA0CASAC: '萨克拉门托',
  USA0NYQEE: '皇后区', USA0NYFFO: '纽约',
  USA0NYBRO: '布鲁克林', USA0NYSTA: '史泰登岛',
  USA0ILCHI: '芝加哥', USA0ILWLB: '威洛布鲁克',
  USA0FLMIA: '迈阿密', USA0FLORT: '奥兰多',
  USA0FLTAM: '坦帕', USA0FLTAL: '塔拉哈西',
  USA0TXHOU: '休斯敦', USA0TXDAL: '达拉斯',
  USA0TXDFW: '达拉斯', USA0TXAUS: '奥斯汀',
  USA0TXSAN: '圣安东尼奥',
  USA0WASEA: '西雅图', USA0WA000: '西雅图',
  USA0WASPO: '斯波坎',
  USA0NVLAS: '拉斯维加斯', USA0NVVGI: '拉斯维加斯',
  USA0AZPHX: '凤凰城', USA0AZTUC: '图森',
  USA0CODEN: '丹佛', USA0COEWD: '欧文',
  USA0PAPHL: '费城', USA0MABZD: '波士顿',
  USA0GAATL: '亚特兰大', USA0GAHIG: '高地',
  USA0MDBAL: '巴尔的摩', USA0VA000: '阿什本',
  USA0VAHEN: '亨里科', USA0VTBTV: '伯灵顿',
  USA0KSKCK: '堪萨斯城', USA0KSCC: '克莱中心',
  USA0HI000: '檀香山', USA0HIPAP: '帕帕库',
  USA0SCCOV: '哥伦比亚', USA0MOSTL: '圣路易斯',
  USA0UTSLC: '盐湖城', USA0UT000: '盐湖城',
  USA0NJ000: '新泽西', USA0OKOKC: '俄克拉荷马城',
  USA0OHCLE: '克利夫兰', USA0OHCVG: '辛辛那提',
  USA0WIMKE: '密尔沃基', USA0MIDET: '底特律',
  USA0MIPON: '庞特亚克', USA0MSJCK: '杰克逊',
  USA0KYLEX: '列克星敦', USA0CTMIL: '米尔福德',
  USA0LAMSY: '新奥尔良', USA0WV0WV: '查尔斯顿',
  USA0ORPOR: '波特兰',
  JPN000000: '东京', JPN000013: '东京',
  JPN000001: '东京', JPN000027: '大阪',
  JPN000023: '名古屋', JPN000012: '横滨',
  JPN000TYO: '东京', JPN000OSA: '大阪',
  KOR000000: '首尔', KOR011SEO: '首尔',
  KOR000SEL: '首尔',
  CHN081000: '港岛', CHN071000: '台北',
  CHN082000: '新界', CHN000SHG: '上海',
  CHN000BJS: '北京', CHN000SZN: '深圳',
  CHN000GZH: '广州', CHN000HGH: '杭州',
  CHN000NJG: '南京', CHN000CDU: '成都',
  CHN000WUH: '武汉',
  HKG000HKG: '香港', HKG000001: '香港',
  TWN000TPE: '台北', TWN000001: '台北',
  TWN000KSG: '高雄', TWN000TCG: '台中',
  SGPSGP: '新加坡', SGPSGPSGP: '新加坡',
  SGP000SIN: '新加坡',
  THA000000: '曼谷', THA000010: '曼谷',
  MYS000000: '吉隆坡', MYS0KLKUL: '吉隆坡',
  MYS0KNKBR: '吉隆坡', MYS0SLPJA: '古晋',
  VNM000000: '河内', VNM0000HC: '胡志明市',
  VNM0000HI: '胡志明市',
  IND000000: '德里', IND000MUB: '孟买',
  IND000AJL: '阿杰梅尔', IND000ICD: '钦奈',
  IDN0000JK: '雅加达', IDN000000: '雅加达',
  PHL000000: '马尼拉', PHL000MNL: '马尼拉',
  MMR0000YG: '仰光', MMR000000: '仰光',
  KHM000PNH: '金边', LAO0000VI: '万象',
  GBR000000: '伦敦', GBR000LON: '伦敦',
  GBRENGLND: '伦敦', GBR000MAN: '曼彻斯特',
  GBR000BIR: '伯明翰', GBR000LIV: '利物浦',
  GBR000EDI: '爱丁堡',
  FRA000000: '巴黎', FRA000PAR: '巴黎',
  FRA000LYS: '里昂', FRA000MRS: '马赛',
  DEU000000: '柏林', DEU0000BE: '柏林',
  DEU000FFO: '法兰克福', DEU000CGN: '科隆',
  DEU000MUC: '慕尼黑', DEU000HAM: '汉堡',
  ITA000000: '罗马', ITA000MIL: '米兰',
  ITA000NAP: '那不勒斯', ITA000VEN: '威尼斯',
  ESP000000: '马德里', ESP000MAD: '马德里',
  ESP000BCN: '巴塞罗那',
  NLD000000: '阿姆斯特丹', NLD000RTD: '鹿特丹',
  NLD000HAG: '海牙',
  RUS000000: '莫斯科', RUS000MOW: '莫斯科',
  RUS000SPB: '圣彼得堡',
  CAN000000: '渥太华', CAN000TOR: '多伦多',
  CAN000VAN: '温哥华', CAN000MTL: '蒙特利尔',
  AUS000000: '堪培拉', AUS000SYD: '悉尼',
  AUS000MEL: '墨尔本', AUS000BRI: '布里斯班',
  AUSNSWHBS: '布里斯班',
  NZL000AUC: '奥克兰', NZL000002: '惠灵顿',
  BRA000000: '巴西利亚', BRA0000SP: '圣保罗',
  ARE000000: '阿布扎比', ARE0000DU: '迪拜',
  ARE0000SH: '沙迦',
  TUR000IST: '伊斯坦布尔', TUR000000: '安卡拉',
  SAU000JED: '吉达', SAU0000RD: '利雅得',
  UKR0000KV: '基辅', UKR000000: '基辅',
  POL000000: '华沙', POL000WAW: '华沙',
  KAZ000ALA: '阿拉木图', KAZ000000: '阿拉木图',
  AUT000VDD: '维也纳', AUT000000: '维也纳',
  SWE0000AB: '斯德哥尔摩',
  EGY000CAI: '开罗', ZAF000JNB: '约翰内斯堡',
  GHA0000GA: '阿克拉', KEN0000NA: '内罗毕',
  AGO000LUA: '卢安达', BGD000DAC: '达卡',
  PAK000ISB: '伊斯兰堡', JOR0000AM: '安曼',
  MEX000000: '墨西哥城', EST000001: '塔林',
  MOZ000001: '马普托',
};

const STATE_CODE_NAMES: Record<string, string> = {
  USA000: '华盛顿',
  USA0DC: '华盛顿', USA0CA: '加利福尼亚',
  USA0NY: '纽约', USA0IL: '伊利诺伊',
  USA0FL: '佛罗里达', USA0TX: '德克萨斯',
  USA0WA: '华盛顿', USA0NV: '内华达',
  USA0AZ: '亚利桑那', USA0CO: '科罗拉多',
  USA0PA: '宾夕法尼亚', USA0MA: '马萨诸塞',
  USA0GA: '乔治亚', USA0VA: '弗吉尼亚',
  USA0MD: '马里兰', USA0NJ: '新泽西',
  USA0OH: '俄亥俄', USA0MI: '密歇根',
  USA0MO: '密苏里', USA0WI: '威斯康星',
  USA0SC: '南卡罗来纳', USA0HI: '夏威夷',
  USA0VT: '佛蒙特', USA0KS: '堪萨斯',
  USA0KY: '肯塔基', USA0UT: '犹他',
  USA0CT: '康涅狄格', USA0OK: '俄克拉荷马',
  USA0MS: '密西西比', USA0LA: '路易斯安那',
  USA0WV: '西弗吉尼亚',
  GBR000: '英国', GBRENG: '英格兰', KOR011: '首尔',
  BRA000: '巴西', ARE000: '阿联酋',
  AUS000: '澳大利亚', MYS0KL: '吉隆坡',
  MYS0SL: '沙捞越', MYS0KN: '吉隆坡',
  AUSNSW: '新南威尔士', SGPSGP: '新加坡',
};

export function codeToName(
  code: string
): string {
  const upper = code.toUpperCase();
  return (
    CITY_CODE_NAMES[upper] ||
    STATE_CODE_NAMES[upper] ||
    COUNTRY_CODE_NAMES[upper] ||
    code
  );
}

export function countryCodeToName(
  code: string
): string {
  return (
    COUNTRY_CODE_NAMES[code.toUpperCase()] ||
    code
  );
}

export function stateCodeToName(
  code: string
): string {
  return (
    STATE_CODE_NAMES[code.toUpperCase()] ||
    code
  );
}

/**
 * Reverse mapping: city display name → all city codes
 * e.g. "伦敦" → ["GBR000000", "GBR000LON", "GBRENGLND"]
 * Built from CITY_CODE_NAMES at module load time.
 */
const CITY_NAME_TO_CODES = new Map<
  string,
  string[]
>();
for (const [code, name] of
  Object.entries(CITY_CODE_NAMES)
) {
  const existing = CITY_NAME_TO_CODES.get(name) ?? [];
  existing.push(code);
  CITY_NAME_TO_CODES.set(name, existing);
}

export function allCityCodesForName(
  name: string
): string[] {
  return CITY_NAME_TO_CODES.get(name) ?? [];
}

function wordBoundaryMatch(
  text: string,
  keyword: string
): boolean {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;
  const before = idx > 0 ? text[idx - 1] : ' ';
  const after =
    idx + keyword.length < text.length
      ? text[idx + keyword.length]
      : ' ';
  const isWordChar = (c: string) =>
    /[a-zA-Z0-9]/.test(c);
  const isCjk = (c: string) =>
    /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(c);
  if (isCjk(keyword[0])) return true;
  if (isWordChar(before) || isWordChar(after)) {
    return false;
  }
  return true;
}

/* ── Geo Groups (semantic geography) ── */

interface GeoGroup {
  states: string[];
  countries?: string[];
  label: string;
  labelEn: string;
}

const GEO_GROUPS: Record<string, GeoGroup> = {
  WEST_COAST: {
    states: ['USA0CA', 'USA0WA', 'USA0OR'],
    countries: ['USA'],
    label: '美国西海岸',
    labelEn: 'US West Coast',
  },
  EAST_COAST: {
    states: [
      'USA0NY', 'USA0NJ', 'USA0MA', 'USA0PA',
      'USA0VA', 'USA0MD', 'USA0DC', 'USA0CT',
      'USA0FL', 'USA0GA', 'USA0SC',
    ],
    countries: ['USA'],
    label: '美国东海岸',
    labelEn: 'US East Coast',
  },
  NORTH_AMERICA: {
    states: [],
    countries: ['USA', 'CAN', 'MEX'],
    label: '北美',
    labelEn: 'North America',
  },
  EUROPE: {
    states: [],
    countries: [
      'GBR', 'DEU', 'FRA', 'NLD', 'ITA', 'ESP',
      'CHE', 'AUT', 'BEL', 'POL', 'SWE', 'NOR',
      'DNK', 'FIN', 'IRL', 'PRT', 'CZE', 'ROU',
      'GRC', 'HUN', 'UKR', 'BGR', 'HRV', 'SVK',
      'LTU', 'LVA', 'EST', 'SVN', 'LUX', 'ISL',
    ],
    label: '欧洲',
    labelEn: 'Europe',
  },
  SOUTHEAST_ASIA: {
    states: [],
    countries: [
      'SGP', 'THA', 'VNM', 'MYS', 'IDN',
      'PHL', 'KHM', 'MMR',
    ],
    label: '东南亚',
    labelEn: 'Southeast Asia',
  },
  EAST_ASIA: {
    states: [],
    countries: ['JPN', 'KOR', 'TWN', 'HKG'],
    label: '东亚',
    labelEn: 'East Asia',
  },
  MIDDLE_EAST: {
    states: [],
    countries: [
      'ARE', 'SAU', 'ISR', 'TUR', 'QAT',
      'BHR', 'KWT', 'OMN', 'JOR',
    ],
    label: '中东',
    labelEn: 'Middle East',
  },
};

const GEO_GROUP_ALIASES: Record<string, string> = {
  '西海岸': 'WEST_COAST',
  '美国西海岸': 'WEST_COAST',
  'west coast': 'WEST_COAST',
  'us west coast': 'WEST_COAST',
  '东海岸': 'EAST_COAST',
  '美国东海岸': 'EAST_COAST',
  'east coast': 'EAST_COAST',
  'us east coast': 'EAST_COAST',
  '北美': 'NORTH_AMERICA',
  '北美洲': 'NORTH_AMERICA',
  'north america': 'NORTH_AMERICA',
  '欧洲': 'EUROPE',
  'europe': 'EUROPE',
  '东南亚': 'SOUTHEAST_ASIA',
  'southeast asia': 'SOUTHEAST_ASIA',
  '东亚': 'EAST_ASIA',
  'east asia': 'EAST_ASIA',
  '中东': 'MIDDLE_EAST',
  'middle east': 'MIDDLE_EAST',
};

/* ═══════════════════════════════════════════════
   Layer 1 — GeoCandidate 候选集系统
   ═══════════════════════════════════════════════ */

export interface GeoCandidate {
  level: 'country' | 'state' | 'city';
  countryCode: string;
  stateCode?: string;
  cityCode?: string;
  label: string;
  labelEn: string;
  confidence: number;
}

export interface GeoResult {
  raw: string;
  ambiguous: boolean;
  candidates: GeoCandidate[];
  city: string | null;
  country: string | null;
  matchedNames: string[];
  group: GeoGroup | null;
}

/* ── Geo Catalog: 歧义/多义地名 ── */

const C_US_DC_CITY: GeoCandidate = {
  level: 'city',
  countryCode: 'USA',
  stateCode: 'USA0DC',
  cityCode: 'USA0DCWAS',
  label: '华盛顿特区',
  labelEn: 'Washington, DC',
  confidence: 0.85,
};
const C_US_WA_STATE: GeoCandidate = {
  level: 'state',
  countryCode: 'USA',
  stateCode: 'USA0WA',
  label: '华盛顿州',
  labelEn: 'Washington State',
  confidence: 0.80,
};
const C_US_DC_LEGACY: GeoCandidate = {
  level: 'city',
  countryCode: 'USA',
  stateCode: 'USA000',
  cityCode: 'USA000000',
  label: '华盛顿(旧)',
  labelEn: 'Washington (legacy)',
  confidence: 0.50,
};
const C_US_GA_STATE: GeoCandidate = {
  level: 'state',
  countryCode: 'USA',
  stateCode: 'USA0GA',
  label: '乔治亚州',
  labelEn: 'Georgia (US)',
  confidence: 0.80,
};
const C_COUNTRY_GEO: GeoCandidate = {
  level: 'country',
  countryCode: 'GEO',
  label: '格鲁吉亚',
  labelEn: 'Georgia (country)',
  confidence: 0.75,
};

interface AmbiguousEntry {
  aliases: string[];
  candidates: GeoCandidate[];
  disambiguators: {
    signal: string;
    pick: GeoCandidate[];
  }[];
}

const GEO_AMBIGUOUS: AmbiguousEntry[] = [
  {
    aliases: ['华盛顿', 'washington'],
    candidates: [
      C_US_DC_CITY, C_US_WA_STATE, C_US_DC_LEGACY,
    ],
    disambiguators: [
      { signal: '特区', pick: [C_US_DC_CITY] },
      { signal: 'dc', pick: [C_US_DC_CITY] },
      { signal: 'd.c.', pick: [C_US_DC_CITY] },
      { signal: 'district', pick: [C_US_DC_CITY] },
      {
        signal: '州',
        pick: [C_US_WA_STATE],
      },
      {
        signal: 'state',
        pick: [C_US_WA_STATE],
      },
    ],
  },
  {
    aliases: ['乔治亚', 'georgia'],
    candidates: [C_US_GA_STATE, C_COUNTRY_GEO],
    disambiguators: [
      { signal: '州', pick: [C_US_GA_STATE] },
      { signal: 'state', pick: [C_US_GA_STATE] },
      {
        signal: '格鲁吉亚',
        pick: [C_COUNTRY_GEO],
      },
      {
        signal: 'country',
        pick: [C_COUNTRY_GEO],
      },
    ],
  },
];

/* ── Layer 2: Disambiguation ── */

function findAmbiguous(
  text: string
): AmbiguousEntry | null {
  const t = text.toLowerCase();
  for (const entry of GEO_AMBIGUOUS) {
    for (const alias of entry.aliases) {
      if (wordBoundaryMatch(t, alias)) return entry;
    }
  }
  return null;
}

function disambiguate(
  entry: AmbiguousEntry,
  text: string
): GeoCandidate[] {
  const t = text.toLowerCase();
  for (const d of entry.disambiguators) {
    if (t.includes(d.signal)) return d.pick;
  }
  return entry.candidates;
}

/* ── resolveGeo：候选集模式 ── */

export function resolveGeo(text: string): GeoResult {
  const t = text.toLowerCase();
  const matchedNames: string[] = [];

  const gResult: GeoResult = {
    raw: text,
    ambiguous: false,
    candidates: [],
    city: null,
    country: null,
    matchedNames: [],
    group: null,
  };

  for (const [alias, groupKey] of
    Object.entries(GEO_GROUP_ALIASES)
  ) {
    if (t.includes(alias)) {
      gResult.group = GEO_GROUPS[groupKey];
      matchedNames.push(gResult.group.label);
      matchedNames.push(gResult.group.labelEn);
      gResult.matchedNames = matchedNames;
      return gResult;
    }
  }

  const ambEntry = findAmbiguous(text);
  if (ambEntry) {
    const picked = disambiguate(ambEntry, text);
    gResult.candidates = picked;
    gResult.ambiguous = picked.length > 1;

    for (const c of picked) {
      if (!matchedNames.includes(c.label))
        matchedNames.push(c.label);
      if (!matchedNames.includes(c.labelEn))
        matchedNames.push(c.labelEn);
    }

    if (!gResult.ambiguous && picked.length === 1) {
      const c = picked[0];
      gResult.city = c.cityCode || c.stateCode || null;
      gResult.country = c.countryCode;
    } else {
      const countries = [
        ...new Set(picked.map((c) => c.countryCode)),
      ];
      gResult.country =
        countries.length === 1 ? countries[0] : null;
    }
    gResult.matchedNames = matchedNames;
    return gResult;
  }

  for (const [name, info] of Object.entries(
    GEO_MAPPING.cities
  )) {
    const lowerName = name.toLowerCase();
    let matched = false;
    if (wordBoundaryMatch(t, lowerName)) {
      matched = true;
      matchedNames.push(name);
      if (info.en) matchedNames.push(info.en);
    } else if (info.en) {
      const lowerEn = info.en.toLowerCase();
      if (wordBoundaryMatch(t, lowerEn)) {
        matched = true;
        matchedNames.push(info.en);
        matchedNames.push(name);
      }
    }
    if (matched) {
      gResult.city = info.code;
      if (info.country)
        gResult.country = info.country;
      gResult.candidates =
        expandCityCandidates(name, info);
      break;
    }
  }

  if (
    !gResult.country &&
    !gResult.group &&
    gResult.candidates.length === 0
  ) {
    for (const [name, info] of Object.entries(
      GEO_MAPPING.countries
    )) {
      const lowerName = name.toLowerCase();
      if (wordBoundaryMatch(t, lowerName)) {
        gResult.country = info.code;
        matchedNames.push(name);
        if (info.en) matchedNames.push(info.en);
        gResult.candidates = [{
          level: 'country',
          countryCode: info.code,
          label: name,
          labelEn: info.en || name,
          confidence: 0.8,
        }];
        break;
      }
      if (info.en) {
        const lowerEn = info.en.toLowerCase();
        if (wordBoundaryMatch(t, lowerEn)) {
          gResult.country = info.code;
          matchedNames.push(info.en);
          matchedNames.push(name);
          gResult.candidates = [{
            level: 'country',
            countryCode: info.code,
            label: name,
            labelEn: info.en,
            confidence: 0.8,
          }];
          break;
        }
      }
      const lowerCode = info.code.toLowerCase();
      if (
        lowerCode.length >= 2 &&
        wordBoundaryMatch(t, lowerCode)
      ) {
        gResult.country = info.code;
        matchedNames.push(info.code);
        gResult.candidates = [{
          level: 'country',
          countryCode: info.code,
          label:
            COUNTRY_CODE_NAMES[info.code] || info.code,
          labelEn: info.en || info.code,
          confidence: 0.8,
        }];
        break;
      }
    }
  }

  gResult.matchedNames = matchedNames;
  return gResult;
}

function candidateFromCity(
  name: string,
  info: GeoEntry
): GeoCandidate {
  return {
    level: 'city',
    countryCode: info.country || '',
    stateCode: extractStateFromCode(info.code),
    cityCode: info.code,
    label: name,
    labelEn: info.en || name,
    confidence: 0.8,
  };
}

/**
 * Given a city match, find ALL city codes
 * sharing the same display name and create
 * candidates for each.
 * e.g. "伦敦" → candidates for GBR000LON,
 *   GBR000000, GBRENGLND
 */
function expandCityCandidates(
  name: string,
  info: GeoEntry
): GeoCandidate[] {
  const displayName =
    CITY_CODE_NAMES[info.code.toUpperCase()];
  if (!displayName) {
    return [candidateFromCity(name, info)];
  }
  const allCodes = allCityCodesForName(displayName);
  if (allCodes.length <= 1) {
    return [candidateFromCity(name, info)];
  }
  return allCodes.map((code) => ({
    level: 'city' as const,
    countryCode: info.country || '',
    stateCode: extractStateFromCode(code),
    cityCode: code,
    label: name,
    labelEn: info.en || name,
    confidence: 0.8,
  }));
}

function extractStateFromCode(
  cityCode: string
): string | undefined {
  if (cityCode.length >= 6) {
    return cityCode.substring(0, 6);
  }
  return undefined;
}

/* ── productLocationNames (unchanged) ── */

export function productLocationNames(
  country?: string,
  state?: string,
  city?: string
): string[] {
  const names: string[] = [];
  if (country) {
    names.push(country.toLowerCase());
    const zh =
      COUNTRY_CODE_NAMES[country.toUpperCase()];
    if (zh) names.push(zh.toLowerCase());
  }
  if (state) {
    names.push(state.toLowerCase());
    const zh =
      STATE_CODE_NAMES[state.toUpperCase()];
    if (zh) names.push(zh.toLowerCase());
  }
  if (city) {
    names.push(city.toLowerCase());
    const zh =
      CITY_CODE_NAMES[city.toUpperCase()];
    if (zh) names.push(zh.toLowerCase());
  }
  return names;
}
