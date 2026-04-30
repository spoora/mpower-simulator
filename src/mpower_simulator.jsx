import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ═══════════════════════════════════════════════════════════════
// ORBITAL CONSTANTS — O3b mPOWER
// ═══════════════════════════════════════════════════════════════
const VERSION = "v4.11.2";
const Re     = 6371;
const h_orb  = 8063;
const Rs     = Re + h_orb;
const mu     = 398600.4418;
const T_orb  = 2 * Math.PI * Math.sqrt(Rs ** 3 / mu);
const w_sat  = (2 * Math.PI) / T_orb;
const w_earth= (2 * Math.PI) / 86164.1;
const w_rel  = w_sat - w_earth;

const MAX_SATS  = 11;
const SAT_COLORS= ["#00cfff","#ff6b35","#7fff00","#ff69b4","#ffd700","#b07aff","#ff4444","#00ced1","#ffbf00","#98fb98","#ff6eb4"];
const EL_LEVELS = [5,10,15,20,25,30,35,40,45,50,55,60];

// Dynamic constellation helpers
function getInitLons(n) { return Array.from({length:n},(_,i)=>wrapL(i*360/n)); }
function getSatNames(n) { return Array.from({length:n},(_,i)=>`mPOWER-${i+1}`); }

// ═══════════════════════════════════════════════════════════════
// AIRPORT DATABASE — major international airports within ±40° lat
// ═══════════════════════════════════════════════════════════════
const AIRPORTS = [
// North America
{iata:"JFK",name:"New York JFK",city:"New York",country:"US",lat:40.64,lon:-73.78},
{iata:"EWR",name:"Newark Liberty",city:"Newark",country:"US",lat:40.69,lon:-74.17},
{iata:"LAX",name:"Los Angeles",city:"Los Angeles",country:"US",lat:33.94,lon:-118.41},
{iata:"ORD",name:"Chicago O'Hare",city:"Chicago",country:"US",lat:41.98,lon:-87.90},
{iata:"ATL",name:"Atlanta Hartsfield",city:"Atlanta",country:"US",lat:33.64,lon:-84.43},
{iata:"DFW",name:"Dallas/Fort Worth",city:"Dallas",country:"US",lat:32.90,lon:-97.04},
{iata:"DEN",name:"Denver Intl",city:"Denver",country:"US",lat:39.86,lon:-104.67},
{iata:"SFO",name:"San Francisco",city:"San Francisco",country:"US",lat:37.62,lon:-122.38},
{iata:"SEA",name:"Seattle-Tacoma",city:"Seattle",country:"US",lat:47.44,lon:-122.31},
{iata:"MIA",name:"Miami Intl",city:"Miami",country:"US",lat:25.80,lon:-80.29},
{iata:"IAH",name:"Houston Intercontinental",city:"Houston",country:"US",lat:29.99,lon:-95.34},
{iata:"PHX",name:"Phoenix Sky Harbor",city:"Phoenix",country:"US",lat:33.44,lon:-112.01},
{iata:"BOS",name:"Boston Logan",city:"Boston",country:"US",lat:42.36,lon:-71.01},
{iata:"MCO",name:"Orlando Intl",city:"Orlando",country:"US",lat:28.43,lon:-81.31},
{iata:"IAD",name:"Washington Dulles",city:"Washington DC",country:"US",lat:38.94,lon:-77.46},
{iata:"YYZ",name:"Toronto Pearson",city:"Toronto",country:"CA",lat:43.68,lon:-79.63},
{iata:"YVR",name:"Vancouver Intl",city:"Vancouver",country:"CA",lat:49.19,lon:-123.18},
{iata:"YUL",name:"Montreal Trudeau",city:"Montreal",country:"CA",lat:45.47,lon:-73.74},
{iata:"MEX",name:"Mexico City Intl",city:"Mexico City",country:"MX",lat:19.44,lon:-99.07},
{iata:"CUN",name:"Cancún Intl",city:"Cancún",country:"MX",lat:21.04,lon:-86.87},
// Caribbean & Central America
{iata:"PTY",name:"Panama City Tocumen",city:"Panama City",country:"PA",lat:9.07,lon:-79.38},
{iata:"BOG",name:"Bogotá El Dorado",city:"Bogotá",country:"CO",lat:4.70,lon:-74.15},
{iata:"GRU",name:"São Paulo Guarulhos",city:"São Paulo",country:"BR",lat:-23.43,lon:-46.47},
{iata:"GIG",name:"Rio de Janeiro Galeão",city:"Rio de Janeiro",country:"BR",lat:-22.81,lon:-43.24},
{iata:"BSB",name:"Brasília Intl",city:"Brasília",country:"BR",lat:-15.87,lon:-47.92},
{iata:"FOR",name:"Fortaleza Intl",city:"Fortaleza",country:"BR",lat:-3.78,lon:-38.53},
{iata:"REC",name:"Recife Guararapes",city:"Recife",country:"BR",lat:-8.13,lon:-34.92},
{iata:"SSA",name:"Salvador Deputado",city:"Salvador",country:"BR",lat:-12.91,lon:-38.33},
{iata:"SCL",name:"Santiago Arturo Merino",city:"Santiago",country:"CL",lat:-33.39,lon:-70.79},
{iata:"LIM",name:"Lima Jorge Chávez",city:"Lima",country:"PE",lat:-12.02,lon:-77.11},
{iata:"EZE",name:"Buenos Aires Ezeiza",city:"Buenos Aires",country:"AR",lat:-34.82,lon:-58.54},
{iata:"MVD",name:"Montevideo Carrasco",city:"Montevideo",country:"UY",lat:-34.84,lon:-56.03},
{iata:"ASU",name:"Asunción Silvio Pettirossi",city:"Asunción",country:"PY",lat:-25.24,lon:-57.52},
// Europe
{iata:"LHR",name:"London Heathrow",city:"London",country:"GB",lat:51.48,lon:-0.46},
{iata:"LGW",name:"London Gatwick",city:"London",country:"GB",lat:51.15,lon:-0.18},
{iata:"CDG",name:"Paris Charles de Gaulle",city:"Paris",country:"FR",lat:49.01,lon:2.55},
{iata:"AMS",name:"Amsterdam Schiphol",city:"Amsterdam",country:"NL",lat:52.31,lon:4.76},
{iata:"FRA",name:"Frankfurt Intl",city:"Frankfurt",country:"DE",lat:50.04,lon:8.56},
{iata:"MAD",name:"Madrid Barajas",city:"Madrid",country:"ES",lat:40.47,lon:-3.57},
{iata:"BCN",name:"Barcelona El Prat",city:"Barcelona",country:"ES",lat:41.30,lon:2.08},
{iata:"FCO",name:"Rome Fiumicino",city:"Rome",country:"IT",lat:41.80,lon:12.25},
{iata:"MXP",name:"Milan Malpensa",city:"Milan",country:"IT",lat:45.63,lon:8.72},
{iata:"ZRH",name:"Zurich Intl",city:"Zurich",country:"CH",lat:47.46,lon:8.55},
{iata:"VIE",name:"Vienna Intl",city:"Vienna",country:"AT",lat:48.11,lon:16.57},
{iata:"BRU",name:"Brussels Intl",city:"Brussels",country:"BE",lat:50.90,lon:4.48},
{iata:"CPH",name:"Copenhagen Kastrup",city:"Copenhagen",country:"DK",lat:55.62,lon:12.66},
{iata:"ARN",name:"Stockholm Arlanda",city:"Stockholm",country:"SE",lat:59.65,lon:17.93},
{iata:"OSL",name:"Oslo Gardermoen",city:"Oslo",country:"NO",lat:60.20,lon:11.08},
{iata:"HEL",name:"Helsinki Vantaa",city:"Helsinki",country:"FI",lat:60.32,lon:24.96},
{iata:"WAW",name:"Warsaw Chopin",city:"Warsaw",country:"PL",lat:52.17,lon:20.97},
{iata:"ATH",name:"Athens Eleftherios",city:"Athens",country:"GR",lat:37.94,lon:23.95},
{iata:"IST",name:"Istanbul Intl",city:"Istanbul",country:"TR",lat:41.28,lon:28.75},
{iata:"LIS",name:"Lisbon Humberto Delgado",city:"Lisbon",country:"PT",lat:38.77,lon:-9.13},
{iata:"DUB",name:"Dublin Intl",city:"Dublin",country:"IE",lat:53.43,lon:-6.24},
// Middle East & Africa
{iata:"DXB",name:"Dubai Intl",city:"Dubai",country:"AE",lat:25.25,lon:55.36},
{iata:"AUH",name:"Abu Dhabi Intl",city:"Abu Dhabi",country:"AE",lat:24.43,lon:54.65},
{iata:"DOH",name:"Doha Hamad",city:"Doha",country:"QA",lat:25.27,lon:51.61},
{iata:"RUH",name:"Riyadh King Khalid",city:"Riyadh",country:"SA",lat:24.96,lon:46.70},
{iata:"JED",name:"Jeddah King Abdulaziz",city:"Jeddah",country:"SA",lat:21.68,lon:39.16},
{iata:"CAI",name:"Cairo Intl",city:"Cairo",country:"EG",lat:30.12,lon:31.41},
{iata:"CMN",name:"Casablanca Mohammed V",city:"Casablanca",country:"MA",lat:33.37,lon:-7.59},
{iata:"TUN",name:"Tunis Carthage",city:"Tunis",country:"TN",lat:36.85,lon:10.23},
{iata:"LOS",name:"Lagos Murtala Muhammed",city:"Lagos",country:"NG",lat:6.58,lon:3.32},
{iata:"ABV",name:"Abuja Nnamdi Azikiwe",city:"Abuja",country:"NG",lat:9.01,lon:7.26},
{iata:"ACC",name:"Accra Kotoka",city:"Accra",country:"GH",lat:5.61,lon:-0.17},
{iata:"DKR",name:"Dakar Léopold Sédar Senghor",city:"Dakar",country:"SN",lat:14.74,lon:-17.49},
{iata:"NBO",name:"Nairobi Jomo Kenyatta",city:"Nairobi",country:"KE",lat:-1.32,lon:36.93},
{iata:"ADD",name:"Addis Ababa Bole",city:"Addis Ababa",country:"ET",lat:8.98,lon:38.80},
{iata:"JNB",name:"Johannesburg O.R. Tambo",city:"Johannesburg",country:"ZA",lat:-26.13,lon:28.24},
{iata:"CPT",name:"Cape Town Intl",city:"Cape Town",country:"ZA",lat:-33.97,lon:18.60},
{iata:"DAR",name:"Dar es Salaam Julius Nyerere",city:"Dar es Salaam",country:"TZ",lat:-6.88,lon:39.20},
{iata:"LUN",name:"Lusaka Kenneth Kaunda",city:"Lusaka",country:"ZM",lat:-15.33,lon:28.45},
// Asia-Pacific
{iata:"SIN",name:"Singapore Changi",city:"Singapore",country:"SG",lat:1.36,lon:103.99},
{iata:"BKK",name:"Bangkok Suvarnabhumi",city:"Bangkok",country:"TH",lat:13.69,lon:100.75},
{iata:"KUL",name:"Kuala Lumpur Intl",city:"Kuala Lumpur",country:"MY",lat:2.74,lon:101.71},
{iata:"CGK",name:"Jakarta Soekarno-Hatta",city:"Jakarta",country:"ID",lat:-6.13,lon:106.65},
{iata:"MNL",name:"Manila Ninoy Aquino",city:"Manila",country:"PH",lat:14.51,lon:121.02},
{iata:"HKG",name:"Hong Kong Intl",city:"Hong Kong",country:"HK",lat:22.31,lon:113.92},
{iata:"PVG",name:"Shanghai Pudong",city:"Shanghai",country:"CN",lat:31.14,lon:121.81},
{iata:"PEK",name:"Beijing Capital",city:"Beijing",country:"CN",lat:40.08,lon:116.60},
{iata:"CAN",name:"Guangzhou Baiyun",city:"Guangzhou",country:"CN",lat:23.39,lon:113.30},
{iata:"ICN",name:"Seoul Incheon",city:"Seoul",country:"KR",lat:37.46,lon:126.44},
{iata:"DEL",name:"Delhi Indira Gandhi",city:"New Delhi",country:"IN",lat:28.56,lon:77.10},
{iata:"BOM",name:"Mumbai Chhatrapati Shivaji",city:"Mumbai",country:"IN",lat:19.09,lon:72.87},
{iata:"BLR",name:"Bangalore Kempegowda",city:"Bangalore",country:"IN",lat:13.20,lon:77.71},
{iata:"HYD",name:"Hyderabad Rajiv Gandhi",city:"Hyderabad",country:"IN",lat:17.24,lon:78.43},
{iata:"MAA",name:"Chennai Intl",city:"Chennai",country:"IN",lat:12.99,lon:80.17},
{iata:"CCU",name:"Kolkata Netaji Subhash",city:"Kolkata",country:"IN",lat:22.65,lon:88.45},
{iata:"CMB",name:"Colombo Bandaranaike",city:"Colombo",country:"LK",lat:7.18,lon:79.88},
{iata:"DAC",name:"Dhaka Hazrat Shahjalal",city:"Dhaka",country:"BD",lat:23.84,lon:90.40},
{iata:"KHI",name:"Karachi Jinnah",city:"Karachi",country:"PK",lat:24.90,lon:67.17},
{iata:"LHE",name:"Lahore Allama Iqbal",city:"Lahore",country:"PK",lat:31.52,lon:74.40},
{iata:"ISB",name:"Islamabad New Intl",city:"Islamabad",country:"PK",lat:33.55,lon:72.83},
{iata:"TXL",name:"Nairobi Wilson",city:"Nairobi",country:"KE",lat:-1.32,lon:36.81},
{iata:"MCT",name:"Muscat Seeb",city:"Muscat",country:"OM",lat:23.59,lon:58.28},
{iata:"KWI",name:"Kuwait Intl",city:"Kuwait City",country:"KW",lat:29.23,lon:47.97},
{iata:"BAH",name:"Bahrain Intl",city:"Manama",country:"BH",lat:26.27,lon:50.63},
{iata:"AMM",name:"Amman Queen Alia",city:"Amman",country:"JO",lat:31.72,lon:35.99},
{iata:"BEY",name:"Beirut Rafic Hariri",city:"Beirut",country:"LB",lat:33.82,lon:35.49},
{iata:"KIX",name:"Osaka Kansai",city:"Osaka",country:"JP",lat:34.43,lon:135.24},
{iata:"NGO",name:"Nagoya Chubu Centrair",city:"Nagoya",country:"JP",lat:34.86,lon:136.81},
// Oceania (within ±40°)
{iata:"SYD",name:"Sydney Kingsford Smith",city:"Sydney",country:"AU",lat:-33.95,lon:151.18},
{iata:"MEL",name:"Melbourne Tullamarine",city:"Melbourne",country:"AU",lat:-37.67,lon:144.84},
{iata:"BNE",name:"Brisbane Intl",city:"Brisbane",country:"AU",lat:-27.38,lon:153.12},
{iata:"PER",name:"Perth Intl",city:"Perth",country:"AU",lat:-31.94,lon:115.97},
{iata:"AKL",name:"Auckland Intl",city:"Auckland",country:"NZ",lat:-37.01,lon:174.79},
];

// ═══════════════════════════════════════════════════════════════
const GATEWAYS = [
  {id:"GW-DUB",name:"Dubbo",country:"AU",lat:-32.25,lon:148.60,operator:"Pivotel",azure:false},
  {id:"GW-MER",name:"Merredin",country:"AU",lat:-31.48,lon:118.28,operator:"Pivotel",azure:false},
  {id:"GW-THE",name:"Thermopylae",country:"GR",lat:38.80,lon:22.56,operator:"OTE",azure:false},
  {id:"GW-PHX",name:"Phoenix",country:"US",lat:33.45,lon:-112.07,operator:"Microsoft",azure:true},
  {id:"GW-QUI",name:"Quincy",country:"US",lat:47.23,lon:-119.85,operator:"Microsoft",azure:true},
  {id:"GW-HIK",name:"Hawaii",country:"US",lat:21.39,lon:-158.00,operator:"SES",azure:false},
  {id:"GW-SCL",name:"Santiago",country:"CL",lat:-33.45,lon:-70.67,operator:"Microsoft",azure:true},
  {id:"GW-FUJ",name:"Fujairah",country:"AE",lat:25.13,lon:56.33,operator:"Datamena",azure:false},
  {id:"GW-DKR",name:"Dakar",country:"SN",lat:14.69,lon:-17.44,operator:"Tigo",azure:false},
  {id:"GW-JNB",name:"Johannesburg",country:"ZA",lat:-25.88,lon:28.19,operator:"Microsoft",azure:true},
  {id:"GW-LIM",name:"Lima",country:"PE",lat:-12.05,lon:-77.04,operator:"Microsoft",azure:true},
  {id:"GW-SIN",name:"Sintra",country:"PT",lat:38.80,lon:-9.38,operator:"SES",azure:false},
];

// Optional gateway locations — not in the standard 12-site network.
// These can be toggled on/off in the Gateway Manager tab.
const OPTIONAL_GATEWAYS = [
  {id:"GW-LPT",name:"Le Port",country:"FR",lat:-20.93,lon:55.29,operator:"Optional",azure:false,optional:true,
   note:"La Réunion island, Indian Ocean — windward western port site"},
  {id:"GW-REU",name:"La Réunion",country:"FR",lat:-21.11444,lon:55.53250,operator:"Optional",azure:false,optional:true,
   note:"La Réunion island — Tab 7 weather risk primary site"},
];

// Full combined pool — standard + optional
const ALL_GATEWAYS = [...GATEWAYS, ...OPTIONAL_GATEWAYS];
const GW_COLOR = "#ff9900";
const GW_MIN_EL_DEFAULT = 5; // minimum elevation for gateway-satellite link (overridden by UI)

// ═══════════════════════════════════════════════════════════════
// CITY DATABASE — 500+ cities worldwide
// ═══════════════════════════════════════════════════════════════
const CITIES=[
// Africa
{name:"Algiers",country:"DZ",lat:36.75,lon:3.04},{name:"Oran",country:"DZ",lat:35.70,lon:-0.63},
{name:"Luanda",country:"AO",lat:-8.84,lon:13.23},{name:"Cotonou",country:"BJ",lat:6.37,lon:2.39},
{name:"Porto-Novo",country:"BJ",lat:6.50,lon:2.63},{name:"Gaborone",country:"BW",lat:-24.65,lon:25.91},
{name:"Ouagadougou",country:"BF",lat:12.37,lon:-1.52},{name:"Bujumbura",country:"BI",lat:-3.38,lon:29.36},
{name:"Yaoundé",country:"CM",lat:3.87,lon:11.52},{name:"Douala",country:"CM",lat:4.05,lon:9.77},
{name:"Praia",country:"CV",lat:14.93,lon:-23.51},{name:"Bangui",country:"CF",lat:4.36,lon:18.56},
{name:"N'Djamena",country:"TD",lat:12.11,lon:15.04},{name:"Brazzaville",country:"CG",lat:-4.27,lon:15.28},
{name:"Kinshasa",country:"CD",lat:-4.44,lon:15.27},{name:"Lubumbashi",country:"CD",lat:-11.66,lon:27.47},
{name:"Djibouti",country:"DJ",lat:11.59,lon:43.15},{name:"Cairo",country:"EG",lat:30.04,lon:31.24},
{name:"Alexandria",country:"EG",lat:31.20,lon:29.92},{name:"Giza",country:"EG",lat:30.01,lon:31.21},
{name:"Asmara",country:"ER",lat:15.34,lon:38.93},{name:"Mbabane",country:"SZ",lat:-26.32,lon:31.13},
{name:"Addis Ababa",country:"ET",lat:9.02,lon:38.75},{name:"Libreville",country:"GA",lat:0.39,lon:9.45},
{name:"Accra",country:"GH",lat:5.56,lon:-0.19},{name:"Kumasi",country:"GH",lat:6.69,lon:-1.62},
{name:"Conakry",country:"GN",lat:9.64,lon:-13.58},{name:"Abidjan",country:"CI",lat:5.36,lon:-4.01},
{name:"Yamoussoukro",country:"CI",lat:6.82,lon:-5.28},{name:"Nairobi",country:"KE",lat:-1.29,lon:36.82},
{name:"Mombasa",country:"KE",lat:-4.04,lon:39.67},{name:"Maseru",country:"LS",lat:-29.31,lon:27.48},
{name:"Monrovia",country:"LR",lat:6.30,lon:-10.80},{name:"Tripoli",country:"LY",lat:32.90,lon:13.18},
{name:"Benghazi",country:"LY",lat:32.12,lon:20.07},{name:"Antananarivo",country:"MG",lat:-18.91,lon:47.52},
{name:"Lilongwe",country:"MW",lat:-13.97,lon:33.79},{name:"Blantyre",country:"MW",lat:-15.79,lon:35.01},
{name:"Bamako",country:"ML",lat:12.64,lon:-8.00},{name:"Nouakchott",country:"MR",lat:18.09,lon:-15.98},
{name:"Port Louis",country:"MU",lat:-20.16,lon:57.50},{name:"Rabat",country:"MA",lat:34.02,lon:-6.84},
{name:"Casablanca",country:"MA",lat:33.57,lon:-7.59},{name:"Marrakech",country:"MA",lat:31.63,lon:-8.01},
{name:"Fez",country:"MA",lat:34.03,lon:-5.00},{name:"Tangier",country:"MA",lat:35.77,lon:-5.80},
{name:"Maputo",country:"MZ",lat:-25.97,lon:32.57},{name:"Beira",country:"MZ",lat:-19.84,lon:34.87},
{name:"Windhoek",country:"NA",lat:-22.56,lon:17.08},{name:"Niamey",country:"NE",lat:13.51,lon:2.13},
{name:"Abuja",country:"NG",lat:9.06,lon:7.49},{name:"Lagos",country:"NG",lat:6.52,lon:3.38},
{name:"Kano",country:"NG",lat:12.00,lon:8.52},{name:"Ibadan",country:"NG",lat:7.38,lon:3.95},
{name:"Port Harcourt",country:"NG",lat:4.78,lon:7.01},{name:"Kigali",country:"RW",lat:-1.94,lon:30.06},
{name:"Dakar",country:"SN",lat:14.69,lon:-17.44},{name:"Freetown",country:"SL",lat:8.48,lon:-13.23},
{name:"Mogadishu",country:"SO",lat:2.05,lon:45.32},{name:"Pretoria",country:"ZA",lat:-25.75,lon:28.19},
{name:"Johannesburg",country:"ZA",lat:-26.20,lon:28.04},{name:"Cape Town",country:"ZA",lat:-33.93,lon:18.42},
{name:"Durban",country:"ZA",lat:-29.86,lon:31.02},{name:"Bloemfontein",country:"ZA",lat:-29.12,lon:26.21},
{name:"Port Elizabeth",country:"ZA",lat:-33.96,lon:25.60},{name:"East London",country:"ZA",lat:-33.02,lon:27.91},
{name:"Pietermaritzburg",country:"ZA",lat:-29.60,lon:30.38},{name:"Nelspruit",country:"ZA",lat:-25.47,lon:30.97},
{name:"Polokwane",country:"ZA",lat:-23.90,lon:29.45},{name:"Kimberley",country:"ZA",lat:-28.74,lon:24.77},
{name:"Upington",country:"ZA",lat:-28.46,lon:21.26},{name:"George",country:"ZA",lat:-33.96,lon:22.46},
{name:"Juba",country:"SS",lat:4.85,lon:31.58},{name:"Khartoum",country:"SD",lat:15.60,lon:32.53},
{name:"Dar es Salaam",country:"TZ",lat:-6.79,lon:39.28},{name:"Dodoma",country:"TZ",lat:-6.16,lon:35.75},
{name:"Zanzibar",country:"TZ",lat:-6.16,lon:39.19},{name:"Lomé",country:"TG",lat:6.14,lon:1.21},
{name:"Tunis",country:"TN",lat:36.81,lon:10.17},{name:"Kampala",country:"UG",lat:0.35,lon:32.58},
{name:"Lusaka",country:"ZM",lat:-15.39,lon:28.32},{name:"Harare",country:"ZW",lat:-17.83,lon:31.05},
{name:"Bulawayo",country:"ZW",lat:-20.15,lon:28.58},
// Americas
{name:"Buenos Aires",country:"AR",lat:-34.60,lon:-58.38},{name:"Córdoba",country:"AR",lat:-31.42,lon:-64.18},
{name:"Rosario",country:"AR",lat:-32.95,lon:-60.65},{name:"Mendoza",country:"AR",lat:-32.89,lon:-68.83},
{name:"Nassau",country:"BS",lat:25.06,lon:-77.35},{name:"Bridgetown",country:"BB",lat:13.10,lon:-59.62},
{name:"La Paz",country:"BO",lat:-16.50,lon:-68.15},{name:"Santa Cruz",country:"BO",lat:-17.81,lon:-63.18},
{name:"Brasília",country:"BR",lat:-15.79,lon:-47.88},{name:"São Paulo",country:"BR",lat:-23.55,lon:-46.63},
{name:"Rio de Janeiro",country:"BR",lat:-22.91,lon:-43.17},{name:"Salvador",country:"BR",lat:-12.97,lon:-38.51},
{name:"Recife",country:"BR",lat:-8.05,lon:-34.87},{name:"Fortaleza",country:"BR",lat:-3.72,lon:-38.53},
{name:"Belo Horizonte",country:"BR",lat:-19.92,lon:-43.94},{name:"Manaus",country:"BR",lat:-3.12,lon:-60.02},
{name:"Curitiba",country:"BR",lat:-25.43,lon:-49.27},{name:"Porto Alegre",country:"BR",lat:-30.03,lon:-51.23},
{name:"Belém",country:"BR",lat:-1.46,lon:-48.50},{name:"Ottawa",country:"CA",lat:45.42,lon:-75.70},
{name:"Toronto",country:"CA",lat:43.65,lon:-79.38},{name:"Vancouver",country:"CA",lat:49.28,lon:-123.12},
{name:"Montreal",country:"CA",lat:45.50,lon:-73.57},{name:"Calgary",country:"CA",lat:51.05,lon:-114.07},
{name:"Santiago",country:"CL",lat:-33.45,lon:-70.67},{name:"Bogotá",country:"CO",lat:4.71,lon:-74.07},
{name:"Medellín",country:"CO",lat:6.25,lon:-75.56},{name:"Cali",country:"CO",lat:3.44,lon:-76.52},
{name:"Barranquilla",country:"CO",lat:10.96,lon:-74.78},{name:"San José",country:"CR",lat:9.93,lon:-84.09},
{name:"Havana",country:"CU",lat:23.11,lon:-82.37},{name:"Santo Domingo",country:"DO",lat:18.47,lon:-69.90},
{name:"Quito",country:"EC",lat:-0.18,lon:-78.47},{name:"Guayaquil",country:"EC",lat:-2.19,lon:-79.89},
{name:"San Salvador",country:"SV",lat:13.69,lon:-89.19},{name:"Guatemala City",country:"GT",lat:14.63,lon:-90.51},
{name:"Port-au-Prince",country:"HT",lat:18.54,lon:-72.34},{name:"Tegucigalpa",country:"HN",lat:14.07,lon:-87.19},
{name:"Kingston",country:"JM",lat:18.00,lon:-76.79},{name:"Mexico City",country:"MX",lat:19.43,lon:-99.13},
{name:"Guadalajara",country:"MX",lat:20.67,lon:-103.35},{name:"Monterrey",country:"MX",lat:25.69,lon:-100.32},
{name:"Cancún",country:"MX",lat:21.16,lon:-86.85},{name:"Puebla",country:"MX",lat:19.04,lon:-98.21},
{name:"Managua",country:"NI",lat:12.13,lon:-86.25},{name:"Panama City",country:"PA",lat:8.98,lon:-79.52},
{name:"Asunción",country:"PY",lat:-25.26,lon:-57.58},{name:"Lima",country:"PE",lat:-12.05,lon:-77.04},
{name:"Cusco",country:"PE",lat:-13.52,lon:-71.97},{name:"San Juan",country:"PR",lat:18.47,lon:-66.11},
{name:"Port of Spain",country:"TT",lat:10.65,lon:-61.51},{name:"Montevideo",country:"UY",lat:-34.88,lon:-56.16},
{name:"Washington D.C.",country:"US",lat:38.91,lon:-77.04},{name:"New York",country:"US",lat:40.71,lon:-74.01},
{name:"Los Angeles",country:"US",lat:34.05,lon:-118.24},{name:"Chicago",country:"US",lat:41.88,lon:-87.63},
{name:"Houston",country:"US",lat:29.76,lon:-95.37},{name:"Miami",country:"US",lat:25.76,lon:-80.19},
{name:"San Francisco",country:"US",lat:37.77,lon:-122.42},{name:"Dallas",country:"US",lat:32.78,lon:-96.80},
{name:"Atlanta",country:"US",lat:33.75,lon:-84.39},{name:"Seattle",country:"US",lat:47.61,lon:-122.33},
{name:"Denver",country:"US",lat:39.74,lon:-104.99},{name:"Boston",country:"US",lat:42.36,lon:-71.06},
{name:"Phoenix",country:"US",lat:33.45,lon:-112.07},{name:"Honolulu",country:"US",lat:21.31,lon:-157.86},
{name:"Caracas",country:"VE",lat:10.49,lon:-66.88},{name:"Paramaribo",country:"SR",lat:5.85,lon:-55.17},
// Asia
{name:"Kabul",country:"AF",lat:34.53,lon:69.17},{name:"Yerevan",country:"AM",lat:40.18,lon:44.51},
{name:"Baku",country:"AZ",lat:40.41,lon:49.87},{name:"Manama",country:"BH",lat:26.23,lon:50.59},
{name:"Dhaka",country:"BD",lat:23.81,lon:90.41},{name:"Chittagong",country:"BD",lat:22.36,lon:91.78},
{name:"Thimphu",country:"BT",lat:27.47,lon:89.64},{name:"Phnom Penh",country:"KH",lat:11.56,lon:104.92},
{name:"Beijing",country:"CN",lat:39.90,lon:116.41},{name:"Shanghai",country:"CN",lat:31.23,lon:121.47},
{name:"Guangzhou",country:"CN",lat:23.13,lon:113.26},{name:"Shenzhen",country:"CN",lat:22.54,lon:114.06},
{name:"Chengdu",country:"CN",lat:30.57,lon:104.07},{name:"Wuhan",country:"CN",lat:30.59,lon:114.31},
{name:"Chongqing",country:"CN",lat:29.56,lon:106.55},{name:"Xi'an",country:"CN",lat:34.26,lon:108.94},
{name:"Hangzhou",country:"CN",lat:30.27,lon:120.15},{name:"Nanjing",country:"CN",lat:32.06,lon:118.80},
{name:"Tbilisi",country:"GE",lat:41.69,lon:44.80},{name:"New Delhi",country:"IN",lat:28.61,lon:77.21},
{name:"Mumbai",country:"IN",lat:19.08,lon:72.88},{name:"Bangalore",country:"IN",lat:12.97,lon:77.59},
{name:"Chennai",country:"IN",lat:13.08,lon:80.27},{name:"Kolkata",country:"IN",lat:22.57,lon:88.36},
{name:"Hyderabad",country:"IN",lat:17.39,lon:78.49},{name:"Ahmedabad",country:"IN",lat:23.02,lon:72.57},
{name:"Pune",country:"IN",lat:18.52,lon:73.86},{name:"Jaipur",country:"IN",lat:26.92,lon:75.79},
{name:"Lucknow",country:"IN",lat:26.85,lon:80.95},{name:"Kochi",country:"IN",lat:9.93,lon:76.27},
{name:"Jakarta",country:"ID",lat:-6.21,lon:106.85},{name:"Surabaya",country:"ID",lat:-7.25,lon:112.75},
{name:"Bandung",country:"ID",lat:-6.92,lon:107.60},{name:"Medan",country:"ID",lat:3.60,lon:98.68},
{name:"Bali",country:"ID",lat:-8.34,lon:115.09},{name:"Tehran",country:"IR",lat:35.69,lon:51.39},
{name:"Isfahan",country:"IR",lat:32.65,lon:51.68},{name:"Mashhad",country:"IR",lat:36.30,lon:59.60},
{name:"Baghdad",country:"IQ",lat:33.31,lon:44.37},{name:"Basra",country:"IQ",lat:30.51,lon:47.81},
{name:"Jerusalem",country:"IL",lat:31.77,lon:35.23},{name:"Tel Aviv",country:"IL",lat:32.09,lon:34.77},
{name:"Tokyo",country:"JP",lat:35.68,lon:139.69},{name:"Osaka",country:"JP",lat:34.69,lon:135.50},
{name:"Yokohama",country:"JP",lat:35.44,lon:139.64},{name:"Nagoya",country:"JP",lat:35.18,lon:136.91},
{name:"Sapporo",country:"JP",lat:43.06,lon:141.35},{name:"Fukuoka",country:"JP",lat:33.59,lon:130.40},
{name:"Amman",country:"JO",lat:31.95,lon:35.93},
{name:"Astana",country:"KZ",lat:51.17,lon:71.43},{name:"Almaty",country:"KZ",lat:43.24,lon:76.95},
{name:"Shymkent",country:"KZ",lat:42.32,lon:69.60},{name:"Aktobe",country:"KZ",lat:50.28,lon:57.21},
{name:"Karaganda",country:"KZ",lat:49.80,lon:73.10},{name:"Taraz",country:"KZ",lat:42.90,lon:71.37},
{name:"Pavlodar",country:"KZ",lat:52.29,lon:76.95},{name:"Atyrau",country:"KZ",lat:47.10,lon:51.92},
{name:"Aktau",country:"KZ",lat:43.65,lon:51.15},{name:"Kostanay",country:"KZ",lat:53.21,lon:63.63},
{name:"Semey",country:"KZ",lat:50.41,lon:80.23},{name:"Oral",country:"KZ",lat:51.23,lon:51.37},
{name:"Petropavl",country:"KZ",lat:54.87,lon:69.16},{name:"Turkestan",country:"KZ",lat:43.30,lon:68.25},
{name:"Kuwait City",country:"KW",lat:29.38,lon:47.99},{name:"Bishkek",country:"KG",lat:42.87,lon:74.59},
{name:"Osh",country:"KG",lat:40.53,lon:72.80},{name:"Vientiane",country:"LA",lat:17.97,lon:102.63},
{name:"Beirut",country:"LB",lat:33.89,lon:35.50},{name:"Kuala Lumpur",country:"MY",lat:3.14,lon:101.69},
{name:"Penang",country:"MY",lat:5.41,lon:100.34},{name:"Johor Bahru",country:"MY",lat:1.49,lon:103.74},
{name:"Malé",country:"MV",lat:4.18,lon:73.51},{name:"Ulaanbaatar",country:"MN",lat:47.92,lon:106.91},
{name:"Yangon",country:"MM",lat:16.87,lon:96.20},{name:"Mandalay",country:"MM",lat:21.97,lon:96.08},
{name:"Kathmandu",country:"NP",lat:27.72,lon:85.32},{name:"Pyongyang",country:"KP",lat:39.02,lon:125.75},
{name:"Seoul",country:"KR",lat:37.57,lon:126.98},{name:"Busan",country:"KR",lat:35.18,lon:129.08},
{name:"Incheon",country:"KR",lat:37.46,lon:126.71},{name:"Muscat",country:"OM",lat:23.59,lon:58.54},
{name:"Islamabad",country:"PK",lat:33.69,lon:73.04},{name:"Karachi",country:"PK",lat:24.86,lon:67.01},
{name:"Lahore",country:"PK",lat:31.55,lon:74.35},{name:"Faisalabad",country:"PK",lat:31.42,lon:73.08},
{name:"Peshawar",country:"PK",lat:34.02,lon:71.58},{name:"Manila",country:"PH",lat:14.60,lon:120.98},
{name:"Cebu",country:"PH",lat:10.32,lon:123.89},{name:"Davao",country:"PH",lat:7.19,lon:125.46},
{name:"Doha",country:"QA",lat:25.29,lon:51.53},{name:"Riyadh",country:"SA",lat:24.69,lon:46.72},
{name:"Jeddah",country:"SA",lat:21.49,lon:39.19},{name:"Mecca",country:"SA",lat:21.39,lon:39.86},
{name:"Medina",country:"SA",lat:24.47,lon:39.61},{name:"Dammam",country:"SA",lat:26.43,lon:50.10},
{name:"Singapore",country:"SG",lat:1.35,lon:103.82},{name:"Colombo",country:"LK",lat:6.93,lon:79.85},
{name:"Damascus",country:"SY",lat:33.51,lon:36.29},{name:"Aleppo",country:"SY",lat:36.20,lon:37.16},
{name:"Taipei",country:"TW",lat:25.03,lon:121.57},{name:"Kaohsiung",country:"TW",lat:22.63,lon:120.30},
{name:"Dushanbe",country:"TJ",lat:38.56,lon:68.77},{name:"Bangkok",country:"TH",lat:13.76,lon:100.50},
{name:"Chiang Mai",country:"TH",lat:18.79,lon:98.98},{name:"Phuket",country:"TH",lat:7.88,lon:98.39},
{name:"Ankara",country:"TR",lat:39.93,lon:32.85},{name:"Istanbul",country:"TR",lat:41.01,lon:28.98},
{name:"Izmir",country:"TR",lat:38.42,lon:27.14},{name:"Antalya",country:"TR",lat:36.90,lon:30.69},
{name:"Ashgabat",country:"TM",lat:37.96,lon:58.33},{name:"Abu Dhabi",country:"AE",lat:24.45,lon:54.65},
{name:"Dubai",country:"AE",lat:25.20,lon:55.27},{name:"Sharjah",country:"AE",lat:25.34,lon:55.41},
{name:"Tashkent",country:"UZ",lat:41.30,lon:69.28},{name:"Samarkand",country:"UZ",lat:39.65,lon:66.96},
{name:"Bukhara",country:"UZ",lat:39.77,lon:64.42},{name:"Hanoi",country:"VN",lat:21.03,lon:105.85},
{name:"Ho Chi Minh City",country:"VN",lat:10.82,lon:106.63},{name:"Da Nang",country:"VN",lat:16.05,lon:108.22},
{name:"Sanaa",country:"YE",lat:15.37,lon:44.19},{name:"Aden",country:"YE",lat:12.80,lon:45.04},
{name:"Hong Kong",country:"HK",lat:22.32,lon:114.17},{name:"Macau",country:"MO",lat:22.20,lon:113.54},
// Europe
{name:"Tirana",country:"AL",lat:41.33,lon:19.82},{name:"Vienna",country:"AT",lat:48.21,lon:16.37},
{name:"Minsk",country:"BY",lat:53.90,lon:27.57},{name:"Brussels",country:"BE",lat:50.85,lon:4.35},
{name:"Antwerp",country:"BE",lat:51.22,lon:4.40},{name:"Sarajevo",country:"BA",lat:43.86,lon:18.41},
{name:"Sofia",country:"BG",lat:42.70,lon:23.32},{name:"Zagreb",country:"HR",lat:45.81,lon:15.98},
{name:"Nicosia",country:"CY",lat:35.17,lon:33.36},{name:"Prague",country:"CZ",lat:50.08,lon:14.44},
{name:"Copenhagen",country:"DK",lat:55.68,lon:12.57},{name:"Tallinn",country:"EE",lat:59.44,lon:24.75},
{name:"Helsinki",country:"FI",lat:60.17,lon:24.94},{name:"Paris",country:"FR",lat:48.86,lon:2.35},
{name:"Marseille",country:"FR",lat:43.30,lon:5.37},{name:"Lyon",country:"FR",lat:45.76,lon:4.84},
{name:"Nice",country:"FR",lat:43.71,lon:7.26},{name:"Toulouse",country:"FR",lat:43.60,lon:1.44},
{name:"Berlin",country:"DE",lat:52.52,lon:13.41},{name:"Munich",country:"DE",lat:48.14,lon:11.58},
{name:"Frankfurt",country:"DE",lat:50.11,lon:8.68},{name:"Hamburg",country:"DE",lat:53.55,lon:9.99},
{name:"Cologne",country:"DE",lat:50.94,lon:6.96},{name:"Athens",country:"GR",lat:37.98,lon:23.73},
{name:"Thessaloniki",country:"GR",lat:40.64,lon:22.94},{name:"Budapest",country:"HU",lat:47.50,lon:19.04},
{name:"Reykjavik",country:"IS",lat:64.15,lon:-21.94},{name:"Dublin",country:"IE",lat:53.35,lon:-6.26},
{name:"Cork",country:"IE",lat:51.90,lon:-8.47},{name:"Rome",country:"IT",lat:41.90,lon:12.50},
{name:"Milan",country:"IT",lat:45.46,lon:9.19},{name:"Naples",country:"IT",lat:40.85,lon:14.27},
{name:"Turin",country:"IT",lat:45.07,lon:7.69},{name:"Florence",country:"IT",lat:43.77,lon:11.25},
{name:"Venice",country:"IT",lat:45.44,lon:12.32},{name:"Riga",country:"LV",lat:56.95,lon:24.11},
{name:"Vilnius",country:"LT",lat:54.69,lon:25.28},{name:"Luxembourg",country:"LU",lat:49.61,lon:6.13},
{name:"Skopje",country:"MK",lat:41.99,lon:21.43},{name:"Valletta",country:"MT",lat:35.90,lon:14.51},
{name:"Chișinău",country:"MD",lat:47.01,lon:28.86},{name:"Podgorica",country:"ME",lat:42.44,lon:19.26},
{name:"Amsterdam",country:"NL",lat:52.37,lon:4.90},{name:"Rotterdam",country:"NL",lat:51.92,lon:4.48},
{name:"Oslo",country:"NO",lat:59.91,lon:10.75},{name:"Bergen",country:"NO",lat:60.39,lon:5.32},
{name:"Warsaw",country:"PL",lat:52.23,lon:21.01},{name:"Kraków",country:"PL",lat:50.06,lon:19.94},
{name:"Gdańsk",country:"PL",lat:54.35,lon:18.65},{name:"Wrocław",country:"PL",lat:51.11,lon:17.04},
{name:"Lisbon",country:"PT",lat:38.72,lon:-9.14},{name:"Porto",country:"PT",lat:41.15,lon:-8.61},
{name:"Bucharest",country:"RO",lat:44.43,lon:26.10},{name:"Cluj-Napoca",country:"RO",lat:46.77,lon:23.60},
{name:"Moscow",country:"RU",lat:55.76,lon:37.62},{name:"St Petersburg",country:"RU",lat:59.93,lon:30.32},
{name:"Novosibirsk",country:"RU",lat:55.03,lon:82.92},{name:"Yekaterinburg",country:"RU",lat:56.84,lon:60.60},
{name:"Vladivostok",country:"RU",lat:43.12,lon:131.89},{name:"Kazan",country:"RU",lat:55.79,lon:49.11},
{name:"Belgrade",country:"RS",lat:44.79,lon:20.47},{name:"Bratislava",country:"SK",lat:48.15,lon:17.11},
{name:"Ljubljana",country:"SI",lat:46.06,lon:14.51},{name:"Madrid",country:"ES",lat:40.42,lon:-3.70},
{name:"Barcelona",country:"ES",lat:41.39,lon:2.17},{name:"Valencia",country:"ES",lat:39.47,lon:-0.38},
{name:"Seville",country:"ES",lat:37.39,lon:-5.98},{name:"Málaga",country:"ES",lat:36.72,lon:-4.42},
{name:"Stockholm",country:"SE",lat:59.33,lon:18.07},{name:"Gothenburg",country:"SE",lat:57.71,lon:11.97},
{name:"Bern",country:"CH",lat:46.95,lon:7.45},{name:"Zurich",country:"CH",lat:47.38,lon:8.54},
{name:"Geneva",country:"CH",lat:46.20,lon:6.14},{name:"Kyiv",country:"UA",lat:50.45,lon:30.52},
{name:"Odesa",country:"UA",lat:46.48,lon:30.74},{name:"Lviv",country:"UA",lat:49.84,lon:24.03},
{name:"London",country:"GB",lat:51.51,lon:-0.13},{name:"Manchester",country:"GB",lat:53.48,lon:-2.24},
{name:"Birmingham",country:"GB",lat:52.49,lon:-1.90},{name:"Edinburgh",country:"GB",lat:55.95,lon:-3.19},
{name:"Glasgow",country:"GB",lat:55.86,lon:-4.25},{name:"Leeds",country:"GB",lat:53.80,lon:-1.55},
{name:"Bristol",country:"GB",lat:51.45,lon:-2.59},{name:"Cardiff",country:"GB",lat:51.48,lon:-3.18},
{name:"Belfast",country:"GB",lat:54.60,lon:-5.93},
// Oceania
{name:"Canberra",country:"AU",lat:-35.28,lon:149.13},{name:"Sydney",country:"AU",lat:-33.87,lon:151.21},
{name:"Melbourne",country:"AU",lat:-37.81,lon:144.96},{name:"Perth",country:"AU",lat:-31.95,lon:115.86},
{name:"Brisbane",country:"AU",lat:-27.47,lon:153.03},{name:"Adelaide",country:"AU",lat:-34.93,lon:138.60},
{name:"Darwin",country:"AU",lat:-12.46,lon:130.84},{name:"Hobart",country:"AU",lat:-42.88,lon:147.33},
{name:"Gold Coast",country:"AU",lat:-28.02,lon:153.43},{name:"Wellington",country:"NZ",lat:-41.29,lon:174.78},
{name:"Auckland",country:"NZ",lat:-36.85,lon:174.76},{name:"Christchurch",country:"NZ",lat:-43.53,lon:172.64},
{name:"Suva",country:"FJ",lat:-18.14,lon:178.44},{name:"Port Moresby",country:"PG",lat:-9.44,lon:147.18},
{name:"Apia",country:"WS",lat:-13.83,lon:-171.76},{name:"Port Vila",country:"VU",lat:-17.73,lon:168.32},
{name:"Guam",country:"GU",lat:13.44,lon:144.79},{name:"Noumea",country:"NC",lat:-22.28,lon:166.46},
];


// ═══════════════════════════════════════════════════════════════
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;
const wrapL = d => ((d + 180) % 360 + 360) % 360 - 180;

function satLon(idx, t, numSats) {
  const initLon = wrapL(idx * 360 / numSats);
  return wrapL(initLon + toDeg(w_rel * t));
}

function earthCentralAngle(elDeg) {
  const el  = toRad(elDeg);
  const eta = Math.asin((Re / Rs) * Math.cos(el));
  return Math.PI / 2 - el - eta;
}

function slantRange(elDeg) {
  const el = toRad(elDeg);
  const g  = earthCentralAngle(elDeg);
  return Rs * Math.sin(g) / Math.cos(el);
}

function elevAngle(latDeg, lonDeg, satLonDeg) {
  const lat  = toRad(latDeg);
  const dlon = toRad(lonDeg - satLonDeg);
  const cosG = Math.cos(lat) * Math.cos(dlon);
  const ratio= Re / Rs;
  if (cosG <= ratio) return -90;
  const g = Math.acos(Math.min(1, cosG));
  return toDeg(Math.atan2(cosG - ratio, Math.sin(g)));
}

// Returns array of {lon, lat} for a spherical cap contour
function contourPts(satLonDeg, elDeg, n = 180) {
  const g    = earthCentralAngle(elDeg);
  const sinG = Math.sin(g), cosG = Math.cos(g);
  const pts  = [];
  for (let i = 0; i <= n; i++) {
    const b    = (i / n) * 2 * Math.PI;
    const lat  = toDeg(Math.asin(sinG * Math.cos(b)));
    const dlon = toDeg(Math.atan2(Math.sin(b) * sinG, cosG));
    pts.push([wrapL(satLonDeg + dlon), lat]);
  }
  return pts;
}

const contourOpacity = el => 0.20 + ((el - 5) / 55) * 0.70;
const contourWidth   = el => el === 5 ? 2.2 : el % 10 === 0 ? 1.5 : 0.8;

// ═══════════════════════════════════════════════════════════════
// FLIGHT SIMULATION
// ═══════════════════════════════════════════════════════════════
const FLIGHT_SPEED_KMH = 850; // typical cruise speed
const FLIGHT_SPEED_KMS = FLIGHT_SPEED_KMH / 3600; // km per second

// OpenSky proxy (CORS-enabled, OAuth handled server-side)
const OPENSKY_PROXY = "https://opensky.spoormaker.io";
// Common airports (IATA / ICAO / city / lat / lon) for autocomplete in real-flight search
// Subset of the larger airport database — covers major hubs across all regions
const REAL_FLIGHT_AIRPORTS = [
  {icao:"KJFK",iata:"JFK",city:"New York JFK",lat:40.6413,lon:-73.7781},
  {icao:"KEWR",iata:"EWR",city:"Newark Liberty",lat:40.6925,lon:-74.1687},
  {icao:"KLGA",iata:"LGA",city:"New York LaGuardia",lat:40.7769,lon:-73.8740},
  {icao:"KBOS",iata:"BOS",city:"Boston Logan",lat:42.3656,lon:-71.0096},
  {icao:"KIAD",iata:"IAD",city:"Washington Dulles",lat:38.9531,lon:-77.4565},
  {icao:"KDCA",iata:"DCA",city:"Washington Reagan",lat:38.8521,lon:-77.0377},
  {icao:"KATL",iata:"ATL",city:"Atlanta",lat:33.6407,lon:-84.4277},
  {icao:"KMIA",iata:"MIA",city:"Miami",lat:25.7959,lon:-80.2870},
  {icao:"KMCO",iata:"MCO",city:"Orlando",lat:28.4312,lon:-81.3081},
  {icao:"KFLL",iata:"FLL",city:"Fort Lauderdale",lat:26.0742,lon:-80.1506},
  {icao:"KORD",iata:"ORD",city:"Chicago O'Hare",lat:41.9742,lon:-87.9073},
  {icao:"KDFW",iata:"DFW",city:"Dallas/Fort Worth",lat:32.8998,lon:-97.0403},
  {icao:"KIAH",iata:"IAH",city:"Houston Intercontinental",lat:29.9844,lon:-95.3414},
  {icao:"KDEN",iata:"DEN",city:"Denver",lat:39.8561,lon:-104.6737},
  {icao:"KLAX",iata:"LAX",city:"Los Angeles",lat:33.9416,lon:-118.4085},
  {icao:"KSFO",iata:"SFO",city:"San Francisco",lat:37.6213,lon:-122.3790},
  {icao:"KSEA",iata:"SEA",city:"Seattle-Tacoma",lat:47.4502,lon:-122.3088},
  {icao:"KLAS",iata:"LAS",city:"Las Vegas",lat:36.0840,lon:-115.1537},
  {icao:"KPHX",iata:"PHX",city:"Phoenix",lat:33.4373,lon:-112.0078},
  {icao:"KSAN",iata:"SAN",city:"San Diego",lat:32.7338,lon:-117.1933},
  {icao:"CYYZ",iata:"YYZ",city:"Toronto Pearson",lat:43.6777,lon:-79.6248},
  {icao:"CYVR",iata:"YVR",city:"Vancouver",lat:49.1967,lon:-123.1815},
  {icao:"CYUL",iata:"YUL",city:"Montreal",lat:45.4706,lon:-73.7408},
  {icao:"MMMX",iata:"MEX",city:"Mexico City",lat:19.4361,lon:-99.0719},
  {icao:"MMUN",iata:"CUN",city:"Cancun",lat:21.0364,lon:-86.8770},
  {icao:"SBGR",iata:"GRU",city:"Sao Paulo Guarulhos",lat:-23.4356,lon:-46.4731},
  {icao:"SAEZ",iata:"EZE",city:"Buenos Aires Ezeiza",lat:-34.8222,lon:-58.5358},
  {icao:"SCEL",iata:"SCL",city:"Santiago Chile",lat:-33.3928,lon:-70.7858},
  {icao:"SPJC",iata:"LIM",city:"Lima",lat:-12.0219,lon:-77.1143},
  {icao:"EGLL",iata:"LHR",city:"London Heathrow",lat:51.4700,lon:-0.4543},
  {icao:"EGKK",iata:"LGW",city:"London Gatwick",lat:51.1481,lon:-0.1903},
  {icao:"EGLC",iata:"LCY",city:"London City",lat:51.5053,lon:0.0553},
  {icao:"EGCC",iata:"MAN",city:"Manchester",lat:53.3537,lon:-2.2750},
  {icao:"EIDW",iata:"DUB",city:"Dublin",lat:53.4213,lon:-6.2701},
  {icao:"LFPG",iata:"CDG",city:"Paris Charles de Gaulle",lat:49.0097,lon:2.5479},
  {icao:"LFPO",iata:"ORY",city:"Paris Orly",lat:48.7233,lon:2.3794},
  {icao:"EDDF",iata:"FRA",city:"Frankfurt",lat:50.0379,lon:8.5622},
  {icao:"EDDM",iata:"MUC",city:"Munich",lat:48.3537,lon:11.7750},
  {icao:"EDDB",iata:"BER",city:"Berlin Brandenburg",lat:52.3667,lon:13.5033},
  {icao:"EHAM",iata:"AMS",city:"Amsterdam Schiphol",lat:52.3086,lon:4.7639},
  {icao:"EBBR",iata:"BRU",city:"Brussels",lat:50.9014,lon:4.4844},
  {icao:"LSZH",iata:"ZRH",city:"Zurich",lat:47.4647,lon:8.5492},
  {icao:"LSGG",iata:"GVA",city:"Geneva",lat:46.2381,lon:6.1090},
  {icao:"LIRF",iata:"FCO",city:"Rome Fiumicino",lat:41.8003,lon:12.2389},
  {icao:"LIMC",iata:"MXP",city:"Milan Malpensa",lat:45.6306,lon:8.7281},
  {icao:"LEMD",iata:"MAD",city:"Madrid Barajas",lat:40.4719,lon:-3.5626},
  {icao:"LEBL",iata:"BCN",city:"Barcelona",lat:41.2974,lon:2.0833},
  {icao:"LPPT",iata:"LIS",city:"Lisbon",lat:38.7813,lon:-9.1359},
  {icao:"LGAV",iata:"ATH",city:"Athens",lat:37.9364,lon:23.9445},
  {icao:"EKCH",iata:"CPH",city:"Copenhagen",lat:55.6181,lon:12.6561},
  {icao:"ESSA",iata:"ARN",city:"Stockholm Arlanda",lat:59.6519,lon:17.9186},
  {icao:"ENGM",iata:"OSL",city:"Oslo",lat:60.1939,lon:11.1004},
  {icao:"EFHK",iata:"HEL",city:"Helsinki",lat:60.3172,lon:24.9633},
  {icao:"UUEE",iata:"SVO",city:"Moscow Sheremetyevo",lat:55.9728,lon:37.4147},
  {icao:"OMDB",iata:"DXB",city:"Dubai",lat:25.2532,lon:55.3657},
  {icao:"OMAA",iata:"AUH",city:"Abu Dhabi",lat:24.4330,lon:54.6511},
  {icao:"OTHH",iata:"DOH",city:"Doha",lat:25.2731,lon:51.6080},
  {icao:"OEJN",iata:"JED",city:"Jeddah",lat:21.6796,lon:39.1565},
  {icao:"OERK",iata:"RUH",city:"Riyadh",lat:24.9576,lon:46.6988},
  {icao:"LTBA",iata:"IST",city:"Istanbul",lat:41.2753,lon:28.7519},
  {icao:"LLBG",iata:"TLV",city:"Tel Aviv",lat:32.0114,lon:34.8867},
  {icao:"HECA",iata:"CAI",city:"Cairo",lat:30.1219,lon:31.4056},
  {icao:"FAOR",iata:"JNB",city:"Johannesburg",lat:-26.1392,lon:28.2460},
  {icao:"FACT",iata:"CPT",city:"Cape Town",lat:-33.9648,lon:18.6017},
  {icao:"HKJK",iata:"NBO",city:"Nairobi",lat:-1.3192,lon:36.9278},
  {icao:"VIDP",iata:"DEL",city:"Delhi",lat:28.5562,lon:77.1000},
  {icao:"VABB",iata:"BOM",city:"Mumbai",lat:19.0887,lon:72.8679},
  {icao:"VOMM",iata:"MAA",city:"Chennai",lat:12.9941,lon:80.1709},
  {icao:"VHHH",iata:"HKG",city:"Hong Kong",lat:22.3080,lon:113.9185},
  {icao:"ZBAA",iata:"PEK",city:"Beijing Capital",lat:40.0801,lon:116.5846},
  {icao:"ZSPD",iata:"PVG",city:"Shanghai Pudong",lat:31.1443,lon:121.8083},
  {icao:"RJTT",iata:"HND",city:"Tokyo Haneda",lat:35.5494,lon:139.7798},
  {icao:"RJAA",iata:"NRT",city:"Tokyo Narita",lat:35.7720,lon:140.3929},
  {icao:"RKSI",iata:"ICN",city:"Seoul Incheon",lat:37.4602,lon:126.4407},
  {icao:"WSSS",iata:"SIN",city:"Singapore Changi",lat:1.3644,lon:103.9915},
  {icao:"WMKK",iata:"KUL",city:"Kuala Lumpur",lat:2.7456,lon:101.7099},
  {icao:"VTBS",iata:"BKK",city:"Bangkok Suvarnabhumi",lat:13.6900,lon:100.7501},
  {icao:"WIII",iata:"CGK",city:"Jakarta Soekarno-Hatta",lat:-6.1256,lon:106.6559},
  {icao:"RPLL",iata:"MNL",city:"Manila",lat:14.5086,lon:121.0194},
  {icao:"YSSY",iata:"SYD",city:"Sydney",lat:-33.9399,lon:151.1753},
  {icao:"YMML",iata:"MEL",city:"Melbourne",lat:-37.6690,lon:144.8410},
  {icao:"YBBN",iata:"BNE",city:"Brisbane",lat:-27.3942,lon:153.1218},
  {icao:"YPPH",iata:"PER",city:"Perth",lat:-31.9402,lon:115.9669},
  {icao:"NZAA",iata:"AKL",city:"Auckland",lat:-37.0082,lon:174.7917},
];

// Airline ICAO callsign prefix → operator name. Used to display friendly
// names in the flight results list, e.g. "BAW286" → "British Airways · 286"
const AIRLINE_NAMES = {
  AAL:"American",ACA:"Air Canada",AFL:"Aeroflot",AFR:"Air France",AMX:"AeroMexico",
  ANA:"All Nippon",ANE:"Air Nostrum",ASA:"Alaska",ASH:"Mesa",AUA:"Austrian",
  AVA:"Avianca",AZA:"ITA Airways",BAW:"British Airways",BLA:"Blue Air",BOX:"Aerologic",
  BTI:"airBaltic",CAL:"China Airlines",CCA:"Air China",CES:"China Eastern",CFG:"Condor",
  CKS:"Kalitta",CLX:"Cargolux",CPA:"Cathay Pacific",CSC:"Sichuan Airlines",CSN:"China Southern",
  CSZ:"Shenzhen",DAL:"Delta",DLH:"Lufthansa",EDV:"Endeavor",EIN:"Aer Lingus",
  EJA:"NetJets",ELY:"El Al",ETD:"Etihad",ETH:"Ethiopian",EUK:"easyJet UK",
  EVA:"EVA Air",EZS:"easyJet Switzerland",EZY:"easyJet",FDX:"FedEx",FFT:"Frontier",
  FIN:"Finnair",GEC:"Lufthansa Cargo",GJS:"GoJet",GLO:"Gol",GTI:"Atlas Air",
  HAL:"Hawaiian",IBE:"Iberia",ICE:"Icelandair",ITY:"ITA Airways",JAL:"Japan Airlines",
  JBU:"JetBlue",JIA:"PSA Airlines",JZA:"Jazz",KAL:"Korean Air",KLM:"KLM",
  LAN:"LATAM Chile",LOT:"LOT",LXJ:"Flexjet",MEA:"Middle East Air",MPH:"Martinair",
  MSR:"EgyptAir",NJE:"NetJets Europe",NKS:"Spirit",NOS:"Neos",NOZ:"Norse Atlantic",
  PGT:"Pegasus",QFA:"Qantas",QTR:"Qatar Airways",RAM:"Royal Air Maroc",ROT:"TAROM",
  RPA:"Republic",RYR:"Ryanair",SAS:"Scandinavian",SAA:"South African",SIA:"Singapore",
  SKW:"SkyWest",SQC:"Singapore Cargo",SVA:"Saudia",SWA:"Southwest",SWR:"Swiss",
  SYR:"Syrianair",TAM:"LATAM Brasil",TAP:"TAP Portugal",THA:"Thai Airways",THY:"Turkish",
  TRA:"Transavia",TVF:"Transavia France",UAE:"Emirates",UAL:"United",UBT:"Tui Belgium",
  UCA:"Commutair",UPS:"UPS",VIR:"Virgin Atlantic",VOI:"Volaris",VRD:"Virgin America",
  VLG:"Vueling",WJA:"WestJet",WUP:"Western Global",XAX:"AirAsia X",ZSAAK:"South African",
};

// Friendly name for any airport ICAO code (just for displaying in result list).
// Bigger than REAL_FLIGHT_AIRPORTS — covers many destinations users won't search FROM
// but want to recognize as a destination.
const DEST_AIRPORT_NAMES = {
  // North America
  KJFK:"New York JFK",KEWR:"Newark",KLGA:"New York LGA",KBOS:"Boston",KIAD:"Washington Dulles",
  KDCA:"Washington Reagan",KATL:"Atlanta",KMIA:"Miami",KMCO:"Orlando",KFLL:"Fort Lauderdale",
  KORD:"Chicago O'Hare",KMDW:"Chicago Midway",KDFW:"Dallas FW",KDAL:"Dallas Love",KIAH:"Houston IAH",
  KHOU:"Houston Hobby",KDEN:"Denver",KLAX:"Los Angeles",KSFO:"San Francisco",KSEA:"Seattle",
  KLAS:"Las Vegas",KPHX:"Phoenix",KSAN:"San Diego",KSAT:"San Antonio",KAUS:"Austin",
  KSLC:"Salt Lake City",KMSP:"Minneapolis",KDTW:"Detroit",KCLT:"Charlotte",KCLE:"Cleveland",
  KIND:"Indianapolis",KPHL:"Philadelphia",KPIT:"Pittsburgh",KBNA:"Nashville",KMEM:"Memphis",
  KMSY:"New Orleans",KTPA:"Tampa",KRDU:"Raleigh-Durham",KCVG:"Cincinnati",KSTL:"St Louis",
  KMCI:"Kansas City",KMKE:"Milwaukee",KOMA:"Omaha",KBUF:"Buffalo",KROC:"Rochester",
  KCHS:"Charleston",KSAV:"Savannah",KJAX:"Jacksonville",KPBI:"West Palm Beach",KRSW:"Fort Myers",
  KABQ:"Albuquerque",KELP:"El Paso",KTUS:"Tucson",KOAK:"Oakland",KSJC:"San Jose",
  KSMF:"Sacramento",KSNA:"Orange County",KPDX:"Portland",KBOI:"Boise",KGEG:"Spokane",
  KANC:"Anchorage",KFAI:"Fairbanks",PHNL:"Honolulu",PHKO:"Kona",PHTO:"Hilo",
  KMDT:"Harrisburg",KLCK:"Columbus Rickenbacker",
  CYYZ:"Toronto",CYUL:"Montreal",CYVR:"Vancouver",CYYC:"Calgary",CYEG:"Edmonton",
  CYOW:"Ottawa",CYHZ:"Halifax",CYWG:"Winnipeg",CYQB:"Quebec City",
  MMMX:"Mexico City",MMUN:"Cancun",MMGL:"Guadalajara",MMMY:"Monterrey",MMSD:"Los Cabos",
  MMPR:"Puerto Vallarta",MMTJ:"Tijuana",
  MGGT:"Guatemala City",MROC:"San Jose CR",MPTO:"Panama City",MSLP:"San Salvador",
  MNMG:"Managua",MHLM:"San Pedro Sula",MHTG:"Tegucigalpa",
  TJSJ:"San Juan",TJBQ:"Aguadilla",TFFF:"Martinique",TFFR:"Guadeloupe",TBPB:"Barbados",
  TKPK:"St Kitts",TXKF:"Bermuda",MKJP:"Kingston",MKJS:"Montego Bay",MDPC:"Punta Cana",
  MDSD:"Santo Domingo",MUHA:"Havana",MWCR:"Grand Cayman",MYNN:"Nassau",
  // South America
  SBGR:"Sao Paulo Guarulhos",SBGL:"Rio Galeao",SBSP:"Sao Paulo Congonhas",SBBR:"Brasilia",
  SBKP:"Campinas",SBSV:"Salvador",SBRF:"Recife",SBFZ:"Fortaleza",SBPA:"Porto Alegre",
  SAEZ:"Buenos Aires Ezeiza",SAAR:"Rosario",SCEL:"Santiago",SPJC:"Lima",SPZO:"Cusco",
  SKBO:"Bogota",SKCG:"Cartagena",SVMI:"Caracas",SUMU:"Montevideo",SEQM:"Quito",SEGU:"Guayaquil",
  // Europe
  EGLL:"London Heathrow",EGKK:"London Gatwick",EGLC:"London City",EGSS:"London Stansted",
  EGGW:"London Luton",EGCC:"Manchester",EGBB:"Birmingham",EGGD:"Bristol",EGGP:"Liverpool",
  EGNX:"East Midlands",EGNT:"Newcastle",EGPH:"Edinburgh",EGPF:"Glasgow",EGAA:"Belfast",
  EIDW:"Dublin",EICK:"Cork",EINN:"Shannon",
  LFPG:"Paris CDG",LFPO:"Paris Orly",LFLL:"Lyon",LFMN:"Nice",LFML:"Marseille",
  LFBO:"Toulouse",LFBD:"Bordeaux",LFRS:"Nantes",LFST:"Strasbourg",
  EDDF:"Frankfurt",EDDM:"Munich",EDDB:"Berlin",EDDL:"Dusseldorf",EDDH:"Hamburg",
  EDDK:"Cologne",EDDS:"Stuttgart",EDDN:"Nuremberg",EDDV:"Hannover",EDDT:"Berlin Tegel",
  EHAM:"Amsterdam",EHRD:"Rotterdam",EHEH:"Eindhoven",
  EBBR:"Brussels",EBLG:"Liege",EBCI:"Charleroi",ELLX:"Luxembourg",
  LSZH:"Zurich",LSGG:"Geneva",LSZB:"Bern",LSZA:"Lugano",
  LOWW:"Vienna",LOWS:"Salzburg",LOWI:"Innsbruck",
  LIRF:"Rome Fiumicino",LIRA:"Rome Ciampino",LIMC:"Milan Malpensa",LIML:"Milan Linate",
  LIPZ:"Venice Marco Polo",LIPE:"Bologna",LIRN:"Naples",LICC:"Catania",LICJ:"Palermo",
  LEMD:"Madrid",LEBL:"Barcelona",LEPA:"Palma de Mallorca",LEMG:"Malaga",LEAL:"Alicante",
  LEVC:"Valencia",LEZL:"Seville",LEBB:"Bilbao",GCLP:"Las Palmas",GCXO:"Tenerife North",
  GCTS:"Tenerife South",GCFV:"Fuerteventura",
  LPPT:"Lisbon",LPPR:"Porto",LPMA:"Madeira",LPFR:"Faro",LPLA:"Azores",
  LGAV:"Athens",LGTS:"Thessaloniki",LGIR:"Heraklion",LGRP:"Rhodes",
  LMML:"Malta",LCLK:"Larnaca",LCPH:"Paphos",
  EKCH:"Copenhagen",EKBI:"Billund",ESSA:"Stockholm Arlanda",ESGG:"Gothenburg",
  ENGM:"Oslo",ENBR:"Bergen",ENVA:"Trondheim",EFHK:"Helsinki",BIKF:"Reykjavik Keflavik",
  EPWA:"Warsaw",EPKK:"Krakow",EPGD:"Gdansk",
  LKPR:"Prague",LZIB:"Bratislava",LHBP:"Budapest",
  LROP:"Bucharest",LBSF:"Sofia",LWSK:"Skopje",LYBE:"Belgrade",LDZA:"Zagreb",LJLJ:"Ljubljana",
  LTBA:"Istanbul Ataturk",LTFM:"Istanbul New",LTAC:"Ankara",LTAI:"Antalya",LTBJ:"Izmir",
  UUEE:"Moscow Sheremetyevo",UUDD:"Moscow Domodedovo",UUWW:"Moscow Vnukovo",ULLI:"St Petersburg",
  UKBB:"Kyiv Boryspil",
  // Middle East / Africa
  OMDB:"Dubai",OMDW:"Dubai World Central",OMAA:"Abu Dhabi",OMSJ:"Sharjah",OMAD:"Al Bateen",
  OTHH:"Doha",OBBI:"Bahrain",OEJN:"Jeddah",OERK:"Riyadh",OEDF:"Dammam",
  OEMA:"Medina",OOMS:"Muscat",OKBK:"Kuwait",
  LLBG:"Tel Aviv",OJAI:"Amman",OLBA:"Beirut",OSDI:"Damascus",
  HECA:"Cairo",HEGN:"Hurghada",HESH:"Sharm el-Sheikh",HKJK:"Nairobi",HKMO:"Mombasa",
  HUEN:"Entebbe",HAAB:"Addis Ababa",HRYR:"Kigali",HTDA:"Dar es Salaam",HTKJ:"Kilimanjaro",
  HSSS:"Khartoum",DNMM:"Lagos",DNAA:"Abuja",DGAA:"Accra",DIAP:"Abidjan",GOOY:"Dakar",
  GMMN:"Casablanca",GMME:"Rabat",DAAG:"Algiers",DTTA:"Tunis",HLLT:"Tripoli",
  FAOR:"Johannesburg",FACT:"Cape Town",FALE:"Durban",FAPE:"Port Elizabeth",FBSK:"Gaborone",
  FBKE:"Kasane",FVHA:"Harare",FVRG:"Victoria Falls",FYWH:"Windhoek",FMMI:"Antananarivo",
  FMEE:"Reunion",FIMP:"Mauritius",
  // Asia
  VIDP:"Delhi",VABB:"Mumbai",VOMM:"Chennai",VOBL:"Bangalore",VOHS:"Hyderabad",
  VOCI:"Kochi",VOCB:"Coimbatore",VOTV:"Trivandrum",VECC:"Kolkata",VAAH:"Ahmedabad",
  VOGO:"Goa",VOMM:"Madras",VOTR:"Tiruchirappalli",VEBN:"Varanasi",VEPT:"Patna",
  VAJJ:"Pune",VANP:"Nagpur",
  VHHH:"Hong Kong",VMMC:"Macau",ZBAA:"Beijing Capital",ZBAD:"Beijing Daxing",ZSPD:"Shanghai Pudong",
  ZSSS:"Shanghai Hongqiao",ZGGG:"Guangzhou",ZGSZ:"Shenzhen",ZUUU:"Chengdu",ZSHC:"Hangzhou",
  ZGHA:"Changsha",ZSAM:"Xiamen",ZJHK:"Haikou",ZBTJ:"Tianjin",ZLXY:"Xian",ZWWW:"Urumqi",
  RJTT:"Tokyo Haneda",RJAA:"Tokyo Narita",RJBB:"Osaka Kansai",RJOO:"Osaka Itami",RJOA:"Hiroshima",
  RJCC:"Sapporo",RJFF:"Fukuoka",RJOH:"Hofu",RJSN:"Niigata",
  RKSI:"Seoul Incheon",RKSS:"Seoul Gimpo",RKPC:"Jeju",RKPK:"Busan",
  RPLL:"Manila",RPMD:"Davao",RPVM:"Mactan-Cebu",
  WSSS:"Singapore",WMKK:"Kuala Lumpur",WMSA:"Subang",WBSB:"Bandar Seri Begawan",
  VTBS:"Bangkok Suvarnabhumi",VTBD:"Bangkok Don Mueang",VTSP:"Phuket",VTCC:"Chiang Mai",
  VVNB:"Hanoi",VVTS:"Ho Chi Minh City",VDPP:"Phnom Penh",VLVT:"Vientiane",
  WIII:"Jakarta",WIDD:"Batam",WADD:"Denpasar Bali",WAJJ:"Jayapura",WALL:"Balikpapan",WAMM:"Manado",
  VNKT:"Kathmandu",VTSE:"Hat Yai",VYYY:"Yangon",VCBI:"Colombo",VRMM:"Male",
  // Pacific / Australia
  YSSY:"Sydney",YMML:"Melbourne",YBBN:"Brisbane",YPPH:"Perth",YPAD:"Adelaide",
  YBCG:"Gold Coast",YBCS:"Cairns",YPDN:"Darwin",YBHM:"Hamilton Island",YMHB:"Hobart",
  NZAA:"Auckland",NZWN:"Wellington",NZCH:"Christchurch",NZQN:"Queenstown",
  NFFN:"Nadi Fiji",NSFA:"Apia Samoa",NTAA:"Papeete",NFTF:"Tonga",AYPY:"Port Moresby",
  // Cargo / niche
  KSDF:"Louisville UPS Hub",KCVG:"Cincinnati DHL",
};

// Pretty-print a callsign by splitting "ABC1234 " → "Airline Name · 1234"
function prettyCallsign(callsign) {
  if (!callsign) return "—";
  const c = callsign.trim();
  if (c.length < 3) return c;
  const prefix = c.substring(0, 3).toUpperCase();
  const suffix = c.substring(3).trim();
  const airline = AIRLINE_NAMES[prefix];
  if (!airline) return c;
  return suffix ? `${airline} ${suffix}` : airline;
}

// Friendly destination name from any ICAO airport code; falls back to the code itself
function prettyAirport(icao) {
  if (!icao) return "—";
  const fromHubs = REAL_FLIGHT_AIRPORTS.find(a => a.icao === icao);
  if (fromHubs) return fromHubs.city;
  return DEST_AIRPORT_NAMES[icao] || icao;
}

// localStorage keys for recent searches/flights
const LS_RECENT_AIRPORTS = "mpower_recent_airports";
const LS_RECENT_FLIGHTS  = "mpower_recent_flights";

// Safe localStorage helpers
function lsGet(key, fallback) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Great circle distance in km between two lat/lon points
function gcDist(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * Re * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Great circle interpolation: returns {lat, lon} at fraction f (0..1) along route
function gcInterp(lat1, lon1, lat2, lon2, f) {
  const la1=toRad(lat1),lo1=toRad(lon1),la2=toRad(lat2),lo2=toRad(lon2);
  const d = 2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
  if (d < 1e-10) return {lat:lat1,lon:lon1};
  const A = Math.sin((1-f)*d)/Math.sin(d);
  const B = Math.sin(f*d)/Math.sin(d);
  const x = A*Math.cos(la1)*Math.cos(lo1) + B*Math.cos(la2)*Math.cos(lo2);
  const y = A*Math.cos(la1)*Math.sin(lo1) + B*Math.cos(la2)*Math.sin(lo2);
  const z = A*Math.sin(la1) + B*Math.sin(la2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x*x+y*y))), lon: toDeg(Math.atan2(y, x)) };
}

// Generate great circle route points for rendering
function gcRoute(lat1, lon1, lat2, lon2, n=100) {
  const pts = [];
  for (let i=0; i<=n; i++) {
    const p = gcInterp(lat1, lon1, lat2, lon2, i/n);
    pts.push([p.lon, p.lat]);
  }
  return pts;
}

// Compute bearing from point 1 to point 2 (degrees, 0=N, 90=E)
function gcBearing(lat1, lon1, lat2, lon2) {
  const la1=toRad(lat1),la2=toRad(lat2),dLon=toRad(lon2-lon1);
  const y=Math.sin(dLon)*Math.cos(la2);
  const x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLon);
  return (toDeg(Math.atan2(y,x))+360)%360;
}

// Ka2517 antenna scan angle — angle between boresight (local zenith) and line of sight to satellite.
// Since boresight = zenith and elevation is measured from the horizon, scan = 90° − EL exactly.
// (The nadir angle AT the satellite is a different quantity: arcsin((Re/Rs)·cos(EL)).)
function satScanAngle(elDeg) {
  return 90 - elDeg;
}

// Azimuth from a ground point to the sub-satellite point (equator at satLonDeg)
function azimToSubSat(fromLat, fromLon, satLonDeg) {
  const la1=toRad(fromLat), lo1=toRad(fromLon);
  const la2=0,             lo2=toRad(satLonDeg);
  const dLon=lo2-lo1;
  const y=Math.sin(dLon)*Math.cos(la2);
  const x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLon);
  return (toDeg(Math.atan2(y,x))+360)%360;
}

function satSkewAngle(acLat, acLon, satLonDeg, headingDeg) {
  const az = azimToSubSat(acLat, acLon, satLonDeg);
  let diff = (az - headingDeg + 360) % 360;
  if (diff > 180) diff -= 360;
  if (diff >  90) diff -= 180;
  if (diff < -90) diff += 180;
  return diff;
}

// ═══════════════════════════════════════════════════════════════
// TAB 7 — GATEWAY WEATHER RISK  (La Réunion PoC)
// ═══════════════════════════════════════════════════════════════
const GW_REU = { id:"GW-REU", name:"La Réunion", country:"FR",
  lat:-21.11444, lon:55.53250, operator:"TBD", azure:false };

const CELL_D = 0.05; // ~5-7 km per step
const WEATHER_CELLS = (() => {
  const cells = [];
  for (const dlat of [-CELL_D, 0, CELL_D])
    for (const dlon of [-CELL_D, 0, CELL_D])
      cells.push({ id:`C(${dlat>=0?"+":""}${dlat},${dlon>=0?"+":""}${dlon})`,
        lat: GW_REU.lat+dlat, lon: GW_REU.lon+dlon, dlat, dlon });
  return cells;
})();

// 20 LOS ground-projection points from gateway through troposphere toward satellite.
// Samples are placed along the bearing at distances 0→maxKm (capped at 50 km).
function losGroundPoints(gwLat, gwLon, satLon, elDeg, n=20) {
  const az   = azimToSubSat(gwLat, gwLon, satLon);
  const elR  = toRad(Math.max(elDeg, 5));
  const maxKm = Math.min(12 / Math.tan(elR), 50); // troposphere crossing distance
  const R = 6371;
  return Array.from({length:n}, (_,i) => {
    const d  = (i/(n-1)) * maxKm;
    const dr = d / R;
    const la1 = toRad(gwLat), az1 = toRad(az);
    const lat2 = Math.asin(Math.sin(la1)*Math.cos(dr) + Math.cos(la1)*Math.sin(dr)*Math.cos(az1));
    const lon2 = toRad(gwLon) + Math.atan2(Math.sin(az1)*Math.sin(dr)*Math.cos(la1),
                                            Math.cos(dr) - Math.sin(la1)*Math.sin(lat2));
    return { lat: toDeg(lat2), lon: toDeg(lon2) };
  });
}

// Map a lat/lon to the nearest cell in the 3×3 grid.
function nearestCell(lat, lon) {
  let best = WEATHER_CELLS[0], bestD = Infinity;
  for (const c of WEATHER_CELLS) {
    const d = (lat-c.lat)**2 + (lon-c.lon)**2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ─── GatewayWeatherTab component ───────────────────────────────
// ═══════════════════════════════════════════════════════════════
// BEAM PROJECTION TAB
// ═══════════════════════════════════════════════════════════════

// Compute the beam footprint ellipse as a GeoJSON polygon on the Earth surface.
// The beam is pointed from the satellite at the terminal (termLat, termLon).
// ── Geodesic helpers for beam projection ──────────────────────
// Slant range from a GROUND terminal (altitude = 0) to the satellite.
function groundSlantRange(elDeg) {
  const elR = toRad(elDeg);
  return Math.sqrt(Rs * Rs - Re * Re * Math.cos(elR) ** 2) - Re * Math.sin(elR);
}

// Destination point on the spherical Earth given start (lat/lon), bearing (deg,
// from N clockwise), and surface distance (km). Uses the Haversine inverse formula.
function geodesicDestPt(lat0, lon0, bearingDeg, distKm) {
  const d   = distKm / Re;            // angular distance (radians)
  const brg = toRad(bearingDeg);
  const la1 = toRad(lat0), lo1 = toRad(lon0);
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(brg)
  );
  const lo2 = lo1 + Math.atan2(
    Math.sin(brg) * Math.sin(d) * Math.cos(la1),
    Math.cos(d) - Math.sin(la1) * Math.sin(la2)
  );
  return [wrapL(toDeg(lo2)), toDeg(la2)]; // [lon, lat] for GeoJSON
}

// Beam footprint polygon for a satellite spot beam directed at a ground terminal.
// Physics:
//   The satellite beam has half-angle alpha (deg). At elevation EL from the terminal:
//   • Cross-track semi-axis  b = d × tan(α)          (perpendicular to elevation plane)
//   • Along-track semi-axis  a = b / sin(EL)          (in the elevation plane, projected on Earth)
//   The major axis is oriented along the azimuth from the terminal to the satellite's
//   sub-satellite point (the equatorial ground track point directly below the satellite).
//   Polygon vertices are computed using proper geodesic projection so large low-elevation
//   footprints (up to ~2000 km major axis) are placed accurately.
function beamFootprintPolygon(termLat, termLon, satLonDeg, elDeg, beamHalfDeg, nPts = 90) {
  if (elDeg < 1) return null;
  const d    = groundSlantRange(elDeg);
  const el   = toRad(Math.max(elDeg, 1));
  const tanA = Math.tan(toRad(Math.min(beamHalfDeg, 20)));
  const az   = azimToSubSat(termLat, termLon, satLonDeg); // bearing to sub-satellite point, degrees
  const azR  = toRad(az);

  const b_km = d * tanA;            // cross-track semi-axis (km)
  const a_km = b_km / Math.sin(el); // along-track semi-axis (km)

  const pts = [];
  for (let i = 0; i <= nPts; i++) {
    const theta  = (i / nPts) * 2 * Math.PI;
    // Local frame: x = along azimuth (major axis), y = cross-track (minor axis)
    const x_km = a_km * Math.cos(theta);
    const y_km = b_km * Math.sin(theta);
    // Rotate local frame into geographic N-E frame
    const dNorth = x_km * Math.cos(azR) - y_km * Math.sin(azR);
    const dEast  = x_km * Math.sin(azR) + y_km * Math.cos(azR);
    // Convert (dNorth, dEast) km to bearing + distance, then geodesic destination
    const distKm = Math.sqrt(dNorth * dNorth + dEast * dEast);
    if (distKm < 0.01) { pts.push([termLon, termLat]); continue; }
    const bear = (toDeg(Math.atan2(dEast, dNorth)) + 360) % 360;
    pts.push(geodesicDestPt(termLat, termLon, bear, distKm));
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] } };
}

function BeamProjectionTab({ simTime, numSats, satNames, gpLat, gpLon, flightActive, flightInfo, activeGateways, gwMinEl, ka2517MinEl, onRestartFlight }) {
  const canvasRef  = useRef(null);
  const worldRef   = useRef(null);
  const dragRef    = useRef(null);
  const [ready,    setReady]    = useState(false);
  const [err,      setErr]      = useState(null);
  const [termLat,  setTermLat]  = useState(gpLat);
  const [termLon,  setTermLon]  = useState(gpLon);
  const [termAlt,  setTermAlt]  = useState(0.0);
  const [beamHalf, setBeamHalf] = useState(0.8);
  const [minElev,  setMinElev]  = useState(10);
  const [numSatMin,setNumSatMin]= useState(1);
  const [maxSep,   setMaxSep]   = useState(60);
  const [handover, setHandover] = useState(2);
  const [isGateway,    setIsGateway]    = useState(false);
  const [showPassRegion,setShowPassRegion]=useState(true);
  const [showDualIllum, setShowDualIllum] =useState(false);
  const [limitElev,    setLimitElev]    = useState(true);
  const [limitElevVal, setLimitElevVal] = useState(10);
  const [projection,   setProjection]   = useState("equirectangular");
  const [selSat,       setSelSat]       = useState(-1);
  const [fixedBeams,   setFixedBeams]   = useState([]);
  const [mapZoom,      setMapZoom]      = useState(1);
  const [mapCenter,    setMapCenter]    = useState([0, 0]);
  const [kmlOutput,    setKmlOutput]    = useState(null);  // KML text shown in-UI

  // Track-flight mode: when active, terminal lat/lon follows the analysis point
  // (which itself follows the aircraft when a flight is in progress).
  // Defaults ON when a flight is active; flips OFF if user manually edits term values.
  const [trackFlight, setTrackFlight] = useState(true);
  // Auto-enable trackFlight when a new flight starts
  const prevFlightActive = useRef(flightActive);
  useEffect(() => {
    if (flightActive && !prevFlightActive.current) setTrackFlight(true);
    prevFlightActive.current = flightActive;
  }, [flightActive]);
  // Sync term lat/lon to analysis point when tracking
  useEffect(() => {
    if (trackFlight && flightActive) {
      setTermLat(+gpLat.toFixed(3));
      setTermLon(+gpLon.toFixed(3));
    } else if (!flightActive) {
      // No flight: sync once on mount/gpLat-change as before
      setTermLat(gpLat); setTermLon(gpLon);
    }
  }, [gpLat, gpLon, trackFlight, flightActive]);

  useEffect(() => {
    let cancelled = false;
    function loadScript(src) {
      return new Promise((res, rej) => {
        if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    (async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js");
        const wd = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json());
        if (!cancelled) { worldRef.current = wd; setReady(true); }
      } catch(e) { if (!cancelled) setErr("Map load failed: " + e.message); }
    })();
    return () => { cancelled = true; };
  }, []);

  const inViewSats = useMemo(() => {
    const vis = [];
    for (let s = 0; s < numSats; s++) {
      const sl = satLon(s, simTime, numSats);
      const el = elevAngle(termLat, termLon, sl);
      if (el >= (limitElev ? limitElevVal : 5)) vis.push({
        idx: s, name: satNames[s], el: +el.toFixed(1),
        satLon: sl, az: +azimToSubSat(termLat, termLon, sl).toFixed(1)
      });
    }
    return vis.sort((a, b) => b.el - a.el);
  }, [simTime, numSats, satNames, termLat, termLon, limitElev, limitElevVal]);

  // ── Active link resolution: pick the satellite + gateway that close the circuit
  // using the same gateway-aware logic as the rest of the simulator.
  // Returns { sat, gw, satEl, gwEl, reason, fallback }.
  const activeLink = useMemo(() => {
    const gws = activeGateways || [];
    const ka2517Min = ka2517MinEl ?? 20;
    const gwMin     = gwMinEl ?? 10;
    // Build all sats sorted by terminal EL
    const allSats = [];
    for (let s = 0; s < numSats; s++) {
      const sl = satLon(s, simTime, numSats);
      const el = elevAngle(termLat, termLon, sl);
      allSats.push({ idx: s, name: satNames[s], el: +el.toFixed(1), satLon: sl });
    }
    allSats.sort((a, b) => b.el - a.el);
    if (allSats.length === 0) return null;
    const bestTermEl = allSats[0].el;
    // Tier 1: any sat above gwMinEl?
    if (bestTermEl < gwMin) {
      return { sat: null, gw: null, reason: `No satellite above ${gwMin}deg from terminal` };
    }
    // For each sat, find best gateway
    const fullyViable = [];
    for (const s of allSats) {
      if (s.el < ka2517Min) break;
      let bestGw = null, bestGwEl = -90;
      for (const gw of gws) {
        const gwEl = elevAngle(gw.lat, gw.lon, s.satLon);
        if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGw = gw; }
      }
      if (bestGwEl >= gwMin && bestGw) {
        fullyViable.push({ ...s, bestGw, bestGwEl: +bestGwEl.toFixed(1) });
      }
    }
    if (fullyViable.length === 0) {
      const termOk = bestTermEl >= ka2517Min;
      if (!termOk) {
        return { sat: allSats[0], gw: null, satEl: bestTermEl,
                 reason: `Best sat ${allSats[0].name} below Ka2517 floor (${bestTermEl.toFixed(1)}deg < ${ka2517Min}deg)` };
      }
      return { sat: allSats[0], gw: null, satEl: bestTermEl,
               reason: `No gateway sees ${allSats[0].name} at >=${gwMin}deg` };
    }
    // Pick the highest-EL sat that's fully viable
    const sel = fullyViable[0];
    // Reason: was this the highest-terminal-EL sat overall?
    const isHighestOverall = sel.idx === allSats[0].idx;
    let reason;
    if (isHighestOverall) {
      reason = `Highest terminal EL (${sel.el}deg) and gateway ${sel.bestGw.id} sees it at ${sel.bestGwEl}deg`;
    } else {
      // The terminal-best sat had no gateway; we picked a lower one with gateway coverage
      const skipped = allSats[0];
      reason = `Best terminal sat ${skipped.name} (${skipped.el}deg) has no gateway in view; using ${sel.name} (${sel.el}deg) which gateway ${sel.bestGw.id} sees at ${sel.bestGwEl}deg`;
    }
    return { sat: sel, gw: sel.bestGw, satEl: sel.el, gwEl: sel.bestGwEl, reason, fallback: !isHighestOverall };
  }, [simTime, numSats, satNames, termLat, termLon, activeGateways, gwMinEl, ka2517MinEl]);

  const targetSats = selSat === -1 ? inViewSats : inViewSats.filter(s => s.idx === selSat);

  const elThresh = limitElev ? limitElevVal : 5;

  function getPassWindow(satIdx) {
    let lo = simTime, hi = simTime;
    for (let dt = 60; dt < 4 * 3600; dt += 60) {
      if (elevAngle(termLat, termLon, satLon(satIdx, simTime - dt, numSats)) < elThresh) break;
      lo = simTime - dt;
    }
    for (let dt = 60; dt < 4 * 3600; dt += 60) {
      if (elevAngle(termLat, termLon, satLon(satIdx, simTime + dt, numSats)) < elThresh) break;
      hi = simTime + dt;
    }
    return { lo, hi };
  }

  function exportKML() {
    const B = String.fromCharCode(60), E = String.fromCharCode(62);
    const o = t => B+t+E, c = t => B+"/"+t+E;
    const rows = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      o('kml xmlns="http://www.opengis.net/kml/2.2"'),
      o('Document'),
      o('name')+'mPOWER Beam '+new Date().toISOString().slice(0,19)+c('name'),
      o('Placemark'),
      o('name')+'Terminal '+termLat.toFixed(4)+' '+termLon.toFixed(4)+c('name'),
      o('Point')+o('coordinates')+termLon+','+termLat+',0'+c('coordinates')+c('Point'),
      c('Placemark'),
    ];
    for (const sat of targetSats) {
      const poly = beamFootprintPolygon(termLat, termLon, sat.satLon, sat.el, beamHalf);
      if (!poly) continue;
      const coords = poly.geometry.coordinates[0].map(function(p){ return p[0]+','+p[1]+',0'; }).join(' ');
      rows.push(o('Placemark'));
      rows.push(o('name')+sat.name+' Beam EL '+sat.el+c('name'));
      rows.push(o('Polygon')+o('outerBoundaryIs')+o('LinearRing'));
      rows.push(o('coordinates')+coords+c('coordinates'));
      rows.push(c('LinearRing')+c('outerBoundaryIs')+c('Polygon'));
      rows.push(c('Placemark'));
    }
    rows.push(c('Document')+c('kml'));
    setKmlOutput(rows.join('\n'));
  }

  function copyImage() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(function(blob) {
      if (!blob) return;
      try { navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); }
      catch(e) { console.warn('Clipboard not supported'); }
    });
  }

  function fixBeam() {
    if (targetSats.length === 0) return;
    const sat = targetSats[0];
    setFixedBeams(function(prev) { return [...prev, { termLat, termLon, satLon: sat.satLon, el: sat.el, satName: sat.name }]; });
  }

  // Named zoom/pan handlers to avoid complex inline lambdas in JSX
  function handleWheel(e) {
    if (projection !== "equirectangular") return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 1/1.2;
    setMapZoom(function(z) { return Math.min(40, Math.max(1, z * factor)); });
  }
  function handleMouseDown(e) {
    if (projection !== "equirectangular") return;
    dragRef.current = { x0: e.clientX, y0: e.clientY, cx0: mapCenter[0], cy0: mapCenter[1] };
    e.currentTarget.style.cursor = "grabbing";
  }
  function handleMouseMove(e) {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    const W = canvas ? canvas.offsetWidth : 700;
    const zScale = (W / (2 * Math.PI)) * mapZoom;
    const dLon = -((e.clientX - dragRef.current.x0) / zScale) * (180 / Math.PI);
    const dLat =  ((e.clientY - dragRef.current.y0) / zScale) * (180 / Math.PI);
    setMapCenter([
      Math.max(-180, Math.min(180, dragRef.current.cx0 + dLon)),
      Math.max(-80,  Math.min(80,  dragRef.current.cy0 + dLat)),
    ]);
  }
  function handleMouseUp(e)    { dragRef.current = null; e.currentTarget.style.cursor = "grab"; }
  function handleMouseLeave(e) { dragRef.current = null; e.currentTarget.style.cursor = "grab"; }
  function zoomIn()    { setMapZoom(function(z) { return Math.min(40, z * 1.4); }); }
  function zoomOut()   { setMapZoom(function(z) { return Math.max(1, z / 1.4); }); }
  function centerPin() { setMapCenter([termLon, termLat]); setMapZoom(function(z) { return Math.max(z, 3); }); }
  function resetView() { setMapCenter([0, 0]); setMapZoom(1); }
  function switchProj(v) { setProjection(v); setMapZoom(1); setMapCenter([0, 0]); }

  useEffect(() => {
    if (!ready || !canvasRef.current || !worldRef.current) return;
    const canvas = canvasRef.current;
    const W = canvas.offsetWidth || 700;
    const H = canvas.offsetHeight || 400;
    if (canvas.width !== Math.round(W * devicePixelRatio)) {
      canvas.width  = Math.round(W * devicePixelRatio);
      canvas.height = Math.round(H * devicePixelRatio);
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
      canvas.getContext("2d").scale(devicePixelRatio, devicePixelRatio);
    }
    const ctx   = canvas.getContext("2d");
    const topo  = window.topojson;
    const world = worldRef.current;

    let proj;
    if (projection === "orthographic") {
      proj = d3.geoOrthographic()
        .rotate([-termLon, -termLat])
        .scale(Math.min(W, H) * 1.25)
        .translate([W / 2, H / 2]);
    } else {
      const zScale = (W / (2 * Math.PI)) * mapZoom;
      const tx = W / 2 - zScale * (mapCenter[0] * Math.PI / 180);
      const ty = H / 2 + zScale * (mapCenter[1] * Math.PI / 180);
      proj = d3.geoEquirectangular().scale(zScale).translate([tx, ty]);
    }
    const path = d3.geoPath(proj, ctx);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); path({ type:"Sphere" });
    ctx.fillStyle = "#060e1a"; ctx.fill();
    ctx.strokeStyle = "#1e3055"; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath(); path(d3.geoGraticule().step([30, 30])());
    ctx.strokeStyle = "#0e1e30"; ctx.lineWidth = 0.4; ctx.stroke();

    ctx.beginPath(); path(topo.feature(world, world.objects.land));
    ctx.fillStyle = "#1a2538"; ctx.fill();

    ctx.beginPath(); path(topo.mesh(world, world.objects.countries, function(a,b) { return a !== b; }));
    ctx.strokeStyle = "#243556"; ctx.lineWidth = 0.5; ctx.stroke();

    if (projection === "orthographic") {
      const EL_RINGS = [5, 15, 30, 45, 60];
      for (const elAngle of EL_RINGS) {
        const elR = toRad(elAngle);
        const nadirAngle = Math.asin((Re / Rs) * Math.cos(elR));
        const centralAngle = Math.PI / 2 - elR - nadirAngle;
        const ringKm = Re * centralAngle;
        const ringPts = [];
        for (let az2 = 0; az2 <= 361; az2 += 2)
          ringPts.push(geodesicDestPt(termLat, termLon, az2, ringKm));
        ctx.beginPath();
        path({ type:"Feature", geometry:{ type:"LineString", coordinates: ringPts } });
        ctx.strokeStyle = "#00cfff" + (elAngle >= 15 ? "44" : "22");
        ctx.lineWidth = elAngle === 5 ? 1 : 0.6;
        ctx.setLineDash(elAngle === 5 ? [] : [3,3]);
        ctx.stroke(); ctx.setLineDash([]);
        const labelPt = proj(geodesicDestPt(termLat, termLon, 90, ringKm));
        if (labelPt) {
          ctx.fillStyle = "rgba(0,207,255,0.35)";
          ctx.font = "8px 'Courier New'";
          ctx.textAlign = "left";
          ctx.fillText(elAngle + "deg", labelPt[0] + 2, labelPt[1] - 2);
        }
      }
    }

    if (showPassRegion) {
      // Pass region is now tied to the ACTIVE LINK: only the satellite currently
      // serving the terminal, and only the portion of its pass during which the
      // active gateway also sees the satellite at >= gwMinEl. The result is
      // the *end-to-end* footprint — where the terminal can be while keeping the
      // link closed via the currently-serving gateway.
      const gwMin    = gwMinEl ?? 10;
      const ka2517Min = ka2517MinEl ?? 20;
      // If user has selected a specific sat, honour that (override active link)
      // Otherwise use the active link's serving satellite.
      let satsToDraw;
      if (selSat !== -1) {
        const matching = inViewSats.filter(s => s.idx === selSat);
        satsToDraw = matching.map(s => ({ ...s, gw: activeLink && activeLink.gw && activeLink.sat && activeLink.sat.idx === s.idx ? activeLink.gw : null }));
      } else if (activeLink && activeLink.sat && activeLink.gw) {
        satsToDraw = [{ idx: activeLink.sat.idx, gw: activeLink.gw }];
      } else {
        satsToDraw = []; // no active link => no end-to-end region to draw
      }
      const elR = toRad(elThresh);
      const nadirAngle = Math.asin((Re / Rs) * Math.cos(elR));
      const centralAngle = Math.PI / 2 - elR - nadirAngle;
      const ringKm = Re * centralAngle;

      for (const drawSat of satsToDraw) {
        const { lo, hi } = getPassWindow(drawSat.idx);
        const nSteps = 80;
        const gw = drawSat.gw;
        // Walk the pass window. For each step record whether the gateway can see
        // the satellite at >= gwMin. Build polygon segments per contiguous run
        // of "gateway closed" samples — so the envelope becomes a set of pieces
        // whenever the gateway loses LOS during the pass.
        const segments = []; // each: { upper:[], lower:[] }
        let cur = null;
        for (let i = 0; i <= nSteps; i++) {
          const t  = lo + (i / nSteps) * (hi - lo);
          const sl = satLon(drawSat.idx, t, numSats);
          let gwOk;
          if (gw) {
            const gwEl = elevAngle(gw.lat, gw.lon, sl);
            gwOk = gwEl >= gwMin;
          } else {
            gwOk = false;
          }
          if (gwOk) {
            if (!cur) { cur = { upper: [], lower: [] }; segments.push(cur); }
            cur.upper.push(geodesicDestPt(0, sl, 0, ringKm));
            cur.lower.push(geodesicDestPt(0, sl, 180, ringKm));
          } else {
            cur = null;
          }
        }
        // Render each viable segment as its own filled polygon
        for (const seg of segments) {
          if (seg.upper.length < 2) continue;
          const allPts = seg.upper.concat(seg.lower.slice().reverse()).concat([seg.upper[0]]);
          ctx.beginPath();
          path({ type:"Feature", geometry:{ type:"Polygon", coordinates:[allPts] } });
          ctx.strokeStyle = "#ff8800cc"; ctx.lineWidth = 1.8;
          ctx.fillStyle = "#ff880012";
          ctx.fill(); ctx.stroke();
        }
      }
    }

    if (showDualIllum && inViewSats.length >= 2) {
      const sat2 = inViewSats[1];
      const { lo, hi } = getPassWindow(sat2.idx);
      const nSteps = 40;
      const elR = toRad(elThresh);
      const nadirAngle = Math.asin((Re / Rs) * Math.cos(elR));
      const centralAngle = Math.PI / 2 - elR - nadirAngle;
      const ringKm = Re * centralAngle;
      const upperPts = [], lowerPts = [];
      for (let i = 0; i <= nSteps; i++) {
        const t  = lo + (i / nSteps) * (hi - lo);
        const sl = satLon(sat2.idx, t, numSats);
        upperPts.push(geodesicDestPt(0, sl, 0, ringKm));
        lowerPts.push(geodesicDestPt(0, sl, 180, ringKm));
      }
      const allPts = upperPts.concat(lowerPts.slice().reverse()).concat([upperPts[0]]);
      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"Polygon", coordinates:[allPts] } });
      ctx.strokeStyle = "#44aaff99"; ctx.lineWidth = 1.5;
      ctx.fillStyle = "#44aaff0a";
      ctx.fill(); ctx.stroke();
    }

    for (const fb of fixedBeams) {
      const poly = beamFootprintPolygon(fb.termLat, fb.termLon, fb.satLon, fb.el, beamHalf);
      if (!poly) continue;
      ctx.beginPath(); path(poly);
      ctx.strokeStyle = "#ffffff44"; ctx.lineWidth = 1;
      ctx.fillStyle = "#ffffff08";
      ctx.fill(); ctx.stroke();
    }

    for (const sat of targetSats) {
      const col = SAT_COLORS[sat.idx % SAT_COLORS.length];
      const { lo, hi } = getPassWindow(sat.idx);
      const nTrack = 60;
      const trackPts = [];
      for (let i = 0; i <= nTrack; i++) {
        const t = lo + (i / nTrack) * (hi - lo);
        trackPts.push([satLon(sat.idx, t, numSats), 0]);
      }
      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"LineString", coordinates: trackPts } });
      ctx.strokeStyle = col + "99"; ctx.lineWidth = 2; ctx.stroke();

      const pRise = proj(trackPts[0]);
      if (pRise) {
        ctx.beginPath(); ctx.arc(pRise[0], pRise[1], 3, 0, Math.PI * 2);
        ctx.fillStyle = col + "99"; ctx.fill();
      }

      const slMid  = satLon(sat.idx, simTime, numSats);
      const slMid2 = satLon(sat.idx, simTime + 120, numSats);
      const pA = proj([slMid,  0]);
      const pB = proj([slMid2, 0]);
      if (pA && pB) {
        const dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 1) {
          const ux = dx/len, uy = dy/len;
          ctx.beginPath();
          ctx.moveTo(pA[0], pA[1]);
          ctx.lineTo(pA[0] + ux*14, pA[1] + uy*14);
          ctx.lineTo(pA[0] + ux*10 - uy*4, pA[1] + uy*10 + ux*4);
          ctx.moveTo(pA[0] + ux*14, pA[1] + uy*14);
          ctx.lineTo(pA[0] + ux*10 + uy*4, pA[1] + uy*10 - ux*4);
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }

      const poly = beamFootprintPolygon(termLat, termLon, sat.satLon, sat.el, beamHalf);
      if (poly) {
        ctx.beginPath(); path(poly);
        ctx.fillStyle = col + "33"; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
        [[0.5, 1.2], [0.3, 0.8]].forEach(function(pair) {
          const inner = beamFootprintPolygon(termLat, termLon, sat.satLon, sat.el, beamHalf * pair[0]);
          if (inner) { ctx.beginPath(); path(inner); ctx.strokeStyle = col + "bb"; ctx.lineWidth = pair[1]; ctx.stroke(); }
        });
      }

      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"LineString", coordinates:[[termLon, termLat],[sat.satLon, 0]] } });
      ctx.strokeStyle = col + "44"; ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

      const pSat = proj([sat.satLon, 0]);
      if (pSat) {
        ctx.beginPath(); ctx.arc(pSat[0], pSat[1], 5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 9px 'Courier New'";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText(sat.name, pSat[0], pSat[1] - 8);
        ctx.fillStyle = col; ctx.font = "7px 'Courier New'";
        ctx.fillText("EL " + sat.el.toFixed(1) + "deg  AZ " + sat.az.toFixed(0) + "deg", pSat[0], pSat[1] + 17);
        ctx.shadowBlur = 0;
      }
    }

    // ── Gateway markers + active link visualization ──────────
    // Draw all active gateways as orange squares; the active one is highlighted.
    const gws = activeGateways || [];
    if (gws.length > 0) {
      ctx.save();
      for (const gw of gws) {
        const pG = proj([gw.lon, gw.lat]);
        if (!pG) continue;
        const isActive = activeLink && activeLink.gw && activeLink.gw.id === gw.id;
        const sz = isActive ? 6 : 4;
        ctx.beginPath();
        ctx.rect(pG[0] - sz, pG[1] - sz, sz * 2, sz * 2);
        if (isActive) {
          ctx.fillStyle = "#ff9900cc";
          ctx.strokeStyle = "#ff9900";
          ctx.lineWidth = 2;
          // Pulsing glow
          ctx.shadowColor = "#ff9900";
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = "#ff990044";
          ctx.strokeStyle = "#ff990088";
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Label
        ctx.fillStyle = isActive ? "#ff9900" : "#ff990088";
        ctx.font = isActive ? "bold 9px 'Courier New'" : "8px 'Courier New'";
        ctx.textAlign = "left";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText(gw.id, pG[0] + sz + 3, pG[1] + 3);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Draw active link path: terminal -> active satellite (subsat point) -> active gateway
    if (activeLink && activeLink.sat && activeLink.gw) {
      const pTerm  = proj([termLon, termLat]);
      const pSat   = proj([activeLink.sat.satLon, 0]);
      const pGw    = proj([activeLink.gw.lon, activeLink.gw.lat]);
      if (pTerm && pSat && pGw) {
        ctx.save();
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 3]);
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 6;
        // Terminal -> sat
        ctx.beginPath();
        ctx.moveTo(pTerm[0], pTerm[1]);
        ctx.lineTo(pSat[0], pSat[1]);
        ctx.stroke();
        // Sat -> gateway
        ctx.beginPath();
        ctx.moveTo(pSat[0], pSat[1]);
        ctx.lineTo(pGw[0], pGw[1]);
        ctx.stroke();
        ctx.restore();
      }
    } else if (activeLink && activeLink.sat && !activeLink.gw) {
      // Terminal sees sat but no gateway: dashed red line, terminal -> subsat
      const pTerm = proj([termLon, termLat]);
      const pSat  = proj([activeLink.sat.satLon, 0]);
      if (pTerm && pSat) {
        ctx.save();
        ctx.strokeStyle = "#ff6b35";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pTerm[0], pTerm[1]);
        ctx.lineTo(pSat[0], pSat[1]);
        ctx.stroke();
        ctx.restore();
      }
    }

    const pT = proj([termLon, termLat]);
    if (pT) {
      if (isGateway) {
        const sz = 8;
        ctx.beginPath();
        ctx.moveTo(pT[0], pT[1] - sz); ctx.lineTo(pT[0] + sz, pT[1]);
        ctx.lineTo(pT[0], pT[1] + sz); ctx.lineTo(pT[0] - sz, pT[1]);
        ctx.closePath();
        ctx.fillStyle = "#ff8800bb"; ctx.strokeStyle = "#ff8800"; ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ff8800"; ctx.font = "bold 8px 'Courier New'";
        ctx.textAlign = "left";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText("GW", pT[0] + sz + 3, pT[1] + 3);
      } else {
        const R2 = 7;
        ctx.strokeStyle = "#00cfff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(pT[0]-R2-4,pT[1]); ctx.lineTo(pT[0]+R2+4,pT[1]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pT[0],pT[1]-R2-4); ctx.lineTo(pT[0],pT[1]+R2+4); ctx.stroke();
        ctx.beginPath(); ctx.arc(pT[0], pT[1], R2, 0, Math.PI*2);
        ctx.strokeStyle = "#00cfff"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#00cfff44"; ctx.fill();
      }
      ctx.fillStyle = "#00cfff"; ctx.font = "bold 9px 'Courier New'";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
      ctx.fillText(
        Math.abs(termLat).toFixed(4) + "deg" + (termLat>=0?"N":"S") + "  " +
        Math.abs(termLon).toFixed(4) + "deg" + (termLon>=0?"E":"W"),
        pT[0] + 12, pT[1] + 4
      );
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#2a4060"; ctx.font = "8px 'Courier New'"; ctx.textAlign = "right";
    ctx.fillText(
      projection === "orthographic" ? "Orthographic - centred on terminal" : "Equirectangular - " + mapZoom.toFixed(1) + "x zoom",
      W - 6, H - 6
    );

  }, [ready, simTime, numSats, termLat, termLon, termAlt, beamHalf, showPassRegion, showDualIllum,
      selSat, targetSats, inViewSats, projection, isGateway, limitElev, limitElevVal, fixedBeams,
      mapZoom, mapCenter, elThresh, activeGateways, activeLink]);

  const fmtKm = function(v) { return v >= 1000 ? (v/1000).toFixed(1) + " Mm" : v.toFixed(0) + " km"; };

  const inputStyle = {background:"#0d1a2a",border:"1px solid #2e4270",color:"#00cfff",
    padding:"3px 6px",width:"100%",boxSizing:"border-box",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"};
  const labelStyle = {color:"#3a5a7a",fontSize:"8px",display:"block",marginBottom:"2px"};
  const panelStyle = {background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",padding:"10px"};
  const secStyle   = {color:"#4a6a8a",fontSize:"9px",marginBottom:"8px",letterSpacing:"0.05em"};
  const btnStyle   = {background:"#0d1a2a",border:"1px solid #2e4270",color:"#8ab0d0",
    padding:"4px 10px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"};

  return (
    <div style={{fontFamily:"'Courier New',monospace"}}>

      <div style={{display:"flex",gap:"6px",marginBottom:"8px",alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={copyImage} style={btnStyle}>Copy Image</button>
        <button onClick={exportKML} style={btnStyle}>KML Export</button>
        <div style={{flex:1}}/>
        <button onClick={fixBeam} disabled={targetSats.length===0}
          style={{...btnStyle, color: targetSats.length>0?"#00cfff":"#3a5a7a",
            cursor:targetSats.length>0?"pointer":"default"}}>
          Fix Beam
        </button>
        <button onClick={function(){setFixedBeams([]);}} disabled={fixedBeams.length===0}
          style={{...btnStyle, color: fixedBeams.length>0?"#ff8800":"#3a5a7a",
            cursor:fixedBeams.length>0?"pointer":"default"}}>
          Remove Fixed {fixedBeams.length>0?"("+fixedBeams.length+")":""}
        </button>
      </div>

      {kmlOutput && (
        <div style={{background:"#060e1a",border:"1px solid #ff8800",borderRadius:"4px",padding:"10px",marginBottom:"8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <span style={{color:"#ff8800",fontSize:"9px",letterSpacing:"0.05em"}}>KML OUTPUT — copy and save as .kml file</span>
            <button onClick={function(){setKmlOutput(null);}}
              style={{background:"transparent",border:"1px solid #ff880066",color:"#ff8800",
                padding:"2px 8px",borderRadius:"3px",cursor:"pointer",fontSize:"9px",fontFamily:"inherit"}}>
              Close
            </button>
          </div>
          <textarea readOnly value={kmlOutput}
            onClick={function(e){e.target.select();}}
            style={{width:"100%",height:"160px",background:"#0d1a2a",border:"1px solid #2e4270",
              color:"#8ab0d0",fontSize:"9px",fontFamily:"'Courier New',monospace",
              padding:"6px",borderRadius:"3px",resize:"vertical",boxSizing:"border-box"}}/>
          <div style={{color:"#3a5a7a",fontSize:"8px",marginTop:"4px"}}>
            Click the text area to select all, then Ctrl+C / Cmd+C to copy
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:"10px",alignItems:"start"}}>

        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>

          <div style={panelStyle}>
            <div style={secStyle}>TERMINAL LOCATION</div>
            {flightActive && (
              <label style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px",
                padding:"6px 8px",background:trackFlight?"#0d1a14":"#080f1a",
                border:`1px solid ${trackFlight?"#00ff88":"#2e4270"}`,borderRadius:"3px",cursor:"pointer"}}>
                <input type="checkbox" checked={trackFlight}
                  onChange={function(e){setTrackFlight(e.target.checked);}}
                  style={{accentColor:"#00ff88",width:"12px",height:"12px",cursor:"pointer"}} />
                <span style={{color:trackFlight?"#00ff88":"#8ab0d0",fontSize:"10px",fontWeight:"bold",letterSpacing:"0.04em"}}>
                  ✈ TRACK FLIGHT
                </span>
                {trackFlight && flightInfo?.callsign && (
                  <span style={{color:"#5a9a7a",fontSize:"9px",marginLeft:"auto"}}>
                    {flightInfo.callsign}
                  </span>
                )}
              </label>
            )}
            {flightActive && onRestartFlight && (
              <button onClick={onRestartFlight}
                style={{...btnStyle,width:"100%",marginBottom:"8px",
                  color:"#00ff88",border:"1px solid #00ff88",background:"#00ff8815",fontWeight:"bold"}}>
                ↺ RESTART FLIGHT
              </button>
            )}
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>Longitude (deg)</label>
              <input type="number" min={-180} max={180} step={0.0001} value={termLon}
                disabled={trackFlight && flightActive}
                onChange={function(e){setTermLon(+e.target.value);}}
                style={{...inputStyle,
                  ...(trackFlight && flightActive?{borderColor:"#00ff88",background:"#0d1a14",color:"#00ff88",cursor:"not-allowed"}:{})}}/>
            </div>
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>Latitude (deg)</label>
              <input type="number" min={-55} max={55} step={0.0001} value={termLat}
                disabled={trackFlight && flightActive}
                onChange={function(e){setTermLat(+e.target.value);}}
                style={{...inputStyle,
                  ...(trackFlight && flightActive?{borderColor:"#00ff88",background:"#0d1a14",color:"#00ff88",cursor:"not-allowed"}:{})}}/>
            </div>
            <div style={{marginBottom:"8px"}}>
              <label style={labelStyle}>UT Altitude (km)</label>
              <input type="number" min={0} max={12} step={0.1} value={termAlt}
                onChange={function(e){setTermAlt(+e.target.value);}} style={inputStyle}/>
            </div>
            <button onClick={function(){setTrackFlight(false);setTermLat(gpLat);setTermLon(gpLon);}}
              style={{...btnStyle,width:"100%",color:"#00cfff",border:"1px solid #00cfff44",background:"#00cfff11"}}>
              Use Analysis Point
            </button>
          </div>

          <div style={panelStyle}>
            <div style={secStyle}>SATELLITE PARAMETERS</div>
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>No. satellites / max sep (deg)</label>
              <div style={{display:"flex",gap:"4px"}}>
                <input type="number" min={1} max={11} step={1} value={numSatMin}
                  onChange={function(e){setNumSatMin(+e.target.value);}}
                  style={{...inputStyle,flex:1}}/>
                <input type="number" min={5} max={120} step={5} value={maxSep}
                  onChange={function(e){setMaxSep(+e.target.value);}}
                  style={{...inputStyle,flex:1}}/>
              </div>
            </div>
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>Handover time (deg)</label>
              <input type="number" min={0} max={10} step={0.5} value={handover}
                onChange={function(e){setHandover(+e.target.value);}} style={inputStyle}/>
            </div>
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>Min. UT Elevation (deg)</label>
              <input type="number" min={0} max={45} step={1} value={minElev}
                onChange={function(e){setMinElev(+e.target.value);}} style={inputStyle}/>
            </div>
            <div style={{marginBottom:"6px"}}>
              <label style={labelStyle}>Half Beam-Width (deg) — HPBW {(beamHalf*2).toFixed(1)}deg</label>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <input type="range" min={0.2} max={5} step={0.1} value={beamHalf}
                  onChange={function(e){setBeamHalf(+e.target.value);}}
                  style={{flex:1,accentColor:"#b07aff"}}/>
                <span style={{color:"#b07aff",fontSize:"11px",fontWeight:"bold",minWidth:"32px"}}>
                  {beamHalf.toFixed(1)}deg
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Satellite</label>
              <select value={selSat} onChange={function(e){setSelSat(+e.target.value);}}
                style={{...inputStyle,color:"#8ab0d0"}}>
                <option value={-1}>All in-view</option>
                {inViewSats.map(function(s) {
                  return <option key={s.idx} value={s.idx}>{s.name} (EL {s.el}deg)</option>;
                })}
              </select>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={secStyle}>DISPLAY OPTIONS</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {[
                ["Is gateway",        isGateway,      setIsGateway],
                ["Show end-to-end pass region", showPassRegion, setShowPassRegion],
                ["Show dual illumination", showDualIllum, setShowDualIllum],
              ].map(function(row) {
                return (
                  <label key={row[0]} style={{color:"#8ab0d0",fontSize:"10px",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:"5px",userSelect:"none"}}>
                    <input type="checkbox" checked={row[1]}
                      onChange={function(e){row[2](e.target.checked);}}
                      style={{accentColor:"#b07aff",width:"12px",height:"12px"}}/>
                    {row[0]}
                  </label>
                );
              })}
              {showPassRegion && (
                <div style={{color:"#5a7a9a",fontSize:"9px",lineHeight:"1.4",
                  background:"#080f1a",border:"1px solid #1e3055",borderRadius:"3px",padding:"5px 7px",marginTop:"2px"}}>
                  Orange envelope = ground area where the terminal can keep the link closed via{" "}
                  <span style={{color:"#ff9900",fontWeight:"bold"}}>
                    {activeLink && activeLink.gw ? activeLink.gw.id : "the active gateway"}
                  </span>{" "}
                  during the pass of{" "}
                  <span style={{color: activeLink && activeLink.sat ? SAT_COLORS[activeLink.sat.idx % SAT_COLORS.length] : "#7fff00", fontWeight:"bold"}}>
                    {activeLink && activeLink.sat ? activeLink.sat.name : "the serving satellite"}
                  </span>.
                  Gaps occur when the gateway loses LOS to the satellite.
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                <label style={{color:"#8ab0d0",fontSize:"10px",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:"5px",userSelect:"none"}}>
                  <input type="checkbox" checked={limitElev}
                    onChange={function(e){setLimitElev(e.target.checked);}}
                    style={{accentColor:"#b07aff",width:"12px",height:"12px"}}/>
                  Limit to elev above (deg)
                </label>
                {limitElev && (
                  <input type="number" min={0} max={45} step={1} value={limitElevVal}
                    onChange={function(e){setLimitElevVal(+e.target.value);}}
                    style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#00cfff",
                      padding:"2px 4px",width:"42px",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"}}/>
                )}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={secStyle}>PASS REGION (END-TO-END)</div>
            {inViewSats.length > 0 ? (selSat===-1?inViewSats.slice(0,2):inViewSats.filter(function(s){return s.idx===selSat;})).map(function(sat) {
              const pw = getPassWindow(sat.idx);
              const slLo = satLon(sat.idx, pw.lo, numSats);
              const slHi = satLon(sat.idx, pw.hi, numSats);
              let elPeak = 0;
              for (let dt = pw.lo; dt <= pw.hi; dt += 60) {
                const el2 = elevAngle(termLat, termLon, satLon(sat.idx, dt, numSats));
                if (el2 > elPeak) elPeak = el2;
              }
              const col = SAT_COLORS[sat.idx % SAT_COLORS.length];
              return (
                <div key={sat.idx} style={{marginBottom:"8px",paddingBottom:"8px",borderBottom:"1px solid #1e3055"}}>
                  <div style={{color:col,fontSize:"9px",fontWeight:"bold",marginBottom:"4px"}}>{sat.name}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 6px",fontSize:"8px"}}>
                    {[["El peak",elPeak.toFixed(1)+"deg"],["El now",sat.el+"deg"],
                      ["Start lon",slLo.toFixed(1)+"deg"],["End lon",slHi.toFixed(1)+"deg"],
                      ["Delta lon",Math.abs(slHi-slLo).toFixed(1)+"deg"],["AZ",sat.az+"deg"]
                    ].map(function(kv) {
                      return (
                        <div key={kv[0]}>
                          <span style={{color:"#3a5a7a"}}>{kv[0]}: </span>
                          <span style={{color:"#8ab0d0",fontWeight:"bold"}}>{kv[1]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }) : <div style={{color:"#3a5a7a",fontSize:"9px",fontStyle:"italic"}}>No satellites above threshold</div>}
          </div>

          <div style={panelStyle}>
            <div style={secStyle}>MAP PROJECTION</div>
            <select value={projection} onChange={function(e){switchProj(e.target.value);}}
              style={{...inputStyle,color:"#8ab0d0"}}>
              <option value="equirectangular">Equirectangular</option>
              <option value="orthographic">Orthographic</option>
            </select>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>

          <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",overflow:"hidden",position:"relative"}}>
            {err && <div style={{color:"#ff4444",padding:"20px",fontSize:"11px"}}>{"Map error: " + err}</div>}
            {!ready && !err && <div style={{color:"#4a6a8a",padding:"40px",textAlign:"center",fontSize:"11px"}}>Loading map...</div>}
            <canvas ref={canvasRef}
              style={{display:"block",width:"100%",height:"400px",
                cursor:projection==="equirectangular"?"grab":"default"}}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
            {projection === "equirectangular" && (
              <div style={{position:"absolute",top:"8px",right:"8px",display:"flex",flexDirection:"column",gap:"3px"}}>
                <button onClick={zoomIn} title="Zoom in"
                  style={{width:"26px",height:"26px",background:"#0d1a2acc",border:"1px solid #2e4270",
                    color:"#8ab0d0",borderRadius:"3px",cursor:"pointer",fontSize:"16px",fontFamily:"monospace",lineHeight:1,padding:0}}>
                  +
                </button>
                <button onClick={zoomOut} title="Zoom out"
                  style={{width:"26px",height:"26px",background:"#0d1a2acc",border:"1px solid #2e4270",
                    color:"#8ab0d0",borderRadius:"3px",cursor:"pointer",fontSize:"16px",fontFamily:"monospace",lineHeight:1,padding:0}}>
                  -
                </button>
                <button onClick={centerPin} title="Center on pin"
                  style={{width:"26px",height:"26px",background:"#0d1a2acc",border:"1px solid #2e4270",
                    color:"#00cfff",borderRadius:"3px",cursor:"pointer",fontSize:"11px",fontFamily:"monospace",lineHeight:1,padding:0}}>
                  [o]
                </button>
                <button onClick={resetView} title="Reset view"
                  style={{width:"26px",height:"26px",background:"#0d1a2acc",border:"1px solid #2e4270",
                    color:"#8ab0d0",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"monospace",lineHeight:1,padding:0}}>
                  [ ]
                </button>
                <div style={{background:"#0d1a2a99",border:"1px solid #1e3055",borderRadius:"3px",
                  padding:"2px 4px",textAlign:"center",color:"#4a6a8a",fontSize:"8px",fontFamily:"'Courier New',monospace"}}>
                  {mapZoom.toFixed(1)}x
                </div>
              </div>
            )}
          </div>

          {/* ── ACTIVE LINK status panel ── */}
          <div style={panelStyle}>
            <div style={secStyle}>ACTIVE LINK</div>
            {!activeLink ? (
              <div style={{color:"#3a5a7a",fontSize:"9px",fontStyle:"italic"}}>Computing...</div>
            ) : !activeLink.sat || !activeLink.gw ? (
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                  <span style={{color:"#ff6b35",fontSize:"10px",fontWeight:"bold"}}>X CLOSED</span>
                  {activeLink.sat && (
                    <span style={{color:SAT_COLORS[activeLink.sat.idx % SAT_COLORS.length],fontSize:"10px"}}>
                      {activeLink.sat.name} EL {activeLink.sat.el}deg
                    </span>
                  )}
                </div>
                <div style={{color:"#a0c0e0",fontSize:"9px",lineHeight:"1.5"}}>
                  {activeLink.reason}
                </div>
              </div>
            ) : (
              <div>
                <div style={{display:"grid",gridTemplateColumns:"auto auto 1fr",gap:"6px 10px",fontSize:"10px",alignItems:"center",marginBottom:"6px"}}>
                  <span style={{color:"#4a6a8a"}}>SAT:</span>
                  <span style={{color:SAT_COLORS[activeLink.sat.idx % SAT_COLORS.length],fontWeight:"bold"}}>
                    {activeLink.sat.name}
                  </span>
                  <span style={{color:"#8ab0d0"}}>{activeLink.satEl}deg from terminal</span>
                  <span style={{color:"#4a6a8a"}}>GW:</span>
                  <span style={{color:"#ff9900",fontWeight:"bold"}}>{activeLink.gw.id}</span>
                  <span style={{color:"#8ab0d0"}}>{activeLink.gwEl}deg from sat ({activeLink.gw.name})</span>
                </div>
                <div style={{color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em",marginTop:"8px",marginBottom:"3px"}}>
                  REASON
                </div>
                <div style={{color:activeLink.fallback?"#ffd700":"#7fff00",fontSize:"9px",lineHeight:"1.5",
                  background:activeLink.fallback?"#1a1408":"#0d1a14",
                  border:`1px solid ${activeLink.fallback?"#ffd70044":"#00ff8844"}`,borderRadius:"3px",padding:"5px 7px"}}>
                  {activeLink.fallback ? "[!] " : "[OK] "}{activeLink.reason}
                </div>
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={secStyle}>IN-VIEW SATELLITES</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {inViewSats.length === 0
                ? <div style={{color:"#3a5a7a",fontSize:"9px",fontStyle:"italic"}}>None above threshold</div>
                : inViewSats.map(function(sat) {
                    const col = SAT_COLORS[sat.idx % SAT_COLORS.length];
                    const d   = slantRange(sat.el);
                    const bMinor = d * Math.tan(toRad(beamHalf));
                    const bMajor = bMinor / Math.sin(toRad(sat.el));
                    const isActive = selSat === -1 || selSat === sat.idx;
                    return (
                      <div key={sat.idx}
                        onClick={function(){setSelSat(function(prev){return prev===sat.idx?-1:sat.idx;});}}
                        style={{
                          background: isActive ? "#0d1a2a" : "#080f1a",
                          border:"1px solid " + (isActive ? col+"66" : "#1e3055"),
                          borderTop:"3px solid " + (isActive ? col : "#2e4270"),
                          borderRadius:"3px", padding:"6px 8px",
                          cursor:"pointer", opacity: isActive ? 1 : 0.5,
                          minWidth:"110px", flex:"1 1 110px",
                        }}>
                        <div style={{color:col,fontSize:"10px",fontWeight:"bold",marginBottom:"3px"}}>{sat.name}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px 4px"}}>
                          {[["EL",sat.el+"deg"],["AZ",sat.az+"deg"],
                            ["Slant",fmtKm(d)],["Scan",(90-sat.el).toFixed(1)+"deg"],
                            ["Minor",fmtKm(bMinor)],["Major",fmtKm(bMajor)],
                          ].map(function(kv) {
                            return (
                              <div key={kv[0]}>
                                <span style={{color:"#3a5a7a",fontSize:"7px"}}>{kv[0]}: </span>
                                <span style={{color:"#8ab0d0",fontSize:"8px",fontWeight:"bold"}}>{kv[1]}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{marginTop:"4px",height:"3px",background:"#152030",borderRadius:"2px",overflow:"hidden"}}>
                          <div style={{width:Math.min(100,(sat.el/60)*100)+"%",height:"100%",background:col,borderRadius:"2px"}}/>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
            <div style={panelStyle}>
              <div style={secStyle}>BEAM CONTOURS</div>
              {[["#fff","Outer - half-angle"],["#aaa","Inner - -3dB (0.5x)"],["#777","Core - -6dB (0.3x)"]].map(function(row) {
                return (
                  <div key={row[1]} style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px"}}>
                    <div style={{width:"18px",height:"2px",background:row[0],flexShrink:0}}/>
                    <span style={{color:"#4a6a8a",fontSize:"8px"}}>{row[1]}</span>
                  </div>
                );
              })}
            </div>
            <div style={panelStyle}>
              <div style={secStyle}>REGIONS</div>
              {[["#ff880099","Pass region (primary)"],["#44aaff99","Pass region (dual)"],["#ffffff44","Fixed beam pins"]].map(function(row) {
                return (
                  <div key={row[1]} style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px"}}>
                    <div style={{width:"18px",height:"2px",background:row[0],flexShrink:0}}/>
                    <span style={{color:"#4a6a8a",fontSize:"8px"}}>{row[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GatewayWeatherTab({ simTime, numSats, satNames }) {
  const [wxData,   setWxData]   = useState(null);   // array of 9 cell data objects
  const [loading,  setLoading]  = useState(false);
  const [wxError,  setWxError]  = useState(null);
  const [lastUpd,  setLastUpd]  = useState(null);
  const [altGwId,  setAltGwId]  = useState("GW-JNB");
  const [cThresh,  setCThresh]  = useState(80);
  const [pThresh,  setPThresh]  = useState(2.0);
  const [leadMin,  setLeadMin]  = useState(30);
  const [webhook,  setWebhook]  = useState("");
  const [alertLog, setAlertLog] = useState([]);
  const [cellTip,  setCellTip]  = useState(null);   // hovered cell tooltip
  const recActiveRef = useRef(false); // hysteresis: is a switch recommendation currently active?
  const clearConsecRef = useRef(0);   // consecutive clear hours once active

  // ── Weather fetch ─────────────────────────────────────────────
  const [demoMode, setDemoMode] = useState(false); // true when using synthetic data

  // Build synthetic weather data for demo/fallback mode.
  // Generates a realistic 48-hour dataset for La Réunion: tropical base with
  // a risk event in hours 2-4 over the eastern cells to demonstrate all UI states.
  const buildDemoData = useCallback(() => {
    const now   = new Date();
    const times = Array.from({length:48}, (_,h) => {
      const d = new Date(now); d.setHours(now.getHours() + h, 0, 0, 0);
      return d.toISOString().slice(0,13) + ":00";
    });
    return WEATHER_CELLS.map(c => {
      // Risk event at T+2h–T+4h in the CENTRE cell and its 4 cardinal neighbours
      // so it is guaranteed to intersect every satellite's LOS regardless of simTime.
      // Eastern cells show caution to give spatial variety in the grid display.
      const isCentre  = Math.abs(c.dlat) < 0.001 && Math.abs(c.dlon) < 0.001;
      const isCardinal= (Math.abs(c.dlat) < 0.001) !== (Math.abs(c.dlon) < 0.001); // N/S/E/W only
      const isEast    = c.dlon > 0.01;
      const cloudcover = times.map((_, h) => {
        let base = 55 + Math.sin(h * 0.4) * 15 + (isEast ? 10 : 0) + (Math.random() * 8 - 4);
        if (h >= 2 && h <= 4 && (isCentre || isCardinal)) base = 86 + Math.random() * 8;
        if (h >= 2 && h <= 4 && isEast)                   base = 72 + Math.random() * 8;
        return Math.max(0, Math.min(100, Math.round(base)));
      });
      const precipitation = times.map((_, h) => {
        if (h >= 2 && h <= 4 && (isCentre || isCardinal)) return +(2.8 + Math.random() * 2).toFixed(1);
        if (h >= 2 && h <= 4 && isEast)                   return +(0.6 + Math.random() * 0.8).toFixed(1);
        return +(Math.random() * 0.3).toFixed(1);
      });
      const weathercode = times.map((_, h) => {
        if (h >= 2 && h <= 4 && (isCentre || isCardinal)) return 81; // moderate rain showers
        if (h >= 2 && h <= 3 && isEast)                   return 61; // slight rain
        return cloudcover[h] > 70 ? 2 : 1;
      });
      return { ...c, times, cloudcover, precipitation,
        weathercode, precip_prob: cloudcover.map(cc => Math.round(cc * 0.7)),
        windspeed: Array.from({length:48}, () => +(15 + Math.random() * 10).toFixed(1)),
        winddir:   Array.from({length:48}, () => +(115 + Math.random() * 30).toFixed(0)) };
    });
  }, []);

  // Fetch strategy:
  //   1. Direct Open-Meteo fetch (works in non-sandboxed environments)
  //   2. Anthropic API proxy with web_search tool (works in Claude.ai artifact sandbox)
  //   3. Synthetic demo mode (always works — for offline / blocked environments)
  const fetchWeather = useCallback(async () => {
    setLoading(true); setWxError(null); setDemoMode(false);
    const vars = "cloudcover,precipitation,weathercode,precipitation_probability,windspeed_10m,winddirection_10m";
    const buildUrl = c => `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(5)}&longitude=${c.lon.toFixed(5)}&hourly=${vars}&forecast_days=2&timezone=UTC`;

    // ── Tier 1: Direct fetch ──────────────────────────────────
    try {
      const results = await Promise.all(WEATHER_CELLS.map(c =>
        fetch(buildUrl(c)).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      ));
      const data = results.map((r, i) => ({
        ...WEATHER_CELLS[i],
        times: r.hourly.time, cloudcover: r.hourly.cloudcover,
        precipitation: r.hourly.precipitation, weathercode: r.hourly.weathercode,
        precip_prob: r.hourly.precipitation_probability,
        windspeed: r.hourly.windspeed_10m, winddir: r.hourly.winddirection_10m,
      }));
      setWxData(data); setLastUpd(new Date()); setLoading(false); return;
    } catch(_) { /* fall through to tier 2 */ }

    // ── Tier 2: Anthropic API proxy (web_search routes through Claude's fetch) ──
    try {
      const urlList = WEATHER_CELLS.map((c,i) => `Cell ${i} ${c.id}: ${buildUrl(c)}`).join("\n");
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 16000,
          tools: [{ "type": "web_search_20250305", "name": "web_search" }],
          messages: [{ role: "user", content:
            `Fetch each of the following 9 Open-Meteo API URLs and return ONLY a JSON array ` +
            `(no markdown, no explanation). Each array element must have: ` +
            `cellIndex (0-8), times (array), cloudcover, precipitation, weathercode, windspeed_10m, winddirection_10m (all arrays).\n\n${urlList}` }]
        })
      });
      if (!resp.ok) throw new Error(`API HTTP ${resp.status}`);
      const apiData = await resp.json();
      const text = apiData.content.filter(b => b.type === "text").map(b => b.text).join("");
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array in proxy response");
      const parsed = JSON.parse(match[0]);
      const data = WEATHER_CELLS.map((cell, i) => {
        const p = parsed.find(x => x.cellIndex === i) || parsed[i] || {};
        return { ...cell, times: p.times||[], cloudcover: p.cloudcover||[],
          precipitation: p.precipitation||[], weathercode: p.weathercode||[],
          precip_prob: [], windspeed: p.windspeed_10m||[], winddir: p.winddirection_10m||[] };
      });
      setWxData(data); setLastUpd(new Date()); setLoading(false); return;
    } catch(_) { /* fall through to tier 3 */ }

    // ── Tier 3: Synthetic demo mode ──────────────────────────
    setDemoMode(true);
    setWxData(buildDemoData());
    setLastUpd(new Date());
    setLoading(false);
  }, [buildDemoData]);

  useEffect(() => {
    fetchWeather();
    const iv = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchWeather]);

  // ── Current forecast hour index (wall-clock, not simTime) ─────
  const currentHourIdx = useMemo(() => {
    if (!wxData || !wxData[0]?.times) return 0;
    const nowIso = new Date().toISOString().slice(0,13); // "YYYY-MM-DDTHH"
    const idx = wxData[0].times.findIndex(t => t.startsWith(nowIso));
    return idx >= 0 ? idx : 0;
  }, [wxData]);

  // ── In-view satellites from GW-REU at current simTime ─────────
  const inViewSats = useMemo(() => {
    const vis = [];
    for (let s = 0; s < numSats; s++) {
      const sl  = satLon(s, simTime, numSats);
      const el  = elevAngle(GW_REU.lat, GW_REU.lon, sl);
      if (el >= 5) vis.push({ idx: s, name: satNames[s], el, satLon: sl,
        az: azimToSubSat(GW_REU.lat, GW_REU.lon, sl) });
    }
    return vis;
  }, [simTime, numSats, satNames]);

  // ── Cell risk function for a given forecast hour ──────────────
  const isCellRisky = useCallback((cellData, hIdx, cT, pT) => {
    if (!cellData) return false;
    const cc = cellData.cloudcover?.[hIdx] ?? 0;
    const pr = cellData.precipitation?.[hIdx] ?? 0;
    const wc = cellData.weathercode?.[hIdx] ?? 0;
    return cc >= cT || pr >= pT || (wc >= 80 && wc <= 99);
  }, []);

  // ── Risk matrix: [satIdx][horizonHour 0-5] → { atRisk, contributingCells, maxCC, maxPr, maxWC } ─
  const riskMatrix = useMemo(() => {
    if (!wxData || inViewSats.length === 0) return {};
    const matrix = {};
    for (const sat of inViewSats) {
      matrix[sat.idx] = [];
      const pts = losGroundPoints(GW_REU.lat, GW_REU.lon, sat.satLon, sat.el);
      for (let h = 0; h < 6; h++) {
        const hIdx = currentHourIdx + h;
        let atRisk = false;
        const contributing = new Set();
        let maxCC = 0, maxPr = 0, maxWC = 0;
        for (const pt of pts) {
          const cell = nearestCell(pt.lat, pt.lon);
          const cd   = wxData.find(d => d.id === cell.id);
          if (isCellRisky(cd, hIdx, cThresh, pThresh)) {
            atRisk = true;
            contributing.add(cell.id);
          }
          if (cd) {
            maxCC = Math.max(maxCC, cd.cloudcover?.[hIdx] ?? 0);
            maxPr = Math.max(maxPr, cd.precipitation?.[hIdx] ?? 0);
            maxWC = Math.max(maxWC, cd.weathercode?.[hIdx] ?? 0);
          }
        }
        matrix[sat.idx].push({ atRisk, cells: [...contributing], maxCC, maxPr, maxWC });
      }
    }
    return matrix;
  }, [wxData, inViewSats, currentHourIdx, cThresh, pThresh, isCellRisky]);

  // ── Switch recommendation with hysteresis ─────────────────────
  const switchRec = useMemo(() => {
    if (!wxData || Object.keys(riskMatrix).length === 0) return null;
    // Build per-hour aggregate: is any satellite at risk this hour?
    const perHour = Array.from({length:6}, (_,h) =>
      inViewSats.some(s => riskMatrix[s.idx]?.[h]?.atRisk)
    );
    // Find first consecutive pair of at-risk hours
    let firstRiskyH = -1;
    for (let h = 0; h < 5; h++) {
      if (perHour[h] && perHour[h+1]) { firstRiskyH = h; break; }
    }
    if (firstRiskyH < 0) return null; // hysteresis not met
    // Lead time: time until the first risky hour (in wall-clock minutes)
    const leadMinutes = firstRiskyH * 60;
    if (leadMinutes < leadMin) return null; // too soon
    // Collect at-risk satellite names, contributing cells, peak values
    const atRiskSats = inViewSats.filter(s => riskMatrix[s.idx]?.[firstRiskyH]?.atRisk);
    const allCells   = [...new Set(atRiskSats.flatMap(s => riskMatrix[s.idx][firstRiskyH].cells))];
    const maxCC  = Math.max(...atRiskSats.map(s => riskMatrix[s.idx][firstRiskyH].maxCC));
    const maxPr  = Math.max(...atRiskSats.map(s => riskMatrix[s.idx][firstRiskyH].maxPr));
    const maxWC  = Math.max(...atRiskSats.map(s => riskMatrix[s.idx][firstRiskyH].maxWC));
    const impactISO = new Date(Date.now() + leadMinutes*60000).toISOString();
    return { firstRiskyH, leadMinutes, atRiskSats, allCells, maxCC, maxPr, maxWC, impactISO, perHour };
  }, [riskMatrix, inViewSats, wxData, leadMin]);

  // ── Alert generation ──────────────────────────────────────────
  useEffect(() => {
    if (!wxData) return;
    const nowRec = !!switchRec;
    // Rising edge only — generate alert when rec becomes newly active
    if (nowRec && !recActiveRef.current) {
      const altGw = GATEWAYS.find(g => g.id === altGwId);
      const alert = {
        alert_id: `ALT-${Date.now()}`,
        gateway_primary_id: "GW-REU",
        gateway_alternate_id: altGwId,
        satellite_ids: switchRec.atRiskSats.map(s => s.name),
        predicted_impact_time: switchRec.impactISO,
        current_time: new Date().toISOString(),
        lead_time_minutes: switchRec.leadMinutes,
        max_cloudcover_pct: +switchRec.maxCC.toFixed(0),
        max_precip_mmh: +switchRec.maxPr.toFixed(2),
        weathercode: switchRec.maxWC,
        contributing_cells: switchRec.allCells,
        recommended_action: "switch_to_alternate_gateway",
        thresholds_used: { cloudcover_pct: cThresh, precip_mmh: pThresh,
          lead_time_min: leadMin, hysteresis_steps: 2 },
      };
      console.log("[mPOWER GW-REU Alert]", alert);
      setAlertLog(prev => [alert, ...prev]);
      // Fire webhook if configured
      if (webhook.trim()) {
        fetch(webhook.trim(), { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify(alert) }).catch(() => {});
      }
    }
    recActiveRef.current = nowRec;
  }, [switchRec, altGwId, cThresh, pThresh, leadMin, webhook, wxData]);

  // ── Helpers ───────────────────────────────────────────────────
  const fmtTime = d => d ? d.toLocaleTimeString() : "—";
  const altGw   = GATEWAYS.find(g => g.id === altGwId);

  // Cell risk state for current hour (for grid display)
  const cellState = useMemo(() => {
    if (!wxData) return {};
    const map = {};
    for (const cd of wxData) {
      const hIdx = currentHourIdx;
      const cc = cd.cloudcover?.[hIdx] ?? 0;
      const pr = cd.precipitation?.[hIdx] ?? 0;
      const wc = cd.weathercode?.[hIdx] ?? 0;
      const risky = cc >= cThresh || pr >= pThresh || (wc >= 80 && wc <= 99);
      const amber = !risky && (cc >= 60 || pr >= 0.5);
      map[cd.id] = { cc, pr, wc, color: risky ? "#ff4444" : amber ? "#ffd700" : "#00ff88",
        status: risky ? "RISK" : amber ? "CAUTION" : "CLEAR" };
    }
    return map;
  }, [wxData, currentHourIdx, cThresh, pThresh]);

  // Chart data for the risk timeline (one entry per forecast hour 0-5)
  const chartData = useMemo(() => {
    return Array.from({length:6}, (_,h) => {
      const row = { h: `T+${h}h` };
      for (const s of inViewSats) {
        row[s.name] = riskMatrix[s.idx]?.[h]?.atRisk ? 1 : 0;
      }
      return row;
    });
  }, [riskMatrix, inViewSats]);

  // SVG cell grid: 3×3 grid 270×270, each cell 80×80 with 5px gap
  const CELL_SZ = 80, CELL_GAP = 5, GRID_OFFSET = 10;
  // Cells: dlat +0.05 = north = row 0 in SVG (top), dlat -0.05 = south = row 2 (bottom)
  // dlon -0.05 = west = col 0, dlon +0.05 = east = col 2
  function cellToSvg(dlat, dlon) {
    const row = dlat >  0.01 ? 0 : dlat < -0.01 ? 2 : 1; // N=top, S=bottom
    const col = dlon < -0.01 ? 0 : dlon >  0.01 ? 2 : 1;
    return { cx: GRID_OFFSET + col*(CELL_SZ+CELL_GAP) + CELL_SZ/2,
             cy: GRID_OFFSET + row*(CELL_SZ+CELL_GAP) + CELL_SZ/2 };
  }
  const SVG_W = GRID_OFFSET*2 + 3*CELL_SZ + 2*CELL_GAP;
  const centerSvg = cellToSvg(0, 0); // SVG center = GW-REU

  const recColor = switchRec ? "#ff4444" : "#00ff88";
  const recLabel = switchRec
    ? `⚠ SWITCH TO ${altGw?.name || altGwId} — lead time ${switchRec.leadMinutes} min`
    : "✔ STAY ON La Réunion (GW-REU) — no weather risk detected";

  return (
    <div style={{fontFamily:"'Courier New',monospace"}}>

      {/* ── Section A: Control Panel ─────────────────────────── */}
      <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",
        padding:"10px 14px",marginBottom:"10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
          {/* Primary GW */}
          <div>
            <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>PRIMARY GATEWAY</div>
            <div style={{color:"#00cfff",fontSize:"11px",fontWeight:"bold"}}>
              La Réunion (GW-REU) — {GW_REU.lat}°, {GW_REU.lon}°
            </div>
          </div>
          {/* Alternate GW */}
          <div>
            <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>ALTERNATE GATEWAY</div>
            <select value={altGwId} onChange={e=>setAltGwId(e.target.value)}
              style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#ff9900",
                padding:"3px 8px",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"}}>
              {GATEWAYS.map(g=>(
                <option key={g.id} value={g.id}>{g.name} ({g.id}) — {g.country}</option>
              ))}
            </select>
          </div>
          {/* Thresholds */}
          <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
            <label style={{color:"#8ab0d0",fontSize:"10px",display:"flex",alignItems:"center",gap:"4px"}}>
              Cloud ≥
              <input type="number" min={0} max={100} value={cThresh}
                onChange={e=>setCThresh(+e.target.value)}
                style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#ffd700",
                  padding:"2px 5px",width:"50px",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"}} />
              %
            </label>
            <label style={{color:"#8ab0d0",fontSize:"10px",display:"flex",alignItems:"center",gap:"4px"}}>
              Precip ≥
              <input type="number" min={0} max={50} step={0.5} value={pThresh}
                onChange={e=>setPThresh(+e.target.value)}
                style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#ffd700",
                  padding:"2px 5px",width:"50px",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"}} />
              mm/h
            </label>
            <label style={{color:"#8ab0d0",fontSize:"10px",display:"flex",alignItems:"center",gap:"4px"}}>
              Lead ≥
              <input type="number" min={0} max={360} value={leadMin}
                onChange={e=>setLeadMin(+e.target.value)}
                style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#ffd700",
                  padding:"2px 5px",width:"50px",borderRadius:"3px",fontSize:"10px",fontFamily:"inherit"}} />
              min
            </label>
          </div>
          {/* Webhook */}
          <div style={{flex:"1 1 220px"}}>
            <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>WEBHOOK URL (optional)</div>
            <input type="text" placeholder="https://…  (blank = disabled)"
              value={webhook} onChange={e=>setWebhook(e.target.value)}
              style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#8ab0d0",
                padding:"3px 8px",width:"100%",borderRadius:"3px",fontSize:"10px",
                fontFamily:"inherit",boxSizing:"border-box"}} />
          </div>
          {/* Status + refresh */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
            <button onClick={fetchWeather} disabled={loading}
              style={{background:"#00cfff22",border:"1px solid #00cfff",color:"#00cfff",
                padding:"3px 10px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"}}>
              {loading ? "⟳ Fetching…" : "⟳ Refresh"}
            </button>
            <div style={{color:"#3a5a7a",fontSize:"8px"}}>
              Last: {lastUpd ? fmtTime(lastUpd) : "—"}
            </div>
          </div>
        </div>
        {wxError && (
          <div style={{marginTop:"8px",background:"#1a0808",border:"1px solid #ff444444",
            borderLeft:"3px solid #ff4444",borderRadius:"3px",padding:"6px 10px",
            color:"#ff4444",fontSize:"10px"}}>
            ⚠ Weather fetch error: {wxError} — risk evaluation disabled. Tabs 1–6 are unaffected.
          </div>
        )}
        {demoMode && (
          <div style={{marginTop:"8px",background:"#0d1a08",border:"1px solid #7fff0044",
            borderLeft:"3px solid #7fff00",borderRadius:"3px",padding:"6px 10px"}}>
            <span style={{color:"#7fff00",fontSize:"10px",fontWeight:"bold"}}>⚡ DEMO MODE</span>
            <span style={{color:"#4a6a8a",fontSize:"9px",marginLeft:"8px"}}>
              Direct Open-Meteo fetch is blocked by the sandbox CSP and API proxy returned no parseable JSON.
              Showing synthetic La Réunion weather data — risk event at T+2h–T+4h in the centre and cardinal cells (C(+0,+0), N, S, E, W), guaranteed to intersect every satellite LOS regardless of simTime. Eastern cells show caution for spatial variety.
            In a production deployment, direct fetch will succeed.
            </span>
          </div>
        )}
      </div>

      {/* ── Section B: Grid + LOS map ────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"10px",marginBottom:"10px",alignItems:"start"}}>

        {/* 3×3 Cell SVG grid */}
        <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",padding:"10px"}}>
          <div style={{color:"#4a6a8a",fontSize:"9px",marginBottom:"6px",letterSpacing:"0.05em"}}>
            3×3 WEATHER CELL GRID — La Réunion
          </div>
          <svg width={SVG_W} height={SVG_W} style={{display:"block"}}>
            {/* Compass labels */}
            <text x={SVG_W/2} y={8}  textAnchor="middle" fill="#2a4060" fontSize="9" fontFamily="Courier New">N</text>
            <text x={SVG_W/2} y={SVG_W-2} textAnchor="middle" fill="#2a4060" fontSize="9" fontFamily="Courier New">S</text>
            <text x={4}       y={SVG_W/2+4} textAnchor="middle" fill="#2a4060" fontSize="9" fontFamily="Courier New">W</text>
            <text x={SVG_W-4} y={SVG_W/2+4} textAnchor="middle" fill="#2a4060" fontSize="9" fontFamily="Courier New">E</text>

            {/* 9 cells */}
            {WEATHER_CELLS.map(c => {
              const { cx, cy } = cellToSvg(c.dlat, c.dlon);
              const st  = cellState[c.id];
              const col = st?.color ?? "#1e3055";
              const isCenter = c.dlat === 0 && c.dlon === 0;
              return (
                <g key={c.id} style={{cursor:"pointer"}}
                  onMouseEnter={() => setCellTip({...c, ...(st||{})})}
                  onMouseLeave={() => setCellTip(null)}>
                  <rect x={cx-CELL_SZ/2} y={cy-CELL_SZ/2} width={CELL_SZ} height={CELL_SZ}
                    rx="4" fill={col+"22"} stroke={col} strokeWidth={isCenter?2:1} />
                  {/* Cell ID */}
                  <text x={cx} y={cy-14} textAnchor="middle" fill={col} fontSize="7"
                    fontFamily="Courier New">{c.id}</text>
                  {/* Status */}
                  <text x={cx} y={cy+4} textAnchor="middle" fill={col} fontSize="9"
                    fontFamily="Courier New" fontWeight="bold">{st?.status ?? "—"}</text>
                  {/* Cloud% */}
                  {st && <text x={cx} y={cy+16} textAnchor="middle" fill="#4a6a8a" fontSize="8"
                    fontFamily="Courier New">☁ {st.cc?.toFixed(0)}%</text>}
                  {/* GW-REU marker at center */}
                  {isCenter && <>
                    <rect x={cx-5} y={cy+19} width={10} height={10} fill="#00cfff" />
                    <text x={cx} y={cy+37} textAnchor="middle" fill="#00cfff" fontSize="7"
                      fontFamily="Courier New">GW-REU</text>
                  </>}
                </g>
              );
            })}

            {/* LOS lines from center to each in-view satellite */}
            {inViewSats.map(s => {
              const risk0 = riskMatrix[s.idx]?.[0]?.atRisk;
              const azRad = toRad(s.az - 90); // SVG: 0=right, satellite az 0=N → offset -90
              // Project line from center to SVG edge in that direction
              const len = SVG_W * 0.45;
              const x2  = centerSvg.cx + len * Math.cos(azRad);
              const y2  = centerSvg.cy + len * Math.sin(azRad);
              const col = risk0 ? "#ff4444" : "#00ff88";
              return (
                <g key={s.idx}>
                  <line x1={centerSvg.cx} y1={centerSvg.cy} x2={x2} y2={y2}
                    stroke={col} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
                  <circle cx={x2} cy={y2} r="4" fill={col} />
                  <text x={x2+6} y={y2+4} fill={col} fontSize="8"
                    fontFamily="Courier New">{s.name}</text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{marginTop:"6px",display:"flex",gap:"10px"}}>
            {[["#00ff88","CLEAR"],["#ffd700","CAUTION"],["#ff4444","RISK"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <div style={{width:"10px",height:"10px",background:c+"33",border:`1px solid ${c}`,borderRadius:"2px"}}/>
                <span style={{color:"#4a6a8a",fontSize:"8px"}}>{l}</span>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
              <div style={{width:"20px",height:"1.5px",background:"#00ff88",borderTop:"1.5px dashed #00ff88"}}/>
              <span style={{color:"#4a6a8a",fontSize:"8px"}}>LOS clear</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
              <div style={{width:"20px",height:"1.5px",background:"#ff4444",borderTop:"1.5px dashed #ff4444"}}/>
              <span style={{color:"#4a6a8a",fontSize:"8px"}}>LOS at risk</span>
            </div>
          </div>

          {/* Cell hover tooltip */}
          {cellTip && (
            <div style={{marginTop:"6px",background:"#0d1a2a",border:`1px solid ${cellTip.color}66`,
              borderLeft:`2px solid ${cellTip.color}`,borderRadius:"3px",padding:"6px 10px",fontSize:"9px"}}>
              <div style={{color:cellTip.color,fontWeight:"bold",marginBottom:"3px"}}>{cellTip.id}</div>
              <div style={{color:"#8ab0d0"}}>{cellTip.lat?.toFixed(5)}°, {cellTip.lon?.toFixed(5)}°</div>
              <div style={{color:"#8ab0d0"}}>Cloud: {cellTip.cc?.toFixed(0)}% · Rain: {cellTip.pr?.toFixed(1)} mm/h · WMO: {cellTip.wc}</div>
              <div style={{color:cellTip.color,fontWeight:"bold"}}>{cellTip.status}</div>
            </div>
          )}
        </div>

        {/* In-view satellite table + current cell summary */}
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {/* In-view sats */}
          <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",padding:"10px"}}>
            <div style={{color:"#4a6a8a",fontSize:"9px",marginBottom:"6px",letterSpacing:"0.05em"}}>
              IN-VIEW SATELLITES FROM GW-REU (EL ≥ 5°)
            </div>
            {inViewSats.length === 0 ? (
              <div style={{color:"#3a5a7a",fontSize:"10px",fontStyle:"italic"}}>No satellites in view</div>
            ) : (
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {inViewSats.map(s => {
                  const risk0 = riskMatrix[s.idx]?.[0]?.atRisk;
                  const col   = risk0 ? "#ff4444" : "#00ff88";
                  return (
                    <div key={s.idx} style={{background:"#060d18",border:`1px solid ${col}44`,
                      borderLeft:`3px solid ${col}`,borderRadius:"3px",padding:"5px 10px",minWidth:"120px"}}>
                      <div style={{color:SAT_COLORS[s.idx],fontSize:"10px",fontWeight:"bold"}}>{s.name}</div>
                      <div style={{color:"#8ab0d0",fontSize:"9px"}}>EL {s.el.toFixed(1)}° · AZ {s.az.toFixed(0)}°</div>
                      <div style={{color:col,fontSize:"9px",fontWeight:"bold"}}>{risk0?"⚠ AT RISK":"✔ CLEAR"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weather data status per cell (compact) */}
          {wxData && (
            <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",padding:"10px"}}>
              <div style={{color:"#4a6a8a",fontSize:"9px",marginBottom:"6px",letterSpacing:"0.05em"}}>
                CURRENT HOUR CELL DATA (T+{currentHourIdx}h UTC)
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"4px"}}>
                {/* Render cells in N→S, W→E order */}
                {[+CELL_D, 0, -CELL_D].map(dlat =>
                  [-CELL_D, 0, +CELL_D].map(dlon => {
                    const key = `C(${dlat>=0?"+":""}${dlat},${dlon>=0?"+":""}${dlon})`;
                    const st  = cellState[key];
                    if (!st) return <div key={key}/>;
                    return (
                      <div key={key} style={{background:`${st.color}15`,border:`1px solid ${st.color}44`,
                        borderRadius:"3px",padding:"3px 5px",textAlign:"center"}}>
                        <div style={{color:"#3a5a7a",fontSize:"7px"}}>{key}</div>
                        <div style={{color:st.color,fontSize:"9px",fontWeight:"bold"}}>
                          ☁{st.cc.toFixed(0)}% 💧{st.pr.toFixed(1)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {!wxData && !loading && !wxError && (
            <div style={{color:"#3a5a7a",fontSize:"10px",padding:"10px",textAlign:"center"}}>Awaiting weather data…</div>
          )}
        </div>
      </div>

      {/* ── Section C: Timeline + Recommendation + Alert Log ─── */}

      {/* Recommendation strip */}
      <div style={{background: switchRec ? "#1a0808" : "#081a0a",
        border:`1px solid ${recColor}44`, borderLeft:`4px solid ${recColor}`,
        borderRadius:"4px",padding:"10px 14px",marginBottom:"10px",
        display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"18px"}}>{switchRec ? "⚠" : "✔"}</span>
        <div style={{flex:1}}>
          <div style={{color:recColor,fontSize:"11px",fontWeight:"bold"}}>{recLabel}</div>
          {switchRec && (
            <div style={{color:"#8ab0d0",fontSize:"9px",marginTop:"2px"}}>
              Affecting: {switchRec.atRiskSats.map(s=>s.name).join(", ")} ·
              Cells: {switchRec.allCells.join(", ")} ·
              Peak cloud: {switchRec.maxCC.toFixed(0)}% · Peak precip: {switchRec.maxPr.toFixed(1)} mm/h
            </div>
          )}
        </div>
        {switchRec && (
          <div style={{background:"#ff444422",border:"1px solid #ff4444",borderRadius:"3px",
            padding:"4px 10px",textAlign:"center"}}>
            <div style={{color:"#ff4444",fontSize:"18px",fontWeight:"bold",lineHeight:1}}>
              {switchRec.leadMinutes}
            </div>
            <div style={{color:"#ff4444",fontSize:"8px"}}>min lead</div>
          </div>
        )}
      </div>

      {/* Risk timeline chart */}
      {wxData && inViewSats.length > 0 && (
        <div style={{marginBottom:"10px",background:"#080f1a",border:"1px solid #1e3055",
          borderRadius:"4px",padding:"10px"}}>
          <div style={{color:"#4a6a8a",fontSize:"9px",marginBottom:"8px",letterSpacing:"0.05em"}}>
            LOS RISK TIMELINE — NEXT 6 FORECAST HOURS (1 = at risk, 0 = clear)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{top:4,right:20,bottom:16,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
              <XAxis dataKey="h" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}/>
              <YAxis domain={[0,1]} ticks={[0,1]} stroke="#2e4270"
                tick={{fill:"#4a6a8a",fontSize:9}}
                tickFormatter={v=>v===1?"RISK":"CLEAR"}/>
              <Tooltip contentStyle={{background:"#080f1a",border:"1px solid #2e4270",
                fontSize:"10px",fontFamily:"Courier New"}}
                formatter={(v,n)=>[v===1?"AT RISK":"CLEAR",n]}/>
              <Legend wrapperStyle={{fontSize:"9px",color:"#4a6a8a"}}/>
              <ReferenceLine y={0.5} stroke="#2e4270" strokeDasharray="4 2"/>
              {inViewSats.map((s,i) => (
                <Line key={s.idx} type="step" dataKey={s.name}
                  stroke={SAT_COLORS[s.idx]} strokeWidth={2} dot={false} name={s.name}/>
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* 6-hour recommendation bar */}
          {switchRec && (
            <div style={{marginTop:"6px"}}>
              <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"3px"}}>GATEWAY RECOMMENDATION BAR</div>
              <div style={{display:"flex",height:"16px",borderRadius:"3px",overflow:"hidden",
                border:"1px solid #1e3055",position:"relative"}}>
                {Array.from({length:6},(_,h) => {
                  const risky = switchRec.perHour[h];
                  return (
                    <div key={h} style={{flex:1,background: risky?"#ff444455":"#00ff8833",
                      borderRight:"1px solid #1e3055",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:"7px",color:risky?"#ff4444":"#00ff88",fontWeight:"bold"}}>
                        {risky?"⚠":"✔"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"2px"}}>
                {Array.from({length:7},(_,i)=>(
                  <span key={i} style={{color:"#3a5a7a",fontSize:"7px"}}>T+{i}h</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert log */}
      <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"4px",padding:"10px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
          <div style={{color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em"}}>
            ALERT LOG ({alertLog.length})
          </div>
          {alertLog.length > 0 && (
            <button onClick={()=>setAlertLog([])}
              style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",
                padding:"1px 8px",borderRadius:"3px",cursor:"pointer",fontSize:"9px",fontFamily:"inherit"}}>
              clear
            </button>
          )}
        </div>
        {alertLog.length === 0 ? (
          <div style={{color:"#3a5a7a",fontSize:"10px",fontStyle:"italic",padding:"6px 0"}}>
            No alerts generated. Alerts appear here when a switch recommendation is raised.
          </div>
        ) : (
          <div style={{maxHeight:"200px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"5px"}}>
            {alertLog.map(a => (
              <div key={a.alert_id} style={{background:"#0d1a2a",border:"1px solid #ff444444",
                borderLeft:"3px solid #ff4444",borderRadius:"3px",padding:"6px 10px",
                display:"flex",gap:"10px",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"2px"}}>
                    <span style={{color:"#ff4444",fontSize:"9px",fontWeight:"bold"}}>{a.alert_id}</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>{new Date(a.current_time).toLocaleTimeString()}</span>
                    <span style={{color:"#ffd700",fontSize:"9px"}}>lead {a.lead_time_minutes} min</span>
                    <span style={{color:"#8ab0d0",fontSize:"9px"}}>→ {a.gateway_alternate_id}</span>
                  </div>
                  <div style={{color:"#8ab0d0",fontSize:"9px"}}>
                    Sats: {a.satellite_ids.join(", ")} ·
                    Cloud: {a.max_cloudcover_pct}% · Rain: {a.max_precip_mmh} mm/h ·
                    Cells: {a.contributing_cells.join(", ")}
                  </div>
                </div>
                <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(a,null,2))}
                  style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",
                    padding:"2px 7px",borderRadius:"3px",cursor:"pointer",fontSize:"9px",
                    fontFamily:"inherit",flexShrink:0}}>
                  Copy JSON
                </button>
              </div>
            ))}
          </div>
        )}
        {!wxData && !loading && (
          <div style={{color:"#3a5a7a",fontSize:"9px",marginTop:"4px",fontStyle:"italic"}}>
            PoC note: wind advection applied as nearest-cell lookup. For production, upgrade to HRRR or Xweather with sub-km radar data.
          </div>
        )}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
const F_DL     = 19.95e9;
const C_LIGHT  = 3e8;
const EIRP_DBW = 68;
const GT_DB    = 14.5;
const BW_MHZ   = 216;
const K_DB     = -228.6;

function linkBudget(elDeg) {
  const d_m  = slantRange(elDeg) * 1000;
  const FSPL = 20 * Math.log10(4 * Math.PI * d_m * F_DL / C_LIGHT);
  const loss = FSPL + 0.5 + 2.5 + 1.0;
  const C_No = EIRP_DBW - loss + GT_DB - K_DB;
  const C_N  = C_No - 10 * Math.log10(BW_MHZ * 1e6);
  const cap  = BW_MHZ * Math.log2(1 + Math.pow(10, C_N / 10));
  return {
    d_km: slantRange(elDeg).toFixed(0),
    fspl: FSPL.toFixed(1),
    loss: loss.toFixed(1),
    C_No: C_No.toFixed(1),
    C_N:  C_N.toFixed(1),
    cap:  Math.max(0, cap).toFixed(0),
  };
}

// ═══════════════════════════════════════════════════════════════
// MODULE B — ThinKom Ka2517 ANTENNA MODEL
// ═══════════════════════════════════════════════════════════════
const CRUISE_ALT_KM  = 3.048;   // 10,000 ft fixed
const ATM_LOSS_FL_DB = 0.3;     // Clear-sky FL atmospheric loss
const ATM_LOSS_RL_DB = 0.3;     // Clear-sky RL atmospheric loss
const MIN_SERVICE_EL_DEFAULT = 20.0; // Ka2517 minimum elevation default (user-configurable)
const F_UL           = 29.0e9;  // Return link frequency

function slantRangeAviation(elDeg) {
  const el = toRad(elDeg);
  const Rp = Re + CRUISE_ALT_KM;
  const sinEl = Math.sin(el), cosEl = Math.cos(el);
  return Math.sqrt(Rs*Rs - Rp*Rp*cosEl*cosEl) - Rp*sinEl;
}

function ka2517ScanLoss(thetaScanDeg, n=1.5) {
  if (thetaScanDeg <= 0) return 0;
  const theta = toRad(Math.min(thetaScanDeg, 85));
  return 12 * Math.pow(Math.sin(theta), n);
}

function ka2517GT(elDeg, gtPeak=18.5) {
  const scanAngle = 90 - elDeg;
  return gtPeak - ka2517ScanLoss(scanAngle);
}

function ka2517TxEirp(elDeg, eirpPeak=55.5, psdBackoffDb=0) {
  const scanAngle = 90 - elDeg;
  return eirpPeak - ka2517ScanLoss(scanAngle) - psdBackoffDb;
}

function psdBackoff(skewDeg) {
  const s = Math.abs(skewDeg);
  if (s < 10) return 0;
  if (s < 30) return 0.5;
  if (s < 50) return 1.5;
  if (s < 70) return 3.0;
  return 5.0;
}

// ═══════════════════════════════════════════════════════════════
// COMBINED SCAN × SKEW LINK CONDITION TABLE
// 9 conditions: 3 skew polarities × 3 elevation zones
// ═══════════════════════════════════════════════════════════════
const LINK_CONDITIONS = {
  //                     elRange     scanRange    scanLoss          leftASI    rightASI   impairment                    cnQuality                          backoff              modcod              fwdTP                   rtnTP                            worstLink          severity
  "pos-HIGH": { zone:"HIGH", elRange:"40°–85°", scanRange:"5°–50°",  scanLoss:"Low (<3 dB)",    leftASI:"High",   rightASI:"High",   impairment:"ASI",              cnQuality:"Degraded by interference",       backoff:"Required",          modcod:"8PSK or lower",      fwdTP:"Reduced (~33% hit)", rtnTP:"Reduced",                         worstLink:"FWD",         severity:"warning"  },
  "pos-MID":  { zone:"MID",  elRange:"25°–40°", scanRange:"50°–65°", scanLoss:"Medium (3–5 dB)",leftASI:"High",   rightASI:"High",   impairment:"Both compound",    cnQuality:"Degraded most — double hit",     backoff:"Required + heavy",  modcod:"Lowest available",   fwdTP:"Worst case",         rtnTP:"Worst case",                      worstLink:"FWD + RTN",   severity:"critical" },
  "pos-LOW":  { zone:"LOW",  elRange:"15°–25°", scanRange:"65°–75°", scanLoss:"High (5–9 dB)",  leftASI:"Medium", rightASI:"Medium", impairment:"Scan loss",        cnQuality:"Very low — scan dominates",      backoff:"Required",          modcod:"QPSK floor",         fwdTP:"Critical",           rtnTP:"Critical — backoff compounds scan", worstLink:"RTN",         severity:"critical" },
  "zero-HIGH":{ zone:"HIGH", elRange:"40°–85°", scanRange:"5°–50°",  scanLoss:"Low (<3 dB)",    leftASI:"Low",    rightASI:"Low",    impairment:"None significant", cnQuality:"Cleanest for elevation",         backoff:"None",              modcod:"16APSK+",            fwdTP:"Optimal",            rtnTP:"Optimal",                         worstLink:"Neither",     severity:"good"     },
  "zero-MID": { zone:"MID",  elRange:"25°–40°", scanRange:"50°–65°", scanLoss:"Medium (3–5 dB)",leftASI:"Low",    rightASI:"Low",    impairment:"Scan loss only",   cnQuality:"Moderate",                       backoff:"None",              modcod:"8PSK–16APSK",        fwdTP:"Good",               rtnTP:"Good",                            worstLink:"Neither",     severity:"ok"       },
  "zero-LOW": { zone:"LOW",  elRange:"15°–25°", scanRange:"65°–75°", scanLoss:"High (5–9 dB)",  leftASI:"Low",    rightASI:"Low",    impairment:"Scan loss",        cnQuality:"Scan-constrained",               backoff:"None",              modcod:"QPSK–8PSK",          fwdTP:"Limited",            rtnTP:"Limited",                         worstLink:"Neither",     severity:"warning"  },
  "neg-HIGH": { zone:"HIGH", elRange:"40°–85°", scanRange:"5°–50°",  scanLoss:"Low (<3 dB)",    leftASI:"Low",    rightASI:"Low",    impairment:"None significant", cnQuality:"Near-ideal",                     backoff:"None",              modcod:"32APSK best case",   fwdTP:"Best",               rtnTP:"Best",                            worstLink:"Neither",     severity:"good"     },
  "neg-MID":  { zone:"MID",  elRange:"25°–40°", scanRange:"50°–65°", scanLoss:"Medium (3–5 dB)",leftASI:"Low",    rightASI:"Low",    impairment:"Scan loss only",   cnQuality:"Moderate — geometry helps",      backoff:"None",              modcod:"8PSK–16APSK",        fwdTP:"Good",               rtnTP:"Good",                            worstLink:"Neither",     severity:"ok"       },
  "neg-LOW":  { zone:"LOW",  elRange:"15°–25°", scanRange:"65°–75°", scanLoss:"High (5–9 dB)",  leftASI:"Low",    rightASI:"Low",    impairment:"Scan loss",        cnQuality:"Scan-constrained",               backoff:"None",              modcod:"QPSK–8PSK",          fwdTP:"Scan floor",         rtnTP:"Scan floor",                      worstLink:"FWD (modcod floor)", severity:"warning" },
};

const SEVERITY_COLOR = { critical:"#ff4444", warning:"#ffd700", ok:"#7fff00", good:"#00ff88" };

// ═══════════════════════════════════════════════════════════════
// MODULE C — DVB-S2X MODCOD + AVIATION LINK BUDGET
// ═══════════════════════════════════════════════════════════════
const DVB_S2X_MODCODS = [
  { label:"QPSK 1/4",     minCN:-2.85, eff:0.49, color:"#ff4444" },
  { label:"QPSK 1/2",     minCN: 1.00, eff:0.99, color:"#ff6b35" },
  { label:"QPSK 3/4",     minCN: 4.03, eff:1.49, color:"#ffd700" },
  { label:"8PSK 2/3",     minCN: 6.62, eff:1.98, color:"#ffbf00" },
  { label:"16APSK 2/3",   minCN: 8.97, eff:2.64, color:"#7fff00" },
  { label:"16APSK 3/4",   minCN:10.21, eff:2.97, color:"#00ff88" },
  { label:"32APSK 3/4",   minCN:12.73, eff:3.70, color:"#00cfff" },
  { label:"32APSK 4/5",   minCN:13.64, eff:3.95, color:"#00ced1" },
  { label:"32APSK 9/10",  minCN:15.69, eff:4.45, color:"#b07aff" },
];

function dvbS2xModcod(cnDb) {
  let best = null;
  for (const mc of DVB_S2X_MODCODS) {
    if (cnDb >= mc.minCN) best = mc;
  }
  return best; // null = link closed
}

function linkBudgetFL(elDeg, useKa2517=false) {
  const d_m = (useKa2517 ? slantRangeAviation(elDeg) : slantRange(elDeg)) * 1000;
  const FSPL = 20 * Math.log10(4 * Math.PI * d_m * F_DL / C_LIGHT);
  const gt = useKa2517 ? ka2517GT(elDeg) : GT_DB;
  const loss = FSPL + ATM_LOSS_FL_DB + 2.5 + 1.0; // atm + rain(0) + misc
  const C_No = EIRP_DBW - loss + gt - K_DB;
  const C_N  = C_No - 10 * Math.log10(BW_MHZ * 1e6);
  const modcod = dvbS2xModcod(C_N);
  return { C_N: +C_N.toFixed(1), modcod, d_km: +(d_m/1000).toFixed(0) };
}

function linkBudgetRL(elDeg, useKa2517=false, satGtDbk=12.0) {
  const d_m = (useKa2517 ? slantRangeAviation(elDeg) : slantRange(elDeg)) * 1000;
  const FSPL = 20 * Math.log10(4 * Math.PI * d_m * F_UL / C_LIGHT);
  const eirp = useKa2517 ? ka2517TxEirp(elDeg) : 55.5;
  const loss = FSPL + ATM_LOSS_RL_DB + 1.0;
  const C_No = eirp - loss + satGtDbk - K_DB;
  const C_N  = C_No - 10 * Math.log10(BW_MHZ * 1e6);
  const modcod = dvbS2xModcod(C_N);
  return { C_N: +C_N.toFixed(1), modcod };
}

function bwRequiredMhz(cirMbps, cnDb) {
  const mc = dvbS2xModcod(cnDb);
  if (!mc) return null; // link closed
  return Math.ceil(cirMbps / mc.eff);
}

// ═══════════════════════════════════════════════════════════════
// D3 CANVAS MAP — zoom + pan + pin-drop
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// GATEWAY MANAGER COMPONENT
// ═══════════════════════════════════════════════════════════════
function GatewayManagerTab({ activeGwIds, setActiveGwIds, simTime, numSats, gwMinEl }) {
  const [customName,    setCustomName]    = useState("");
  const [customLat,     setCustomLat]     = useState("");
  const [customLon,     setCustomLon]     = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customOp,      setCustomOp]      = useState("");
  const [customGws,     setCustomGws]     = useState([]); // user-added gateways
  const [addError,      setAddError]      = useState("");
  const [hoveredGw,     setHoveredGw]     = useState(null);

  // All gateways the manager knows about (standard + optional pool + user-added)
  const allKnown = useMemo(() => [
    ...GATEWAYS.map(g => ({ ...g, source:"standard" })),
    ...OPTIONAL_GATEWAYS.map(g => ({ ...g, source:"optional" })),
    ...customGws.map(g => ({ ...g, source:"custom" })),
  ], [customGws]);

  // Toggle a single gateway
  const toggle = (id) => {
    setActiveGwIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Select / deselect all in a group
  const setGroup = (ids, on) => {
    setActiveGwIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => on ? next.add(id) : next.delete(id));
      return next;
    });
  };

  // Live elevation from each gateway to each visible satellite
  const gwElevations = useMemo(() => {
    const out = {};
    for (const gw of allKnown) {
      const els = [];
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(gw.lat, gw.lon, satLon(s, simTime, numSats));
        if (el >= gwMinEl) els.push({ s, el: +el.toFixed(1) });
      }
      els.sort((a, b) => b.el - a.el);
      out[gw.id] = els;
    }
    return out;
  }, [simTime, numSats, allKnown, gwMinEl]);

  // Add a custom gateway
  const addCustom = () => {
    setAddError("");
    const lat = parseFloat(customLat), lon = parseFloat(customLon);
    if (!customName.trim()) { setAddError("Name is required."); return; }
    if (isNaN(lat) || lat < -90 || lat > 90) { setAddError("Latitude must be −90 to +90."); return; }
    if (isNaN(lon) || lon < -180 || lon > 180) { setAddError("Longitude must be −180 to +180."); return; }
    if (Math.abs(lat) > 55) { setAddError("Warning: mPOWER coverage ends near ±50°. Gateway may have limited visibility."); }
    const id = `GW-USR${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const gw = { id, name: customName.trim(), country: customCountry.trim() || "—",
      lat, lon, operator: customOp.trim() || "Custom", azure: false, optional: true };
    setCustomGws(prev => [...prev, gw]);
    setActiveGwIds(prev => new Set([...prev, id]));
    setCustomName(""); setCustomLat(""); setCustomLon(""); setCustomCountry(""); setCustomOp("");
  };

  const removeCustom = (id) => {
    setCustomGws(prev => prev.filter(g => g.id !== id));
    setActiveGwIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const standardIds   = GATEWAYS.map(g => g.id);
  const optionalIds   = OPTIONAL_GATEWAYS.map(g => g.id);
  const customIds     = customGws.map(g => g.id);
  const activeCount   = activeGwIds.size;

  const SOURCE_COLORS = { standard:"#ff9900", optional:"#00cfff", custom:"#b07aff" };

  const GwCard = ({ gw }) => {
    const active = activeGwIds.has(gw.id);
    const els    = gwElevations[gw.id] || [];
    const bestEl = els[0];
    const col    = SOURCE_COLORS[gw.source] || "#ff9900";
    const latStr = `${Math.abs(gw.lat).toFixed(3)}°${gw.lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(gw.lon).toFixed(3)}°${gw.lon >= 0 ? "E" : "W"}`;

    return (
      <div
        style={{
          background: active ? "#080f1a" : "#050a12",
          border: `1px solid ${active ? col+"66" : "#1e3055"}`,
          borderLeft: `3px solid ${active ? col : "#2e4270"}`,
          borderRadius: "4px", padding: "8px 10px",
          opacity: active ? 1 : 0.5,
          transition: "opacity 0.15s, border-color 0.15s",
          cursor: "pointer", userSelect: "none",
          position: "relative",
        }}
        onClick={() => toggle(gw.id)}
        onMouseEnter={() => setHoveredGw(gw.id)}
        onMouseLeave={() => setHoveredGw(null)}
      >
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px" }}>
          <div style={{
            width:"12px", height:"12px",
            background: active ? col+"44" : "transparent",
            border: `2px solid ${active ? col : "#2e4270"}`,
            borderRadius:"2px", flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {active && <span style={{color:col, fontSize:"9px", lineHeight:1}}>✔</span>}
          </div>
          <span style={{color: active ? col : "#4a6a8a", fontSize:"11px", fontWeight:"bold"}}>{gw.name}</span>
          <span style={{color:"#3a5a7a", fontSize:"8px", marginLeft:"auto"}}>{gw.id}</span>
        </div>

        {/* Coords + meta */}
        <div style={{color:"#4a6a8a", fontSize:"8px", marginBottom:"4px"}}>
          {latStr} · {lonStr} · {gw.country}
        </div>
        <div style={{display:"flex", gap:"5px", alignItems:"center", flexWrap:"wrap"}}>
          <span style={{
            background:`${col}18`, border:`1px solid ${col}44`,
            color:col, fontSize:"7px", padding:"1px 5px", borderRadius:"2px",
          }}>
            {gw.source === "standard" ? "STANDARD" : gw.source === "optional" ? "OPTIONAL" : "CUSTOM"}
          </span>
          {gw.azure && <span style={{background:"#0078d418", border:"1px solid #0078d4",
            color:"#0078d4", fontSize:"7px", padding:"1px 5px", borderRadius:"2px"}}>Azure</span>}
          {gw.operator && gw.operator !== "Custom" && <span style={{color:"#3a5a7a", fontSize:"7px"}}>{gw.operator}</span>}
          {gw.note && <span style={{color:"#2a4060", fontSize:"7px", fontStyle:"italic"}}>{gw.note}</span>}
        </div>

        {/* Live elevation to best satellite */}
        {active && (
          <div style={{marginTop:"5px", borderTop:"1px solid #1e3055", paddingTop:"4px",
            display:"flex", gap:"5px", flexWrap:"wrap"}}>
            {els.length === 0
              ? <span style={{color:"#3a5a7a", fontSize:"8px"}}>No satellites in view (EL &lt; 5°)</span>
              : els.slice(0,4).map(e => (
                  <span key={e.s} style={{
                    background: e.el >= 30 ? "#00ff8820" : e.el >= 15 ? "#ffd70020" : "#ff6b3520",
                    border: `1px solid ${e.el >= 30 ? "#00ff8866" : e.el >= 15 ? "#ffd70066" : "#ff6b3566"}`,
                    color: e.el >= 30 ? "#00ff88" : e.el >= 15 ? "#ffd700" : "#ff6b35",
                    fontSize:"8px", padding:"1px 5px", borderRadius:"2px",
                  }}>
                    S{e.s+1} {e.el}°
                  </span>
                ))
            }
          </div>
        )}

        {/* Remove button for custom gateways */}
        {gw.source === "custom" && (
          <button onClick={e => { e.stopPropagation(); removeCustom(gw.id); }}
            style={{position:"absolute", top:"6px", right:"6px",
              background:"transparent", border:"none", color:"#3a5a7a",
              cursor:"pointer", fontSize:"13px", lineHeight:1, padding:"0 2px"}}
            title="Remove custom gateway">×</button>
        )}
      </div>
    );
  };

  return (
    <div style={{fontFamily:"'Courier New',monospace"}}>

      {/* ── Header + active count ── */}
      <div style={{display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px",
        borderBottom:"1px solid #2e4270", paddingBottom:"8px", flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{color:"#c0d8f0", fontSize:"12px", fontWeight:"bold"}}>GATEWAY MANAGER</div>
          <div style={{color:"#3a5a7a", fontSize:"9px", marginTop:"2px"}}>
            Select which gateways are included in handover analysis, flight simulation, and coverage map.
            Changes take effect immediately across all tabs.
          </div>
        </div>
        <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
          <div style={{background:"#080f1a", border:"1px solid #ff990044", borderLeft:"3px solid #ff9900",
            borderRadius:"3px", padding:"5px 12px", textAlign:"center"}}>
            <div style={{color:"#ff9900", fontSize:"20px", fontWeight:"bold", lineHeight:1}}>{activeCount}</div>
            <div style={{color:"#3a5a7a", fontSize:"8px"}}>active</div>
          </div>
          <div style={{background:"#080f1a", border:"1px solid #2e4270",
            borderRadius:"3px", padding:"5px 12px", textAlign:"center"}}>
            <div style={{color:"#8ab0d0", fontSize:"20px", fontWeight:"bold", lineHeight:1}}>{allKnown.length}</div>
            <div style={{color:"#3a5a7a", fontSize:"8px"}}>total</div>
          </div>
        </div>
      </div>

      {/* ── Colour key ── */}
      <div style={{display:"flex", gap:"12px", marginBottom:"12px", flexWrap:"wrap"}}>
        {[["#ff9900","Standard (12-site network)"],["#00cfff","Optional (pre-defined)"],["#b07aff","Custom (user-added)"]].map(([c,l])=>(
          <div key={l} style={{display:"flex", alignItems:"center", gap:"5px"}}>
            <div style={{width:"10px", height:"10px", background:`${c}33`, border:`1.5px solid ${c}`, borderRadius:"2px"}}/>
            <span style={{color:"#4a6a8a", fontSize:"9px"}}>{l}</span>
          </div>
        ))}
        <div style={{marginLeft:"auto", display:"flex", gap:"5px"}}>
          {[["#00ff88","≥30°"],["#ffd700","15–29°"],["#ff6b35","5–14°"]].map(([c,l])=>(
            <span key={l} style={{background:`${c}20`, border:`1px solid ${c}66`,
              color:c, fontSize:"7px", padding:"1px 6px", borderRadius:"2px"}}>{l}</span>
          ))}
          <span style={{color:"#3a5a7a", fontSize:"7px", alignSelf:"center"}}>live EL</span>
        </div>
      </div>

      {/* ── Standard gateways ── */}
      <div style={{marginBottom:"14px"}}>
        <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"7px"}}>
          <div style={{color:"#ff9900", fontSize:"10px", fontWeight:"bold", letterSpacing:"0.05em"}}>
            STANDARD GATEWAYS — 12-SITE mPOWER NETWORK
          </div>
          <div style={{marginLeft:"auto", display:"flex", gap:"4px"}}>
            <button onClick={() => setGroup(standardIds, true)}
              style={{background:"#ff990022", border:"1px solid #ff990066", color:"#ff9900",
                padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
              All on
            </button>
            <button onClick={() => setGroup(standardIds, false)}
              style={{background:"transparent", border:"1px solid #2e4270", color:"#4a6a8a",
                padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
              All off
            </button>
          </div>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"6px"}}>
          {GATEWAYS.map(g => <GwCard key={g.id} gw={{...g, source:"standard"}} />)}
        </div>
      </div>

      {/* ── Optional gateways ── */}
      <div style={{marginBottom:"14px"}}>
        <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"7px"}}>
          <div style={{color:"#00cfff", fontSize:"10px", fontWeight:"bold", letterSpacing:"0.05em"}}>
            OPTIONAL GATEWAYS — PRE-DEFINED LOCATIONS
          </div>
          <div style={{marginLeft:"auto", display:"flex", gap:"4px"}}>
            <button onClick={() => setGroup(optionalIds, true)}
              style={{background:"#00cfff22", border:"1px solid #00cfff66", color:"#00cfff",
                padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
              All on
            </button>
            <button onClick={() => setGroup(optionalIds, false)}
              style={{background:"transparent", border:"1px solid #2e4270", color:"#4a6a8a",
                padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
              All off
            </button>
          </div>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"6px"}}>
          {OPTIONAL_GATEWAYS.map(g => <GwCard key={g.id} gw={{...g, source:"optional"}} />)}
        </div>
      </div>

      {/* ── Custom gateways ── */}
      <div style={{marginBottom:"14px"}}>
        <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"7px"}}>
          <div style={{color:"#b07aff", fontSize:"10px", fontWeight:"bold", letterSpacing:"0.05em"}}>
            CUSTOM GATEWAYS — USER-DEFINED LOCATIONS
          </div>
          {customGws.length > 0 && (
            <div style={{marginLeft:"auto", display:"flex", gap:"4px"}}>
              <button onClick={() => setGroup(customIds, true)}
                style={{background:"#b07aff22", border:"1px solid #b07aff66", color:"#b07aff",
                  padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
                All on
              </button>
              <button onClick={() => setGroup(customIds, false)}
                style={{background:"transparent", border:"1px solid #2e4270", color:"#4a6a8a",
                  padding:"2px 8px", borderRadius:"3px", cursor:"pointer", fontSize:"9px", fontFamily:"inherit"}}>
                All off
              </button>
            </div>
          )}
        </div>

        {customGws.length > 0 && (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"6px", marginBottom:"8px"}}>
            {customGws.map(g => <GwCard key={g.id} gw={{...g, source:"custom"}} />)}
          </div>
        )}

        {/* Add custom gateway form */}
        <div style={{background:"#080f1a", border:"1px solid #b07aff33",
          borderRadius:"4px", padding:"10px 12px"}}>
          <div style={{color:"#b07aff", fontSize:"9px", marginBottom:"8px", fontWeight:"bold", letterSpacing:"0.05em"}}>
            + ADD CUSTOM LOCATION
          </div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"flex-end"}}>
            {[
              ["Name", customName, setCustomName, "200px", "e.g. Nairobi", false],
              ["Lat (−90 to +90)", customLat, setCustomLat, "100px", "e.g. −1.29", false],
              ["Lon (−180 to +180)", customLon, setCustomLon, "110px", "e.g. 36.82", false],
              ["Country", customCountry, setCustomCountry, "80px", "KE", false],
              ["Operator", customOp, setCustomOp, "110px", "Optional", false],
            ].map(([label, val, setter, w, ph]) => (
              <label key={label} style={{color:"#4a6a8a", fontSize:"9px", display:"flex",
                flexDirection:"column", gap:"3px"}}>
                {label}
                <input type="text" value={val} placeholder={ph}
                  onChange={e => setter(e.target.value)}
                  style={{background:"#0d1a2a", border:"1px solid #2e4270", color:"#c0d8f0",
                    padding:"4px 7px", width:w, borderRadius:"3px", fontSize:"10px",
                    fontFamily:"inherit", boxSizing:"border-box"}}
                />
              </label>
            ))}
            <button onClick={addCustom}
              style={{background:"#b07aff22", border:"1px solid #b07aff",
                color:"#b07aff", padding:"4px 14px", borderRadius:"3px",
                cursor:"pointer", fontSize:"10px", fontFamily:"inherit",
                fontWeight:"bold", alignSelf:"flex-end", marginBottom:"0px"}}>
              + Add
            </button>
          </div>
          {addError && (
            <div style={{marginTop:"6px", color:"#ffd700", fontSize:"9px"}}>{addError}</div>
          )}
          <div style={{marginTop:"6px", color:"#2a4060", fontSize:"8px"}}>
            Note: mPOWER provides coverage between approximately ±50° latitude. Gateways outside this band
            will have limited or no satellite visibility.
          </div>
        </div>
      </div>

      {/* ── Active set summary table ── */}
      <div style={{background:"#080f1a", border:"1px solid #1e3055", borderRadius:"4px", padding:"10px"}}>
        <div style={{color:"#4a6a8a", fontSize:"9px", marginBottom:"8px", letterSpacing:"0.05em"}}>
          ACTIVE GATEWAY SET — LIVE VISIBILITY ({activeCount} selected)
        </div>
        <div style={{display:"grid",
          gridTemplateColumns:"90px 130px 80px 80px 1fr",
          gap:"6px", padding:"4px 0", borderBottom:"1px solid #2e4270", marginBottom:"4px"}}>
          {["ID","NAME","LAT","LON","BEST SAT (live EL)"].map(h => (
            <span key={h} style={{color:"#4a6a8a", fontSize:"8px"}}>{h}</span>
          ))}
        </div>
        {activeCount === 0
          ? <div style={{color:"#3a5a7a", fontSize:"10px", fontStyle:"italic", padding:"6px 0"}}>
              No gateways active — enable at least one above.
            </div>
          : allKnown.filter(g => activeGwIds.has(g.id)).map(gw => {
              const els = gwElevations[gw.id] || [];
              const best = els[0];
              const col  = SOURCE_COLORS[gw.source] || "#ff9900";
              return (
                <div key={gw.id} style={{display:"grid",
                  gridTemplateColumns:"90px 130px 80px 80px 1fr",
                  gap:"6px", padding:"4px 0", borderBottom:"1px solid #152030", alignItems:"center"}}>
                  <span style={{color:col, fontSize:"9px", fontWeight:"bold"}}>{gw.id}</span>
                  <span style={{color:"#c0d8f0", fontSize:"9px"}}>{gw.name}</span>
                  <span style={{color:"#8ab0d0", fontSize:"9px"}}>{gw.lat.toFixed(3)}°</span>
                  <span style={{color:"#8ab0d0", fontSize:"9px"}}>{gw.lon.toFixed(3)}°</span>
                  <span style={{color: best ? (best.el>=30?"#00ff88":best.el>=15?"#ffd700":"#ff6b35") : "#3a5a7a",
                    fontSize:"9px"}}>
                    {best ? `S${best.s+1} @ ${best.el}°` : "No sats in view"}
                  </span>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── end GatewayManagerTab ─────────────────────────────────────

function MapCanvas({ simTime, pins, onPinDrop, gpLat, gpLon, numSats, showGwLink, flightData, onAcBubble, pathMarkers, activeGateways, gwMinEl, flightSelecting, pendingOrigin, pendingDest, height }) {
  const canvasRef    = useRef(null);
  const wrapRef      = useRef(null);
  const worldRef     = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const simTimeRef   = useRef(simTime);
  const pinsRef      = useRef(pins);
  const gpRef        = useRef({ lat: gpLat, lon: gpLon });
  const dragStart    = useRef(null);
  const zoomBehav    = useRef(null);
  const projRef      = useRef(null);   // stores current projection for hit-testing
  const cssDims      = useRef({ w: 800, h: 420 }); // CSS pixel dims set at init
  const [ready,   setReady]   = useState(false);
  const [err,     setErr]     = useState(null);
  const [zoomK,   setZoomK]   = useState(1);
  const [cursor,  setCursor]  = useState(null);
  const [pinMode, setPinMode] = useState(false);
  const [dotTip,  setDotTip]  = useState(null);  // hovered flight-path dot tooltip
  const pinModeRef = useRef(false);
  const numSatsRef = useRef(numSats);
  const showGwLinkRef = useRef(showGwLink);
  const flightDataRef   = useRef(flightData);
  const pathMarkersRef  = useRef(pathMarkers);
  const activeGatewaysRef = useRef(activeGateways);
  const prevSatIdxRef       = useRef(-1);  // hysteresis: last active satellite index
  const gwMinElRef           = useRef(gwMinEl);  // keep draw callback in sync with prop
  const flightSelectingRef_  = useRef(flightSelecting); // keep click handler in sync with prop
  const pendingOriginRef     = useRef(pendingOrigin);
  const pendingDestRef       = useRef(pendingDest);

  // Keep refs in sync so draw callback always has latest values
  useEffect(() => { simTimeRef.current = simTime; }, [simTime]);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { gpRef.current = { lat: gpLat, lon: gpLon }; }, [gpLat, gpLon]);
  useEffect(() => { numSatsRef.current = numSats; }, [numSats]);
  useEffect(() => { showGwLinkRef.current = showGwLink; }, [showGwLink]);
  useEffect(() => { flightDataRef.current    = flightData;     }, [flightData]);
  useEffect(() => { pathMarkersRef.current   = pathMarkers;    }, [pathMarkers]);
  useEffect(() => { activeGatewaysRef.current = activeGateways; }, [activeGateways]);
  useEffect(() => { gwMinElRef.current = gwMinEl; }, [gwMinEl]);
  useEffect(() => { flightSelectingRef_.current = flightSelecting; }, [flightSelecting]);
  useEffect(() => { pendingOriginRef.current = pendingOrigin; if (ready) draw(); }, [pendingOrigin, ready]);
  useEffect(() => { pendingDestRef.current   = pendingDest;   if (ready) draw(); }, [pendingDest,   ready]);

  // ── Load topojson + world data ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    function loadScript(src) {
      return new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    (async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js");
        const wd = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json());
        if (!cancelled) { worldRef.current = wd; setReady(true); }
      } catch (e) { if (!cancelled) setErr("Map load failed: " + e.message); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Helper: canvas pixel → [lon, lat] using the live projection ───
  function canvasPixelFromEvent(e) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dims = cssDims.current;
    // Scale from screen-space (may be CSS-transformed) to canvas CSS-pixel space
    const scaleX = dims.w / rect.width;
    const scaleY = dims.h / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;
    return { px, py };
  }

  // ── Core draw ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldRef.current) return;
    const ctx   = canvas.getContext("2d");
    // Use stored CSS pixel dimensions — immune to style resets or parsing issues
    const W = cssDims.current.w;
    const H = cssDims.current.h;
    const t     = transformRef.current;
    const topo  = window.topojson;
    const world = worldRef.current;
    const st    = simTimeRef.current;
    const curPins = pinsRef.current;
    const gp    = gpRef.current;

    // Build zoom-adjusted projection for this frame
    // First compute base projection that fills the canvas
    const baseProj = d3.geoEquirectangular().fitSize([W, H], {type: "Sphere"});
    const baseScale = baseProj.scale();
    const baseTrans = baseProj.translate();
    // Apply d3.zoom transform on top of base
    const tProj = d3.geoEquirectangular()
      .scale(baseScale * t.k)
      .translate([t.x + baseTrans[0] * t.k, t.y + baseTrans[1] * t.k]);
    projRef.current = tProj;  // share with click/mousemove handlers
    const path = d3.geoPath(tProj, ctx);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1622";
    ctx.fillRect(0, 0, W, H);

    // Sphere clip outline
    ctx.beginPath(); path({ type:"Sphere" });
    ctx.strokeStyle = "#1e3055"; ctx.lineWidth = 1; ctx.stroke();

    // Graticule
    ctx.beginPath(); path(d3.geoGraticule()());
    ctx.strokeStyle = "#0d1b2e"; ctx.lineWidth = 0.4; ctx.stroke();

    // Land
    ctx.beginPath();
    path(topo.feature(world, world.objects.land));
    ctx.fillStyle = "#1a2538"; ctx.fill();

    // Country borders
    ctx.beginPath();
    path(topo.mesh(world, world.objects.countries, (a, b) => a !== b));
    ctx.strokeStyle = "#2a3f6a"; ctx.lineWidth = 0.4; ctx.stroke();

    // ±50° coverage band fill
    const band50 = { type:"Feature", geometry:{ type:"Polygon", coordinates:[[
      ...[...Array(361)].map((_,i)=>[i-180, 50]),
      ...[...Array(361)].map((_,i)=>[180-i, -50]),
      [-180, 50]
    ]]}}; 
    ctx.beginPath(); path(band50);
    ctx.fillStyle = "rgba(0,207,255,0.04)"; ctx.fill();

    // ±10° NGSO-only band — regulatory zone where NGSO has priority
    const band10 = { type:"Feature", geometry:{ type:"Polygon", coordinates:[[
      ...[...Array(361)].map((_,i)=>[i-180, 10]),
      ...[...Array(361)].map((_,i)=>[180-i, -10]),
      [-180, 10]
    ]]}};
    ctx.beginPath(); path(band10);
    ctx.fillStyle = "rgba(255,200,0,0.07)"; ctx.fill();

    // Equator
    ctx.beginPath();
    path({ type:"Feature", geometry:{ type:"LineString", coordinates:[...Array(361)].map((_,i)=>[i-180,0]) }});
    ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 0.5;
    ctx.setLineDash([4,6]); ctx.stroke(); ctx.setLineDash([]);

    // ±50° boundary lines
    for (const ll of [50,-50]) {
      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"LineString", coordinates:[...Array(361)].map((_,i)=>[i-180,ll]) }});
      ctx.strokeStyle = "rgba(0,207,255,0.28)"; ctx.lineWidth = 0.7;
      ctx.setLineDash([6,4]); ctx.stroke(); ctx.setLineDash([]);
    }

    // ±10° NGSO-only boundary lines
    for (const ll of [10,-10]) {
      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"LineString", coordinates:[...Array(361)].map((_,i)=>[i-180,ll]) }});
      ctx.strokeStyle = "rgba(255,200,0,0.55)"; ctx.lineWidth = 0.8;
      ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);
    }

    // ±10° NGSO band labels
    const labelN10 = tProj([-170, 11.2]);
    const labelS10 = tProj([-170, -8.8]);
    if (labelN10) {
      ctx.fillStyle = "rgba(255,200,0,0.55)"; ctx.font = `bold 8px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.fillText("10°N NGSO ONLY", labelN10[0], labelN10[1]);
    }
    if (labelS10) {
      ctx.fillStyle = "rgba(255,200,0,0.55)"; ctx.font = `bold 8px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.fillText("10°S NGSO ONLY", labelS10[0], labelS10[1]);
    }

    // ── Satellites ───────────────────────────────────────────
    const nSats = numSatsRef.current;
    for (let s = 0; s < nSats; s++) {
      const lon = satLon(s, st, nSats);
      const col = SAT_COLORS[s % SAT_COLORS.length];

      // Ground track (past 90 min)
      ctx.beginPath(); ctx.setLineDash([3,5]);
      ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.4;
      let first = true, prevLon2 = null;
      for (let i = 0; i <= 100; i++) {
        const t2 = st - 5400 + (i/100)*5400;
        const lo2 = satLon(s, t2, nSats);
        const p  = tProj([lo2, 0]);
        if (!p) { first = true; continue; }
        if (prevLon2 !== null && Math.abs(lo2 - prevLon2) > 100) first = true;
        if (first) { ctx.moveTo(p[0],p[1]); first=false; } else ctx.lineTo(p[0],p[1]);
        prevLon2 = lo2;
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;

      // Elevation contours
      for (const el of EL_LEVELS) {
        const pts = contourPts(lon, el);
        ctx.strokeStyle = col;
        ctx.lineWidth   = contourWidth(el);
        ctx.globalAlpha = contourOpacity(el);
        ctx.setLineDash(el !== 5 && el % 10 !== 0 ? [2,3] : []);
        ctx.beginPath();
        let pf = true, pLon2 = null;
        for (const [plo, pla] of pts) {
          const p = tProj([plo, pla]);
          if (!p) { pf=true; continue; }
          if (pLon2 !== null && Math.abs(plo - pLon2) > 90) pf = true;
          if (pf) { ctx.moveTo(p[0],p[1]); pf=false; } else ctx.lineTo(p[0],p[1]);
          pLon2 = plo;
        }
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // Satellite diamond marker
      const sp = tProj([lon, 0]);
      if (sp) {
        const r = Math.max(5, 8 / t.k * Math.min(t.k, 2));
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1]-r); ctx.lineTo(sp[0]+r*0.65, sp[1]);
        ctx.lineTo(sp[0], sp[1]+r); ctx.lineTo(sp[0]-r*0.65, sp[1]);
        ctx.closePath();
        ctx.fillStyle = col; ctx.strokeStyle = "white"; ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "white"; ctx.font = `bold 9px 'Courier New'`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText(`S${s+1}`, sp[0], sp[1]-r-4);
        ctx.shadowBlur = 0; ctx.textAlign = "left";
      }
    }

    // ── ±40° service-area fade mask ─────────────────────────
    // Darkens areas beyond the SES operational coverage band
    // while still allowing contour geometry to show through
    const maskNorth = { type:"Feature", geometry:{ type:"Polygon", coordinates:[[
      ...[...Array(361)].map((_,i)=>[i-180, 90]),
      ...[...Array(361)].map((_,i)=>[180-i, 40]),
      [-180, 90]
    ]]}};
    const maskSouth = { type:"Feature", geometry:{ type:"Polygon", coordinates:[[
      ...[...Array(361)].map((_,i)=>[i-180, -40]),
      ...[...Array(361)].map((_,i)=>[180-i, -90]),
      [-180, -40]
    ]]}};
    ctx.beginPath(); path(maskNorth);
    ctx.fillStyle = "rgba(8,15,26,0.55)"; ctx.fill();
    ctx.beginPath(); path(maskSouth);
    ctx.fillStyle = "rgba(8,15,26,0.55)"; ctx.fill();

    // Re-stroke the ±40° boundary lines on top of the mask
    for (const ll of [40,-40]) {
      ctx.beginPath();
      path({ type:"Feature", geometry:{ type:"LineString", coordinates:[...Array(361)].map((_,i)=>[i-180,ll]) }});
      ctx.strokeStyle = "rgba(0,207,255,0.40)"; ctx.lineWidth = 1.0;
      ctx.setLineDash([6,4]); ctx.stroke(); ctx.setLineDash([]);
    }
    // Label the ±40° boundary
    const labelPos40N = tProj([-170, 41.5]);
    const labelPos40S = tProj([-170, -38.5]);
    if (labelPos40N) {
      ctx.fillStyle = "rgba(0,207,255,0.45)"; ctx.font = `bold 8px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.fillText("40°N SVC LIMIT", labelPos40N[0], labelPos40N[1]);
    }
    if (labelPos40S) {
      ctx.fillStyle = "rgba(0,207,255,0.45)"; ctx.font = `bold 8px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.fillText("40°S SVC LIMIT", labelPos40S[0], labelPos40S[1]);
    }

    // ── Pins ────────────────────────────────────────────────
    const drawPin = (lat, lon, color, label, isGp) => {
      const p = tProj([lon, lat]);
      if (!p) return;
      const r = 7;
      // Crosshair lines
      ctx.strokeStyle = color; ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(p[0]-10,p[1]); ctx.lineTo(p[0]+10,p[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p[0],p[1]-10); ctx.lineTo(p[0],p[1]+10); ctx.stroke();
      ctx.globalAlpha = 1;
      // Pin circle
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI*2);
      ctx.fillStyle = isGp ? color+"55" : color+"44";
      ctx.strokeStyle = color; ctx.lineWidth = isGp ? 2 : 1.5;
      ctx.fill(); ctx.stroke();
      // Pin label
      ctx.fillStyle = "white"; ctx.font = `bold 9px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
      ctx.fillText(label, p[0]+r+3, p[1]+4);
      ctx.shadowBlur = 0;
    };

    // Analysis point (gpLat/gpLon) always shown as cyan crosshair
    drawPin(gp.lat, gp.lon, "#00cfff", `${gp.lat.toFixed(1)}°,${gp.lon.toFixed(1)}°`, true);

    // User-dropped pins
    curPins.forEach((pin, i) => {
      drawPin(pin.lat, pin.lon, "#ffd700", pin.label || `P${i+1}`, false);
    });

    // Pending flight origin/dest markers (shown before LAUNCH while user is picking)
    const pOrig = pendingOriginRef.current;
    const pDest = pendingDestRef.current;
    const noActiveFlight = !flightDataRef.current;
    if (pOrig && noActiveFlight) {
      const pp = tProj([pOrig.lon, pOrig.lat]);
      if (pp) {
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 6, 0, Math.PI*2);
        ctx.fillStyle = "#00ff8844"; ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#00ff88"; ctx.font = "bold 8px 'Courier New'";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText("FROM: " + pOrig.name, pp[0], pp[1] - 10);
        ctx.shadowBlur = 0;
      }
    }
    if (pDest && noActiveFlight) {
      const pp2 = tProj([pDest.lon, pDest.lat]);
      if (pp2) {
        ctx.beginPath(); ctx.arc(pp2[0], pp2[1], 6, 0, Math.PI*2);
        ctx.fillStyle = "#ff6b3544"; ctx.strokeStyle = "#ff6b35"; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ff6b35"; ctx.font = "bold 8px 'Courier New'";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText("TO: " + pDest.name, pp2[0], pp2[1] - 10);
        ctx.shadowBlur = 0;
      }
    }

    // ── Gateway ground stations ─────────────────────────────
    for (const gw of (activeGatewaysRef.current || GATEWAYS)) {
      const gp2 = tProj([gw.lon, gw.lat]);
      if (!gp2) continue;
      const r = 5;
      // Square marker
      ctx.fillStyle = GW_COLOR + "55";
      ctx.strokeStyle = GW_COLOR;
      ctx.lineWidth = 1.5;
      ctx.fillRect(gp2[0]-r, gp2[1]-r, r*2, r*2);
      ctx.strokeRect(gp2[0]-r, gp2[1]-r, r*2, r*2);
      // Label
      ctx.fillStyle = GW_COLOR;
      ctx.font = `bold 8px 'Courier New'`;
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
      ctx.fillText(gw.id.replace("GW-",""), gp2[0]+r+3, gp2[1]+3);
      ctx.shadowBlur = 0;
    }

    // ── GW Link line (analysis point → active gateway) ──────
    if (showGwLinkRef.current) {
      const nS = numSatsRef.current;
      const gpNow = gpRef.current;
      // Find best satellite for analysis point
      let bestSatEl = -90, bestSatIdx = -1;
      for (let s = 0; s < nS; s++) {
        const el = elevAngle(gpNow.lat, gpNow.lon, satLon(s, st, nS));
        if (el > bestSatEl) { bestSatEl = el; bestSatIdx = s; }
      }
      if (bestSatEl >= gwMinElRef.current && bestSatIdx >= 0) {
        const activeSatLon = satLon(bestSatIdx, st, nS);
        // Find best gateway for that satellite
        let bestGw = null, bestGwEl = -90;
        for (const gw of (activeGatewaysRef.current || GATEWAYS)) {
          const gwEl = elevAngle(gw.lat, gw.lon, activeSatLon);
          if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGw = gw; }
        }
        if (bestGw && bestGwEl >= gwMinEl) {
          const pA = tProj([gpNow.lon, gpNow.lat]);
          const pG = tProj([bestGw.lon, bestGw.lat]);
          const pS = tProj([activeSatLon, 0]);
          if (pA && pG) {
            // Line from analysis point to gateway
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = GW_COLOR;
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.7;
            ctx.moveTo(pA[0], pA[1]);
            // If satellite marker visible, route through it
            if (pS) {
              ctx.lineTo(pS[0], pS[1]);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(pS[0], pS[1]);
            }
            ctx.lineTo(pG[0], pG[1]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            // Label the active gateway with highlight
            ctx.fillStyle = GW_COLOR;
            ctx.font = `bold 9px 'Courier New'`;
            ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 4;
            ctx.fillText(`⟶ ${bestGw.name}`, pG[0] + 8, pG[1] - 8);
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    // ── Flight route and plane ──────────────────────────────
    const fd = flightDataRef.current;
    if (fd) {
      ctx.beginPath();
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([8, 4]);
      let firstPt = true, prevRouteLon = null;
      for (const [rlon, rlat] of fd.route) {
        const rp = tProj([rlon, rlat]);
        if (!rp) { firstPt = true; continue; }
        if (prevRouteLon !== null && Math.abs(rlon - prevRouteLon) > 100) firstPt = true;
        if (firstPt) { ctx.moveTo(rp[0], rp[1]); firstPt = false; } else ctx.lineTo(rp[0], rp[1]);
        prevRouteLon = rlon;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Draw origin marker (green circle)
      const pO = tProj([fd.origin.lon, fd.origin.lat]);
      if (pO) {
        ctx.beginPath(); ctx.arc(pO[0], pO[1], 5, 0, Math.PI*2);
        ctx.fillStyle = "#00ff8855"; ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#00ff88"; ctx.font = `bold 8px 'Courier New'`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText(fd.origin.name, pO[0], pO[1] - 9);
        ctx.shadowBlur = 0;
      }

      // Draw destination marker (green circle)
      const pD = tProj([fd.dest.lon, fd.dest.lat]);
      if (pD) {
        ctx.beginPath(); ctx.arc(pD[0], pD[1], 5, 0, Math.PI*2);
        ctx.fillStyle = "#00ff8855"; ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#00ff88"; ctx.font = `bold 8px 'Courier New'`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        ctx.fillText(fd.dest.name, pD[0], pD[1] - 9);
        ctx.shadowBlur = 0;
      }

      // ── Switch marker dots on flight path ──────────────────
      const markers = pathMarkersRef.current;
      if (markers && markers.length) {
        for (const m of markers) {
          const mp = tProj([m.lon, m.lat]);
          if (!mp) continue;
          const R = Math.max(3, 4.5 / t.k * Math.min(t.k, 2));
          const fillCol   = m.type === "both" ? "rgba(255,255,255,0.95)"
                          : m.type === "gw"   ? "rgba(30,120,255,0.95)"
                          :                     "rgba(20,20,20,0.95)";
          const strokeCol = m.type === "both" ? "rgba(255,255,255,0.7)"
                          : m.type === "gw"   ? "rgba(80,160,255,0.8)"
                          :                     "rgba(140,140,140,0.7)";
          const glowCol   = m.type === "both" ? "rgba(255,255,255,0.5)"
                          : m.type === "gw"   ? "rgba(30,120,255,0.4)"
                          :                     null;
          ctx.beginPath();
          ctx.arc(mp[0], mp[1], R, 0, Math.PI * 2);
          ctx.fillStyle = fillCol;
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1.2;
          if (glowCol) {
            ctx.shadowColor = glowCol; ctx.shadowBlur = 6;
          }
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Draw plane at current position
      const pP = tProj([fd.pos.lon, fd.pos.lat]);
      if (pP) {
        ctx.save();
        ctx.translate(pP[0], pP[1]);
        // Rotate plane icon to match bearing
        // Map bearing (0=N,90=E) to canvas angle (0=right, PI/2=down)
        const angle = toRad(fd.bearing - 90);
        ctx.rotate(angle);
        // Draw plane shape
        const sz = 8;
        ctx.beginPath();
        ctx.moveTo(sz*1.5, 0);           // nose
        ctx.lineTo(-sz*0.5, -sz*0.8);    // left wing tip
        ctx.lineTo(-sz*0.3, 0);          // left wing root
        ctx.lineTo(-sz, -sz*0.4);        // left tail
        ctx.lineTo(-sz, sz*0.4);         // right tail
        ctx.lineTo(-sz*0.3, 0);          // right wing root
        ctx.lineTo(-sz*0.5, sz*0.8);     // right wing tip
        ctx.closePath();
        ctx.fillStyle = fd.complete ? "#4a6a8a" : "#00ff88";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // Flight info label
        ctx.fillStyle = "#00ff88"; ctx.font = `bold 9px 'Courier New'`;
        ctx.textAlign = "left";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
        const label = fd.complete
          ? "ARRIVED"
          : `${(fd.progress*100).toFixed(0)}% · ETA ${fd.etaMin.toFixed(0)}m`;
        ctx.fillText(label, pP[0]+12, pP[1]+4);
        ctx.shadowBlur = 0;

        // ── Compute link stats for the status panel ─────────
        if (!fd.complete) {
          const nS = numSatsRef.current;
          const st = simTimeRef.current;

          // Recompute aircraft position at the EXACT current simTime so the
          // satellite positions (also at st) are evaluated at the same instant.
          const freshProgress = Math.min(1, Math.max(0, fd.elapsed !== undefined
            ? (st - (st - fd.elapsed)) / fd.durationSec   // approximate from elapsed
            : fd.progress));
          // Use fd.pos (already accurate to <33 ms) — good enough at MEO speeds
          const acLat = fd.pos.lat;
          const acLon = fd.pos.lon;

          // Find best satellite — peak elevation, no hysteresis first pass
          let bestEl = -90, bestIdx = -1, prevEl = -90;
          const prev = prevSatIdxRef.current;
          for (let s = 0; s < nS; s++) {
            const el = elevAngle(acLat, acLon, satLon(s, st, nS));
            if (el > bestEl) { bestEl = el; bestIdx = s; }
            if (s === prev) prevEl = el;
          }

          // Apply same 2° hysteresis used by flightStats — prevents oscillation
          // at satellite boundaries and keeps the panel in sync with the main sim
          const SAT_HYS = 2;
          let activeIdx;
          if (prev >= 0 && prevEl >= gwMinElRef.current && (bestEl - prevEl) < SAT_HYS) {
            activeIdx = prev;
            bestEl    = prevEl;   // stick with current satellite's elevation
          } else {
            activeIdx = bestEl >= gwMinElRef.current ? bestIdx : -1;
          }
          prevSatIdxRef.current = activeIdx;

          if (activeIdx >= 0) {
            const activeSatLon = satLon(activeIdx, st, nS);
            const scan    = satScanAngle(bestEl);
            const skew    = satSkewAngle(acLat, acLon, activeSatLon, fd.bearing);
            const slantKm = slantRange(bestEl);
            onAcBubble && onAcBubble({
              elevation: +bestEl.toFixed(1),
              scan:      +scan.toFixed(1),
              skew:      +skew.toFixed(1),
              slantKm,
              satName:   `mPOWER-${activeIdx + 1}`,
              satColor:  SAT_COLORS[activeIdx],
              originName: fd.origin.name,
              destName:   fd.dest.name,
              progress:   fd.progress,
            });
          } else {
            // Aircraft is not in view of any satellite — show no-link state
            onAcBubble && onAcBubble({
              elevation: +bestEl.toFixed(1),
              scan: 0, skew: 0, slantKm: 0,
              satName: "—", satColor: "#4a6a8a",
              originName: fd.origin.name,
              destName:   fd.dest.name,
              progress:   fd.progress,
            });
          }
        }
      }
    } else {
      prevSatIdxRef.current = -1;
      onAcBubble && onAcBubble(null);
    }

  }, []);

  // ── Init canvas size + zoom behavior after data ready ─────
  useEffect(() => {
    if (!ready || !canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;

    const sizeCanvas = () => {
      const W = canvas.offsetWidth || 800;
      const H = canvas.offsetHeight || 420;
      cssDims.current = { w: W, h: H };
      canvas.width  = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
      canvas.getContext("2d").scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    };
    sizeCanvas();

    // Re-size canvas when container changes
    const ro = new ResizeObserver(() => sizeCanvas());
    ro.observe(canvas.parentElement);

    // d3.zoom attached to wrapper div
    const zoom = d3.zoom()
      .scaleExtent([0.5, 12])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        setZoomK(+event.transform.k.toFixed(2));
        draw();
      });
    zoomBehav.current = zoom;
    d3.select(wrapRef.current).call(zoom);

    return () => ro.disconnect();
  }, [ready, draw]);

  // ── Redraw on simTime / pins / gp changes ─────────────────
  useEffect(() => { if (ready) draw(); }, [simTime, pins, gpLat, gpLon, numSats, showGwLink, flightData, pathMarkers, activeGateways, ready, draw, height]);
  // Redraw on window resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => { if (ready) draw(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ready, draw]);

  // ── Mouse handlers on wrapper div ─────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (!ready || !projRef.current) return;
    const cp = canvasPixelFromEvent(e);
    if (!cp) return;
    const ll = projRef.current.invert([cp.px, cp.py]);
    if (ll && isFinite(ll[0]) && isFinite(ll[1]) && Math.abs(ll[1]) <= 90)
      setCursor({ lon: ll[0].toFixed(2), lat: ll[1].toFixed(2) });
    else setCursor(null);

    // Check proximity to path marker dots
    const markers = pathMarkersRef.current;
    if (markers && markers.length && projRef.current) {
      const HIT = 10; // pixel hit radius
      let hit = null;
      for (const m of markers) {
        const mp = projRef.current([m.lon, m.lat]);
        if (!mp) continue;
        const dx = cp.px - mp[0], dy = cp.py - mp[1];
        if (Math.sqrt(dx*dx + dy*dy) <= HIT) { hit = m; break; }
      }
      if (hit) {
        setDotTip({ marker: hit, x: e.clientX, y: e.clientY });
      } else {
        setDotTip(prev => prev ? null : prev);
      }
    } else {
      setDotTip(prev => prev ? null : prev);
    }
  }, [ready]);

  const handleMouseDown = useCallback((e) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback((e) => {
    if (!ready || !projRef.current) return;
    // Ignore if this was a drag (moved > 5px)
    if (dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.sqrt(dx*dx+dy*dy) > 5) return;
    }
    if (!pinModeRef.current && !flightSelectingRef_.current) return;  // only drop pins in pin mode or flight-selecting mode
    const cp = canvasPixelFromEvent(e);
    if (!cp) return;
    const ll = projRef.current.invert([cp.px, cp.py]);
    if (ll && isFinite(ll[0]) && isFinite(ll[1]) && Math.abs(ll[1]) <= 90) {
      onPinDrop({ lat: +ll[1].toFixed(3), lon: +ll[0].toFixed(3) });
    }
  }, [ready, onPinDrop]);

  // Zoom button handlers
  const zoomBy = (factor) => {
    if (!wrapRef.current || !zoomBehav.current) return;
    d3.select(wrapRef.current).transition().duration(300)
      .call(zoomBehav.current.scaleBy, factor);
  };
  const zoomReset = () => {
    if (!wrapRef.current || !zoomBehav.current) return;
    d3.select(wrapRef.current).transition().duration(400)
      .call(zoomBehav.current.transform, d3.zoomIdentity);
  };
  const togglePinMode = () => {
    const next = !pinModeRef.current;
    pinModeRef.current = next;
    setPinMode(next);
  };

  if (err) return (
    <div style={{background:"#080f1a",border:"1px solid #ff3030",color:"#ff6060",padding:"16px",borderRadius:"4px",fontSize:"11px",fontFamily:"monospace"}}>⚠ {err}</div>
  );
  if (!ready) return (
    <div style={{background:"#080f1a",color:"#4a6a8a",padding:"32px",textAlign:"center",borderRadius:"4px",fontSize:"11px",fontFamily:"monospace",border:"1px solid #1e3055"}}>
      <div style={{marginBottom:"8px",color:"#00cfff"}}>◈ LOADING WORLD MAP DATA…</div>
      <div>Fetching topographic data from CDN</div>
    </div>
  );

  const btnStyle = (active) => ({
    background: active ? "#00cfff22" : "#080f1a",
    border: `1px solid ${active ? "#00cfff" : "#2e4270"}`,
    color: active ? "#00cfff" : "#8ab0d0",
    width: "28px", height: "28px", borderRadius: "3px",
    cursor: "pointer", fontSize: "14px", fontFamily: "inherit",
    display:"flex", alignItems:"center", justifyContent:"center",
    lineHeight: 1,
  });

  return (
    <div style={{ position:"relative" }}>
      {/* Zoom + pin controls overlay */}
      <div style={{ position:"absolute", top:8, left:8, zIndex:10, display:"flex", flexDirection:"column", gap:"4px" }}>
        <button style={btnStyle(false)} onClick={() => zoomBy(1.5)} title="Zoom in">+</button>
        <button style={btnStyle(false)} onClick={() => zoomBy(1/1.5)} title="Zoom out">−</button>
        <button style={{...btnStyle(false), fontSize:"10px", width:"28px"}} onClick={zoomReset} title="Reset zoom">⌂</button>
        <div style={{borderTop:"1px solid #2e4270", margin:"2px 0"}} />
        <button style={btnStyle(pinMode)} onClick={togglePinMode} title="Drop pin mode">
          {pinMode ? "📍" : "📌"}
        </button>
      </div>

      {/* Zoom level badge */}
      <div style={{ position:"absolute", top:8, right:8, zIndex:10,
        background:"rgba(8,15,26,0.8)", border:"1px solid #2e4270",
        color:"#4a6a8a", fontSize:"10px", fontFamily:"'Courier New',monospace",
        padding:"2px 7px", borderRadius:"3px" }}>
        {zoomK.toFixed(1)}×
      </div>

      {/* Cursor lat/lon readout */}
      {cursor && (
        <div style={{ position:"absolute", bottom:8, left:8, zIndex:10,
          background:"rgba(8,15,26,0.85)", border:"1px solid #2e4270",
          color:"#00cfff", fontSize:"10px", fontFamily:"'Courier New',monospace",
          padding:"2px 8px", borderRadius:"3px", pointerEvents:"none" }}>
          {cursor.lat}° {cursor.lon}°
          {pinMode && <span style={{color:"#ffd700",marginLeft:"8px"}}>📍 click to drop pin</span>}
          {flightSelecting === "origin" && <span style={{color:"#00ff88",marginLeft:"8px",fontWeight:"bold"}}>✈ click map to set ORIGIN</span>}
          {flightSelecting === "dest"   && <span style={{color:"#ff6b35",marginLeft:"8px",fontWeight:"bold"}}>✈ click map to set DESTINATION</span>}
        </div>
      )}

      {/* Flight-path dot tooltip */}
      {dotTip && (() => {
        const m   = dotTip.marker;
        const TW  = 200, TH = 110, GAP = 12;
        const vw  = window.innerWidth, vh = window.innerHeight;
        const tx  = dotTip.x + GAP + TW > vw ? dotTip.x - GAP - TW : dotTip.x + GAP;
        const ty  = Math.min(dotTip.y - 10, vh - TH - 8);
        const borderCol = m.type === "both" ? "rgba(255,255,255,0.8)"
                        : m.type === "gw"   ? "rgba(30,120,255,0.8)"
                        :                     "rgba(140,140,140,0.7)";
        const label     = m.type === "both" ? "SAT + GW HANDOVER"
                        : m.type === "gw"   ? "GW HANDOVER"
                        :                     "SAT HANDOVER";
        const labelCol  = m.type === "both" ? "white"
                        : m.type === "gw"   ? "rgba(100,160,255,1)"
                        :                     "rgba(200,200,200,1)";
        return (
          <div style={{
            position:"fixed", left:tx, top:ty, width:TW,
            zIndex:999, pointerEvents:"none",
            fontFamily:"'Courier New',monospace", fontSize:"10px",
            background:"rgba(4,10,20,0.96)",
            border:`1.5px solid ${borderCol}55`,
            borderLeft:`3px solid ${borderCol}`,
            borderRadius:"4px", padding:"8px 11px",
            boxShadow:"0 6px 24px rgba(0,0,0,0.8)",
          }}>
            <div style={{color:labelCol, fontSize:"9px", fontWeight:"bold",
              letterSpacing:"0.06em", marginBottom:"6px", borderBottom:"1px solid #1a2a40",
              paddingBottom:"4px"}}>
              ⇄ {label}
            </div>
            {(m.type === "sat" || m.type === "both") && (
              <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"3px"}}>
                <span style={{fontSize:"10px"}}>🛰</span>
                <span style={{color:"#8ab0d0",fontSize:"9px"}}>{m.fromSat} → {m.toSat}</span>
              </div>
            )}
            {(m.type === "gw" || m.type === "both") && (
              <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"3px"}}>
                <span style={{fontSize:"10px"}}>📡</span>
                <span style={{color:"#8ab0d0",fontSize:"9px"}}>{m.fromGw} → {m.toGw}</span>
              </div>
            )}
            <div style={{color:"#3a5a7a",fontSize:"8px",marginTop:"4px",borderTop:"1px solid #1a2a40",paddingTop:"4px"}}>
              {m.lat.toFixed(2)}°, {m.lon.toFixed(2)}°
            </div>
          </div>
        );
      })()}

      {/* Canvas wrapper — d3.zoom attaches here */}
      <div
        ref={wrapRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{ cursor: (pinMode || flightSelecting) ? "crosshair" : "grab", borderRadius:"4px", overflow:"hidden",
          border:"1px solid #1e3055", userSelect:"none" }}
      >
        <canvas ref={canvasRef} style={{ display:"block", width:"100%", height:`${height || 420}px` }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SIMULATOR COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function O3bSimulator() {
  const animRef    = useRef(null);
  const lastMs     = useRef(null);
  const simTimeRef = useRef(0);

  // ── Responsive viewport tracking ──────────────────────────
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth  : 1280);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  // Detect short viewports (mobile in landscape: e.g. iPhone 14 Pro = 852x393)
  const isShort   = vh < 500;
  const isMobile  = vw < 768 || isShort; // treat short landscape as mobile too
  const isNarrow  = vw < 1024;
  // Map height: cap by both width-proportional ratio AND a fraction of viewport height
  // so the map never dominates the viewport on short screens (e.g. iPhone landscape)
  const mapHeightByWidth = isMobile ? Math.round(vw * 0.45) : isNarrow ? Math.round(vw * 0.40) : 420;
  const mapHeightByVh    = Math.round(vh * 0.55);  // never more than 55% of viewport height
  const mapHeight = Math.max(160, Math.min(mapHeightByWidth, mapHeightByVh));

  const [simTime, setSimTime] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [speed,    setSpeed]    = useState(120);
  const [numSats,  setNumSats]  = useState(6);
  const [tab,      setTab]      = useState("coverage");
  const [elSl,     setElSl]     = useState(20);
  const [gpLat,    setGpLat]    = useState(20);
  const [gpLon,    setGpLon]    = useState(0);
  const [pins,     setPins]     = useState([]);
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen,  setCityOpen]  = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showGwLink, setShowGwLink] = useState(false);
  // Gateway selection — defaults to all 12 standard gateways active
  const [activeGwIds, setActiveGwIds] = useState(
    () => new Set(GATEWAYS.map(g => g.id))
  );
  const activeGateways = useMemo(
    () => ALL_GATEWAYS.filter(g => activeGwIds.has(g.id)),
    [activeGwIds]
  );
  const [gwMinEl,     setGwMinEl]     = useState(10);                 // user-configurable GW min elevation (default 10°)
  const [ka2517MinEl, setKa2517MinEl] = useState(MIN_SERVICE_EL_DEFAULT); // Ka2517 service floor (default 20°)
  const [flightMode, setFlightMode] = useState(false);
  const [flightOrigin, setFlightOrigin] = useState(null);    // {name, lat, lon}
  const [flightDest,   setFlightDest]   = useState(null);    // {name, lat, lon}
  const [flightStartTime, setFlightStartTime] = useState(null); // simTime when flight started
  // ── Real Flight (OpenSky) state ──────────────────────────
  const [realFlightMode,    setRealFlightMode]    = useState(false);
  const [realFlightSearch,  setRealFlightSearch]  = useState({ airport:"", date:"" });
  const [realFlightResults, setRealFlightResults] = useState(null); // null | array | "loading" | "error:..."
  const [realFlightSelected, setRealFlightSelected] = useState(null); // selected flight metadata
  const [realFlightTrack,   setRealFlightTrack]   = useState(null);   // {points:[{t,lat,lon,alt}], duration, info}
  const [strategyBeamHalf,  setStrategyBeamHalf]  = useState(0.8);    // half beam-width (deg) used by STRATEGY tab footprint-area calc
  const [realFlightLoading, setRealFlightLoading] = useState(false);
  const [realFlightError,   setRealFlightError]   = useState(null);
  const [aptQReal,          setAptQReal]          = useState("");
  const [aptOpenReal,       setAptOpenReal]       = useState(false);
  const aptRefReal = useRef(null);
  const [resultsFilter,     setResultsFilter]     = useState(""); // (A) live filter on results
  const [recentAirports,    setRecentAirports]    = useState(() => lsGet(LS_RECENT_AIRPORTS, [])); // (E) persisted
  const [recentFlights,     setRecentFlights]     = useState(() => lsGet(LS_RECENT_FLIGHTS, []));
  const [flightSelecting, setFlightSelecting_] = useState(null); // "origin" | "dest" | null
  // Wrapper keeps the ref in sync for the onPinDrop closure
  function setFlightSelecting(v) { flightSelectingRef.current = v; setFlightSelecting_(v); }
  const [aptQ1, setAptQ1] = useState("");  // airport search query — origin
  const [aptQ2, setAptQ2] = useState("");  // airport search query — destination
  const [aptOpen1, setAptOpen1] = useState(false);
  const [aptOpen2, setAptOpen2] = useState(false);
  const aptRef1 = useRef(null);
  const aptRef2 = useRef(null);
  const [acBubble, setAcBubble] = useState(null); // live aircraft link stats panel
  const [ribbonTip, setRibbonTip] = useState(null); // hover tooltip for TX/RX ribbon
  const [fwdCirMbps, setFwdCirMbps] = useState(25);
  const [rtnCirMbps, setRtnCirMbps] = useState(5);
  const cityInputRef = useRef(null);
  const pinCounter = useRef(0);

  // Derived constellation values
  const satNames = useMemo(() => getSatNames(numSats), [numSats]);
  const satSpacing = (360 / numSats).toFixed(1);

  const flightSelectingRef = useRef(null); // ref mirror of flightSelecting for onPinDrop closure
  const onPinDrop = useCallback(({ lat, lon }) => {
    const sel = flightSelectingRef.current;
    const label = `${Math.abs(lat).toFixed(2)}${lat>=0?"N":"S"} ${Math.abs(lon).toFixed(2)}${lon>=0?"E":"W"}`;
    if (sel === "origin") {
      setFlightOrigin({ iata:"PIN", name: label, city:"Map pin", lat, lon });
      setAptQ1("");
      setFlightSelecting(null);
      flightSelectingRef.current = null;
      return;
    }
    if (sel === "dest") {
      setFlightDest({ iata:"PIN", name: label, city:"Map pin", lat, lon });
      setAptQ2("");
      setFlightSelecting(null);
      flightSelectingRef.current = null;
      return;
    }
    // Normal analysis-point pin drop
    setPins(prev => {
      const close = prev.findIndex(p => Math.abs(p.lat-lat)<1 && Math.abs(p.lon-lon)<1);
      if (close >= 0) return [];
      pinCounter.current += 1;
      return [{ lat, lon, label: `P${pinCounter.current}` }];
    });
    setGpLat(lat);
    setGpLon(lon);
    setSelectedCity(null);
  }, []);

  // Animation loop — throttle state updates to ~30fps to reduce React re-renders
  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastMs.current = null;
      return;
    }
    let lastStateUpdate = 0;
    const FRAME_BUDGET = 33; // ~30fps state update throttle (ms)
    const tick = now => {
      if (lastMs.current === null) { lastMs.current = now; lastStateUpdate = now; }
      const dt = (now - lastMs.current) / 1000;
      lastMs.current = now;
      simTimeRef.current += dt * speed;
      if (now - lastStateUpdate >= FRAME_BUDGET) {
        setSimTime(simTimeRef.current);
        lastStateUpdate = now;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, speed]);

  // ── OpenSky API helpers ────────────────────────────────────
  // Search flights departing from an airport on a given date
  async function searchRealFlights(icao, dateStr) {
    // Clear any previously-loaded flight so the new results list isn't suppressed
    // by the `!realFlightTrack` guard. Also clears origin/dest/start so a stale
    // flight doesn't keep playing while the user picks a new one.
    setRealFlightTrack(null);
    setRealFlightSelected(null);
    setFlightStartTime(null);
    setRealFlightLoading(true);
    setRealFlightError(null);
    setRealFlightResults("loading");
    setResultsFilter("");
    try {
      // dateStr is YYYY-MM-DD; build [00:00, 24:00) UTC window
      const startMs = Date.parse(dateStr + "T00:00:00Z");
      if (isNaN(startMs)) throw new Error("Invalid date");
      const begin = Math.floor(startMs / 1000);
      const end   = begin + 86400;
      const url = `${OPENSKY_PROXY}/api/flights/departure?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON response"); }
      if (!Array.isArray(data)) {
        if (data && typeof data === "object" && data.error) throw new Error(data.error);
        throw new Error("Unexpected response format");
      }
      // Filter out flights without arrival airport (incomplete/cancelled)
      const filtered = data.filter(f => f.estArrivalAirport && f.callsign);
      // Sort by departure time
      filtered.sort((a, b) => a.firstSeen - b.firstSeen);
      setRealFlightResults(filtered);
      setResultsFilter("");
      // Persist airport in recent list (most-recent-first, dedup, max 8)
      const updated = [icao, ...recentAirports.filter(x => x !== icao)].slice(0, 8);
      setRecentAirports(updated);
      lsSet(LS_RECENT_AIRPORTS, updated);
    } catch (err) {
      setRealFlightError(`Search failed: ${err.message}`);
      setRealFlightResults("error:" + err.message);
    } finally {
      setRealFlightLoading(false);
    }
  }

  // Fetch the actual ADS-B track for a selected flight, downsample to ~200 pts,
  // and bind origin/dest from the airport database.
  async function loadRealFlightTrack(flight) {
    setRealFlightLoading(true);
    setRealFlightError(null);
    try {
      // Use middle-of-flight time for the tracks call
      const midTime = Math.floor((flight.firstSeen + flight.lastSeen) / 2);
      const url = `${OPENSKY_PROXY}/api/tracks/all?icao24=${encodeURIComponent(flight.icao24)}&time=${midTime}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON track response"); }
      if (!data || !Array.isArray(data.path) || data.path.length < 2) {
        throw new Error("No track data available for this flight");
      }
      // path entries: [time, lat, lon, baroAlt, trueTrack, onGround]
      const rawPts = data.path
        .filter(p => p && p[1] !== null && p[2] !== null)
        .map(p => ({ t: p[0], lat: p[1], lon: p[2], alt: p[3] }));
      if (rawPts.length < 2) throw new Error("Track has fewer than 2 valid points");
      // Normalize times to start at 0
      const t0 = rawPts[0].t;
      const lastT = rawPts[rawPts.length - 1].t;
      const duration = lastT - t0;
      if (duration <= 0) throw new Error("Track has zero duration");
      const normalized = rawPts.map(p => ({ t: p.t - t0, lat: p.lat, lon: p.lon, alt: p.alt }));
      // Downsample evenly to max 200 points
      const TARGET = 200;
      let points;
      if (normalized.length <= TARGET) {
        points = normalized;
      } else {
        const step = (normalized.length - 1) / (TARGET - 1);
        points = [];
        for (let i = 0; i < TARGET; i++) {
          const idx = Math.round(i * step);
          points.push(normalized[Math.min(idx, normalized.length - 1)]);
        }
      }
      // Look up origin/dest airports
      const origAirport = REAL_FLIGHT_AIRPORTS.find(a => a.icao === flight.estDepartureAirport);
      const destAirport = REAL_FLIGHT_AIRPORTS.find(a => a.icao === flight.estArrivalAirport);
      // Use first/last track point as fallback if airport unknown
      const orig = origAirport
        ? { iata: origAirport.iata, name: origAirport.city, city: origAirport.city, lat: origAirport.lat, lon: origAirport.lon }
        : { iata: flight.estDepartureAirport || "ORIG", name: flight.estDepartureAirport || "Origin", city: "", lat: points[0].lat, lon: points[0].lon };
      const dest = destAirport
        ? { iata: destAirport.iata, name: destAirport.city, city: destAirport.city, lat: destAirport.lat, lon: destAirport.lon }
        : { iata: flight.estArrivalAirport || "DEST", name: flight.estArrivalAirport || "Destination", city: "", lat: points[points.length-1].lat, lon: points[points.length-1].lon };
      const track = {
        points, duration,
        info: {
          callsign: flight.callsign?.trim() || "Unknown",
          icao24: flight.icao24,
          origin: flight.estDepartureAirport,
          dest: flight.estArrivalAirport,
          firstSeen: flight.firstSeen,
          lastSeen: flight.lastSeen,
        },
      };
      setRealFlightTrack(track);
      setRealFlightSelected(flight);
      setFlightOrigin(orig);
      setFlightDest(dest);
      // Persist favourite/recent flight (dedup by callsign+date, most-recent-first, max 5)
      const fav = {
        icao24: flight.icao24,
        callsign: (flight.callsign || "").trim(),
        from: flight.estDepartureAirport,
        to:   flight.estArrivalAirport,
        firstSeen: flight.firstSeen,
        lastSeen:  flight.lastSeen,
      };
      const dedupKey = (f) => `${f.callsign}|${f.firstSeen}`;
      const updatedFlights = [fav, ...recentFlights.filter(f => dedupKey(f) !== dedupKey(fav))].slice(0, 5);
      setRecentFlights(updatedFlights);
      lsSet(LS_RECENT_FLIGHTS, updatedFlights);
    } catch (err) {
      setRealFlightError(`Track load failed: ${err.message}`);
    } finally {
      setRealFlightLoading(false);
    }
  }

  // Clear real-flight selection (revert to great-circle mode)
  function clearRealFlight() {
    setRealFlightTrack(null);
    setRealFlightSelected(null);
    setRealFlightResults(null);
    setRealFlightError(null);
    setFlightOrigin(null);
    setFlightDest(null);
    setFlightStartTime(null);
  }

  // ── Real-flight track helpers ──────────────────────────────
  // Interpolate position along real ADS-B track at fractional progress 0..1.
  // Track points are {t (sec since track start), lat, lon, alt}.
  function interpRealTrack(track, progress) {
    const pts = track.points;
    if (pts.length === 0) return { lat: 0, lon: 0, alt: 0 };
    if (progress <= 0) return { lat: pts[0].lat, lon: pts[0].lon, alt: pts[0].alt || 0 };
    if (progress >= 1) {
      const last = pts[pts.length - 1];
      return { lat: last.lat, lon: last.lon, alt: last.alt || 0 };
    }
    const targetT = progress * track.duration;
    // Binary search for surrounding points
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t <= targetT) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const span = b.t - a.t;
    const f = span > 0 ? (targetT - a.t) / span : 0;
    // Linear interp on lat/lon (handles longitude wrap if both points cross +/-180)
    let dLon = b.lon - a.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    return {
      lat: a.lat + (b.lat - a.lat) * f,
      lon: wrapL(a.lon + dLon * f),
      alt: (a.alt || 0) + ((b.alt || 0) - (a.alt || 0)) * f,
    };
  }
  // Bearing between two consecutive interpolated points
  function realTrackBearing(track, progress) {
    const eps = 0.001;
    const p0 = interpRealTrack(track, Math.max(0, progress - eps));
    const p1 = interpRealTrack(track, Math.min(1, progress + eps));
    return gcBearing(p0.lat, p0.lon, p1.lat, p1.lon);
  }

  // Flight position computation
  const flightData = useMemo(() => {
    if (!flightMode || !flightOrigin || !flightDest || flightStartTime === null) return null;
    const elapsed = simTime - flightStartTime;
    // If a real flight track is loaded, follow it instead of great-circle
    if (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2) {
      const dist = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
      const durationSec = dist / FLIGHT_SPEED_KMS;  // playback duration uses sim speed (option B)
      const progress = Math.min(1, Math.max(0, elapsed / durationSec));
      const pos = interpRealTrack(realFlightTrack, progress);
      const bearing = realTrackBearing(realFlightTrack, progress);
      // Build route polyline from track points (same [lon, lat] tuple shape as gcRoute)
      const route = realFlightTrack.points.map(p => [p.lon, p.lat]);
      return {
        pos, bearing, progress, dist, durationSec,
        elapsed, route,
        origin: flightOrigin, dest: flightDest,
        etaMin: Math.max(0, (durationSec - elapsed) / 60),
        complete: progress >= 1,
        isReal: true,
        callsign: realFlightTrack.info?.callsign,
      };
    }
    // Default great-circle path
    const dist = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const durationSec = dist / FLIGHT_SPEED_KMS;
    const progress = Math.min(1, Math.max(0, elapsed / durationSec));
    const pos = gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, progress);
    const bearing = progress < 1
      ? gcBearing(pos.lat, pos.lon, flightDest.lat, flightDest.lon)
      : gcBearing(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const route = gcRoute(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    return {
      pos, bearing, progress, dist, durationSec,
      elapsed, route,
      origin: flightOrigin, dest: flightDest,
      etaMin: Math.max(0, (durationSec - elapsed) / 60),
      complete: progress >= 1,
      isReal: false,
    };
  }, [flightMode, flightOrigin, flightDest, flightStartTime, simTime, realFlightTrack]);

  // When flight is active, update analysis point to track the plane
  useEffect(() => {
    if (flightData && !flightData.complete) {
      setGpLat(+flightData.pos.lat.toFixed(3));
      setGpLon(+flightData.pos.lon.toFixed(3));
    }
  }, [flightData]);

  // Flight summary stats — computed over the entire flight duration
  const flightStats = useMemo(() => {
    if (tab !== "flight" || !flightMode || !flightOrigin || !flightDest || flightStartTime === null) return null;
    const dist = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const durationSec = dist / FLIGHT_SPEED_KMS;
    const N = 400;
    const dt_min = (durationSec / N) / 60;
    const SAT_HYS = 2, GW_HYS = 3;
    let prevSatIdx = -1, prevGwId = null;

    // Three coverage tiers — each independently tracked:
    //  1. Constellation  — any satellite EL > 5° (pure orbital geometry)
    //  2. Ka2517 terminal — best sat EL ≥ 15° (within scan floor, regardless of GW)
    //  3. End-to-end service — EL ≥ 15° AND an active gateway sees the satellite
    let covCount = 0, terminalCovCount = 0, e2eCovCount = 0;
    // Alternative satellite tracking: during "no active gateway" closures,
    // track terminal EL of the sat that HAS gw coverage (below ka2517MinEl)
    let altTermElMin = 999, altTermElMax = -999, altTermElSum = 0, altTermElCount = 0;
    // Elevation stats collected only over terminal-viable samples (EL ≥ 15°)
    let sumEl = 0, minEl = 999, maxEl = -999;
    let satHandovers = 0, gwHandovers = 0;
    const satDuration = {}, gwDuration = {};
    const gwElStats = {}; // gwId -> { sumEl, minEl, maxEl, count }
    const satTransitions = [];
    const gwTransitions  = [];
    const coverageGaps   = []; // constellation outages  (EL < 5°)
    const terminalGaps   = []; // terminal outages       (EL < 15°, but sat may be visible)
    const serviceGaps    = []; // e2e service outages    (EL ≥ 15° but no active gateway)
    let gapStart = null, terminalGapStart = null, serviceGapStart = null;

    for (let i = 0; i <= N; i++) {
      const f      = i / N;
      const t      = flightStartTime + f * durationSec;
      const pos    = (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2)
        ? interpRealTrack(realFlightTrack, f)
        : gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, f);
      const tHours = +(f * durationSec / 3600).toFixed(2);

      // ── Collect all satellite elevations (sorted descending) ──
      const allSatEls = [];
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(pos.lat, pos.lon, satLon(s, t, numSats));
        allSatEls.push({ s, el });
      }
      allSatEls.sort((a, b) => b.el - a.el);
      const bestEl = allSatEls[0].el;

      // ── Tier 1: Constellation visibility (any sat >= gwMinEl) ──
      const satInView = bestEl >= gwMinEl;
      if (satInView) {
        covCount++;
        if (gapStart !== null) { coverageGaps.push({ start: gapStart, end: tHours }); gapStart = null; }
      } else {
        if (gapStart === null) gapStart = tHours;
      }

      // ── Tier 2: Ka2517 terminal viability (best sat EL >= ka2517MinEl) ──
      const terminalOk = bestEl >= ka2517MinEl;
      if (terminalOk) {
        terminalCovCount++;
        sumEl += bestEl;
        if (bestEl < minEl) minEl = bestEl;
        if (bestEl > maxEl) maxEl = bestEl;
        if (terminalGapStart !== null) { terminalGaps.push({ start: terminalGapStart, end: tHours }); terminalGapStart = null; }
      } else {
        if (terminalGapStart === null) terminalGapStart = tHours;
      }

      // ── Gateway-aware satellite selection ──
      // Build list of fully-viable satellites: both terminal EL and SOME gateway EL meet thresholds.
      // The primary objective is to KEEP THE CIRCUIT UP — we consider all candidates that can close
      // the link, not just the terminal-best one.
      const fullyViable = [];
      for (const { s, el } of allSatEls) {
        if (el < ka2517MinEl) break;
        const candSatLon = satLon(s, t, numSats);
        let bestGw = null, bestGwEl = -90;
        for (const gw of activeGateways) {
          const gwEl = elevAngle(gw.lat, gw.lon, candSatLon);
          if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGw = gw; }
        }
        if (bestGwEl >= gwMinEl && bestGw) fullyViable.push({ s, termEl: el, bestGw, bestGwEl });
      }

      // ── If no fully-viable sat but some sat has gateway coverage at a lower terminal EL,
      // track its terminal EL as the "alternative" we'd need to accept to close this gap.
      if (fullyViable.length === 0 && terminalOk) {
        let altTermEl = -90, altGwEl = -90;
        for (const { s, el } of allSatEls) {
          const candSatLon = satLon(s, t, numSats);
          let bestGwEl = -90;
          for (const gw of activeGateways) {
            const gwEl = elevAngle(gw.lat, gw.lon, candSatLon);
            if (gwEl > bestGwEl) bestGwEl = gwEl;
          }
          if (bestGwEl >= gwMinEl && bestGwEl > altGwEl) {
            altGwEl = bestGwEl;
            altTermEl = el;
          }
        }
        if (altTermEl > -90) {
          altTermElSum += altTermEl;
          if (altTermEl < altTermElMin) altTermElMin = altTermEl;
          if (altTermEl > altTermElMax) altTermElMax = altTermEl;
          altTermElCount++;
        }
      }

      // Select active satellite with hysteresis favouring current if still viable
      let activeSat = -1, activeGw = null;
      if (fullyViable.length > 0) {
        const current = fullyViable.find(v => v.s === prevSatIdx);
        let selected;
        if (current) {
          const bestOverall = fullyViable[0];
          if (bestOverall.s === current.s || (bestOverall.termEl - current.termEl) < SAT_HYS) {
            selected = current; // hysteresis: stay
          } else {
            selected = bestOverall; // significantly better alternative
          }
        } else {
          selected = fullyViable[0];
        }
        activeSat = selected.s;

        // Gateway hysteresis within the selected satellite
        activeGw = selected.bestGw;
        let activeGwEl = selected.bestGwEl;
        if (prevGwId && selected.s === prevSatIdx) {
          const prevGw = activeGateways.find(g => g.id === prevGwId);
          if (prevGw) {
            const selSatLon = satLon(selected.s, t, numSats);
            const prevGwEl = elevAngle(prevGw.lat, prevGw.lon, selSatLon);
            if (prevGwEl >= gwMinEl && (selected.bestGwEl - prevGwEl) < GW_HYS) {
              activeGw = prevGw;
              activeGwEl = prevGwEl;
            }
          }
        }
        // Accumulate per-gateway elevation stats
        if (activeGw) {
          const st = gwElStats[activeGw.id] || (gwElStats[activeGw.id] = { sumEl: 0, minEl: 999, maxEl: -999, count: 0 });
          st.sumEl += activeGwEl;
          if (activeGwEl < st.minEl) st.minEl = activeGwEl;
          if (activeGwEl > st.maxEl) st.maxEl = activeGwEl;
          st.count += 1;
        }
      }

      // Handover tracking
      if (activeSat >= 0 && prevSatIdx >= 0 && activeSat !== prevSatIdx) {
        satHandovers++;
        satTransitions.push({ t: tHours, from: prevSatIdx, to: activeSat });
      }
      if (activeGw && prevGwId && activeGw.id !== prevGwId) {
        gwHandovers++;
        gwTransitions.push({ t: tHours, from: prevGwId, to: activeGw.id });
      }
      if (activeSat >= 0) satDuration[activeSat] = (satDuration[activeSat] || 0) + 1;
      if (activeGw)      gwDuration[activeGw.id] = (gwDuration[activeGw.id] || 0) + 1;

      // Update hysteresis state to the ACTUALLY USED sat/gateway (not preference)
      prevSatIdx = activeSat;
      prevGwId   = activeGw ? activeGw.id : null;

      // ── Tier 3: End-to-end service (EL ≥ 15° AND gateway available) ──
      const e2eOk = terminalOk && activeGw !== null;
      if (e2eOk) {
        e2eCovCount++;
        if (serviceGapStart !== null) { serviceGaps.push({ start: serviceGapStart, end: tHours }); serviceGapStart = null; }
      } else {
        // Service gap when terminal is viable but no GW is serving (subset selection effect)
        if (terminalOk && !activeGw && serviceGapStart === null) serviceGapStart = tHours;
        // Also close service gap tracking if terminal itself is the reason
        if (!terminalOk && serviceGapStart !== null) { serviceGaps.push({ start: serviceGapStart, end: tHours }); serviceGapStart = null; }
      }
    }

    // Close any open gaps at end of flight
    const flightEndH = +(durationSec / 3600).toFixed(2);
    if (gapStart        !== null) coverageGaps.push({ start: gapStart,        end: flightEndH });
    if (terminalGapStart !== null) terminalGaps.push({ start: terminalGapStart, end: flightEndH });
    if (serviceGapStart  !== null) serviceGaps.push({ start: serviceGapStart,   end: flightEndH });

    const totalSamples  = N + 1;
    const covPct         = +((covCount         / totalSamples) * 100).toFixed(1);
    const terminalCovPct = +((terminalCovCount  / totalSamples) * 100).toFixed(1);
    const e2eCovPct      = +((e2eCovCount       / totalSamples) * 100).toFixed(1);
    const durationHours  = +(durationSec / 3600).toFixed(2);

    // Elevation stats reflect Ka2517 terminal-viable samples only (EL ≥ 15°)
    const satSummary = Object.entries(satDuration)
      .map(([s, cnt]) => ({ sat: +s, minutes: Math.round(cnt * dt_min), pct: +((cnt / totalSamples) * 100).toFixed(1) }))
      .sort((a, b) => b.minutes - a.minutes);

    const gwSummary = Object.entries(gwDuration)
      .map(([id, cnt]) => {
        const gw = activeGateways.find(g => g.id === id);
        const st = gwElStats[id];
        return {
          id, name: gw?.name || id, country: gw?.country || "",
          minutes: Math.round(cnt * dt_min), pct: +((cnt / totalSamples) * 100).toFixed(1),
          azure: gw?.azure, operator: gw?.operator,
          avgEl: st && st.count > 0 ? +(st.sumEl / st.count).toFixed(1) : null,
          minEl: st && st.count > 0 ? +st.minEl.toFixed(1) : null,
          maxEl: st && st.count > 0 ? +st.maxEl.toFixed(1) : null,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return {
      origin: flightOrigin, dest: flightDest,
      dist, durationSec, durationHours, speedKmh: FLIGHT_SPEED_KMH,
      // Three-tier coverage
      covPct,          // Tier 1: constellation (any sat EL > 5°)
      terminalCovPct,  // Tier 2: Ka2517 terminal viable (EL ≥ 15°)
      e2eCovPct,       // Tier 3: end-to-end with active gateway
      serviceCovPct: e2eCovPct, // alias used elsewhere in JSX
      // Elevation stats (over terminal-viable samples)
      minEl: terminalCovCount > 0 ? +minEl.toFixed(1) : 0,
      maxEl: terminalCovCount > 0 ? +maxEl.toFixed(1) : 0,
      avgEl: terminalCovCount > 0 ? +(sumEl / terminalCovCount).toFixed(1) : 0,
      // Alternative satellite during "no active gateway" closures
      altTermElMin: altTermElCount > 0 ? +altTermElMin.toFixed(1) : null,
      altTermElMax: altTermElCount > 0 ? +altTermElMax.toFixed(1) : null,
      altTermElAvg: altTermElCount > 0 ? +(altTermElSum / altTermElCount).toFixed(1) : null,
      altTermElCount,
      // Handovers
      satHandovers, gwHandovers,
      satSummary, gwSummary,
      satTransitions, gwTransitions,
      // Gap arrays for all three tiers
      coverageGaps, terminalGaps, serviceGaps,
      numSats,
      activeGwCount: activeGateways.length,
    };
  }, [tab, flightMode, flightOrigin, flightDest, flightStartTime, simTime, numSats, activeGateways, gwMinEl, ka2517MinEl, realFlightTrack]);

  // Resource chart data — precomputed 400-sample sweep for Tab 6 chart + pairing table
  const resourceData = useMemo(() => {
    if (tab !== "resources" || !flightMode || !flightOrigin || !flightDest || flightStartTime === null) return null;
    const dist = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const durationSec = dist / FLIGHT_SPEED_KMS;
    const N = 400, SAT_HYS = 2, GW_HYS = 3;
    const dt_min = (durationSec / N) / 60;
    let prevSat = -1, prevGw = null;
    const chartPoints = [];
    const pairings = new Map(); // key -> pairing record
    const satHandoffs = [], gwHandoffs = [];
    let worstFwd = 0, worstRtn = 0, worstFwdPair = "", worstRtnPair = "";
    let covCount = 0;

    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const t = flightStartTime + f * durationSec;
      const pos = (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2)
        ? interpRealTrack(realFlightTrack, f)
        : gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, f);
      const pct = +(f * 100).toFixed(1);

      // Best sat with hysteresis
      let bestEl = -90, bestIdx = -1, pEl = -90;
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(pos.lat, pos.lon, satLon(s, t, numSats));
        if (el > bestEl) { bestEl = el; bestIdx = s; }
        if (s === prevSat) pEl = el;
      }
      let activeSat;
      if (prevSat >= 0 && pEl >= gwMinEl && (bestEl - pEl) < SAT_HYS) { activeSat = prevSat; bestEl = pEl; }
      else activeSat = bestEl >= gwMinEl ? bestIdx : -1;
      if (activeSat >= 0 && prevSat >= 0 && activeSat !== prevSat) satHandoffs.push(pct);
      prevSat = activeSat;

      if (activeSat < 0 || bestEl < gwMinEl) {
        chartPoints.push({ pct, fwdMhz: 0, rtnMhz: 0, el: 0, lowEl: true });
        prevGw = null;
        continue;
      }
      covCount++;
      const satLonNow = satLon(activeSat, t, numSats);

      // Best GW with hysteresis
      let bGw = null, bGwEl = -90, pGwEl = -90;
      for (const gw of activeGateways) {
        const gwEl = elevAngle(gw.lat, gw.lon, satLonNow);
        if (gwEl > bGwEl) { bGwEl = gwEl; bGw = gw; }
        if (gw.id === prevGw) pGwEl = gwEl;
      }
      let activeGwId;
      if (prevGw && pGwEl >= gwMinEl && (bGwEl - pGwEl) < GW_HYS) activeGwId = prevGw;
      else activeGwId = bGwEl >= gwMinEl ? bGw.id : null;
      if (activeGwId && prevGw && activeGwId !== prevGw) gwHandoffs.push(pct);
      prevGw = activeGwId;

      // Link budgets
      const fl = linkBudgetFL(bestEl, true);
      const rl = linkBudgetRL(bestEl, true);
      const fwdMhz = bwRequiredMhz(fwdCirMbps, fl.C_N);
      const rtnMhz = bwRequiredMhz(rtnCirMbps, rl.C_N);
      const lowEl = bestEl < ka2517MinEl;

      chartPoints.push({ pct, fwdMhz: fwdMhz || 0, rtnMhz: rtnMhz || 0, el: +bestEl.toFixed(1), lowEl, linkClosed: !fwdMhz || !rtnMhz });

      // Accumulate pairing
      if (activeGwId && activeSat >= 0) {
        const satName = getSatNames(numSats)[activeSat];
        const key = `${satName}|${activeGwId}`;
        const gwObj = activeGateways.find(g => g.id === activeGwId);
        if (!pairings.has(key)) {
          pairings.set(key, {
            satIdx: activeSat, satName, gwId: activeGwId,
            gwName: gwObj?.name || activeGwId, gwCountry: gwObj?.country || "",
            gwAzure: gwObj?.azure || false, gwOperator: gwObj?.operator || "",
            samples: 0, fwdWorst: 0, fwdSum: 0, rtnWorst: 0, rtnSum: 0,
            minEl: 999, sumEl: 0,
            fwdModcods: {}, rtnModcods: {},
            linkClosedCount: 0,
          });
        }
        const p = pairings.get(key);
        p.samples++;
        if (fwdMhz) { p.fwdWorst = Math.max(p.fwdWorst, fwdMhz); p.fwdSum += fwdMhz; }
        if (rtnMhz) { p.rtnWorst = Math.max(p.rtnWorst, rtnMhz); p.rtnSum += rtnMhz; }
        if (!fwdMhz || !rtnMhz) p.linkClosedCount++;
        if (bestEl < p.minEl) p.minEl = bestEl;
        p.sumEl += bestEl;
        if (fl.modcod) p.fwdModcods[fl.modcod.label] = (p.fwdModcods[fl.modcod.label] || 0) + 1;
        if (rl.modcod) p.rtnModcods[rl.modcod.label] = (p.rtnModcods[rl.modcod.label] || 0) + 1;

        if (fwdMhz && fwdMhz > worstFwd) { worstFwd = fwdMhz; worstFwdPair = `${satName} / ${gwObj?.name}`; }
        if (rtnMhz && rtnMhz > worstRtn) { worstRtn = rtnMhz; worstRtnPair = `${satName} / ${gwObj?.name}`; }
      }
    }

    // Finalize pairings
    const pairingList = [...pairings.values()].map(p => ({
      ...p,
      timeMin: Math.round(p.samples * dt_min),
      fwdAvg: p.samples > 0 ? Math.round(p.fwdSum / p.samples) : 0,
      rtnAvg: p.samples > 0 ? Math.round(p.rtnSum / p.samples) : 0,
      avgEl: p.samples > 0 ? +(p.sumEl / p.samples).toFixed(1) : 0,
      minEl: p.minEl < 999 ? +p.minEl.toFixed(1) : 0,
      linkClosedPct: p.samples > 0 ? +((p.linkClosedCount / p.samples) * 100).toFixed(1) : 0,
      fwdPrimaryModcod: Object.entries(p.fwdModcods).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—",
      rtnPrimaryModcod: Object.entries(p.rtnModcods).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—",
    })).sort((a, b) => b.timeMin - a.timeMin);

    return {
      chartPoints, pairingList, satHandoffs, gwHandoffs,
      worstFwd, worstRtn, worstFwdPair, worstRtnPair,
      covPct: +((covCount / (N + 1)) * 100).toFixed(1),
      dist, durationSec, durationHours: +(durationSec / 3600).toFixed(2),
    };
  }, [tab, flightMode, flightOrigin, flightDest, flightStartTime, numSats, fwdCirMbps, rtnCirMbps, activeGateways, gwMinEl, ka2517MinEl, realFlightTrack]);

  // ──────────────────────────────────────────────────────────────────────
  // Strategy comparison — three gateway/satellite handover policies, run
  // against the same flight path. Splash-zone radius (along-track semi-axis)
  // is the optimization metric: smaller = less satellite resource consumed.
  //
  //   S3 (free-pick):    optimal sat+GW pair at every step → smallest splash
  //   S2 (single-GW):    one fixed gateway, switch sats opportunistically
  //   S1 (single-GW + locked sat): one gateway, only switch sats when
  //                       current sat drops out of GW LOS → largest splash
  //
  // The single gateway used for S1/S2 is auto-selected as the gateway that
  // gives the BEST average S1 result over the flight (option C from spec).
  // ──────────────────────────────────────────────────────────────────────
  const strategyData = useMemo(() => {
    if (tab !== "strategy" || !flightMode || !flightOrigin || !flightDest || flightStartTime === null) return null;
    if (!activeGateways || activeGateways.length === 0) return { error: "No active gateways selected" };

    const dist = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const durationSec = dist / FLIGHT_SPEED_KMS;
    const N = 200;
    const dt_min = (durationSec / N) / 60;
    const ka2517Min = ka2517MinEl ?? 20;
    const gwMin     = gwMinEl ?? 10;
    const SAT_HYS   = 2;
    const BEAM_HALF = strategyBeamHalf;

    // Pre-compute path positions and per-step satellite geometry once
    const samples = []; // {pos, satEls:[{idx, el, satLon}]}
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const t = flightStartTime + f * durationSec;
      const pos = (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2)
        ? interpRealTrack(realFlightTrack, f)
        : gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, f);
      const satEls = [];
      for (let s = 0; s < numSats; s++) {
        const sl = satLon(s, t, numSats);
        const el = elevAngle(pos.lat, pos.lon, sl);
        satEls.push({ idx: s, el, satLon: sl });
      }
      satEls.sort((a, b) => b.el - a.el);
      samples.push({ pos, t, satEls });
    }

    // Footprint area (km^2) for the active beam at given terminal EL.
    // The beam ellipse on the ground has cross-track semi-axis b = d * tan(beamHalf)
    // and along-track semi-axis a = b / sin(EL). Area = pi * a * b.
    // Lower elevations therefore inflate the footprint dramatically.
    function footprintAreaKm2(el) {
      if (el < 1) return null;
      const d = groundSlantRange(Math.max(el, 1));
      const tanA = Math.tan(toRad(BEAM_HALF));
      const b = d * tanA;
      const a = b / Math.sin(toRad(Math.max(el, 1)));
      return Math.PI * a * b;
    }

    // ── Strategy S3: free-pick (optimal sat+gw at every step) ──
    // For each sample, find the highest-EL sat that has at least one GW with
    // bestGwEl >= gwMin; pick that GW.
    function runS3() {
      const out = [];
      let prevSat = -1, prevGw = null, satHo = 0, gwHo = 0;
      for (const s of samples) {
        let chosen = null;
        for (const sat of s.satEls) {
          if (sat.el < ka2517Min) break;
          let bGw = null, bGwEl = -90;
          for (const gw of activeGateways) {
            const e = elevAngle(gw.lat, gw.lon, sat.satLon);
            if (e > bGwEl) { bGwEl = e; bGw = gw; }
          }
          if (bGwEl >= gwMin && bGw) { chosen = { sat, gw: bGw, gwEl: bGwEl }; break; }
        }
        if (!chosen) {
          out.push({ closed: true });
          continue;
        }
        if (prevSat >= 0 && chosen.sat.idx !== prevSat) satHo++;
        if (prevGw && chosen.gw.id !== prevGw) gwHo++;
        prevSat = chosen.sat.idx;
        prevGw  = chosen.gw.id;
        out.push({ el: chosen.sat.el, area: footprintAreaKm2(chosen.sat.el), satIdx: chosen.sat.idx, gwId: chosen.gw.id, closed: false });
      }
      return { samples: out, satHo, gwHo };
    }

    // ── Strategy S2: single GW, opportunistic sat switching ──
    // Lock to one gateway. Each step, pick the highest-EL sat that *this gateway*
    // can see at >= gwMin. Use SAT_HYS to avoid jitter.
    function runS2(gw) {
      const out = [];
      let prevSat = -1, satHo = 0;
      for (const s of samples) {
        const viable = s.satEls.filter(sat => {
          if (sat.el < ka2517Min) return false;
          const ge = elevAngle(gw.lat, gw.lon, sat.satLon);
          return ge >= gwMin;
        });
        if (viable.length === 0) {
          out.push({ closed: true });
          continue;
        }
        // Hysteresis: keep current sat if still viable and best alt isn't >SAT_HYS better
        let chosen = viable[0];
        const cur = viable.find(v => v.idx === prevSat);
        if (cur && (viable[0].el - cur.el) < SAT_HYS) chosen = cur;
        if (prevSat >= 0 && chosen.idx !== prevSat) satHo++;
        prevSat = chosen.idx;
        out.push({ el: chosen.el, area: footprintAreaKm2(chosen.el), satIdx: chosen.idx, gwId: gw.id, closed: false });
      }
      return { samples: out, satHo, gwHo: 0 };
    }

    // ── Strategy S1: single GW, sat locked until forced switch ──
    // Stay on current sat until it drops out of GW LOS (or terminal scan).
    function runS1(gw) {
      const out = [];
      let curSat = -1, satHo = 0;
      for (const s of samples) {
        // Is current sat still viable through this gateway?
        let chosen = null;
        if (curSat >= 0) {
          const cur = s.satEls.find(x => x.idx === curSat);
          if (cur && cur.el >= ka2517Min) {
            const ge = elevAngle(gw.lat, gw.lon, cur.satLon);
            if (ge >= gwMin) chosen = cur;
          }
        }
        if (!chosen) {
          // Forced switch: pick best available
          for (const sat of s.satEls) {
            if (sat.el < ka2517Min) break;
            const ge = elevAngle(gw.lat, gw.lon, sat.satLon);
            if (ge >= gwMin) { chosen = sat; break; }
          }
          if (chosen) {
            if (curSat >= 0) satHo++;
            curSat = chosen.idx;
          }
        }
        if (!chosen) {
          out.push({ closed: true });
          continue;
        }
        out.push({ el: chosen.el, area: footprintAreaKm2(chosen.el), satIdx: chosen.idx, gwId: gw.id, closed: false });
      }
      return { samples: out, satHo, gwHo: 0 };
    }

    // Auto-pick the best single GW for S1/S2 (option C):
    // Score each GW by mean closed-sample splash on S1; pick the one with the lowest mean splash.
    let bestGw = null, bestS1Score = Infinity, bestS1 = null;
    const allS1Results = {};
    for (const gw of activeGateways) {
      const r = runS1(gw);
      const closedSamples = r.samples.filter(x => !x.closed);
      const meanArea = closedSamples.length
        ? closedSamples.reduce((acc, x) => acc + x.area, 0) / closedSamples.length
        : Infinity;
      allS1Results[gw.id] = { meanArea, openCount: closedSamples.length, run: r };
      if (meanArea < bestS1Score) { bestS1Score = meanArea; bestGw = gw; bestS1 = r; }
    }
    if (!bestGw) return { error: "No gateway can serve any portion of this flight" };
    const s2 = runS2(bestGw);
    const s3 = runS3();

    // Compose chart data
    // Stacked layout: y-bottom = S3 area, then S2 increment on top, then S1 increment on top.
    // The visible thickness of each band == the *cost* of dropping to that strategy.
    // Total stack height at any X = the S1 area for that sample.
    const chart = [];
    let s1Sum = 0, s2Sum = 0, s3Sum = 0;
    let s1N = 0, s2N = 0, s3N = 0;
    // Time-integrated area in km^2 * hours: sum(area * dt_hr), where dt_hr is per-sample width
    const dt_hr = (durationSec / N) / 3600;
    let s1AreaTime = 0, s2AreaTime = 0, s3AreaTime = 0;

    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const pct = +(f * 100).toFixed(1);
      const sa = bestS1.samples[i];
      const sb = s2.samples[i];
      const sc = s3.samples[i];
      const aS = sa.closed ? null : sa.area;
      const bS = sb.closed ? null : sb.area;
      const cS = sc.closed ? null : sc.area;
      // Stack increments. Note S3 <= S2 <= S1 by construction.
      let s3Layer = null, s2Inc = null, s1Inc = null;
      if (cS !== null) s3Layer = cS;
      if (bS !== null) s2Inc   = (cS !== null) ? Math.max(0, bS - cS) : bS;
      if (aS !== null) s1Inc   = (bS !== null) ? Math.max(0, aS - bS) : (cS !== null ? Math.max(0, aS - cS) : aS);
      chart.push({
        pct,
        s3Base: s3Layer,    // bottom layer (green)
        s2Inc:  s2Inc,      // cost of locking GW (allow sat switches)
        s1Inc:  s1Inc,      // cost of locking sat too (on top of S2)
        s1Total: aS, s2Total: bS, s3Total: cS,
        s1Closed: sa.closed, s2Closed: sb.closed, s3Closed: sc.closed,
        // Helpers for tooltip display: km^2 in pretty format
      });
      if (aS !== null) { s1Sum += aS; s1N++; s1AreaTime += aS * dt_hr; }
      if (bS !== null) { s2Sum += bS; s2N++; s2AreaTime += bS * dt_hr; }
      if (cS !== null) { s3Sum += cS; s3N++; s3AreaTime += cS * dt_hr; }
    }
    const tot = N + 1;

    return {
      chart,
      bestGw,
      durationHours: +(durationSec / 3600).toFixed(2),
      beamHalfDeg: BEAM_HALF,
      // Per-strategy summary: mean instantaneous area + total area-time (resource consumption)
      s1: {
        meanArea:   s1N ? s1Sum / s1N : null,
        totalAreaH: s1AreaTime,                 // km^2 * hours
        satHo: bestS1.satHo, gwHo: 0,
        availPct: +(s1N / tot * 100).toFixed(1),
      },
      s2: {
        meanArea:   s2N ? s2Sum / s2N : null,
        totalAreaH: s2AreaTime,
        satHo: s2.satHo, gwHo: 0,
        availPct: +(s2N / tot * 100).toFixed(1),
      },
      s3: {
        meanArea:   s3N ? s3Sum / s3N : null,
        totalAreaH: s3AreaTime,
        satHo: s3.satHo, gwHo: s3.gwHo,
        availPct: +(s3N / tot * 100).toFixed(1),
      },
      // Per-GW S1 breakdown using area now
      gwScores: Object.entries(allS1Results).map(([id, r]) => {
        const closed = r.run.samples.filter(x => !x.closed);
        const meanArea = closed.length
          ? closed.reduce((acc, x) => acc + x.area, 0) / closed.length
          : null;
        const totalAreaH = closed.length
          ? closed.reduce((acc, x) => acc + x.area * dt_hr, 0)
          : 0;
        return {
          id,
          name: activeGateways.find(g => g.id === id)?.name || id,
          meanArea, totalAreaH,
          availPct: +(r.openCount / tot * 100).toFixed(1),
        };
      }).sort((a, b) => (a.meanArea || Infinity) - (b.meanArea || Infinity)),
    };
  }, [tab, flightMode, flightOrigin, flightDest, flightStartTime, numSats, activeGateways, gwMinEl, ka2517MinEl, realFlightTrack, strategyBeamHalf]);

  // TX / RX time ribbon — 200 segments across the full flight duration
  // Each segment is classified into the 9-condition table and mapped to a colour.
  // TX and RX are differentiated by which link is the "worst link" in each condition.
  const TX_RIBBON_COLOR = {
    "pos-HIGH":"#ffd700","pos-MID":"#ff4444","pos-LOW":"#ffd700",
    "zero-HIGH":"#00ff88","zero-MID":"#7fff00","zero-LOW":"#ffd700",
    "neg-HIGH":"#00ff88","neg-MID":"#7fff00","neg-LOW":"#ffd700",
  };
  const RX_RIBBON_COLOR = {
    "pos-HIGH":"#7fff00","pos-MID":"#ff4444","pos-LOW":"#ff4444",
    "zero-HIGH":"#00ff88","zero-MID":"#7fff00","zero-LOW":"#ffd700",
    "neg-HIGH":"#00ff88","neg-MID":"#7fff00","neg-LOW":"#7fff00",
  };
  const CLOSED_COLOR = "#12192a";

  // Helper: for a given time step, compute the best GW elevation per satellite (above 0°)
  // Returns array of { satName, satIdx, satEl (terminal EL), gwName, gwEl } sorted by satEl desc
  function computeGwSatEls(allSatEls, t, nSats, gws) {
    const result = [];
    for (const { s, el } of allSatEls) {
      if (el <= 0) continue; // skip satellites below horizon
      const sl = satLon(s, t, nSats);
      let bestGwName = null, bestGwEl = -90;
      for (const gw of gws) {
        const gwEl = elevAngle(gw.lat, gw.lon, sl);
        if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGwName = gw.name; }
      }
      result.push({
        satIdx: s,
        satName: `mPOWER-${s + 1}`,
        satEl: +el.toFixed(1),
        gwName: bestGwEl > 0 ? bestGwName : null,
        gwEl:   bestGwEl > 0 ? +bestGwEl.toFixed(1) : null,
      });
    }
    return result.sort((a, b) => b.satEl - a.satEl);
  }

  const flightRibbon = useMemo(() => {
    if (!flightMode || !flightOrigin || !flightDest || flightStartTime === null) return null;
    const dist        = gcDist(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon);
    const durationSec = dist / FLIGHT_SPEED_KMS;
    const N           = 200;
    const tx = [], rx = [];
    const segments = [];       // per-segment hover data
    const SAT_HYS = 2;
    let prevSat = -1, prevGwId = null;

    for (let i = 0; i < N; i++) {
      const f   = (i + 0.5) / N;
      const t   = flightStartTime + f * durationSec;
      const pos = (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2)
        ? interpRealTrack(realFlightTrack, f)
        : gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, f);
      const tHours = +(f * durationSec / 3600).toFixed(2);

      // ── Collect ALL satellite elevations from terminal (sorted descending) ──
      const allSatEls = [];
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(pos.lat, pos.lon, satLon(s, t, numSats));
        allSatEls.push({ s, el });
      }
      allSatEls.sort((a, b) => b.el - a.el);
      const bestEl  = allSatEls[0].el;

      // ── Tier 1: Constellation visibility (any sat above gwMinEl) ──
      if (bestEl < gwMinEl) {
        prevSat = -1; prevGwId = null;
        tx.push(CLOSED_COLOR); rx.push(CLOSED_COLOR);
        const gwSatEls_ns = computeGwSatEls(allSatEls, t, numSats, activeGateways);
        segments.push({ tHours, closed: true, closedReason: "no sat", gwSatEls: gwSatEls_ns });
        continue;
      }

      // ── Build "fully viable" list: satellites where BOTH ends meet thresholds ──
      // For each sat, find the best gateway that can see it. A sat is fully viable
      // only if its terminal EL >= ka2517MinEl AND some gateway sees it >= gwMinEl.
      // Priority is gateway-aware: we consider ALL candidates that keep the circuit
      // up, not just the one with the highest terminal EL.
      const fullyViable = [];
      for (const { s, el } of allSatEls) {
        if (el < ka2517MinEl) break; // sorted desc, so rest are lower too
        const candSatLon = satLon(s, t, numSats);
        let bestGw = null, bestGwEl = -90;
        for (const gw of activeGateways) {
          const gwEl = elevAngle(gw.lat, gw.lon, candSatLon);
          if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGw = gw; }
        }
        if (bestGwEl >= gwMinEl && bestGw) {
          fullyViable.push({ s, termEl: el, bestGw, bestGwEl });
        }
      }

      // ── If nothing is fully viable, determine which threshold failed ──
      if (fullyViable.length === 0) {
        const termOk = allSatEls[0].el >= ka2517MinEl;
        prevSat = -1; prevGwId = null;
        tx.push(CLOSED_COLOR); rx.push(CLOSED_COLOR);
        const gwSatEls_fail = computeGwSatEls(allSatEls, t, numSats, activeGateways);
        segments.push({
          tHours, closed: true,
          closedReason: termOk ? "no active gateway" : "below Ka2517 floor",
          gwSatEls: gwSatEls_fail,
        });
        continue;
      }

      // ── Satellite selection with proper hysteresis ──
      // Priority: KEEP THE CIRCUIT UP. If current sat is still fully viable,
      // prefer to stay on it unless a significantly better alternative exists
      // (terminal EL improvement >= SAT_HYS AND the alternative is also fully viable).
      const GW_HYS = 3;
      let selected = null;
      const current = fullyViable.find(v => v.s === prevSat);
      if (current) {
        // Current sat still works — only switch if a significantly better option exists
        const bestOverall = fullyViable[0]; // highest terminal EL viable sat
        if (bestOverall.s === current.s || (bestOverall.termEl - current.termEl) < SAT_HYS) {
          selected = current; // stay — hysteresis holds
        } else {
          selected = bestOverall; // switch — alternative is significantly better
        }
      } else {
        // No current (first sample or previous sat no longer viable) → pick highest-EL viable
        selected = fullyViable[0];
      }

      const activeIdx = selected.s;
      const activeEl  = selected.termEl;
      const activeSatLon = satLon(activeIdx, t, numSats);

      // ── Gateway selection with hysteresis (among gateways that see selected sat) ──
      // If staying on the same sat and the previous GW still sees it >= gwMinEl,
      // prefer the previous GW unless another GW is significantly better.
      let activeGw = selected.bestGw;
      let activeGwEl = selected.bestGwEl;
      if (prevGwId && selected.s === prevSat) {
        const prevGw = activeGateways.find(g => g.id === prevGwId);
        if (prevGw) {
          const prevGwEl = elevAngle(prevGw.lat, prevGw.lon, activeSatLon);
          if (prevGwEl >= gwMinEl && (selected.bestGwEl - prevGwEl) < GW_HYS) {
            activeGw = prevGw;
            activeGwEl = prevGwEl;
          }
        }
      }

      // ── Update hysteresis state to the ACTUALLY USED satellite/gateway ──
      prevSat  = activeIdx;
      prevGwId = activeGw.id;

      const bearing  = gcBearing(pos.lat, pos.lon, flightDest.lat, flightDest.lon);
      const skew     = satSkewAngle(pos.lat, pos.lon, activeSatLon, bearing);
      const scan     = +(90 - activeEl).toFixed(1);
      const elZone   = activeEl >= 40 ? "HIGH" : activeEl >= 25 ? "MID" : "LOW";
      const skewPol  = Math.abs(skew) <= 10 ? "zero" : skew > 0 ? "pos" : "neg";
      const key      = `${skewPol}-${elZone}`;
      const txC      = TX_RIBBON_COLOR[key] || "#ffd700";
      const rxC      = RX_RIBBON_COLOR[key] || "#ffd700";

      tx.push(txC); rx.push(rxC);
      segments.push({
        tHours, closed: false,
        el: +activeEl.toFixed(1), scan, skew: +skew.toFixed(1),
        satIdx: activeIdx,
        satName: `mPOWER-${activeIdx + 1}`,
        satColor: SAT_COLORS[activeIdx],
        gwName: activeGw ? activeGw.name : "—",
        gwId:   activeGw ? activeGw.id   : null,
        gwCountry: activeGw ? activeGw.country : "",
        condKey: key, cond: LINK_CONDITIONS[key],
        txColor: txC, rxColor: rxC,
      });
    }

    // Build CSS step-gradient strings
    const toGradient = (arr) =>
      "linear-gradient(to right, " +
      arr.map((c, i) => `${c} ${(i/N*100).toFixed(1)}%, ${c} ${((i+1)/N*100).toFixed(1)}%`).join(", ") +
      ")";

    // Detect switch events: sat-only (black), gw-only (blue), both (white)
    const switches = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1], curr = segments[i];
      if (prev.closed || curr.closed) continue;
      const satChanged = prev.satIdx !== curr.satIdx;
      const gwChanged  = prev.gwId  !== curr.gwId && (prev.gwId || curr.gwId);
      if (!satChanged && !gwChanged) continue;
      const type = satChanged && gwChanged ? "both" : satChanged ? "sat" : "gw";
      switches.push({
        pct: (i / N) * 100,
        type,
        fromSat: prev.satName, toSat: curr.satName,
        fromGw:  prev.gwName,  toGw:  curr.gwName,
      });
    }

    return { txGradient: toGradient(tx), rxGradient: toGradient(rx), durationSec, N, segments, switches };
  }, [flightMode, flightOrigin, flightDest, flightStartTime, numSats, activeGateways, gwMinEl, ka2517MinEl, realFlightTrack]);

  // Convert switch fractions to lat/lon dots for the canvas map
  const pathMarkers = useMemo(() => {
    if (!flightRibbon || !flightOrigin || !flightDest) return [];
    return flightRibbon.switches.map(sw => {
      const f   = sw.pct / 100;
      const pos = (realFlightTrack && realFlightTrack.points && realFlightTrack.points.length >= 2)
        ? interpRealTrack(realFlightTrack, f)
        : gcInterp(flightOrigin.lat, flightOrigin.lon, flightDest.lat, flightDest.lon, f);
      return { lat: pos.lat, lon: pos.lon, type: sw.type,
               fromSat: sw.fromSat, toSat: sw.toSat,
               fromGw:  sw.fromGw,  toGw:  sw.toGw };
    });
  }, [flightRibbon, flightOrigin, flightDest]);
  const elevTimeData = useMemo(() => {
    if (tab !== "elevation") return [];
    const N = 250, T_w = 6 * 3600;
    return Array.from({length:N+1},(_,i)=>{
      const t = simTime + (i/N)*T_w;
      const row = { t: +((i/N)*6).toFixed(3) };
      for (let s=0; s<numSats; s++) {
        const el = elevAngle(gpLat, gpLon, satLon(s,t,numSats));
        row[`S${s+1}`] = el > -90 ? +el.toFixed(1) : null;
      }
      return row;
    });
  }, [simTime, gpLat, gpLon, numSats, tab, activeGateways, gwMinEl, ka2517MinEl]);

  // Handover data (24h) — only compute when tab is active
  const handoverData = useMemo(() => {
    if (tab !== "handover") return [];
    const N = 600, T_w = 24 * 3600;
    const SAT_HYSTERESIS = 2; // degrees — must beat current sat by this margin
    let prevSat = -1;
    return Array.from({length:N+1},(_,i)=>{
      const t = simTime + (i/N)*T_w;
      let bestEl=-90, bestIdx=0, prevEl=-90;
      for (let s=0; s<numSats; s++) {
        const el = elevAngle(gpLat,gpLon,satLon(s,t,numSats));
        if (el>bestEl){bestEl=el;bestIdx=s;}
        if (s===prevSat) prevEl=el;
      }
      // Hysteresis: keep current satellite unless a new one is significantly better
      let activeSat, activeEl;
      if (prevSat>=0 && prevEl>5 && (bestEl-prevEl)<SAT_HYSTERESIS) {
        activeSat=prevSat; activeEl=prevEl;
      } else {
        activeSat=bestEl>5?bestIdx:-1; activeEl=bestEl;
      }
      prevSat=activeSat;
      return { t:+((i/N)*24).toFixed(3), active:activeSat>=0?activeSat+1:0, maxEl:activeEl>5?+activeEl.toFixed(1):0 };
    });
  }, [simTime, gpLat, gpLon, numSats, tab, activeGateways, gwMinEl, ka2517MinEl]);

  // Stable min/avg elevation stats — computed over one full coverage repeat period
  // For N equally-spaced equatorial sats, coverage repeats every T_rel/N seconds
  const elevStats = useMemo(() => {
    if (tab !== "handover") return { minEl: "N/A", avgEl: "N/A" };
    const T_rel = 2 * Math.PI / w_rel; // ground-relative period (~6h)
    const T_repeat = T_rel / numSats;  // coverage repeat period
    // Snap to nearest repeat period boundary for stable values
    const t0 = Math.floor(simTime / T_repeat) * T_repeat;
    const N = 300;
    let sumEl = 0, count = 0, min = 999;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (i / N) * T_repeat;
      let bestEl = -90;
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(gpLat, gpLon, satLon(s, t, numSats));
        if (el > bestEl) bestEl = el;
      }
      if (bestEl >= gwMinEl) {
        sumEl += bestEl;
        count++;
        if (bestEl < min) min = bestEl;
      }
    }
    return {
      minEl: count > 0 ? min.toFixed(1) : "N/A",
      avgEl: count > 0 ? (sumEl / count).toFixed(1) : "N/A",
    };
  }, [simTime, gpLat, gpLon, numSats, tab, activeGateways, gwMinEl, ka2517MinEl]);

  // Gateway handover data (24h) — which GW serves the active satellite
  const gwHandoverData = useMemo(() => {
    if (tab !== "handover") return { timeline: [], summary: [] };
    const N = 600, T_w = 24 * 3600, dt_min = (T_w / N) / 60;
    const timeline = [];
    const gwDuration = {}; // gwId -> total samples
    const GW_HYSTERESIS = 3; // degrees — must beat current GW by this margin to trigger handover
    let prevGwId = null;

    for (let i = 0; i <= N; i++) {
      const t = simTime + (i / N) * T_w;
      // Find best satellite for the analysis point
      let bestEl = -90, bestSatIdx = -1;
      for (let s = 0; s < numSats; s++) {
        const el = elevAngle(gpLat, gpLon, satLon(s, t, numSats));
        if (el > bestEl) { bestEl = el; bestSatIdx = s; }
      }
      if (bestEl <= 5) {
        prevGwId = null;
        timeline.push({ t: +((i / N) * 24).toFixed(3), gw: null, gwEl: 0, sat: -1 });
        continue;
      }
      // For that satellite, find best gateway with hysteresis
      const satLonNow = satLon(bestSatIdx, t, numSats);
      let bestGw = null, bestGwEl = -90, prevGwEl = -90;
      for (const gw of activeGateways) {
        const gwEl = elevAngle(gw.lat, gw.lon, satLonNow);
        if (gwEl > bestGwEl) { bestGwEl = gwEl; bestGw = gw; }
        if (gw.id === prevGwId) prevGwEl = gwEl;
      }
      // Hysteresis: keep current gateway unless a new one is significantly better
      let activeGw;
      if (prevGwId && prevGwEl >= gwMinEl && (bestGwEl - prevGwEl) < GW_HYSTERESIS) {
        activeGw = activeGateways.find(g => g.id === prevGwId);
      } else {
        activeGw = bestGwEl >= gwMinEl ? bestGw : null;
      }
      if (activeGw) {
        gwDuration[activeGw.id] = (gwDuration[activeGw.id] || 0) + 1;
        prevGwId = activeGw.id;
      } else {
        prevGwId = null;
      }
      timeline.push({
        t: +((i / N) * 24).toFixed(3),
        gw: activeGw ? activeGw.id : null,
        gwName: activeGw ? activeGw.name : null,
        gwEl: activeGw ? +(elevAngle(activeGw.lat, activeGw.lon, satLonNow)).toFixed(1) : 0,
        sat: bestSatIdx,
      });
    }

    // Build summary: gateway durations sorted by time
    const summary = Object.entries(gwDuration)
      .map(([id, samples]) => {
        const gw = activeGateways.find(g => g.id === id);
        return { id, name: gw?.name || id, country: gw?.country || "", minutes: Math.round(samples * dt_min), azure: gw?.azure };
      })
      .sort((a, b) => b.minutes - a.minutes);

    // Count gateway handovers
    let gwHandovers = 0;
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].gw && timeline[i - 1].gw && timeline[i].gw !== timeline[i - 1].gw) gwHandovers++;
    }

    return { timeline, summary, gwHandovers };
  }, [simTime, gpLat, gpLon, numSats, tab, activeGateways, gwMinEl, ka2517MinEl]);

  const lb = useMemo(() => linkBudget(elSl), [elSl]);

  const currElevs = useMemo(() =>
    Array.from({length:numSats},(_,s)=>elevAngle(gpLat,gpLon,satLon(s,simTime,numSats))),
    [simTime,gpLat,gpLon,numSats]);

  const bestSat = currElevs.reduce((b,el,i)=>el>currElevs[b]?i:b,0);

  const hh=String(Math.floor((simTime/3600)%24)).padStart(2,"0");
  const mm=String(Math.floor((simTime/60)%60)).padStart(2,"0");
  const ss=String(Math.floor(simTime%60)).padStart(2,"0");

  // 24h dual-satellite coverage stats at 20°, 25°, 30° thresholds
  const VIS_THRESHOLDS = [20, 25, 30];
  const dualCoverageStats = useMemo(() => {
    if (tab !== "elevation") return null;
    const N = 720; // sample every 2 min over 24h
    const T_w = 24 * 3600;
    const dt_min = (T_w / N) / 60; // minutes per sample

    const stats = VIS_THRESHOLDS.map(thresh => {
      let dualCount = 0;
      // Track pair durations: key = "i-j" (i<j), value = sample count
      const pairSamples = {};

      for (let i = 0; i <= N; i++) {
        const t = simTime + (i / N) * T_w;
        // Find which sats are above threshold
        const visible = [];
        for (let s = 0; s < numSats; s++) {
          if (elevAngle(gpLat, gpLon, satLon(s, t, numSats)) >= thresh) visible.push(s);
        }
        if (visible.length >= 2) {
          dualCount++;
          // Record all pairs visible at this sample
          for (let a = 0; a < visible.length; a++) {
            for (let b = a + 1; b < visible.length; b++) {
              const key = `${visible[a]}-${visible[b]}`;
              pairSamples[key] = (pairSamples[key] || 0) + 1;
            }
          }
        }
      }

      // Convert pair samples to sorted list with durations
      const pairs = Object.entries(pairSamples)
        .map(([key, count]) => {
          const [a, b] = key.split("-").map(Number);
          return { a, b, minutes: Math.round(count * dt_min) };
        })
        .sort((x, y) => y.minutes - x.minutes)
        .slice(0, 3); // top 3 pairs

      const totalMin = Math.round(dualCount * dt_min);
      const totalH = +(totalMin / 60).toFixed(1);
      const pct = +((dualCount / (N + 1)) * 100).toFixed(1);

      return { thresh, totalMin, totalH, pct, pairs };
    });
    return stats;
  }, [simTime, gpLat, gpLon, numSats, tab, activeGateways, gwMinEl, ka2517MinEl]);

  // ── Styles ──────────────────────────────────────────────────
  const S = {
    root:  {background:"#080f1a",color:"#8ab0d0",fontFamily:"'Courier New',monospace",minHeight:"100vh",padding:isMobile?"6px":"12px",fontSize:isMobile?"11px":"12px"},
    hdr:   {display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",marginBottom:"10px",paddingBottom:"8px",borderBottom:"1px solid #1e3055",flexDirection:isMobile?"column":"row",gap:isMobile?"8px":"0"},
    title: {fontSize:isMobile?"13px":"15px",fontWeight:"bold",color:"#00cfff",letterSpacing:"0.08em"},
    sub:   {fontSize:isMobile?"9px":"10px",color:"#3a5a7a",marginTop:"3px"},
    ctrls: {display:"flex",gap:isMobile?"4px":"7px",alignItems:"center",flexWrap:"wrap"},
    btn:   a=>({background:a?"#00cfff22":"transparent",border:`1px solid ${a?"#00cfff":"#2e4270"}`,color:a?"#00cfff":"#8ab0d0",padding:isMobile?"3px 8px":"4px 12px",borderRadius:"3px",cursor:"pointer",fontSize:isMobile?"10px":"11px",fontFamily:"inherit"}),
    sel:   {background:"#0d1a2a",border:"1px solid #2e4270",color:"#8ab0d0",padding:"3px 6px",borderRadius:"3px",fontSize:isMobile?"10px":"11px",fontFamily:"inherit"},
    time:  {color:"#00cfff",fontSize:isMobile?"11px":"13px",fontWeight:"bold",background:"#0d1a2a",padding:"3px 10px",border:"1px solid #2e4270",borderRadius:"3px"},
    tabs:  {display:"flex",gap:"2px",marginBottom:"0",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"thin"},
    tab:   a=>({padding:isMobile?"4px 8px":"5px 14px",cursor:"pointer",background:a?"#0d1a2a":"transparent",borderTop:`1px solid ${a?"#00cfff":"#2e4270"}`,borderLeft:`1px solid ${a?"#00cfff":"#2e4270"}`,borderRight:`1px solid ${a?"#00cfff":"#2e4270"}`,borderBottom:a?"1px solid #0d1a2a":"1px solid #2e4270",color:a?"#00cfff":"#4a6a8a",fontSize:isMobile?"10px":"11px",borderRadius:"3px 3px 0 0",whiteSpace:"nowrap",flexShrink:0}),
    body:  {border:"1px solid #2e4270",borderRadius:"0 3px 3px 3px",padding:isMobile?"6px":"10px",background:"#0d1a2a"},
    grid2: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"},
    card:  hi=>({background:"#080f1a",border:`1px solid ${hi?"#00cfff44":"#2e4270"}`,borderRadius:"4px",padding:"10px"}),
    lbl:   {color:"#4a6a8a",fontSize:"10px",marginBottom:"4px"},
    lbRow: {display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #152030"},
    inp:   {background:"#080f1a",border:"1px solid #2e4270",color:"#8ab0d0",padding:"3px 6px",width:"65px",borderRadius:"3px",fontSize:"11px",fontFamily:"inherit"},
    slider:{width:"100%",accentColor:"#00cfff",cursor:"pointer"},
    badge: i=>({display:"inline-block",background:`${SAT_COLORS[i]}22`,border:`1px solid ${SAT_COLORS[i]}`,color:SAT_COLORS[i],padding:"1px 6px",borderRadius:"2px",fontSize:"10px",marginLeft:"4px"}),
  };

  const chartT = {background:"#080f1a",border:"1px solid #2e4270",fontSize:"10px",fontFamily:"'Courier New',monospace"};

  const gpControls = useMemo(() => {
    const tracking = flightData && !flightData.complete;
    return (
      <div style={{display:"flex",gap:"16px",alignItems:"center",marginBottom:"12px",flexWrap:"wrap"}}>
        <span style={{color:"#4a6a8a"}}>ANALYSIS POINT:</span>
        <label style={{color:tracking?"#5a7a9a":"#8ab0d0"}}>Lat
          <input type="number" min={-55} max={55} value={gpLat}
            disabled={tracking}
            onChange={e=>setGpLat(+e.target.value)}
            style={{...S.inp,marginLeft:"6px",
              ...(tracking?{borderColor:"#00ff88",background:"#0d1a14",color:"#00ff88",cursor:"not-allowed"}:{})}} />
        </label>
        <label style={{color:tracking?"#5a7a9a":"#8ab0d0"}}>Lon
          <input type="number" min={-180} max={180} value={gpLon}
            disabled={tracking}
            onChange={e=>setGpLon(+e.target.value)}
            style={{...S.inp,marginLeft:"6px",
              ...(tracking?{borderColor:"#00ff88",background:"#0d1a14",color:"#00ff88",cursor:"not-allowed"}:{})}} />
        </label>
        {tracking && (
          <span style={{color:"#00ff88",fontSize:"10px",fontWeight:"bold",background:"#00ff8815",
            border:"1px solid #00ff88",padding:"2px 8px",borderRadius:"3px",letterSpacing:"0.05em"}}>
            ✈ TRACKING FLIGHT — {flightData.isReal ? `${flightData.callsign||"real"} ` : ""}
            {(flightData.progress*100).toFixed(0)}%
          </span>
        )}
        {selectedCity && !tracking && (
          <span style={{color:"#00cfff",fontSize:"10px",background:"#00cfff15",border:"1px solid #00cfff44",padding:"2px 8px",borderRadius:"3px"}}>
            📍 {selectedCity}
          </span>
        )}
      </div>
    );
  }, [gpLat, gpLon, selectedCity, flightData]);

  // City search filter — instant local matching
  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return CITIES.slice(0, 20);
    return CITIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [cityQuery]);

  const handleCitySelect = useCallback((city) => {
    setGpLat(city.lat);
    setGpLon(city.lon);
    setSelectedCity(`${city.name}${city.country ? ", " + city.country : ""}`);
    setPins([]);  // clear any existing pin
    setCityQuery("");
    setCityOpen(false);
  }, []);

  // Close dropdown when clicking outside — use capture phase to fire before d3.zoom
  useEffect(() => {
    if (!cityOpen) return;
    const handleClickOutside = (e) => {
      if (cityInputRef.current && !cityInputRef.current.contains(e.target)) {
        setCityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("pointerdown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("pointerdown", handleClickOutside, true);
    };
  }, [cityOpen]);

  // Airport search filters
  const filteredApts1 = useMemo(() => {
    const q = aptQ1.trim().toLowerCase();
    if (!q) return AIRPORTS.slice(0, 20);
    return AIRPORTS.filter(a =>
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [aptQ1]);

  const filteredApts2 = useMemo(() => {
    const q = aptQ2.trim().toLowerCase();
    if (!q) return AIRPORTS.slice(0, 20);
    return AIRPORTS.filter(a =>
      a.iata.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [aptQ2]);

  // Click-outside for airport dropdowns
  useEffect(() => {
    if (!aptOpen1) return;
    const h = e => { if (aptRef1.current && !aptRef1.current.contains(e.target)) setAptOpen1(false); };
    document.addEventListener("mousedown", h, true);
    return () => document.removeEventListener("mousedown", h, true);
  }, [aptOpen1]);
  useEffect(() => {
    if (!aptOpen2) return;
    const h = e => { if (aptRef2.current && !aptRef2.current.contains(e.target)) setAptOpen2(false); };
    document.addEventListener("mousedown", h, true);
    return () => document.removeEventListener("mousedown", h, true);
  }, [aptOpen2]);
  useEffect(() => {
    if (!aptOpenReal) return;
    const h = e => { if (aptRefReal.current && !aptRefReal.current.contains(e.target)) setAptOpenReal(false); };
    document.addEventListener("mousedown", h, true);
    return () => document.removeEventListener("mousedown", h, true);
  }, [aptOpenReal]);

  return (
    <div style={S.root}>

      {/* Header */}
      <div style={S.hdr}>
        <div>
          <div style={S.title}>▸ mPOWER MEO CONSTELLATION SIMULATOR <span style={{fontSize:"10px",color:"#3a5a7a",fontWeight:"normal",marginLeft:"8px"}}>{VERSION}</span></div>
          <div style={S.sub}>{numSats} × Boeing 702SP · 8 063 km equatorial · Ka-band · {satSpacing}° spacing</div>
        </div>
        <div style={S.ctrls}>
          <span style={S.time}>T+ {hh}:{mm}:{ss}</span>
          <button style={S.btn(playing)} onClick={()=>setPlaying(p=>!p)}>
            {playing?"⏸ PAUSE":"▶ PLAY"}
          </button>
          <button style={S.btn(false)} onClick={()=>{
            setPlaying(false); setSimTime(0); simTimeRef.current=0;
          }}>⏮ RESET</button>
          <select style={S.sel} value={speed} onChange={e=>setSpeed(+e.target.value)}>
            <option value={30}>30× real</option>
            <option value={120}>120× real</option>
            <option value={300}>300× real</option>
            <option value={600}>600× real</option>
            <option value={3600}>3600× (1h/s)</option>
          </select>
          <span style={{color:"#4a6a8a",fontSize:"9px",marginLeft:"4px"}}>SATS:</span>
          <div style={{display:"flex",gap:"1px"}}>
            {[5,6,7,8,9,10,11].map(n=>(
              <button key={n} onClick={()=>setNumSats(n)}
                style={{background:numSats===n?"#00cfff22":"#080f1a",
                  border:`1px solid ${numSats===n?"#00cfff":"#2e4270"}`,
                  color:numSats===n?"#00cfff":"#4a6a8a",
                  padding:"3px 8px",fontSize:"11px",fontFamily:"inherit",
                  cursor:"pointer",borderRadius:n===6?"3px 0 0 3px":n===11?"0 3px 3px 0":"0",
                  fontWeight:numSats===n?"bold":"normal",minWidth:"28px"}}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          ["coverage","◎ COVERAGE MAP"],
          ...(flightMode ? [["flight","✈ FLIGHT SUMMARY"],["resources","📊 RESOURCES"],["strategy","⊞ STRATEGY"]] : []),
          ["gateways","🗂 GATEWAYS"],
          ["weather","🌩 GW WEATHER RISK"],
          ["beam","📡 BEAM PROJECTION"],
          ["handover","⇄ HANDOVER"],
          ["elevation","∠ ELEVATION/TIME"],
          ["linkbudget","📡 LINK BUDGET"],
        ].map(([id,lbl])=>(
          <div key={id} style={S.tab(tab===id)} onClick={()=>setTab(id)}>{lbl}</div>
        ))}
      </div>

      <div style={S.body}>

        {/* ════ TAB 1 — Coverage Map ════ */}
        {tab==="coverage" && (
          <div>
            {/* Contour legend */}
            <div style={{display:"flex",gap:"4px",marginBottom:"8px",flexWrap:"wrap",alignItems:"center"}}>
              <span style={{color:"#4a6a8a",fontSize:"10px",marginRight:"4px"}}>ELEVATION CONTOURS:</span>
              {EL_LEVELS.map(el=>(
                <span key={el} style={{padding:"1px 5px",borderRadius:"2px",fontSize:"9px",border:"1px solid #4a6a8a",color:"#c0d8f0",opacity:contourOpacity(el)+0.2,fontWeight:el%10===0?"bold":"normal"}}>
                  {el}°
                </span>
              ))}
              <span style={{color:"#3a5a7a",fontSize:"9px",marginLeft:"6px"}}>outermost = 5° min el · innermost = 60° · faded zone beyond ±40° = outside SES service area</span>
              <span style={{color:GW_COLOR,fontSize:"9px",marginLeft:"8px",border:`1px solid ${GW_COLOR}`,padding:"0 4px",borderRadius:"2px"}}>■ Gateways</span>
              <span style={{color:"rgba(255,200,0,0.9)",fontSize:"9px",marginLeft:"8px",
                border:"1px solid rgba(255,200,0,0.5)",padding:"0 4px",borderRadius:"2px",
                background:"rgba(255,200,0,0.08)"}}>
                ±10° NGSO only
              </span>
              <label style={{color:"#4a6a8a",fontSize:"9px",marginLeft:"8px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"3px"}}>
                <input type="checkbox" checked={showGwLink} onChange={e=>setShowGwLink(e.target.checked)}
                  style={{accentColor:GW_COLOR,width:"11px",height:"11px",cursor:"pointer"}} />
                Show GW link
              </label>
              <label style={{color:"#4a6a8a",fontSize:"9px",marginLeft:"12px",display:"inline-flex",alignItems:"center",gap:"5px"}}>
                GW min EL:
                <input type="number" min={0} max={30} step={1} value={gwMinEl}
                  onChange={e=>setGwMinEl(Math.max(0,Math.min(30,+e.target.value)))}
                  style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#ff9900",
                    padding:"1px 4px",width:"38px",borderRadius:"3px",fontSize:"9px",
                    fontFamily:"inherit",textAlign:"center"}}/>
                <span style={{color:"#ff990088"}}>deg</span>
              </label>
              <label style={{color:"#4a6a8a",fontSize:"9px",marginLeft:"12px",display:"inline-flex",alignItems:"center",gap:"5px"}}>
                Ka2517 min EL:
                <input type="number" min={0} max={45} step={1} value={ka2517MinEl}
                  onChange={e=>setKa2517MinEl(Math.max(0,Math.min(45,+e.target.value)))}
                  style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#b07aff",
                    padding:"1px 4px",width:"38px",borderRadius:"3px",fontSize:"9px",
                    fontFamily:"inherit",textAlign:"center"}}/>
                <span style={{color:"#b07aff88"}}>deg</span>
              </label>
            </div>

            {/* City search + analysis point controls */}
            <div style={{display:"flex",gap:"12px",alignItems:"flex-start",marginBottom:"10px",flexWrap:"wrap"}}>
              {/* City search */}
              <div ref={cityInputRef} style={{position:"relative",flex:"0 0 auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <span style={{color:"#4a6a8a",fontSize:"10px",whiteSpace:"nowrap"}}>CITY LOOKUP:</span>
                  <input
                    type="text"
                    placeholder="Search city…"
                    value={cityQuery}
                    onChange={e=>{setCityQuery(e.target.value);setCityOpen(true);}}
                    onFocus={()=>setCityOpen(true)}
                    style={{background:"#080f1a",border:"1px solid #2e4270",color:"#8ab0d0",
                      padding:"4px 8px",width:"220px",borderRadius:"3px",fontSize:"11px",fontFamily:"inherit"}}
                  />
                </div>
                {cityOpen && filteredCities.length > 0 && (
                  <div style={{position:"absolute",top:"100%",left:"0",marginTop:"2px",zIndex:50,
                    background:"#0b1622",border:"1px solid #2e4270",borderRadius:"3px",
                    maxHeight:"260px",overflowY:"auto",width:"320px",boxShadow:"0 4px 12px rgba(0,0,0,0.6)"}}>
                    {filteredCities.map((city,i)=>(
                      <div key={`${city.name}-${city.country}-${i}`}
                        onClick={()=>handleCitySelect(city)}
                        style={{padding:"5px 10px",cursor:"pointer",borderBottom:"1px solid #152030",
                          display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px",
                          background:i%2===0?"transparent":"#080f1a22"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#00cfff15"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#080f1a22"}>
                        <span style={{color:"#c0d8f0",fontSize:"11px"}}>{city.name}</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",whiteSpace:"nowrap"}}>{city.country} · {city.lat.toFixed(1)}°, {city.lon.toFixed(1)}°</span>
                      </div>
                    ))}
                  </div>
                )}
                {cityOpen && filteredCities.length === 0 && cityQuery.trim().length >= 2 && (
                  <div style={{position:"absolute",top:"100%",left:"0",marginTop:"2px",zIndex:50,
                    background:"#0b1622",border:"1px solid #2e4270",borderRadius:"3px",
                    width:"320px",boxShadow:"0 4px 12px rgba(0,0,0,0.6)",padding:"8px 10px"}}>
                    <div style={{color:"#3a5a7a",fontSize:"10px"}}>No match — use Lat/Lon fields to enter manually</div>
                  </div>
                )}
              </div>
              {/* Analysis point display */}
              <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                <span style={{color:"#4a6a8a",fontSize:"10px"}}>ANALYSIS POINT:</span>
                <label style={{color:"#8ab0d0",fontSize:"11px"}}>Lat
                  <input type="number" min={-55} max={55} value={gpLat}
                    onChange={e=>{setGpLat(+e.target.value);setSelectedCity(null);}} style={{...S.inp,marginLeft:"4px"}} />
                </label>
                <label style={{color:"#8ab0d0",fontSize:"11px"}}>Lon
                  <input type="number" min={-180} max={180} value={gpLon}
                    onChange={e=>{setGpLon(+e.target.value);setSelectedCity(null);}} style={{...S.inp,marginLeft:"4px"}} />
                </label>
                {selectedCity && (
                  <span style={{color:"#00cfff",fontSize:"10px",background:"#00cfff15",border:"1px solid #00cfff44",padding:"2px 8px",borderRadius:"3px"}}>
                    📍 {selectedCity}
                  </span>
                )}
              </div>
            </div>

            {/* Flight Simulation Controls */}
            <div style={{background:"#080f1a",border:`1px solid ${flightMode?"#00ff8844":"#1e3055"}`,borderRadius:"4px",padding:"8px 12px",marginBottom:"10px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                <label style={{color:"#00ff88",fontSize:"10px",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}>
                  <input type="checkbox" checked={flightMode}
                    onChange={e=>{
                      setFlightMode(e.target.checked);
                      if(!e.target.checked){setFlightStartTime(null);setFlightOrigin(null);setFlightDest(null);setFlightSelecting(null);setPins([]);}
                    }}
                    style={{accentColor:"#00ff88",width:"12px",height:"12px",cursor:"pointer"}} />
                  ✈ FLIGHT SIM
                </label>
                {flightMode && (
                  <>
                    {/* Origin airport search */}
                    <div ref={aptRef1} style={{position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                        <span style={{color:"#4a6a8a",fontSize:"9px",whiteSpace:"nowrap"}}>FROM:</span>
                        <input
                          type="text"
                          placeholder="Airport or IATA…"
                          value={flightOrigin ? `${flightOrigin.iata} – ${flightOrigin.name}` : aptQ1}
                          onChange={e=>{setAptQ1(e.target.value);setFlightOrigin(null);setAptOpen1(true);}}
                          onFocus={()=>{if(!flightOrigin)setAptOpen1(true);}}
                          style={{background:"#0d1a2a",border:`1px solid ${flightOrigin?"#00ff8866":"#2e4270"}`,
                            color:"#00ff88",padding:"3px 7px",width:"190px",borderRadius:"3px",
                            fontSize:"10px",fontFamily:"inherit"}}
                        />
                        {flightOrigin && (
                          <button onClick={()=>{setFlightOrigin(null);setAptQ1("");}}
                            style={{background:"transparent",border:"none",color:"#4a6a8a",
                              cursor:"pointer",fontSize:"13px",padding:"0 2px",lineHeight:1}}>×</button>
                        )}
                      </div>
                      {aptOpen1 && !flightOrigin && filteredApts1.length > 0 && (
                        <div style={{position:"absolute",top:"100%",left:0,marginTop:"2px",zIndex:60,
                          background:"#0b1622",border:"1px solid #2e4270",borderRadius:"3px",
                          maxHeight:"220px",overflowY:"auto",width:"300px",
                          boxShadow:"0 4px 16px rgba(0,0,0,0.7)"}}>
                          {filteredApts1.map((a,i)=>(
                            <div key={a.iata}
                              onClick={()=>{setFlightOrigin({iata:a.iata,name:a.name,city:a.city,lat:a.lat,lon:a.lon});setAptQ1("");setAptOpen1(false);}}
                              style={{padding:"5px 10px",cursor:"pointer",borderBottom:"1px solid #152030",
                                display:"flex",alignItems:"center",gap:"8px",
                                background:i%2===0?"transparent":"#080f1a22"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#00ff8812"}
                              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#080f1a22"}>
                              <span style={{color:"#00ff88",fontSize:"10px",fontWeight:"bold",minWidth:"32px"}}>{a.iata}</span>
                              <div style={{flex:1}}>
                                <div style={{color:"#c0d8f0",fontSize:"10px"}}>{a.name}</div>
                                <div style={{color:"#4a6a8a",fontSize:"8px"}}>{a.city} · {a.country}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Drop on map toggle for origin */}
                    <label title="Click on map to set origin" style={{
                      color: flightSelecting==="origin" ? "#00ff88" : "#4a6a8a",
                      fontSize:"9px",cursor:"pointer",display:"flex",alignItems:"center",
                      gap:"3px",userSelect:"none",whiteSpace:"nowrap",
                      border: `1px solid ${flightSelecting==="origin"?"#00ff8866":"#2e4270"}`,
                      borderRadius:"3px",padding:"2px 6px",
                      background: flightSelecting==="origin"?"#00ff8811":"transparent",
                    }}>
                      <input type="checkbox"
                        checked={flightSelecting==="origin"}
                        onChange={e=>setFlightSelecting(e.target.checked?"origin":null)}
                        style={{accentColor:"#00ff88",width:"10px",height:"10px",cursor:"pointer"}}/>
                      Pin origin
                    </label>

                    <span style={{color:"#4a6a8a",fontSize:"14px"}}>→</span>

                    {/* Destination airport search */}
                    <div ref={aptRef2} style={{position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                        <span style={{color:"#4a6a8a",fontSize:"9px",whiteSpace:"nowrap"}}>TO:</span>
                        <input
                          type="text"
                          placeholder="Airport or IATA…"
                          value={flightDest ? `${flightDest.iata} – ${flightDest.name}` : aptQ2}
                          onChange={e=>{setAptQ2(e.target.value);setFlightDest(null);setAptOpen2(true);}}
                          onFocus={()=>{if(!flightDest)setAptOpen2(true);}}
                          style={{background:"#0d1a2a",border:`1px solid ${flightDest?"#ff6b3566":"#2e4270"}`,
                            color:"#ff6b35",padding:"3px 7px",width:"190px",borderRadius:"3px",
                            fontSize:"10px",fontFamily:"inherit"}}
                        />
                        {flightDest && (
                          <button onClick={()=>{setFlightDest(null);setAptQ2("");}}
                            style={{background:"transparent",border:"none",color:"#4a6a8a",
                              cursor:"pointer",fontSize:"13px",padding:"0 2px",lineHeight:1}}>×</button>
                        )}
                      </div>
                      {aptOpen2 && !flightDest && filteredApts2.length > 0 && (
                        <div style={{position:"absolute",top:"100%",left:0,marginTop:"2px",zIndex:60,
                          background:"#0b1622",border:"1px solid #2e4270",borderRadius:"3px",
                          maxHeight:"220px",overflowY:"auto",width:"300px",
                          boxShadow:"0 4px 16px rgba(0,0,0,0.7)"}}>
                          {filteredApts2.map((a,i)=>(
                            <div key={a.iata}
                              onClick={()=>{setFlightDest({iata:a.iata,name:a.name,city:a.city,lat:a.lat,lon:a.lon});setAptQ2("");setAptOpen2(false);}}
                              style={{padding:"5px 10px",cursor:"pointer",borderBottom:"1px solid #152030",
                                display:"flex",alignItems:"center",gap:"8px",
                                background:i%2===0?"transparent":"#080f1a22"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#ff6b3512"}
                              onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#080f1a22"}>
                              <span style={{color:"#ff6b35",fontSize:"10px",fontWeight:"bold",minWidth:"32px"}}>{a.iata}</span>
                              <div style={{flex:1}}>
                                <div style={{color:"#c0d8f0",fontSize:"10px"}}>{a.name}</div>
                                <div style={{color:"#4a6a8a",fontSize:"8px"}}>{a.city} · {a.country}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Drop on map toggle for dest */}
                    <label title="Click on map to set destination" style={{
                      color: flightSelecting==="dest" ? "#ff6b35" : "#4a6a8a",
                      fontSize:"9px",cursor:"pointer",display:"flex",alignItems:"center",
                      gap:"3px",userSelect:"none",whiteSpace:"nowrap",
                      border: `1px solid ${flightSelecting==="dest"?"#ff6b3566":"#2e4270"}`,
                      borderRadius:"3px",padding:"2px 6px",
                      background: flightSelecting==="dest"?"#ff6b3511":"transparent",
                    }}>
                      <input type="checkbox"
                        checked={flightSelecting==="dest"}
                        onChange={e=>setFlightSelecting(e.target.checked?"dest":null)}
                        style={{accentColor:"#ff6b35",width:"10px",height:"10px",cursor:"pointer"}}/>
                      Pin dest
                    </label>

                    {/* Launch / Reset / Restart */}
                    {flightOrigin && flightDest && !flightStartTime && (
                      <button onClick={()=>{
                        setFlightStartTime(simTime);
                        setGpLat(flightOrigin.lat); setGpLon(flightOrigin.lon);
                        setPins([]); setSelectedCity(null);
                        if(!playing) setPlaying(true);
                      }} style={{background:"#00ff8822",border:"1px solid #00ff88",color:"#00ff88",
                        padding:"3px 12px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",fontWeight:"bold"}}>
                        ▶ LAUNCH
                      </button>
                    )}
                    {flightStartTime !== null && (
                      <div style={{display:"flex",gap:"5px"}}>
                        <button onClick={()=>{
                          setFlightStartTime(simTime);
                          setGpLat(flightOrigin.lat); setGpLon(flightOrigin.lon);
                          setPins([]); setSelectedCity(null);
                          if(!playing) setPlaying(true);
                        }} style={{background:"#00ff8822",border:"1px solid #00ff88",color:"#00ff88",
                          padding:"3px 12px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit",fontWeight:"bold"}}>
                          ↺ RESTART
                        </button>
                        <button onClick={()=>{setFlightStartTime(null);setFlightOrigin(null);setFlightDest(null);setAptQ1("");setAptQ2("");setPins([]);}} style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",
                          padding:"3px 10px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"}}>
                          ⏮ RESET
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Real Flight (OpenSky) toggle and search ── */}
              {flightMode && (
                <div style={{marginTop:"8px",paddingTop:"8px",borderTop:"1px dashed #2e4270"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                    <label style={{color:realFlightMode?"#00cfff":"#4a6a8a",fontSize:"10px",cursor:"pointer",
                      display:"flex",alignItems:"center",gap:"4px"}}>
                      <input type="checkbox" checked={realFlightMode}
                        onChange={e=>{
                          setRealFlightMode(e.target.checked);
                          if (!e.target.checked) clearRealFlight();
                          else { const today = new Date(); today.setUTCDate(today.getUTCDate()-1);
                            setRealFlightSearch({ airport:"", date: today.toISOString().slice(0,10) });
                          }
                        }}
                        style={{accentColor:"#00cfff",width:"12px",height:"12px",cursor:"pointer"}} />
                      🛰 REAL FLIGHT (OpenSky)
                    </label>
                    {realFlightMode && (
                      <>
                        {/* Airport search */}
                        <div ref={aptRefReal} style={{position:"relative"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                            <span style={{color:"#4a6a8a",fontSize:"9px"}}>AIRPORT:</span>
                            <input type="text" placeholder="ICAO/IATA/city…"
                              value={realFlightSearch.airport ? realFlightSearch.airport : aptQReal}
                              onChange={e=>{ setAptQReal(e.target.value); setAptOpenReal(true);
                                setRealFlightSearch({ ...realFlightSearch, airport: "" }); }}
                              onFocus={()=>setAptOpenReal(true)}
                              style={{...S.sel,width:"160px",fontSize:"10px"}} />
                          </div>
                          {aptOpenReal && aptQReal.length > 0 && (
                            <div style={{position:"absolute",top:"100%",left:0,marginTop:"2px",
                              background:"#0d1a2a",border:"1px solid #2e4270",borderRadius:"3px",
                              maxHeight:"200px",overflowY:"auto",zIndex:100,minWidth:"260px"}}>
                              {REAL_FLIGHT_AIRPORTS.filter(a=>{
                                const q = aptQReal.toLowerCase();
                                return a.icao.toLowerCase().includes(q) || a.iata.toLowerCase().includes(q) || a.city.toLowerCase().includes(q);
                              }).slice(0,12).map(a=>(
                                <div key={a.icao} onClick={()=>{
                                  setRealFlightSearch({ ...realFlightSearch, airport: a.icao });
                                  setAptQReal(`${a.icao} – ${a.city}`); setAptOpenReal(false);
                                }} style={{padding:"4px 8px",cursor:"pointer",fontSize:"10px",borderBottom:"1px solid #152030",color:"#8ab0d0"}}>
                                  <span style={{color:"#00cfff",fontWeight:"bold"}}>{a.icao}</span>
                                  <span style={{color:"#4a6a8a"}}> / {a.iata}</span> – {a.city}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Date picker */}
                        <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                          <span style={{color:"#4a6a8a",fontSize:"9px"}}>DATE:</span>
                          <input type="date" value={realFlightSearch.date}
                            max={new Date(Date.now()-86400000).toISOString().slice(0,10)}
                            onChange={e=>setRealFlightSearch({ ...realFlightSearch, date: e.target.value })}
                            style={{...S.sel,fontSize:"10px"}} />
                        </div>
                        {/* Search button */}
                        <button
                          onClick={()=>{
                            if (!realFlightSearch.airport) { setRealFlightError("Pick an airport first"); return; }
                            if (!realFlightSearch.date)    { setRealFlightError("Pick a date first"); return; }
                            searchRealFlights(realFlightSearch.airport, realFlightSearch.date);
                          }}
                          disabled={realFlightLoading}
                          style={{background:"#00cfff22",border:"1px solid #00cfff",color:"#00cfff",
                            padding:"3px 12px",borderRadius:"3px",cursor:realFlightLoading?"wait":"pointer",
                            fontSize:"10px",fontFamily:"inherit",fontWeight:"bold",opacity:realFlightLoading?0.6:1}}>
                          {realFlightLoading ? "…" : "🔍 SEARCH"}
                        </button>
                        {realFlightTrack && (
                          <button onClick={clearRealFlight}
                            style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",
                              padding:"3px 10px",borderRadius:"3px",cursor:"pointer",fontSize:"10px"}}>
                            ✕ CLEAR
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* (E) Recent airport quick-pick chips */}
                  {realFlightMode && recentAirports.length > 0 && !realFlightTrack && (
                    <div style={{marginTop:"6px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em"}}>RECENT:</span>
                      {recentAirports.map(icao => {
                        const apt = REAL_FLIGHT_AIRPORTS.find(a => a.icao === icao);
                        const label = apt ? `${apt.iata} ${apt.city}` : icao;
                        return (
                          <button key={icao} onClick={() => {
                            setRealFlightSearch({ ...realFlightSearch, airport: icao });
                            setAptQReal(apt ? `${apt.icao} – ${apt.city}` : icao);
                          }} style={{background:"#0d1a2a",border:"1px solid #2e4270",color:"#8ab0d0",
                            padding:"2px 8px",borderRadius:"10px",cursor:"pointer",fontSize:"9px",
                            fontFamily:"inherit"}}>
                            {label}
                          </button>
                        );
                      })}
                      <button onClick={() => { setRecentAirports([]); lsSet(LS_RECENT_AIRPORTS, []); }}
                        style={{background:"transparent",border:"none",color:"#4a6a8a",cursor:"pointer",
                          fontSize:"9px",textDecoration:"underline"}}>
                        clear
                      </button>
                    </div>
                  )}

                  {/* (E) Recent flight chips - one-click re-load */}
                  {realFlightMode && recentFlights.length > 0 && !realFlightTrack && (
                    <div style={{marginTop:"6px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em"}}>RECENT FLIGHTS:</span>
                      {recentFlights.map((f, i) => {
                        const date = new Date(f.firstSeen * 1000).toISOString().slice(5, 10); // MM-DD
                        return (
                          <button key={i} onClick={() => loadRealFlightTrack({
                            icao24: f.icao24, callsign: f.callsign,
                            estDepartureAirport: f.from, estArrivalAirport: f.to,
                            firstSeen: f.firstSeen, lastSeen: f.lastSeen,
                          })} style={{background:"#0d1a2a",border:"1px solid #00cfff44",color:"#00cfff",
                            padding:"2px 8px",borderRadius:"10px",cursor:"pointer",fontSize:"9px",
                            fontFamily:"inherit",whiteSpace:"nowrap"}}>
                            {prettyCallsign(f.callsign)} · {prettyAirport(f.from)} → {prettyAirport(f.to)} · {date}
                          </button>
                        );
                      })}
                      <button onClick={() => { setRecentFlights([]); lsSet(LS_RECENT_FLIGHTS, []); }}
                        style={{background:"transparent",border:"none",color:"#4a6a8a",cursor:"pointer",
                          fontSize:"9px",textDecoration:"underline"}}>
                        clear
                      </button>
                    </div>
                  )}

                  {/* Error display */}
                  {realFlightError && (
                    <div style={{marginTop:"6px",color:"#ff6b35",fontSize:"10px",
                      background:"#ff6b3512",border:"1px solid #ff6b3544",borderRadius:"3px",padding:"4px 8px"}}>
                      ⚠ {realFlightError}
                    </div>
                  )}

                  {/* (A,C) Search results list with filter and friendly labels */}
                  {realFlightMode && Array.isArray(realFlightResults) && realFlightResults.length > 0 && !realFlightTrack && (() => {
                    const q = resultsFilter.trim().toLowerCase();
                    // Filter by callsign / airline name / departure airport / arrival airport / arrival city
                    const filtered = q ? realFlightResults.filter(f => {
                      const cs   = (f.callsign || "").toLowerCase();
                      const pcs  = prettyCallsign(f.callsign).toLowerCase();
                      const dep  = (f.estDepartureAirport || "").toLowerCase();
                      const arr  = (f.estArrivalAirport   || "").toLowerCase();
                      const depC = prettyAirport(f.estDepartureAirport).toLowerCase();
                      const arrC = prettyAirport(f.estArrivalAirport).toLowerCase();
                      return cs.includes(q) || pcs.includes(q) || dep.includes(q) || arr.includes(q) || depC.includes(q) || arrC.includes(q);
                    }) : realFlightResults;
                    return (
                      <div style={{marginTop:"8px",background:"#080f1a",border:"1px solid #2e4270",borderRadius:"3px"}}>
                        {/* Filter input row */}
                        <div style={{position:"sticky",top:0,background:"#0d1a2a",padding:"6px 8px",
                          borderBottom:"1px solid #2e4270",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                          <span style={{color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>
                            {filtered.length} of {realFlightResults.length} FLIGHTS
                          </span>
                          <input
                            type="text"
                            value={resultsFilter}
                            onChange={e => setResultsFilter(e.target.value)}
                            placeholder="filter: airline, dest, route…"
                            style={{...S.sel, fontSize:"10px", flex:1, minWidth:"160px"}}
                          />
                          {resultsFilter && (
                            <button onClick={() => setResultsFilter("")}
                              style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",
                                padding:"2px 8px",borderRadius:"3px",cursor:"pointer",fontSize:"9px"}}>
                              ✕ clear
                            </button>
                          )}
                        </div>
                        <div style={{maxHeight:"220px",overflowY:"auto"}}>
                          {filtered.length === 0 && (
                            <div style={{padding:"12px",color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>
                              No flights match "{resultsFilter}". Try a different airline (e.g. AAL, BAW), city, or ICAO code.
                            </div>
                          )}
                          {filtered.slice(0, 200).map((f, i) => {
                            const callsign = (f.callsign || "").trim();
                            const friendly = prettyCallsign(callsign);
                            const isFriendly = friendly !== callsign && friendly !== "—";
                            const depTime = new Date(f.firstSeen * 1000).toISOString().slice(11, 16);
                            const fromCity = prettyAirport(f.estDepartureAirport);
                            const toCity   = prettyAirport(f.estArrivalAirport);
                            return (
                              <div key={`${f.icao24}-${i}`} onClick={() => loadRealFlightTrack(f)}
                                style={{padding:"6px 10px",cursor:"pointer",fontSize:"10px",
                                  borderBottom:"1px solid #152030",
                                  display:"grid",gridTemplateColumns:"140px 1fr 60px",gap:"8px",alignItems:"center",
                                  color:"#8ab0d0"}}
                                onMouseEnter={e => e.currentTarget.style.background = "#0d1a2a"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                {/* Callsign + friendly airline */}
                                <div style={{lineHeight:"1.2"}}>
                                  <div style={{color:"#00cfff",fontWeight:"bold",fontSize:"11px"}}>{callsign || "—"}</div>
                                  {isFriendly && <div style={{color:"#5a7a9a",fontSize:"9px"}}>{friendly}</div>}
                                </div>
                                {/* Route with friendly cities */}
                                <div style={{lineHeight:"1.2"}}>
                                  <div>
                                    <span style={{color:"#7fff00"}}>{fromCity}</span>
                                    <span style={{color:"#4a6a8a"}}> → </span>
                                    <span style={{color:"#ff6b35"}}>{toCity}</span>
                                  </div>
                                  <div style={{color:"#5a7a9a",fontSize:"9px"}}>
                                    {f.estDepartureAirport} → {f.estArrivalAirport} · {f.icao24}
                                  </div>
                                </div>
                                {/* Departure time */}
                                <div style={{textAlign:"right",color:"#8ab0d0",fontSize:"10px",fontFamily:"inherit"}}>
                                  {depTime}Z
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Loaded track summary */}
                  {realFlightTrack && (
                    <div style={{marginTop:"8px",background:"#0d1a2a",border:"1px solid #00cfff44",borderRadius:"3px",padding:"6px 10px"}}>
                      <div style={{display:"flex",gap:"12px",flexWrap:"wrap",alignItems:"center",fontSize:"10px"}}>
                        <span style={{color:"#00cfff",fontWeight:"bold"}}>🛰 {realFlightTrack.info.callsign}</span>
                        {prettyCallsign(realFlightTrack.info.callsign) !== realFlightTrack.info.callsign && (
                          <span style={{color:"#5a7a9a",fontSize:"10px"}}>({prettyCallsign(realFlightTrack.info.callsign)})</span>
                        )}
                        <span style={{color:"#7fff00"}}>{prettyAirport(realFlightTrack.info.origin)}</span>
                        <span style={{color:"#4a6a8a"}}>→</span>
                        <span style={{color:"#ff6b35"}}>{prettyAirport(realFlightTrack.info.dest)}</span>
                        <span style={{color:"#5a7a9a",fontSize:"9px"}}>
                          {realFlightTrack.info.origin} → {realFlightTrack.info.dest}
                        </span>
                        <span style={{color:"#8ab0d0"}}>{realFlightTrack.points.length} pts</span>
                        <span style={{color:"#8ab0d0"}}>real {(realFlightTrack.duration/3600).toFixed(1)}h</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>
                          {new Date(realFlightTrack.info.firstSeen*1000).toISOString().slice(0,16).replace("T"," ")}Z
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Flight status bar */}
              {flightData && (
                <div style={{display:"flex",alignItems:"center",gap:"12px",marginTop:"8px",flexWrap:"wrap"}}>
                  <span style={{color:"#00ff88",fontSize:"10px",fontWeight:"bold"}}>
                    {flightData.origin.name} → {flightData.dest.name}
                  </span>
                  <span style={{color:"#8ab0d0",fontSize:"10px"}}>
                    {flightData.dist.toFixed(0)} km · {FLIGHT_SPEED_KMH} km/h
                  </span>
                  {/* Progress bar */}
                  <div style={{flex:"0 0 120px",height:"6px",background:"#152030",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{width:`${(flightData.progress*100).toFixed(0)}%`,height:"100%",
                      background:flightData.complete?"#4a6a8a":"#00ff88",borderRadius:"3px",transition:"width 0.3s"}} />
                  </div>
                  <span style={{color:flightData.complete?"#ffd700":"#00ff88",fontSize:"10px",fontWeight:"bold"}}>
                    {flightData.complete ? "ARRIVED" : `${(flightData.progress*100).toFixed(0)}% · ETA ${flightData.etaMin.toFixed(0)} min`}
                  </span>
                  {flightData.complete && (
                    <button onClick={()=>{
                      setFlightStartTime(simTime);
                      setGpLat(flightOrigin.lat); setGpLon(flightOrigin.lon);
                      setPins([]); setSelectedCity(null);
                      if(!playing) setPlaying(true);
                    }} style={{background:"#00ff8822",border:"1px solid #00ff88",color:"#00ff88",
                      padding:"2px 10px",borderRadius:"3px",cursor:"pointer",fontSize:"9px",
                      fontFamily:"inherit",fontWeight:"bold"}}>
                      ↺ FLY AGAIN
                    </button>
                  )}
                  <span style={{color:"#4a6a8a",fontSize:"9px"}}>
                    {flightData.pos.lat.toFixed(2)}°, {flightData.pos.lon.toFixed(2)}°
                  </span>
                </div>
              )}
            </div>

            {/* D3 Canvas Map */}
            <MapCanvas simTime={simTime} pins={pins} onPinDrop={onPinDrop} gpLat={gpLat} gpLon={gpLon} numSats={numSats} showGwLink={showGwLink} flightData={flightData} onAcBubble={setAcBubble} pathMarkers={pathMarkers} activeGateways={activeGateways} gwMinEl={gwMinEl} flightSelecting={flightSelecting} pendingOrigin={flightOrigin} pendingDest={flightDest} height={mapHeight} />

            {/* ── Aircraft Link Status Panel (below map) ── */}
            {acBubble && (() => {
              const el   = acBubble.elevation;
              const scan = acBubble.scan;
              const skew = acBubble.skew;

              // ── Classify current state ───────────────────────
              const elZone   = el >= 40 ? "HIGH" : el >= 25 ? "MID" : el >= 15 ? "LOW" : "BELOW";
              const skewPol  = Math.abs(skew) <= 10 ? "zero" : skew > 0 ? "pos" : "neg";
              const condKey  = elZone !== "BELOW" ? `${skewPol}-${elZone}` : null;
              const cond     = condKey ? LINK_CONDITIONS[condKey] : null;
              const sevColor = cond ? SEVERITY_COLOR[cond.severity] : "#4a6a8a";

              // ── VICTS scan loss ──────────────────────────────
              const scanLossDb = scan > 0 && scan < 90
                ? +(1.5 * 10 * Math.log10(Math.cos(scan * Math.PI / 180))).toFixed(2) : 0;

              // ── Backoff ──────────────────────────────────────
              const backoffDb  = skew > 0 ? psdBackoff(Math.abs(skew)) : 0;
              const eirpPeak   = 55.5;
              const eirpAfter  = eirpPeak - backoffDb;

              // ── Colour helpers ───────────────────────────────
              const elColor   = el >= 40 ? "#00ff88" : el >= 25 ? "#7fff00" : el >= 15 ? "#ffd700" : "#ff4444";
              const skewColor = skewPol === "pos" ? "#ff6b35" : skewPol === "neg" ? "#00cfff" : "#8ab0d0";
              const scanColor = scan < 30 ? "#00ff88" : scan < 45 ? "#7fff00" : scan < 65 ? "#ffd700" : scan < 75 ? "#ff6b35" : "#ff4444";

              const asiColor  = (v) => v === "High" ? "#ff4444" : v === "Medium" ? "#ffd700" : "#00ff88";
              const tpColor   = (v) => /Best|Optimal/.test(v) ? "#00ff88"
                                     : /Good/.test(v)         ? "#7fff00"
                                     : /Reduced|Limited/.test(v) ? "#ffd700"
                                     : /Critical|Worst|floor/.test(v) ? "#ff4444" : "#8ab0d0";

              return (
                <div style={{
                  marginTop:"8px", background:"#060d18",
                  border:`1px solid ${sevColor}44`,
                  borderLeft:`3px solid ${sevColor}`,
                  borderRadius:"4px", padding:"10px 14px",
                  fontFamily:"'Courier New',monospace",
                }}>

                  {/* ── Header ── */}
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"9px"}}>
                    <span style={{fontSize:"14px"}}>✈</span>
                    <div style={{flex:1}}>
                      <span style={{color:"#00ff88",fontSize:"10px",fontWeight:"bold",letterSpacing:"0.06em"}}>
                        AIRCRAFT LINK STATUS
                      </span>
                      <span style={{color:"#3a5a7a",fontSize:"9px",marginLeft:"10px"}}>
                        {acBubble.originName} → {acBubble.destName}
                      </span>
                    </div>
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>
                      {Math.round(acBubble.progress * 100)}% complete
                    </span>
                  </div>

                  {/* ── Compact top strip: four key values ── */}
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>

                    {/* Elevation */}
                    <div style={{background:"#0d1a2a",borderLeft:`2px solid ${elColor}`,borderRadius:"3px",padding:"5px 10px",minWidth:"90px"}}>
                      <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>ELEVATION</div>
                      <div style={{color:elColor,fontSize:"20px",fontWeight:"bold",lineHeight:1}}>{el.toFixed(1)}°</div>
                      <div style={{color:"#3a5a7a",fontSize:"7px",marginTop:"2px"}}>{elZone} ZONE</div>
                    </div>

                    {/* Scan angle */}
                    <div style={{background:"#0d1a2a",borderLeft:`2px solid ${scanColor}`,borderRadius:"3px",padding:"5px 10px",minWidth:"90px"}}>
                      <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>SCAN  (90°−EL)</div>
                      <div style={{color:scanColor,fontSize:"20px",fontWeight:"bold",lineHeight:1}}>{scan.toFixed(1)}°</div>
                      <div style={{color:"#3a5a7a",fontSize:"7px",marginTop:"2px"}}>{scanLossDb.toFixed(2)} dB VICTS loss</div>
                    </div>

                    {/* Skew angle */}
                    <div style={{background:"#0d1a2a",borderLeft:`2px solid ${skewColor}`,borderRadius:"3px",padding:"5px 10px",minWidth:"90px"}}>
                      <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>SKEW ANGLE</div>
                      <div style={{color:skewColor,fontSize:"20px",fontWeight:"bold",lineHeight:1}}>
                        {skew >= 0 ? "+" : "−"}{Math.abs(skew).toFixed(1)}°
                      </div>
                      <div style={{color:skewColor,fontSize:"7px",marginTop:"2px",fontWeight:"bold"}}>
                        {skewPol === "pos" ? "POSITIVE ↻" : skewPol === "neg" ? "NEGATIVE ↺" : "NEAR ZERO"}
                      </div>
                    </div>

                    {/* Best sat */}
                    <div style={{background:"#0d1a2a",borderLeft:`2px solid ${acBubble.satColor}`,borderRadius:"3px",padding:"5px 10px",minWidth:"90px"}}>
                      <div style={{color:"#3a5a7a",fontSize:"8px",marginBottom:"2px"}}>BEST SAT</div>
                      <div style={{color:acBubble.satColor,fontSize:"11px",fontWeight:"bold",lineHeight:1.6}}>{acBubble.satName}</div>
                      <div style={{color:"#3a5a7a",fontSize:"7px",marginTop:"2px"}}>
                        {acBubble.slantKm > 0 ? `${acBubble.slantKm.toFixed(0)} km` : "no link"}
                      </div>
                    </div>

                  </div>

                  {/* ── Combined condition block ── */}
                  {cond ? (
                    <div style={{
                      background:"#0d1a2a",
                      border:`1px solid ${sevColor}44`,
                      borderLeft:`3px solid ${sevColor}`,
                      borderRadius:"3px", padding:"8px 12px",
                    }}>

                      {/* Condition title */}
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",
                        borderBottom:"1px solid #152030",paddingBottom:"6px"}}>
                        <div style={{flex:1}}>
                          <span style={{color:sevColor,fontSize:"10px",fontWeight:"bold",letterSpacing:"0.05em"}}>
                            {skewPol === "pos" ? "POSITIVE SKEW" : skewPol === "neg" ? "NEGATIVE SKEW" : "ZERO SKEW"}
                            {" · "}
                            {cond.zone} ELEVATION
                          </span>
                        </div>
                        <span style={{
                          background:`${sevColor}22`, border:`1px solid ${sevColor}`,
                          color:sevColor, fontSize:"8px", fontWeight:"bold",
                          padding:"1px 7px", borderRadius:"2px", letterSpacing:"0.06em",
                        }}>
                          {cond.severity.toUpperCase()}
                        </span>
                      </div>

                      {/* Row 1: EL range · Scan range · Scan loss actual · Backoff */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 8px",marginBottom:"6px"}}>
                        {[
                          ["EL Range",      cond.elRange,                          "#4a6a8a"],
                          ["Scan Range",    cond.scanRange,                        "#4a6a8a"],
                          ["Scan Loss",     `${scanLossDb.toFixed(2)} dB`,         scanColor],
                          ["Tx Backoff",    backoffDb > 0 ? `−${backoffDb} dB` : "None", backoffDb > 0 ? "#ff6b35" : "#00ff88"],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{background:"#060d18",borderRadius:"2px",padding:"4px 6px"}}>
                            <div style={{color:"#3a5a7a",fontSize:"7px",marginBottom:"2px"}}>{label}</div>
                            <div style={{color,fontSize:"9px",fontWeight:"bold"}}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Row 2: Left ASI · Right ASI · Worst link · EIRP */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"4px 8px",marginBottom:"6px"}}>
                        {[
                          ["Left Nbr ASI",  cond.leftASI,                            asiColor(cond.leftASI)],
                          ["Right Nbr ASI", cond.rightASI,                           asiColor(cond.rightASI)],
                          ["Worst Link",    cond.worstLink,                          cond.worstLink === "Neither" ? "#00ff88" : "#ffd700"],
                          ["Actual EIRP",   backoffDb > 0 ? `${eirpAfter.toFixed(1)} dBW` : `${eirpPeak.toFixed(1)} dBW`, backoffDb > 0 ? "#ff6b35" : "#00ff88"],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{background:"#060d18",borderRadius:"2px",padding:"4px 6px"}}>
                            <div style={{color:"#3a5a7a",fontSize:"7px",marginBottom:"2px"}}>{label}</div>
                            <div style={{color,fontSize:"9px",fontWeight:"bold"}}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Row 3: Dominant impairment + C/N quality — full width labels */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 8px",marginBottom:"6px"}}>
                        {[
                          ["Dominant Impairment", cond.impairment,  sevColor],
                          ["C/N Assessment",      cond.cnQuality,   sevColor],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{background:"#060d18",borderRadius:"2px",padding:"4px 7px"}}>
                            <div style={{color:"#3a5a7a",fontSize:"7px",marginBottom:"2px"}}>{label}</div>
                            <div style={{color,fontSize:"8px",fontWeight:"bold"}}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Row 4: Modcod · FWD TP · RTN TP */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px 8px"}}>
                        {[
                          ["Active Modcod",  cond.modcod, sevColor],
                          ["FWD Throughput", cond.fwdTP,  tpColor(cond.fwdTP)],
                          ["RTN Throughput", cond.rtnTP,  tpColor(cond.rtnTP)],
                        ].map(([label, value, color]) => (
                          <div key={label} style={{background:"#060d18",borderRadius:"2px",padding:"4px 6px"}}>
                            <div style={{color:"#3a5a7a",fontSize:"7px",marginBottom:"2px"}}>{label}</div>
                            <div style={{color,fontSize:"8px",fontWeight:"bold"}}>{value}</div>
                          </div>
                        ))}
                      </div>

                    </div>
                  ) : (
                    /* Below service limit */
                    <div style={{background:"#0d1a2a",border:"1px solid #ff444444",borderLeft:"3px solid #ff4444",
                      borderRadius:"3px",padding:"8px 12px",color:"#ff4444",fontSize:"9px",fontWeight:"bold"}}>
                      ✘ BELOW Ka2517 SERVICE LIMIT (EL &lt; 15°) — LINK CLOSED
                    </div>
                  )}

                </div>
              );
            })()}

            {/* Sat cards */}
            <div style={{display:"flex",gap:"7px",marginTop:"10px",flexWrap:"wrap"}}>
              {Array.from({length:numSats},(_,s)=>{
                const lon=satLon(s,simTime,numSats);
                return (
                  <div key={s} style={{background:"#080f1a",border:`1px solid ${SAT_COLORS[s]}44`,borderLeft:`3px solid ${SAT_COLORS[s]}`,padding:"5px 9px",borderRadius:"3px",minWidth:"110px"}}>
                    <div style={{color:SAT_COLORS[s],fontSize:"10px",fontWeight:"bold"}}>{satNames[s]}</div>
                    <div style={{color:"#c0d0e0",fontSize:"11px"}}>{Math.abs(lon).toFixed(1)}°{lon>=0?"E":"W"}</div>
                    <div style={{color:"#3a5a7a",fontSize:"9px"}}>Lat: 0.0° equatorial</div>
                  </div>
                );
              })}
            </div>

            {/* Pin list */}
            {pins.length > 0 && (
              <div style={{marginTop:"10px",background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"8px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                  <span style={{color:"#ffd700",fontSize:"10px",fontWeight:"bold"}}>📍 DROPPED PINS</span>
                  <button onClick={()=>{setPins([]);pinCounter.current=0;}} style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",padding:"1px 8px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"}}>
                    clear all
                  </button>
                </div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {pins.map((pin,i)=>(
                    <div key={i} style={{background:"#0d1a2a",border:"1px solid #ffd70055",borderLeft:"3px solid #ffd700",padding:"4px 8px",borderRadius:"3px",display:"flex",gap:"8px",alignItems:"center"}}>
                      <span style={{color:"#ffd700",fontSize:"10px",fontWeight:"bold"}}>{pin.label}</span>
                      <span style={{color:"#8ab0d0",fontSize:"10px"}}>{pin.lat.toFixed(2)}°, {pin.lon.toFixed(2)}°</span>
                      <button onClick={()=>{setGpLat(pin.lat);setGpLon(pin.lon);setSelectedCity(null);}} style={{background:"#00cfff22",border:"1px solid #00cfff66",color:"#00cfff",padding:"1px 6px",borderRadius:"2px",cursor:"pointer",fontSize:"9px",fontFamily:"inherit"}}>
                        → analysis
                      </button>
                      <button onClick={()=>setPins(p=>p.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#4a6a8a",cursor:"pointer",fontSize:"11px",padding:"0 2px"}}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orbital facts */}
            <div style={{marginTop:"10px",display:"flex",gap:"10px",flexWrap:"wrap"}}>
              {[
                ["Altitude","8 063 km"],
                ["Period",`${(T_orb/60).toFixed(0)} min`],
                ["Orbits/day",`${(86164.1/T_orb).toFixed(2)}`],
                ["Ground-rel period",`${((2*Math.PI/w_rel)/3600).toFixed(2)} h`],
                [`${satSpacing}° spacing`,`${numSats} satellites`],
                ["5° contour radius",`${toDeg(earthCentralAngle(5)).toFixed(1)}° ECA`],
              ].map(([k,v])=>(
                <div key={k} style={{background:"#080f1a",border:"1px solid #1e3055",padding:"4px 9px",borderRadius:"3px"}}>
                  <div style={{color:"#3a5a7a",fontSize:"9px"}}>{k}</div>
                  <div style={{color:"#00cfff",fontSize:"11px"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ TAB 2 — Link Budget ════ */}
        {tab==="linkbudget" && (
          <div>
            <div style={S.grid2}>
              <div>
                <div style={{marginBottom:"14px"}}>
                  <div style={S.lbl}>ELEVATION ANGLE TO SATELLITE</div>
                  <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                    <input type="range" min={5} max={60} value={elSl}
                      onChange={e=>setElSl(+e.target.value)} style={S.slider} />
                    <span style={{color:"#00cfff",fontSize:"26px",fontWeight:"bold",minWidth:"52px"}}>{elSl}°</span>
                  </div>
                  <div style={{color:"#3a5a7a",fontSize:"10px",marginTop:"4px"}}>
                    Slant range: {lb.d_km} km · 5° = coverage edge · 60° = high-el terminal
                  </div>
                </div>
                <div style={S.card(false)}>
                  <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"8px"}}>SYSTEM PARAMETERS</div>
                  {[
                    ["Frequency (DL)","19.95 GHz (Ka)"],
                    ["BW / beam",`${BW_MHZ} MHz`],
                    ["EIRP (est.)","68 dBW"],
                    ["Terminal G/T","14.5 dB/K"],
                    ["Terminal size","~0.6 m dish"],
                    ["Rain fade","2.5 dB"],
                    ["Atm. loss","0.5 dB"],
                    ["Misc losses","1.0 dB"],
                  ].map(([l,v])=>(
                    <div key={l} style={S.lbRow}>
                      <span style={{color:"#4a6a8a"}}>{l}</span>
                      <span style={{color:"#c0d8f0",fontWeight:"bold"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{...S.card(false),marginBottom:"10px"}}>
                  <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"8px"}}>COMPUTED LINK BUDGET</div>
                  {[
                    ["Slant range",`${lb.d_km} km`],
                    ["Free space path loss",`${lb.fspl} dB`],
                    ["Total link loss",`${lb.loss} dB`],
                    ["C/N₀",`${lb.C_No} dBHz`],
                    ["C/N",`${lb.C_N} dB`],
                  ].map(([l,v])=>(
                    <div key={l} style={S.lbRow}>
                      <span style={{color:"#4a6a8a"}}>{l}</span>
                      <span style={{color:+lb.C_N>0?"#00cfff":"#ff6b35",fontWeight:"bold"}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{...S.card(true),textAlign:"center",marginBottom:"10px"}}>
                  <div style={{color:"#4a6a8a",fontSize:"10px"}}>SHANNON CAPACITY BOUND</div>
                  <div style={{color:"#00cfff",fontSize:"38px",fontWeight:"bold",margin:"6px 0 2px"}}>{lb.cap}</div>
                  <div style={{color:"#4a6a8a",fontSize:"11px"}}>Mbps / beam at {elSl}°</div>
                  <div style={{color:"#3a5a7a",fontSize:"10px",marginTop:"4px"}}>Theoretical upper bound</div>
                </div>
                <div style={S.card(false)}>
                  <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>COVERAGE GEOMETRY @ {elSl}°</div>
                  {[
                    ["Earth central angle",`${toDeg(earthCentralAngle(elSl)).toFixed(1)}°`],
                    ["Ground radius",`${(Re*toRad(toDeg(earthCentralAngle(elSl)))).toFixed(0)} km`],
                    ["Slant range",`${lb.d_km} km`],
                  ].map(([l,v])=>(
                    <div key={l} style={S.lbRow}>
                      <span style={{color:"#4a6a8a"}}>{l}</span>
                      <span style={{color:"#c0d8f0",fontWeight:"bold"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB 3 — Handover ════ */}
        {tab==="handover" && (
          <div>
            {gpControls}
            <div style={{marginBottom:"12px",padding:"6px 10px",background:"#080f1a",border:"1px solid #1e3055",borderRadius:"3px"}}>
              <span style={{color:"#4a6a8a"}}>Best satellite now: </span>
              <span style={S.badge(bestSat)}>{satNames[bestSat]}</span>
              <span style={{color:"#00cfff",marginLeft:"10px",fontWeight:"bold"}}>
                {currElevs[bestSat]>5?`${currElevs[bestSat].toFixed(1)}° elevation`:"Below 5° threshold"}
              </span>
              <span style={{color:"#3a5a7a",fontSize:"10px",marginLeft:"14px"}}>at ({gpLat}°, {gpLon}°)</span>
            </div>
            <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>ACTIVE SATELLITE — 24 h window</div>
            <ResponsiveContainer width="100%" height={155}>
              <LineChart data={handoverData} margin={{top:4,right:12,bottom:14,left:2}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
                <XAxis dataKey="t" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  label={{value:"Hours from now",position:"insideBottom",offset:-6,fill:"#4a6a8a",fontSize:9}}/>
                <YAxis domain={[0,numSats+0.5]} stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  ticks={Array.from({length:numSats+1},(_,i)=>i)} tickFormatter={v=>v===0?"—":`S${v}`}
                  label={{value:"Active",angle:-90,position:"insideLeft",fill:"#4a6a8a",fontSize:9}}/>
                <Tooltip contentStyle={chartT} labelFormatter={v=>`T+${(+v).toFixed(1)} h`}
                  formatter={v=>[v===0?"No coverage":satNames[v-1],"Active"]}/>
                <Line type="stepAfter" dataKey="active" stroke="#00cfff" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
            <div style={{color:"#4a6a8a",fontSize:"10px",margin:"12px 0 6px"}}>ELEVATION ANGLE — 24 h window</div>
            <ResponsiveContainer width="100%" height={145}>
              <LineChart data={handoverData} margin={{top:4,right:12,bottom:14,left:2}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
                <XAxis dataKey="t" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  label={{value:"Hours from now",position:"insideBottom",offset:-6,fill:"#4a6a8a",fontSize:9}}/>
                <YAxis stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  label={{value:"El (°)",angle:-90,position:"insideLeft",fill:"#4a6a8a",fontSize:9}}/>
                <ReferenceLine y={5} stroke="#ff6b35" strokeDasharray="4 2"
                  label={{value:"5° min",position:"insideTopRight",fill:"#ff6b35",fontSize:9}}/>
                <Tooltip contentStyle={chartT} labelFormatter={v=>`T+${(+v).toFixed(1)} h`}
                  formatter={v=>[`${v}°`,"Elevation"]}/>
                <Line type="monotone" dataKey="maxEl" stroke="#ffd700" dot={false} strokeWidth={1.5}/>
              </LineChart>
            </ResponsiveContainer>
            {(()=>{
              let count=0;
              for(let i=1;i<handoverData.length;i++){
                if(handoverData[i].active!==handoverData[i-1].active&&handoverData[i].active>0&&handoverData[i-1].active>0) count++;
              }
              const covPct=(handoverData.filter(d=>d.active>0).length/handoverData.length*100).toFixed(0);
              return(
                <div style={{display:"flex",gap:"10px",marginTop:"10px",flexWrap:"wrap"}}>
                  {[
                    ["Handovers / 24h",count],
                    ["Coverage avail.",`${covPct}%`],
                    ["Avg time / sat",`${count>0?(24/count).toFixed(1):"N/A"} h`],
                    ["Min elevation",`${elevStats.minEl}°`],
                    ["Avg elevation",`${elevStats.avgEl}°`],
                  ].map(([l,v])=>(
                    <div key={l} style={S.card(false)}>
                      <div style={{color:"#3a5a7a",fontSize:"9px"}}>{l}</div>
                      <div style={{color:"#00cfff",fontSize:"16px",fontWeight:"bold"}}>{v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Gateway Handover Section */}
            {gwHandoverData.summary && gwHandoverData.summary.length > 0 && (
              <div style={{marginTop:"14px"}}>
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  GATEWAY HANDOVERS — 24 h WINDOW
                </div>

                {/* GW summary stats */}
                <div style={{display:"flex",gap:"10px",marginBottom:"12px",flexWrap:"wrap"}}>
                  <div style={S.card(false)}>
                    <div style={{color:"#3a5a7a",fontSize:"9px"}}>GW handovers / 24h</div>
                    <div style={{color:GW_COLOR,fontSize:"16px",fontWeight:"bold"}}>{gwHandoverData.gwHandovers}</div>
                  </div>
                  <div style={S.card(false)}>
                    <div style={{color:"#3a5a7a",fontSize:"9px"}}>Active gateways</div>
                    <div style={{color:GW_COLOR,fontSize:"16px",fontWeight:"bold"}}>{gwHandoverData.summary.length}</div>
                  </div>
                </div>

                {/* Gateway duration table */}
                <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"12px",overflowX:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:"60px 100px 40px 70px 60px 80px 1fr",gap:"8px",
                    padding:"6px 0",borderBottom:"1px solid #2e4270",marginBottom:"4px"}}>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>ID</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>LOCATION</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>CC</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>TIME (h)</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>% 24h</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>OPERATOR</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}></span>
                  </div>
                  {gwHandoverData.summary.map((gw,i)=>{
                    const fullGw = activeGateways.find(g=>g.id===gw.id);
                    const hours = (gw.minutes/60).toFixed(1);
                    const pct = (gw.minutes/1440*100).toFixed(1);
                    return (
                      <div key={gw.id} style={{display:"grid",gridTemplateColumns:"60px 100px 40px 70px 60px 80px 1fr",gap:"8px",
                        padding:"6px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                        <span style={{color:GW_COLOR,fontSize:"11px",fontWeight:"bold"}}>{gw.id.replace("GW-","")}</span>
                        <span style={{color:"#c0d8f0",fontSize:"11px"}}>{gw.name}</span>
                        <span style={{color:"#4a6a8a",fontSize:"10px"}}>{gw.country}</span>
                        <span style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",textAlign:"center"}}>{hours}</span>
                        <span style={{color:+pct>=10?"#00cfff":+pct>=5?GW_COLOR:"#4a6a8a",fontSize:"12px",fontWeight:"bold",textAlign:"center"}}>{pct}%</span>
                        <span style={{color:"#8ab0d0",fontSize:"10px"}}>{fullGw?.operator}</span>
                        <div>{fullGw?.azure && <span style={{color:"#0078d4",fontSize:"8px",background:"#0078d422",border:"1px solid #0078d4",padding:"0 4px",borderRadius:"2px"}}>Azure</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 4 — Elevation/Time ════ */}
        {tab==="elevation" && (
          <div>
            {gpControls}
            <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>ELEVATION ANGLE — 6 h FORWARD WINDOW</div>
            <ResponsiveContainer width="100%" height={295}>
              <LineChart data={elevTimeData} margin={{top:4,right:20,bottom:18,left:2}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
                <XAxis dataKey="t" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  label={{value:"Hours from now",position:"insideBottom",offset:-8,fill:"#4a6a8a",fontSize:9}}/>
                <YAxis domain={[-10,90]} stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                  label={{value:"Elevation (°)",angle:-90,position:"insideLeft",fill:"#4a6a8a",fontSize:9}}/>
                <ReferenceLine y={5} stroke="#ff6b35" strokeDasharray="4 2"
                  label={{value:"5° min",position:"insideTopRight",fill:"#ff6b35",fontSize:9}}/>
                <ReferenceLine y={0} stroke="#2e4270" strokeWidth={0.5}/>
                <Tooltip contentStyle={chartT} labelFormatter={v=>`T+${(+v).toFixed(2)} h`}
                  formatter={(v,n)=>[`${v}°`,n]}/>
                <Legend wrapperStyle={{fontSize:"10px",color:"#4a6a8a"}}/>
                {Array.from({length:numSats},(_,s)=>(
                  <Line key={s} type="monotone" dataKey={`S${s+1}`}
                    stroke={SAT_COLORS[s]} dot={false} strokeWidth={1.5}
                    name={satNames[s]} connectNulls={false}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{marginTop:"12px"}}>
              <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"7px"}}>CURRENT ELEVATION ANGLES</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {currElevs.map((el,s)=>(
                  <div key={s} style={{background:"#080f1a",border:`1px solid ${el>5?SAT_COLORS[s]:"#2e4270"}55`,borderLeft:`3px solid ${el>5?SAT_COLORS[s]:"#2e4270"}`,padding:"5px 10px",borderRadius:"3px"}}>
                    <div style={{color:SAT_COLORS[s],fontSize:"10px"}}>{satNames[s]}</div>
                    <div style={{color:el>5?"#00cfff":"#4a6a8a",fontSize:"17px",fontWeight:"bold"}}>
                      {el>-90?`${el.toFixed(1)}°`:"—"}
                    </div>
                    <div style={{color:"#3a5a7a",fontSize:"9px"}}>
                      {el>5?"IN VIEW":el>-90?"BELOW 5°":"NO COVERAGE"}
                    </div>
                    {el>5&&<div style={{color:"#3a5a7a",fontSize:"9px"}}>{slantRange(el).toFixed(0)} km</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* 24h Dual-Satellite Coverage */}
            {dualCoverageStats && (
              <div style={{marginTop:"14px"}}>
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  DUAL-SATELLITE COVERAGE — 24 h WINDOW
                </div>
                <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"12px",overflowX:"auto"}}>
                  {/* Header row */}
                  <div style={{display:"grid",gridTemplateColumns:"90px 80px 70px 120px 1fr",gap:"8px",
                    padding:"6px 0",borderBottom:"1px solid #2e4270",marginBottom:"4px"}}>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>MIN ELEVATION</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>TIME (min)</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>TIME (h)</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>% OF 24 h</span>
                    <span style={{color:"#4a6a8a",fontSize:"10px"}}>TOP CONTRIBUTING PAIRS</span>
                  </div>
                  {/* Data rows */}
                  {dualCoverageStats.map(({thresh, totalMin, totalH, pct, pairs}) => {
                    const barColor = thresh === 20 ? "#00cfff" : thresh === 25 ? "#ffd700" : "#ff6b35";
                    return (
                      <div key={thresh} style={{display:"grid",gridTemplateColumns:"90px 80px 70px 120px 1fr",gap:"8px",
                        padding:"10px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                        {/* Threshold badge */}
                        <div>
                          <span style={{display:"inline-block",background:`${barColor}22`,border:`1px solid ${barColor}`,
                            color:barColor,padding:"2px 10px",borderRadius:"3px",fontSize:"12px",fontWeight:"bold"}}>
                            {thresh}°
                          </span>
                        </div>
                        {/* Time (min) */}
                        <div style={{textAlign:"center",color:"#c0d8f0",fontSize:"14px",fontWeight:"bold"}}>{totalMin}</div>
                        {/* Time (h) */}
                        <div style={{textAlign:"center",color:"#c0d8f0",fontSize:"14px",fontWeight:"bold"}}>{totalH}</div>
                        {/* % with bar */}
                        <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                          <span style={{color:barColor,fontSize:"14px",fontWeight:"bold",minWidth:"42px",textAlign:"right"}}>{pct}%</span>
                          <div style={{flex:1,height:"6px",background:"#152030",borderRadius:"3px",overflow:"hidden"}}>
                            <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:barColor,borderRadius:"3px"}} />
                          </div>
                        </div>
                        {/* Top pairs */}
                        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                          {pairs.map(({a,b,minutes},pi) => (
                            <div key={pi} style={{display:"flex",alignItems:"center",gap:"4px",
                              background:"#0d1a2a",border:"1px solid #2e4270",borderRadius:"3px",padding:"2px 8px"}}>
                              <span style={{width:"7px",height:"7px",borderRadius:"50%",background:SAT_COLORS[a],display:"inline-block"}} />
                              <span style={{width:"7px",height:"7px",borderRadius:"50%",background:SAT_COLORS[b],display:"inline-block"}} />
                              <span style={{color:"#8ab0d0",fontSize:"9px"}}>{satNames[a]} + {satNames[b]}</span>
                              <span style={{color:"#4a6a8a",fontSize:"9px"}}>{minutes}m</span>
                            </div>
                          ))}
                          {pairs.length === 0 && (
                            <span style={{color:"#3a5a7a",fontSize:"9px",fontStyle:"italic"}}>no dual coverage</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 5 — Flight Summary ════ */}
        {tab==="flight" && flightMode && (
          <div>
            {!flightStats ? (
              <div style={{color:"#4a6a8a",textAlign:"center",padding:"40px",fontSize:"12px"}}>
                {!flightOrigin || !flightDest
                  ? "Select origin and destination on the Coverage Map tab, then press LAUNCH."
                  : flightStartTime === null
                  ? "Press LAUNCH on the Coverage Map tab to start the flight simulation."
                  : "Computing flight data…"}
              </div>
            ) : (
              <div>
                {/* ── TX / RX Time Ribbon ── */}
                {flightRibbon && (
                  <div style={{marginBottom:"18px"}}>
                    <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                      borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                      TX / RX LINK QUALITY RIBBON
                    </div>

                    {/* Legend */}
                    <div style={{display:"flex",gap:"12px",marginBottom:"8px",flexWrap:"wrap",alignItems:"center"}}>
                      {[
                        ["#00ff88","Good / Near-ideal"],
                        ["#7fff00","Moderate / Scan-limited"],
                        ["#ffd700","Degraded / Backoff or floor"],
                        ["#ff4444","Critical / Worst case"],
                        [CLOSED_COLOR,`Link closed (terminal EL < ${ka2517MinEl}° or no GW)`],
                      ].map(([c,l])=>(
                        <div key={l} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                          <div style={{width:"20px",height:"9px",background:c,borderRadius:"2px",
                            border:"1px solid #2e4270"}} />
                          <span style={{color:"#4a6a8a",fontSize:"9px"}}>{l}</span>
                        </div>
                      ))}
                      <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                        <div style={{width:"2px",height:"14px",background:"rgba(0,0,0,0.85)",border:"1px solid #444"}} />
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>Sat handover</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                        <div style={{width:"2px",height:"14px",background:"rgba(30,120,255,0.9)",boxShadow:"0 0 3px rgba(30,120,255,0.5)"}} />
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>GW handover</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                        <div style={{width:"2px",height:"14px",background:"rgba(255,255,255,0.95)",boxShadow:"0 0 4px rgba(255,255,255,0.7)"}} />
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>Sat + GW handover</span>
                      </div>
                    </div>

                    {/* TX Ribbon */}
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                      <span style={{color:"#00cfff",fontSize:"9px",fontWeight:"bold",
                        minWidth:"28px",textAlign:"right"}}>TX</span>
                      <div
                        style={{flex:1,position:"relative",height:"18px",borderRadius:"3px",overflow:"hidden",
                          background:flightRibbon.txGradient,border:"1px solid #1e3055",cursor:"crosshair"}}
                        onMouseMove={e=>{
                          const rect = e.currentTarget.getBoundingClientRect();
                          const idx = Math.min(flightRibbon.N-1, Math.max(0, Math.floor((e.clientX-rect.left)/rect.width*flightRibbon.N)));
                          const nearSwitch = flightRibbon.switches.find(sw => Math.abs(sw.pct/100*flightRibbon.N - idx) <= 1);
                          setRibbonTip({seg:flightRibbon.segments[idx],source:"TX",x:e.clientX,y:e.clientY,nearSwitch});
                        }}
                        onMouseLeave={()=>setRibbonTip(null)}
                      >
                        {flightRibbon.switches.map((sw, i) => (
                          <div key={i} style={{
                            position:"absolute", top:0, bottom:0,
                            left:`${sw.pct.toFixed(2)}%`,
                            width:"2px", pointerEvents:"none", zIndex:2,
                            background: sw.type==="both" ? "rgba(255,255,255,0.95)"
                                      : sw.type==="gw"   ? "rgba(30,120,255,0.9)"
                                      :                    "rgba(0,0,0,0.85)",
                            boxShadow: sw.type==="both" ? "0 0 4px rgba(255,255,255,0.7)"
                                     : sw.type==="gw"   ? "0 0 3px rgba(30,120,255,0.5)"
                                     : "none",
                          }}/>
                        ))}
                        {flightData && !flightData.complete && (
                          <div style={{
                            position:"absolute",top:0,bottom:0,
                            left:`${(flightData.progress*100).toFixed(1)}%`,
                            width:"2px",background:"white",opacity:0.9,
                            boxShadow:"0 0 4px rgba(255,255,255,0.8)",pointerEvents:"none",zIndex:3,
                          }}/>
                        )}
                      </div>
                    </div>

                    {/* RX Ribbon */}
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                      <span style={{color:"#ffd700",fontSize:"9px",fontWeight:"bold",
                        minWidth:"28px",textAlign:"right"}}>RX</span>
                      <div
                        style={{flex:1,position:"relative",height:"18px",borderRadius:"3px",overflow:"hidden",
                          background:flightRibbon.rxGradient,border:"1px solid #1e3055",cursor:"crosshair"}}
                        onMouseMove={e=>{
                          const rect = e.currentTarget.getBoundingClientRect();
                          const idx = Math.min(flightRibbon.N-1, Math.max(0, Math.floor((e.clientX-rect.left)/rect.width*flightRibbon.N)));
                          const nearSwitch = flightRibbon.switches.find(sw => Math.abs(sw.pct/100*flightRibbon.N - idx) <= 1);
                          setRibbonTip({seg:flightRibbon.segments[idx],source:"RX",x:e.clientX,y:e.clientY,nearSwitch});
                        }}
                        onMouseLeave={()=>setRibbonTip(null)}
                      >
                        {flightRibbon.switches.map((sw, i) => (
                          <div key={i} style={{
                            position:"absolute", top:0, bottom:0,
                            left:`${sw.pct.toFixed(2)}%`,
                            width:"2px", pointerEvents:"none", zIndex:2,
                            background: sw.type==="both" ? "rgba(255,255,255,0.95)"
                                      : sw.type==="gw"   ? "rgba(30,120,255,0.9)"
                                      :                    "rgba(0,0,0,0.85)",
                            boxShadow: sw.type==="both" ? "0 0 4px rgba(255,255,255,0.7)"
                                     : sw.type==="gw"   ? "0 0 3px rgba(30,120,255,0.5)"
                                     : "none",
                          }}/>
                        ))}
                        {flightData && !flightData.complete && (
                          <div style={{
                            position:"absolute",top:0,bottom:0,
                            left:`${(flightData.progress*100).toFixed(1)}%`,
                            width:"2px",background:"white",opacity:0.9,
                            boxShadow:"0 0 4px rgba(255,255,255,0.8)",pointerEvents:"none",zIndex:3,
                          }}/>
                        )}
                      </div>
                    </div>

                    {/* Hover tooltip — fixed position, follows cursor */}
                    {ribbonTip && ribbonTip.seg && (() => {
                      const TIP_W = 260, TIP_H = 320, GAP = 14;
                      const vw = window.innerWidth, vh = window.innerHeight;
                      // Flip left when tooltip would overflow the right edge
                      const tipLeft = ribbonTip.x + GAP + TIP_W > vw
                        ? ribbonTip.x - GAP - TIP_W
                        : ribbonTip.x + GAP;
                      // Flip down when tooltip would overflow the top edge
                      const tipTop = ribbonTip.y - TIP_H < 0
                        ? ribbonTip.y + GAP
                        : Math.min(ribbonTip.y - 10, vh - TIP_H - 8);
                      return (
                      <div style={{
                        position:"fixed",
                        left: tipLeft,
                        top:  tipTop,
                        zIndex: 999,
                        pointerEvents:"none",
                        fontFamily:"'Courier New',monospace",
                        fontSize:"10px",
                        background:"rgba(4,10,20,0.97)",
                        border:`1.5px solid ${ribbonTip.source==="TX"?"#00cfff":"#ffd700"}66`,
                        borderLeft:`3px solid ${ribbonTip.source==="TX"?"#00cfff":"#ffd700"}`,
                        borderRadius:"4px",
                        padding:"8px 11px",
                        width: TIP_W + "px",
                        boxShadow:"0 6px 24px rgba(0,0,0,0.8)",
                      }}>
                        {ribbonTip.seg.closed ? (
                          <div>
                            <div style={{color:"#ff4444",fontWeight:"bold",marginBottom:"4px"}}>
                              ✘ LINK CLOSED
                            </div>
                            <div style={{color:"#3a5a7a",fontSize:"9px",marginBottom:"8px"}}>
                              T+{ribbonTip.seg.tHours}h ·{" "}
                              {ribbonTip.seg.closedReason === "no active gateway"
                                ? "No active gateway has LOS to any viable satellite"
                                : ribbonTip.seg.closedReason === "no sat"
                                ? `No satellite above ${gwMinEl}° minimum elevation`
                                : `EL below Ka2517 service floor (${ka2517MinEl}° min — scan angle > ${(90-ka2517MinEl).toFixed(0)}°)`}
                            </div>
                            {ribbonTip.seg.gwSatEls && ribbonTip.seg.gwSatEls.length > 0 && (
                              <div style={{borderTop:"1px solid #1a2a40",paddingTop:"6px"}}>
                                <div style={{color:"#4a6a8a",fontSize:"8px",marginBottom:"5px",letterSpacing:"0.04em"}}>
                                  GATEWAY EL PER SATELLITE (above horizon)
                                </div>
                                {ribbonTip.seg.gwSatEls.map(function(row) {
                                  const col = SAT_COLORS[row.satIdx % SAT_COLORS.length];
                                  const gwOk = row.gwEl !== null && row.gwEl >= gwMinEl;
                                  return (
                                    <div key={row.satIdx} style={{display:"grid",gridTemplateColumns:"72px 1fr 60px",
                                      gap:"2px 6px",alignItems:"center",marginBottom:"3px"}}>
                                      <span style={{color:col,fontSize:"9px",fontWeight:"bold"}}>{row.satName}</span>
                                      <span style={{color:"#5a7a9a",fontSize:"8px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                        TermEL {row.satEl}°
                                      </span>
                                      <span style={{
                                        color: gwOk ? "#00ff88" : row.gwEl !== null ? "#ff6b35" : "#3a5a7a",
                                        fontSize:"9px",fontWeight:"bold",textAlign:"right",
                                      }}>
                                        {row.gwEl !== null
                                          ? (row.gwName ? row.gwName.slice(0,8) + " " : "") + row.gwEl + "°"
                                          : "no GW"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {/* Header */}
                            <div style={{display:"flex",alignItems:"center",gap:"7px",
                              borderBottom:"1px solid #1a2a40",paddingBottom:"5px",marginBottom:"6px"}}>
                              <span style={{
                                background:`${ribbonTip.source==="TX"?"#00cfff":"#ffd700"}22`,
                                border:`1px solid ${ribbonTip.source==="TX"?"#00cfff":"#ffd700"}`,
                                color:ribbonTip.source==="TX"?"#00cfff":"#ffd700",
                                fontSize:"8px",fontWeight:"bold",
                                padding:"1px 6px",borderRadius:"2px",
                              }}>{ribbonTip.source}</span>
                              <span style={{color:"#c0d8f0",fontWeight:"bold"}}>
                                T+{ribbonTip.seg.tHours}h
                              </span>
                              {ribbonTip.seg.cond && (
                                <span style={{
                                  color: SEVERITY_COLOR[ribbonTip.seg.cond.severity],
                                  fontSize:"8px",fontWeight:"bold",marginLeft:"auto",
                                }}>
                                  {ribbonTip.seg.cond.severity.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Satellite row */}
                            <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"4px"}}>
                              <div style={{width:"8px",height:"8px",borderRadius:"50%",
                                background:ribbonTip.seg.satColor,flexShrink:0}}/>
                              <span style={{color:ribbonTip.seg.satColor,fontWeight:"bold",fontSize:"10px"}}>
                                {ribbonTip.seg.satName}
                              </span>
                              <span style={{color:"#3a5a7a",fontSize:"9px",marginLeft:"4px"}}>
                                EL {ribbonTip.seg.el}°
                              </span>
                            </div>

                            {/* Gateway row */}
                            <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"6px"}}>
                              <div style={{width:"8px",height:"8px",borderRadius:"2px",
                                background:GW_COLOR,flexShrink:0}}/>
                              <span style={{color:GW_COLOR,fontWeight:"bold",fontSize:"10px"}}>
                                {ribbonTip.seg.gwName}
                              </span>
                              {ribbonTip.seg.gwCountry && (
                                <span style={{color:"#3a5a7a",fontSize:"9px"}}>
                                  {ribbonTip.seg.gwCountry}
                                </span>
                              )}
                            </div>

                            {/* Handover banner — type-aware */}
                            {ribbonTip.nearSwitch && (() => {
                              const sw = ribbonTip.nearSwitch;
                              const isBoth = sw.type === "both";
                              const isGw   = sw.type === "gw";
                              const borderCol = isBoth ? "rgba(255,255,255,0.9)"
                                              : isGw   ? "rgba(30,120,255,0.9)"
                                              :           "rgba(180,180,180,0.7)";
                              const bgCol     = isBoth ? "rgba(40,40,40,0.8)"
                                              : isGw   ? "rgba(10,30,80,0.7)"
                                              :           "rgba(0,0,0,0.6)";
                              const label     = isBoth ? "⇄ SAT + GW HANDOVER"
                                              : isGw   ? "⇄ GW HANDOVER"
                                              :           "⇄ SAT HANDOVER";
                              const labelCol  = isBoth ? "white"
                                              : isGw   ? "rgba(100,160,255,1)"
                                              :           "rgba(200,200,200,1)";
                              return (
                                <div style={{
                                  marginBottom:"6px",
                                  background:bgCol,
                                  border:`1px solid ${borderCol}44`,
                                  borderLeft:`2px solid ${borderCol}`,
                                  borderRadius:"2px",
                                  padding:"4px 7px",
                                }}>
                                  <div style={{color:labelCol,fontSize:"8px",fontWeight:"bold",
                                    letterSpacing:"0.05em",marginBottom: isBoth ? "3px" : "0"}}>
                                    {label}
                                  </div>
                                  {(sw.type === "sat" || isBoth) && (
                                    <div style={{color:"#8ab0d0",fontSize:"8px"}}>
                                      🛰 {sw.fromSat} → {sw.toSat}
                                    </div>
                                  )}
                                  {(sw.type === "gw" || isBoth) && (
                                    <div style={{color:"#8ab0d0",fontSize:"8px"}}>
                                      📡 {sw.fromGw} → {sw.toGw}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Angles + link quality grid */}
                            {(() => {
                              const seg       = ribbonTip.seg;
                              const skewAbs   = Math.abs(seg.skew);
                              const backoffDb = seg.skew > 0 ? psdBackoff(skewAbs) : 0;
                              const eirpPeak  = 55.5;
                              const eirpAfter = eirpPeak - backoffDb;
                              const backoffColor = backoffDb === 0 ? "#00ff88"
                                                 : backoffDb <= 0.5 ? "#7fff00"
                                                 : backoffDb <= 1.5 ? "#ffd700"
                                                 : backoffDb <= 3.0 ? "#ff6b35"
                                                 : "#ff4444";
                              const asiColor = v => v === "High" ? "#ff4444"
                                                  : v === "Medium" ? "#ffd700" : "#00ff88";
                              const leftASI  = seg.cond?.leftASI  || "—";
                              const rightASI = seg.cond?.rightASI || "—";

                              return (
                                <div style={{borderTop:"1px solid #1a2a40",paddingTop:"6px",display:"flex",flexDirection:"column",gap:"3px"}}>

                                  {/* Row 1: Scan + Skew */}
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px"}}>
                                    <div>
                                      <span style={{color:"#3a5a7a",fontSize:"8px"}}>Scan: </span>
                                      <span style={{color:"#c0d8f0",fontSize:"8px",fontWeight:"bold"}}>{seg.scan}°</span>
                                    </div>
                                    <div>
                                      <span style={{color:"#3a5a7a",fontSize:"8px"}}>Skew: </span>
                                      <span style={{color:"#c0d8f0",fontSize:"8px",fontWeight:"bold"}}>{seg.skew >= 0 ? "+" : ""}{seg.skew}°</span>
                                    </div>
                                  </div>

                                  {/* Row 2: TX EIRP Backoff */}
                                  <div style={{
                                    background:"#060d18",borderRadius:"2px",
                                    padding:"3px 6px",
                                    borderLeft:`2px solid ${backoffColor}`,
                                    display:"flex",alignItems:"center",justifyContent:"space-between",
                                  }}>
                                    <span style={{color:"#3a5a7a",fontSize:"8px"}}>TX EIRP backoff</span>
                                    <span style={{color:backoffColor,fontSize:"9px",fontWeight:"bold"}}>
                                      {backoffDb > 0
                                        ? `−${backoffDb.toFixed(1)} dB  (${eirpAfter.toFixed(1)} dBW)`
                                        : "None  — full power"}
                                    </span>
                                  </div>

                                  {/* Row 3: ASI from neighbours */}
                                  <div style={{
                                    background:"#060d18",borderRadius:"2px",
                                    padding:"3px 6px",
                                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",
                                  }}>
                                    <span style={{color:"#3a5a7a",fontSize:"8px",flexShrink:0}}>Nbr ASI impact</span>
                                    <div style={{display:"flex",gap:"8px"}}>
                                      <span>
                                        <span style={{color:"#3a5a7a",fontSize:"7px"}}>L: </span>
                                        <span style={{color:asiColor(leftASI),fontSize:"8px",fontWeight:"bold"}}>{leftASI}</span>
                                      </span>
                                      <span>
                                        <span style={{color:"#3a5a7a",fontSize:"7px"}}>R: </span>
                                        <span style={{color:asiColor(rightASI),fontSize:"8px",fontWeight:"bold"}}>{rightASI}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Row 4: Modcod + TP */}
                                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px"}}>
                                    <div>
                                      <span style={{color:"#3a5a7a",fontSize:"8px"}}>Modcod: </span>
                                      <span style={{color:"#c0d8f0",fontSize:"8px",fontWeight:"bold"}}>{seg.cond?.modcod || "—"}</span>
                                    </div>
                                    <div>
                                      <span style={{color:"#3a5a7a",fontSize:"8px"}}>{ribbonTip.source === "TX" ? "FWD TP" : "RTN TP"}: </span>
                                      <span style={{color:"#c0d8f0",fontSize:"8px",fontWeight:"bold"}}>
                                        {ribbonTip.source === "TX" ? seg.cond?.fwdTP : seg.cond?.rtnTP || "—"}
                                      </span>
                                    </div>
                                  </div>

                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* Time axis */}
                    <div style={{display:"flex",marginLeft:"36px"}}>
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const h = (f * flightRibbon.durationSec / 3600).toFixed(1);
                        return (
                          <div key={f} style={{
                            position:"relative",flex: f === 1 ? "0 0 0" : 1,
                          }}>
                            <div style={{
                              position:"absolute",left: f === 1 ? "auto" : 0,
                              right: f === 1 ? 0 : "auto",
                              color:"#3a5a7a",fontSize:"8px",whiteSpace:"nowrap",
                            }}>
                              T+{h}h
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Differentiation note */}
                    <div style={{marginTop:"14px",padding:"5px 8px",background:"#0d1a2a",
                      borderRadius:"3px",border:"1px solid #1e3055"}}>
                      <span style={{color:"#3a5a7a",fontSize:"8px"}}>
                        TX/RX differ at <span style={{color:"#ff6b35"}}>pos-HIGH</span> (TX worst: FWD ASI degrades forward throughput more) and{" "}
                        <span style={{color:"#ff6b35"}}>pos-LOW</span> (RX worst: EIRP backoff compounds scan loss on the return path).
                        All other conditions are symmetric.
                      </span>
                    </div>
                  </div>
                )}

                {/* Flight Details */}
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  FLIGHT DETAILS
                </div>
                <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
                  {[
                    ["Route",`${flightStats.origin.name} → ${flightStats.dest.name}`],
                    ["Distance",`${flightStats.dist.toFixed(0)} km`],
                    ["Duration",`${flightStats.durationHours} h (${Math.round(flightStats.durationSec/60)} min)`],
                    ["Speed",`${flightStats.speedKmh} km/h`],
                    ["Constellation",`${flightStats.numSats} satellites`],
                  ].map(([l,v])=>(
                    <div key={l} style={S.card(false)}>
                      <div style={{color:"#3a5a7a",fontSize:"9px"}}>{l}</div>
                      <div style={{color:"#00ff88",fontSize:"14px",fontWeight:"bold"}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Elevation & Coverage */}
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  USER TERMINAL SAT ANALYTICS
                </div>

                {/* Three-tier coverage cards */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
                  {(() => {
                    const tiers = [
                      {
                        key:"cov", label:"CONSTELLATION", pct: flightStats.covPct,
                        desc:`Any mPOWER satellite EL ≥ ${gwMinEl}° (orbital geometry)`,
                        color:"#00cfff", gaps: flightStats.coverageGaps,
                        gapLabel:"Orbital gap",
                        elRow: [{l:"Max EL",v:`${flightStats.maxEl}°`},{l:"Avg EL",v:`${flightStats.avgEl}°`}],
                      },
                      {
                        key:"term", label:"Ka2517 TERMINAL", pct: flightStats.terminalCovPct,
                        desc:`Any sat EL ≥ ${ka2517MinEl}° — antenna scan capability only (ignores gateway)`,
                        color: flightStats.terminalCovPct >= 99?"#00ff88":flightStats.terminalCovPct>=90?"#ffd700":"#ff6b35",
                        gaps: flightStats.terminalGaps, gapLabel:"Antenna scan gap",
                        elRow: [{l:"Min EL",v:`${flightStats.minEl}°`},{l:"Avg EL",v:`${flightStats.avgEl}°`}],
                      },
                      {
                        key:"e2e", label:"END-TO-END SVC", pct: flightStats.e2eCovPct,
                        desc:`Terminal + gateway both closed (${flightStats.activeGwCount} GW${flightStats.activeGwCount!==1?"s":""} selected) — actual link availability`,
                        color: flightStats.e2eCovPct >= 99?"#00ff88":flightStats.e2eCovPct>=90?"#ffd700":"#ff6b35",
                        gaps: flightStats.serviceGaps, gapLabel:"GW service gap",
                        elRow: [],
                      },
                    ];
                    return tiers.map(tier => (
                      <div key={tier.key} style={{background:"#080f1a",
                        border:`1px solid ${tier.color}44`,
                        borderLeft:`3px solid ${tier.color}`,
                        borderRadius:"4px",padding:"12px 14px",fontFamily:"'Courier New',monospace"}}>
                        <div style={{color:tier.color,fontSize:"11px",letterSpacing:"0.06em",marginBottom:"6px",fontWeight:"bold"}}>
                          {tier.label}
                        </div>
                        <div style={{color:tier.color,fontSize:"30px",fontWeight:"bold",lineHeight:1,marginBottom:"4px"}}>
                          {tier.pct}%
                        </div>
                        <div style={{color:"#7a9ab8",fontSize:"11px",lineHeight:"1.4",marginBottom:"8px"}}>{tier.desc}</div>
                        {/* Progress bar */}
                        <div style={{height:"5px",background:"#152030",borderRadius:"2px",overflow:"hidden",marginBottom:"8px"}}>
                          <div style={{width:`${tier.pct}%`,height:"100%",background:tier.color,borderRadius:"2px"}} />
                        </div>
                        {/* Elevation chips */}
                        {tier.elRow.length > 0 && (
                          <div style={{display:"flex",gap:"6px",marginBottom:"7px"}}>
                            {tier.elRow.map(({l,v})=>(
                              <div key={l} style={{background:"#0d1a2a",borderRadius:"3px",padding:"4px 8px"}}>
                                <div style={{color:"#6a8aa8",fontSize:"9px",letterSpacing:"0.03em"}}>{l}</div>
                                <div style={{color:"#c0d8f0",fontSize:"13px",fontWeight:"bold"}}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Gaps */}
                        {tier.gaps.length > 0 ? (
                          <div>
                            <div style={{color:"#ff6b35",fontSize:"10px",fontWeight:"bold",marginBottom:"4px"}}>
                              ⚠ {tier.gaps.length} {tier.gapLabel}{tier.gaps.length>1?"s":""}
                            </div>
                            <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                              {tier.gaps.map((g,i)=>(
                                <span key={i} style={{color:"#ff6b35",fontSize:"9px",background:"#ff6b3512",
                                  border:"1px solid #ff6b3544",padding:"2px 6px",borderRadius:"2px"}}>
                                  T+{g.start}h ({((g.end-g.start)*60).toFixed(0)}m)
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{color:tier.color,fontSize:"10px",fontWeight:"bold",marginBottom:tier.key==="term" && flightStats.e2eCovPct < 100 ? "4px" : 0}}>
                              ✔ No {tier.key==="cov"?"orbital":tier.key==="term"?"antenna-scan":"service"} gaps
                            </div>
                            {tier.key==="term" && flightStats.e2eCovPct < 100 && (
                              <div style={{color:"#ffd700",fontSize:"10px",lineHeight:"1.4",
                                background:"#1a1408",border:"1px solid #ffd70044",borderRadius:"3px",padding:"6px 8px",marginTop:"5px"}}>
                                <div><span style={{fontWeight:"bold"}}>Note:</span> the antenna can scan-track a satellite (EL ≥ {ka2517MinEl}°) throughout the flight, but ribbon still shows closed segments — those are <strong>gateway-limited</strong>.</div>
                                {flightStats.altTermElMin !== null && (
                                  <div style={{marginTop:"5px",paddingTop:"5px",borderTop:"1px solid #ffd70033",color:"#a0c0e0"}}>
                                    <span style={{color:"#7fff00",fontWeight:"bold"}}>Alternative option:</span> during closures, a gateway-visible satellite exists with terminal EL between{" "}
                                    <strong style={{color:"#7fff00"}}>{flightStats.altTermElMin}°</strong> and{" "}
                                    <strong style={{color:"#7fff00"}}>{flightStats.altTermElMax}°</strong> (avg {flightStats.altTermElAvg}°).
                                    Lowering Ka2517 min EL to <strong style={{color:"#7fff00"}}>{flightStats.altTermElMin}°</strong> would close all these gaps.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>

                {/* Delta callout — only shown when gateway subset reduces coverage */}
                {flightStats.terminalCovPct > flightStats.e2eCovPct && (
                  <div style={{background:"#1a1008",border:"1px solid #ffd70044",borderLeft:"3px solid #ffd700",
                    borderRadius:"4px",padding:"8px 12px",marginBottom:"10px",
                    fontFamily:"'Courier New',monospace"}}>
                    <div style={{color:"#ffd700",fontSize:"12px",fontWeight:"bold",marginBottom:"5px",letterSpacing:"0.03em"}}>
                      ⚠ GATEWAY SUBSET COVERAGE LOSS
                    </div>
                    <div style={{color:"#a0c0e0",fontSize:"11px",lineHeight:"1.5"}}>
                      Ka2517 terminal is viable for <strong style={{color:"#ffd700"}}>{flightStats.terminalCovPct}%</strong> of the flight,
                      but the selected <strong style={{color:"#ffd700"}}>{flightStats.activeGwCount} gateway{flightStats.activeGwCount!==1?"s":""}</strong> only
                      deliver end-to-end service for <strong style={{color:flightStats.e2eCovPct<90?"#ff6b35":"#ffd700"}}>{flightStats.e2eCovPct}%</strong>.
                      {" "}<span style={{color:"#5a7a9a",fontSize:"10px"}}>
                        The {(flightStats.terminalCovPct - flightStats.e2eCovPct).toFixed(1)}% gap
                        represents periods where the aircraft antenna can see a satellite but no active
                        gateway has line-of-sight to it. Enable additional gateways in the Gateway Manager tab.
                      </span>
                    </div>
                  </div>
                )}

                {/* Handover Summary */}
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"10px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  HANDOVERS DURING FLIGHT
                </div>
                {(() => {
                  const sw      = flightRibbon ? flightRibbon.switches : [];
                  const satOnly = sw.filter(s => s.type === "sat").length;
                  const gwOnly  = sw.filter(s => s.type === "gw").length;
                  const both    = sw.filter(s => s.type === "both").length;
                  const uniqueGw = flightStats.gwSummary.length;

                  const buckets = [
                    {
                      label: "SAT HANDOVER",
                      count: satOnly,
                      sub:   "satellite switch only",
                      color: "rgba(140,140,140,0.9)",
                      bg:    "rgba(20,20,20,0.4)",
                      icon:  "🛰",
                      dot:   "rgba(0,0,0,0.85)",
                      dotStroke: "rgba(140,140,140,0.7)",
                    },
                    {
                      label: "GW HANDOVER",
                      count: gwOnly,
                      sub:   "gateway switch only",
                      color: "rgba(80,160,255,1)",
                      bg:    "rgba(10,30,80,0.4)",
                      icon:  "📡",
                      dot:   "rgba(30,120,255,0.9)",
                      dotStroke: "rgba(80,160,255,0.8)",
                    },
                    {
                      label: "SAT + GW HANDOVER",
                      count: both,
                      sub:   "simultaneous switch",
                      color: "rgba(255,255,255,0.9)",
                      bg:    "rgba(40,40,40,0.4)",
                      icon:  "⇄",
                      dot:   "rgba(255,255,255,0.95)",
                      dotStroke: "rgba(255,255,255,0.7)",
                    },
                    {
                      label: "UNIQUE GATEWAYS",
                      count: uniqueGw,
                      sub:   "ground stations used",
                      color: GW_COLOR,
                      bg:    `${GW_COLOR}18`,
                      icon:  "■",
                      dot:   null,
                    },
                  ];

                  return (
                    <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap"}}>
                      {buckets.map(b => (
                        <div key={b.label} style={{
                          background:"#080f1a",
                          border:`1px solid ${b.color}44`,
                          borderLeft:`3px solid ${b.color}`,
                          borderRadius:"4px", padding:"8px 14px",
                          minWidth:"130px", flex:"1 1 130px",
                          fontFamily:"'Courier New',monospace",
                        }}>
                          {/* Icon + dot swatch */}
                          <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"5px"}}>
                            <span style={{fontSize:"12px"}}>{b.icon}</span>
                            {b.dot && (
                              <div style={{
                                width:"10px",height:"10px",borderRadius:"50%",
                                background:b.dot,
                                border:`1.5px solid ${b.dotStroke}`,
                                boxShadow: b.dot.includes("255,255") ? "0 0 4px rgba(255,255,255,0.5)"
                                         : b.dot.includes("30,120")  ? "0 0 4px rgba(30,120,255,0.4)"
                                         : "none",
                                flexShrink:0,
                              }}/>
                            )}
                            <span style={{color:"#3a5a7a",fontSize:"8px",letterSpacing:"0.04em"}}>{b.label}</span>
                          </div>
                          {/* Count */}
                          <div style={{color:b.color,fontSize:"28px",fontWeight:"bold",lineHeight:1,marginBottom:"3px"}}>
                            {b.count}
                          </div>
                          {/* Sub-label */}
                          <div style={{color:"#3a5a7a",fontSize:"8px"}}>{b.sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Satellite usage table */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
                  <div>
                    <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>SATELLITE USAGE</div>
                    <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"10px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"90px 70px 60px 1fr",gap:"6px",
                        padding:"4px 0",borderBottom:"1px solid #2e4270",marginBottom:"4px"}}>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>SATELLITE</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>TIME</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>%</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}></span>
                      </div>
                      {flightStats.satSummary.map(s=>(
                        <div key={s.sat} style={{display:"grid",gridTemplateColumns:"90px 70px 60px 1fr",gap:"6px",
                          padding:"4px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                          <span style={{color:SAT_COLORS[s.sat],fontSize:"11px",fontWeight:"bold"}}>{satNames[s.sat]}</span>
                          <span style={{color:"#c0d8f0",fontSize:"11px",textAlign:"center"}}>{s.minutes}m</span>
                          <span style={{color:"#00cfff",fontSize:"11px",fontWeight:"bold",textAlign:"center"}}>{s.pct}%</span>
                          <div style={{height:"5px",background:"#152030",borderRadius:"3px",overflow:"hidden"}}>
                            <div style={{width:`${s.pct}%`,height:"100%",background:SAT_COLORS[s.sat],borderRadius:"3px"}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gateway usage table */}
                  <div>
                    <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>GATEWAY USAGE</div>
                    <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"10px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"90px 55px 50px 60px 60px 40px 1fr",gap:"6px",
                        padding:"4px 0",borderBottom:"1px solid #2e4270",marginBottom:"4px"}}>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>GATEWAY</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>TIME</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>%</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>AVG EL</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>MIN EL</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}>CC</span>
                        <span style={{color:"#4a6a8a",fontSize:"9px"}}></span>
                      </div>
                      {flightStats.gwSummary.map(gw=>{
                        const avgElColor = gw.avgEl === null ? "#4a6a8a" : gw.avgEl >= 30 ? "#00ff88" : gw.avgEl >= 20 ? "#7fff00" : gw.avgEl >= 10 ? "#ffd700" : "#ff6b35";
                        const minElColor = gw.minEl === null ? "#4a6a8a" : gw.minEl >= 20 ? "#00ff88" : gw.minEl >= 10 ? "#ffd700" : "#ff6b35";
                        return (
                        <div key={gw.id} style={{display:"grid",gridTemplateColumns:"90px 55px 50px 60px 60px 40px 1fr",gap:"6px",
                          padding:"4px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                          <span style={{color:GW_COLOR,fontSize:"11px",fontWeight:"bold"}}>{gw.name}</span>
                          <span style={{color:"#c0d8f0",fontSize:"11px",textAlign:"center"}}>{gw.minutes}m</span>
                          <span style={{color:GW_COLOR,fontSize:"11px",fontWeight:"bold",textAlign:"center"}}>{gw.pct}%</span>
                          <span style={{color:avgElColor,fontSize:"11px",fontWeight:"bold",textAlign:"center"}}>
                            {gw.avgEl !== null ? `${gw.avgEl}°` : "—"}
                          </span>
                          <span style={{color:minElColor,fontSize:"11px",fontWeight:"bold",textAlign:"center"}}>
                            {gw.minEl !== null ? `${gw.minEl}°` : "—"}
                          </span>
                          <span style={{color:"#4a6a8a",fontSize:"10px"}}>{gw.country}</span>
                          <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                            <div style={{flex:1,height:"5px",background:"#152030",borderRadius:"3px",overflow:"hidden"}}>
                              <div style={{width:`${gw.pct}%`,height:"100%",background:GW_COLOR,borderRadius:"3px"}} />
                            </div>
                            {gw.azure && <span style={{color:"#0078d4",fontSize:"7px",background:"#0078d422",border:"1px solid #0078d4",padding:"0 3px",borderRadius:"2px"}}>Az</span>}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Handover timeline */}
                {(flightStats.satTransitions.length > 0 || flightStats.gwTransitions.length > 0) && (
                  <div>
                    <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>HANDOVER TIMELINE</div>
                    <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"10px",maxHeight:"180px",overflowY:"auto"}}>
                      {[
                        ...flightStats.satTransitions.map(h=>({t:h.t,type:"SAT",desc:`${satNames[h.from]} → ${satNames[h.to]}`,color:"#00cfff"})),
                        ...flightStats.gwTransitions.map(h=>({t:h.t,type:"GW",desc:`${h.from.replace("GW-","")} → ${h.to.replace("GW-","")}`,color:GW_COLOR})),
                      ].sort((a,b)=>a.t-b.t).map((h,i)=>(
                        <div key={i} style={{display:"flex",gap:"10px",padding:"3px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                          <span style={{color:"#4a6a8a",fontSize:"10px",minWidth:"55px"}}>T+{h.t}h</span>
                          <span style={{color:h.color,fontSize:"9px",fontWeight:"bold",background:`${h.color}15`,border:`1px solid ${h.color}44`,padding:"1px 6px",borderRadius:"2px",minWidth:"28px",textAlign:"center"}}>{h.type}</span>
                          <span style={{color:"#c0d8f0",fontSize:"10px"}}>{h.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 6 — Flight Satellite Resource Summary ════ */}
        {tab==="resources" && flightMode && (
          <div>
            {!resourceData ? (
              <div style={{color:"#4a6a8a",textAlign:"center",padding:"40px",fontSize:"12px"}}>
                {!flightOrigin || !flightDest
                  ? "Select origin and destination on the Coverage Map tab, then press LAUNCH."
                  : flightStartTime === null
                  ? "Press LAUNCH to start the flight simulation."
                  : "Computing resource data…"}
              </div>
            ) : (
              <div>
                {/* Route metadata bar */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",
                  padding:"6px 10px",background:"#080f1a",border:"1px solid #1e3055",borderRadius:"3px"}}>
                  <span style={{color:"#00ff88",fontSize:"11px",fontWeight:"bold"}}>
                    {flightOrigin.name} → {flightDest.name} · {resourceData.dist.toFixed(0)} km · {resourceData.durationHours}h
                  </span>
                  {flightData && (
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"100px",height:"5px",background:"#152030",borderRadius:"3px",overflow:"hidden"}}>
                        <div style={{width:`${(flightData.progress*100).toFixed(0)}%`,height:"100%",background:"#00ff88",borderRadius:"3px"}} />
                      </div>
                      <span style={{color:flightData.complete?"#ffd700":"#00ff88",fontSize:"10px"}}>
                        {flightData.complete?"COMPLETE":`${(flightData.progress*100).toFixed(0)}%`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Service inputs */}
                <div style={{display:"flex",gap:"16px",alignItems:"center",marginBottom:"14px",flexWrap:"wrap"}}>
                  <span style={{color:"#4a6a8a",fontSize:"10px"}}>SERVICE INPUTS:</span>
                  <label style={{color:"#00cfff",fontSize:"11px",display:"flex",alignItems:"center",gap:"4px"}}>
                    FWD CIR
                    <input type="number" min={1} max={500} value={fwdCirMbps}
                      onChange={e=>setFwdCirMbps(+e.target.value||25)}
                      style={{background:"#080f1a",border:"1px solid #00cfff44",color:"#00cfff",padding:"3px 6px",
                        width:"55px",borderRadius:"3px",fontSize:"11px",fontFamily:"inherit",textAlign:"right"}} />
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>Mbps</span>
                  </label>
                  <label style={{color:"#00ff88",fontSize:"11px",display:"flex",alignItems:"center",gap:"4px"}}>
                    RTN CIR
                    <input type="number" min={1} max={100} value={rtnCirMbps}
                      onChange={e=>setRtnCirMbps(+e.target.value||5)}
                      style={{background:"#080f1a",border:"1px solid #00ff8844",color:"#00ff88",padding:"3px 6px",
                        width:"55px",borderRadius:"3px",fontSize:"11px",fontFamily:"inherit",textAlign:"right"}} />
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>Mbps</span>
                  </label>
                </div>

                {/* Pairing table */}
                <div style={{color:"#c0d8f0",fontSize:"12px",fontWeight:"bold",marginBottom:"8px",
                  borderBottom:"1px solid #2e4270",paddingBottom:"6px"}}>
                  SATELLITE + GATEWAY RESOURCE TABLE
                </div>
                <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"4px",padding:"10px",marginBottom:"14px",overflowX:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:"110px 110px 55px 100px 100px 55px",gap:"6px",
                    padding:"5px 0",borderBottom:"1px solid #2e4270",marginBottom:"4px"}}>
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>SATELLITE</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px"}}>GATEWAY</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>TIME</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>FWD MHz (W/A)</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>RTN MHz (W/A)</span>
                    <span style={{color:"#4a6a8a",fontSize:"9px",textAlign:"center"}}>EL</span>
                  </div>
                  {resourceData.pairingList.map((p,i)=>(
                    <div key={`${p.satName}-${p.gwId}`} style={{display:"grid",gridTemplateColumns:"110px 110px 55px 100px 100px 55px",gap:"6px",
                      padding:"5px 0",borderBottom:"1px solid #152030",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                        <span style={{width:"6px",height:"6px",borderRadius:"50%",background:SAT_COLORS[p.satIdx],display:"inline-block"}} />
                        <span style={{color:SAT_COLORS[p.satIdx],fontSize:"10px",fontWeight:"bold"}}>{p.satName}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                        <span style={{color:GW_COLOR,fontSize:"10px"}}>{p.gwName}</span>
                        {p.gwAzure && <span style={{color:"#0078d4",fontSize:"7px",background:"#0078d422",border:"1px solid #0078d4",padding:"0 3px",borderRadius:"2px"}}>Az</span>}
                      </div>
                      <span style={{color:"#c0d8f0",fontSize:"11px",textAlign:"center",fontWeight:"bold"}}>{p.timeMin}m</span>
                      <span style={{color:p.linkClosedPct>50?"#ff6b35":"#00cfff",fontSize:"11px",textAlign:"center",fontWeight:"bold"}}>
                        {p.fwdWorst>0?`${p.fwdWorst} / ${p.fwdAvg}`:"CLOSED"}
                      </span>
                      <span style={{color:p.linkClosedPct>50?"#ff6b35":"#00ff88",fontSize:"11px",textAlign:"center",fontWeight:"bold"}}>
                        {p.rtnWorst>0?`${p.rtnWorst} / ${p.rtnAvg}`:"CLOSED"}
                      </span>
                      <span style={{color:"#4a6a8a",fontSize:"10px",textAlign:"center"}}>{p.avgEl}°</span>
                    </div>
                  ))}
                </div>

                {/* Route dimensioning summary */}
                <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
                  {[
                    ["FWD worst pairing",resourceData.worstFwdPair,"#00cfff"],
                    ["FWD worst MHz",`${resourceData.worstFwd} MHz`,"#00cfff"],
                    ["RTN worst pairing",resourceData.worstRtnPair,"#00ff88"],
                    ["RTN worst MHz",`${resourceData.worstRtn} MHz`,"#00ff88"],
                    ["Distinct pairings",resourceData.pairingList.length,"#ffd700"],
                    ["Route coverage",`${resourceData.covPct}%`,"#ffd700"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={S.card(false)}>
                      <div style={{color:"#3a5a7a",fontSize:"9px"}}>{l}</div>
                      <div style={{color:c,fontSize:"13px",fontWeight:"bold"}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* BW vs route progress chart */}
                <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px"}}>BANDWIDTH DEMAND vs. ROUTE PROGRESS</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={resourceData.chartPoints} margin={{top:4,right:20,bottom:18,left:8}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
                    <XAxis dataKey="pct" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                      label={{value:"Route progress (%)",position:"insideBottom",offset:-8,fill:"#4a6a8a",fontSize:9}}/>
                    <YAxis stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                      label={{value:"MHz",angle:-90,position:"insideLeft",fill:"#4a6a8a",fontSize:9}}/>
                    {resourceData.worstFwd > 0 && (
                      <ReferenceLine y={resourceData.worstFwd} stroke="#00cfff" strokeDasharray="6 3"
                        label={{value:`FWD WORST ${resourceData.worstFwd}`,position:"insideTopRight",fill:"#00cfff",fontSize:8}} />
                    )}
                    {resourceData.worstRtn > 0 && (
                      <ReferenceLine y={resourceData.worstRtn} stroke="#00ff88" strokeDasharray="6 3"
                        label={{value:`RTN WORST ${resourceData.worstRtn}`,position:"insideBottomRight",fill:"#00ff88",fontSize:8}} />
                    )}
                    {resourceData.satHandoffs.map((x,i)=>(
                      <ReferenceLine key={`sh${i}`} x={x} stroke="#00cfff44" strokeDasharray="2 2" />
                    ))}
                    {resourceData.gwHandoffs.map((x,i)=>(
                      <ReferenceLine key={`gh${i}`} x={x} stroke={GW_COLOR+"44"} strokeDasharray="2 2" />
                    ))}
                    <Tooltip contentStyle={chartT} labelFormatter={v=>`${v}% route`}
                      formatter={(v,n)=>[`${v} MHz`,n==="fwdMhz"?"FWD BW":"RTN BW"]}/>
                    <Legend wrapperStyle={{fontSize:"10px",color:"#4a6a8a"}}/>
                    <Line type="monotone" dataKey="fwdMhz" stroke="#00cfff" dot={false} strokeWidth={1.5} name="FWD BW (MHz)"/>
                    <Line type="monotone" dataKey="rtnMhz" stroke="#00ff88" dot={false} strokeWidth={1.5} name="RTN BW (MHz)"/>
                  </LineChart>
                </ResponsiveContainer>

                {/* Export CSV */}
                <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
                  <button onClick={()=>{
                    const hdr = "satellite,gateway_id,gateway_name,gateway_country,azure,time_min,fwd_cir_mbps,rtn_cir_mbps,fwd_worst_mhz,fwd_avg_mhz,rtn_worst_mhz,rtn_avg_mhz,min_el,avg_el,fwd_modcod,rtn_modcod,link_closed_pct";
                    const rows = resourceData.pairingList.map(p=>
                      [p.satName,p.gwId,p.gwName,p.gwCountry,p.gwAzure,p.timeMin,fwdCirMbps,rtnCirMbps,p.fwdWorst,p.fwdAvg,p.rtnWorst,p.rtnAvg,p.minEl,p.avgEl,p.fwdPrimaryModcod,p.rtnPrimaryModcod,p.linkClosedPct].join(",")
                    );
                    const csv = [hdr,...rows].join("\n");
                    const dataUri2 = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                    const a = document.createElement("a"); a.href=dataUri2; a.download=`mpower_resources_${flightOrigin.name}_${flightDest.name}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  }} style={{background:"#00cfff22",border:"1px solid #00cfff",color:"#00cfff",padding:"4px 14px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"}}>
                    Export CSV
                  </button>
                  <button onClick={()=>{
                    const txt = `mPOWER Resource Summary\n${flightOrigin.name} → ${flightDest.name}\n${resourceData.dist.toFixed(0)} km · ${resourceData.durationHours}h\nFWD CIR: ${fwdCirMbps} Mbps · RTN CIR: ${rtnCirMbps} Mbps\nFWD Worst: ${resourceData.worstFwd} MHz (${resourceData.worstFwdPair})\nRTN Worst: ${resourceData.worstRtn} MHz (${resourceData.worstRtnPair})\nPairings: ${resourceData.pairingList.length} · Coverage: ${resourceData.covPct}%`;
                    navigator.clipboard?.writeText(txt);
                  }} style={{background:"transparent",border:"1px solid #2e4270",color:"#4a6a8a",padding:"4px 14px",borderRadius:"3px",cursor:"pointer",fontSize:"10px",fontFamily:"inherit"}}>
                    Copy Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB — STRATEGY (single-GW vs free-pick) ════ */}
        {tab==="strategy" && flightMode && (
          <div>
            {!strategyData ? (
              <div style={{color:"#4a6a8a",textAlign:"center",padding:"40px",fontSize:"12px"}}>
                Select origin and destination on the Coverage Map tab and press LAUNCH to compare gateway strategies.
              </div>
            ) : strategyData.error ? (
              <div style={{color:"#ff6b35",textAlign:"center",padding:"40px",fontSize:"12px"}}>
                {strategyData.error}
              </div>
            ) : (
              <div>
                {/* Header / context */}
                <div style={{marginBottom:"10px",padding:"8px 12px",background:"#080f1a",border:"1px solid #1e3055",borderRadius:"3px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap",fontSize:"11px"}}>
                    <span style={{color:"#00cfff",fontWeight:"bold",letterSpacing:"0.05em"}}>STRATEGY COMPARISON</span>
                    <span style={{color:"#4a6a8a"}}>Best single GW for this route:</span>
                    <span style={{color:"#ff9900",fontWeight:"bold"}}>{strategyData.bestGw.id} ({strategyData.bestGw.name})</span>
                    <span style={{color:"#4a6a8a"}}>{strategyData.durationHours}h flight, {numSats} sats</span>
                    {/* Beam half-width control */}
                    <span style={{flex:1}}/>
                    <label style={{color:"#8ab0d0",fontSize:"11px",display:"flex",alignItems:"center",gap:"5px"}}>
                      Beam half-width
                      <input type="number" min={0.1} max={5} step={0.1} value={strategyBeamHalf}
                        onChange={e=>setStrategyBeamHalf(+e.target.value)}
                        style={{...S.sel,width:"60px",fontSize:"11px"}} />
                      <span style={{color:"#4a6a8a",fontSize:"10px"}}>deg</span>
                    </label>
                  </div>
                  <div style={{color:"#5a7a9a",fontSize:"10px",marginTop:"5px",lineHeight:"1.4"}}>
                    <strong>Footprint area</strong> (km²) = pi · a · b, where a = b/sin(EL) is the along-track semi-axis.
                    Lower elevation angles inflate the footprint dramatically. The stack chart below shows total
                    instantaneous area by strategy; the colored bands above the green base are the *cost* of switching
                    to that simpler strategy.
                  </div>
                </div>

                {/* Three summary cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"12px"}}>
                  {[
                    { key:"s3", label:"S3 — FREE PICK",         color:"#00ff88", desc:"Optimal sat+GW at every step" },
                    { key:"s2", label:"S2 — SINGLE GW",         color:"#7fff00", desc:"One GW, switch sats opportunistically" },
                    { key:"s1", label:"S1 — SINGLE GW + LOCK",  color:"#ffd700", desc:"One GW, sat locked until forced switch" },
                  ].map(card => {
                    const d = strategyData[card.key];
                    const baseline = strategyData.s3;
                    const pctMore = (d.meanArea !== null && baseline.meanArea && baseline.meanArea > 0)
                      ? ((d.meanArea - baseline.meanArea) / baseline.meanArea * 100) : null;
                    const fmt = v => v == null ? "—" : v >= 1e6 ? `${(v/1e6).toFixed(2)} M km²` : v >= 1e4 ? `${(v/1e3).toFixed(1)} k km²` : `${v.toFixed(0)} km²`;
                    return (
                      <div key={card.key} style={{background:"#080f1a",border:`1px solid ${card.color}44`,
                        borderLeft:`3px solid ${card.color}`,borderRadius:"3px",padding:"12px 14px"}}>
                        <div style={{color:card.color,fontSize:"11px",fontWeight:"bold",letterSpacing:"0.05em",marginBottom:"5px"}}>
                          {card.label}
                        </div>
                        <div style={{color:"#7a9ab8",fontSize:"10px",marginBottom:"10px",lineHeight:"1.3"}}>
                          {card.desc}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"4px 10px",fontSize:"11px"}}>
                          <span style={{color:"#4a6a8a"}}>Mean area:</span>
                          <span style={{color:card.color,fontWeight:"bold"}}>{fmt(d.meanArea)}</span>
                          <span style={{color:"#4a6a8a"}}>Total area·time:</span>
                          <span style={{color:"#c0d8f0"}}>
                            {d.totalAreaH ? `${d.totalAreaH.toFixed(0)} km²·h` : "—"}
                          </span>
                          <span style={{color:"#4a6a8a"}}>Availability:</span>
                          <span style={{color:"#c0d8f0"}}>{d.availPct}%</span>
                          <span style={{color:"#4a6a8a"}}>Sat handovers:</span>
                          <span style={{color:"#c0d8f0"}}>{d.satHo}</span>
                          <span style={{color:"#4a6a8a"}}>GW handovers:</span>
                          <span style={{color:"#c0d8f0"}}>{d.gwHo}</span>
                          {pctMore !== null && card.key !== "s3" && (
                            <>
                              <span style={{color:"#4a6a8a"}}>vs S3:</span>
                              <span style={{color:pctMore > 50 ? "#ff6b35" : pctMore > 20 ? "#ffd700" : "#7fff00",fontWeight:"bold"}}>
                                +{pctMore.toFixed(0)}% more area
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stacked area chart - ONE chart, three colored bands */}
                <div style={{color:"#4a6a8a",fontSize:"10px",marginBottom:"6px",letterSpacing:"0.05em"}}>
                  FOOTPRINT AREA STACK — total instantaneous beam area (km²) along flight
                </div>
                <div style={{background:"#080f1a",border:"1px solid #1e3055",borderRadius:"3px",padding:"8px 4px"}}>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={strategyData.chart} margin={{top:8,right:14,bottom:18,left:18}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#152030"/>
                      <XAxis dataKey="pct" stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                        label={{value:"Flight progress (%)",position:"insideBottom",offset:-8,fill:"#4a6a8a",fontSize:9}}/>
                      <YAxis stroke="#2e4270" tick={{fill:"#4a6a8a",fontSize:9}}
                        tickFormatter={v=>v>=1000?`${(v/1000).toFixed(1)}k`:`${v.toFixed(0)}`}
                        label={{value:"km²",angle:-90,position:"insideLeft",fill:"#4a6a8a",fontSize:9,offset:0}}/>
                      <Tooltip
                        contentStyle={{background:"#080f1a",border:"1px solid #2e4270",fontSize:"11px"}}
                        labelFormatter={v=>`T+${(+v).toFixed(1)}%`}
                        formatter={(v,k,p)=>{
                          if (v == null) return ["—", k];
                          const fmt = v >= 1e4 ? `${(v/1e3).toFixed(1)} k km²` : `${v.toFixed(0)} km²`;
                          const labels = { s3Base:"S3 base (free pick)", s2Inc:"S2 increment (lock GW)", s1Inc:"S1 increment (lock sat)" };
                          return [fmt, labels[k] || k];
                        }}/>
                      <Legend
                        wrapperStyle={{fontSize:"10px"}}
                        formatter={(v)=>{
                          if (v === "s3Base") return "S3 base (free pick)";
                          if (v === "s2Inc")  return "+ S2 cost (lock GW)";
                          if (v === "s1Inc")  return "+ S1 cost (lock sat)";
                          return v;
                        }}/>
                      {/* Stacked from bottom to top: green (S3), yellow-green (S2 inc), gold (S1 inc) */}
                      <Area type="monotone" dataKey="s3Base" stackId="1" stroke="#00ff88" fill="#00ff8866" strokeWidth={1.5}/>
                      <Area type="monotone" dataKey="s2Inc"  stackId="1" stroke="#7fff00" fill="#7fff0066" strokeWidth={1.5}/>
                      <Area type="monotone" dataKey="s1Inc"  stackId="1" stroke="#ffd700" fill="#ffd70066" strokeWidth={1.5}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Per-gateway S1 score table - now using area */}
                <div style={{color:"#4a6a8a",fontSize:"10px",marginTop:"14px",marginBottom:"6px",letterSpacing:"0.05em"}}>
                  SINGLE-GATEWAY CANDIDATES (S1 baseline — sorted by mean footprint area)
                </div>
                <div style={{background:"#080f1a",border:"1px solid #2e4270",borderRadius:"3px",padding:"10px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"50px 1fr 110px 110px 80px 90px",gap:"8px",
                    padding:"3px 0",borderBottom:"1px solid #2e4270",marginBottom:"3px",
                    color:"#4a6a8a",fontSize:"9px",letterSpacing:"0.05em"}}>
                    <span>RANK</span><span>GATEWAY</span>
                    <span style={{textAlign:"right"}}>MEAN AREA</span>
                    <span style={{textAlign:"right"}}>TOTAL AREA·H</span>
                    <span style={{textAlign:"right"}}>AVAIL</span>
                    <span style={{textAlign:"right"}}>vs BEST</span>
                  </div>
                  {strategyData.gwScores.map((g, i) => {
                    const isBest = g.id === strategyData.bestGw.id;
                    const bestArea = strategyData.gwScores[0].meanArea;
                    const delta = (g.meanArea !== null && bestArea !== null) ? g.meanArea - bestArea : null;
                    const fmt = v => v == null ? "—" : v >= 1e6 ? `${(v/1e6).toFixed(2)} M` : v >= 1e3 ? `${(v/1e3).toFixed(1)} k` : `${v.toFixed(0)}`;
                    return (
                      <div key={g.id} style={{display:"grid",gridTemplateColumns:"50px 1fr 110px 110px 80px 90px",gap:"8px",
                        padding:"3px 0",borderBottom:"1px solid #152030",alignItems:"center",fontSize:"11px"}}>
                        <span style={{color:isBest?"#ff9900":"#4a6a8a",fontWeight:isBest?"bold":"normal"}}>
                          {isBest?"★ ":"  "}{i+1}
                        </span>
                        <span style={{color:isBest?"#ff9900":"#8ab0d0",fontWeight:isBest?"bold":"normal"}}>
                          {g.id} <span style={{color:"#5a7a9a"}}>{g.name}</span>
                        </span>
                        <span style={{color:"#c0d8f0",textAlign:"right"}}>
                          {fmt(g.meanArea)} km²
                        </span>
                        <span style={{color:"#c0d8f0",textAlign:"right"}}>
                          {g.totalAreaH ? `${g.totalAreaH.toFixed(0)} km²·h` : "—"}
                        </span>
                        <span style={{color:g.availPct >= 95 ? "#00ff88" : g.availPct >= 70 ? "#ffd700" : "#ff6b35",textAlign:"right"}}>
                          {g.availPct}%
                        </span>
                        <span style={{color:"#5a7a9a",textAlign:"right",fontSize:"10px"}}>
                          {delta == null ? "—" : delta === 0 ? "★" : `+${fmt(delta)} km²`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TAB 7 — Gateway Weather Risk ════ */}
        {tab==="weather" && (
          <GatewayWeatherTab simTime={simTime} numSats={numSats} satNames={satNames} />
        )}

        {/* ════ TAB 8 — Gateway Manager ════ */}
        {tab==="gateways" && (
          <GatewayManagerTab
            activeGwIds={activeGwIds}
            setActiveGwIds={setActiveGwIds}
            simTime={simTime}
            numSats={numSats}
            gwMinEl={gwMinEl}
          />
        )}

        {/* ════ TAB 9 — Beam Projection ════ */}
        {tab==="beam" && (
          <BeamProjectionTab
            simTime={simTime}
            numSats={numSats}
            satNames={satNames}
            gpLat={gpLat}
            gpLon={gpLon}
            flightActive={!!(flightData && !flightData.complete)}
            flightInfo={flightData ? {
              callsign: flightData.isReal ? (flightData.callsign || "real flight") : `${flightData.origin?.iata||""} → ${flightData.dest?.iata||""}`,
              progress: flightData.progress,
            } : null}
            activeGateways={activeGateways}
            gwMinEl={gwMinEl}
            ka2517MinEl={ka2517MinEl}
            onRestartFlight={flightOrigin && flightDest ? (() => {
              setFlightStartTime(simTime);
              setGpLat(flightOrigin.lat); setGpLon(flightOrigin.lon);
              setPins([]); setSelectedCity(null);
              if (!playing) setPlaying(true);
            }) : null}
          />
        )}

      </div>
    </div>
  );
}
