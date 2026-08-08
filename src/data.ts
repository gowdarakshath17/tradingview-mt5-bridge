import { Trade } from "./types";

export const HISTORICAL_TRADES: Trade[] = [
  {
    id: 1,
    direction: "BUY",
    entryDate: "Jun 25",
    entryPrice: 4012,
    exitDate: "Jun 25",
    exitPrice: 4015,
    points: 3,
    result: "WIN"
  },
  {
    id: 2,
    direction: "SELL",
    entryDate: "Jun 25",
    entryPrice: 4015,
    exitDate: "Jun 26",
    exitPrice: 4016,
    points: -1,
    result: "LOSS"
  },
  {
    id: 3,
    direction: "BUY",
    entryDate: "Jun 26",
    entryPrice: 4016,
    exitDate: "Jun 27",
    exitPrice: 4047,
    points: 31,
    result: "WIN"
  },
  {
    id: 4,
    direction: "SELL",
    entryDate: "Jun 27",
    entryPrice: 4047,
    exitDate: "Jul 2",
    exitPrice: 4023,
    points: 24,
    result: "WIN"
  },
  {
    id: 5,
    direction: "BUY",
    entryDate: "Jul 2",
    entryPrice: 4023,
    exitDate: "Jul 6",
    exitPrice: 4089,
    points: 66,
    result: "WIN"
  },
  {
    id: 6,
    direction: "SELL",
    entryDate: "Jul 6",
    entryPrice: 4089,
    exitDate: "Jul 6",
    exitPrice: 4075,
    points: 14,
    result: "WIN"
  },
  {
    id: 7,
    direction: "BUY",
    entryDate: "Jul 6",
    entryPrice: 4075,
    exitDate: "Jul 6",
    exitPrice: 4099,
    points: 24,
    result: "WIN"
  },
  {
    id: 8,
    direction: "SELL",
    entryDate: "Jul 6",
    entryPrice: 4099,
    exitDate: "Jul 7",
    exitPrice: 4068,
    points: 31,
    result: "WIN"
  },
  {
    id: 9,
    direction: "BUY",
    entryDate: "Jul 7",
    entryPrice: 4068,
    exitDate: "Jul 8",
    exitPrice: 4073,
    points: 5,
    result: "WIN"
  },
  {
    id: 10,
    direction: "SELL",
    entryDate: "Jul 8",
    entryPrice: 4073,
    exitDate: "Jul 9",
    exitPrice: 4046,
    points: 27,
    result: "WIN"
  },
  {
    id: 11,
    direction: "BUY",
    entryDate: "Jul 9",
    entryPrice: 4046,
    exitDate: "Jul 10",
    exitPrice: 4046,
    points: 0,
    result: "BE"
  },
  {
    id: 12,
    direction: "SELL",
    entryDate: "Jul 10",
    entryPrice: 4046,
    exitDate: "Jul 10",
    exitPrice: 4038,
    points: 8,
    result: "WIN"
  },
  {
    id: 13,
    direction: "BUY",
    entryDate: "Jul 10",
    entryPrice: 4038,
    exitDate: "Jul 11",
    exitPrice: 4068,
    points: 30,
    result: "WIN"
  }
];
