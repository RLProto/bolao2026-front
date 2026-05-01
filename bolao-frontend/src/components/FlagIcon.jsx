// src/components/FlagIcon.jsx
import React from "react";

// ----- Mapa FIFA (3 letras) -> ISO2 para montar URL do CDN -----
const FIFA_TO_ISO2 = {
  // GRUPO A
  MEX: "mx",
  RSA: "za", // África do Sul
  KOR: "kr",
  CZE: "cz",
  IRL: "ie",
  DEN: "dk",
  MKD: "mk",

  // GRUPO B
  CAN: "ca",
  ITA: "it",
  NIR: "gb", // Irlanda do Norte (Reino Unido)
  WAL: "gb", // País de Gales (Reino Unido)
  BIH: "ba", // Bósnia e Herzegovina
  QAT: "qa",
  SUI: "ch",

  // GRUPO C
  BRA: "br",
  MAR: "ma",
  HAI: "ht",
  SCO: "gb",

  // GRUPO D
  USA: "us",
  PAR: "py",
  AUS: "au",
  TUR: "tr",
  ROM: "ro",
  SVK: "sk",
  KOS: "xk", // pode ou não existir no CDN

  // GRUPO E
  GER: "de",
  CUW: "cw", // Curaçao
  CIV: "ci", // Costa do Marfim
  ECU: "ec",

  // GRUPO F
  NED: "nl", // Holanda
  JPN: "jp",
  UKR: "ua",
  SWE: "se",
  POL: "pl",
  ALB: "al",
  TUN: "tn",

  // GRUPO G
  BEL: "be",
  EGY: "eg",
  IRN: "ir",
  NZL: "nz",

  // GRUPO H
  ESP: "es",
  CPV: "cv", // Cabo Verde
  KSA: "sa", // Arábia Saudita
  URU: "uy",

  // GRUPO I
  FRA: "fr",
  SEN: "sn",
  BOL: "bo",
  SUR: "sr",
  IRQ: "iq",
  NOR: "no",

  // GRUPO J
  ARG: "ar",
  ALG: "dz",
  AUT: "at",
  JOR: "jo",

  // GRUPO K
  POR: "pt",
  COD: "cd", // RD Congo
  JAM: "jm",
  NCL: "nc", // Nova Caledônia
  UZB: "uz",
  COL: "co",

  // GRUPO L
  ENG: "gb",
  CRO: "hr",
  GHA: "gh",
  PAN: "pa",
};

function getFlagCode(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();

  // Se já vier ISO2 tipo "BR", "US"
  if (upper.length === 2) return upper.toLowerCase();

  // Se vier FIFA (3 letras)
  if (upper.length === 3 && FIFA_TO_ISO2[upper]) {
    return FIFA_TO_ISO2[upper];
  }

  return null;
}

function getFlagUrl(code) {
  const iso2 = getFlagCode(code);
  if (!iso2) return null;
  return `https://flagcdn.com/w40/${iso2}.png`;
}

export default function FlagIcon({ code, name }) {
  const url = getFlagUrl(code);
  if (!url) {
    return <span className="team-flag-placeholder">?</span>;
  }
  return (
    <img
      src={url}
      alt={name || code}
      className="team-flag"
      loading="lazy"
    />
  );
}
