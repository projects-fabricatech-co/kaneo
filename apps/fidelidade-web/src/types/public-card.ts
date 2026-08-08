/**
 * Shape of `GET /api/public/card/:token`.
 *
 * Declared locally, and deliberately so: this is the one unauthenticated
 * endpoint that returns tenant data, and the server builds its response from an
 * explicit allowlist. Mirroring that allowlist here as a closed type means a
 * field the server should never send has no place to land on the client either.
 */

export type PublicCardStore = {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  city: string | null;
  whatsapp: string | null;
};

export type PublicCardCustomer = {
  firstName: string | null;
  /** e.g. "(11) *****-4321" — never the full number. */
  phoneMasked: string;
};

export type PublicCardEntry = {
  programName: string;
  rewardDescription: string;
  stampsCount: number;
  stampsRequired: number;
  cardColor: string;
  cardTextColor: string;
  status: "active" | "completed";
  cycle: number;
  /** ISO timestamps, most recent first. No staff attribution. */
  stampedAt: string[];
};

export type PublicCardReward = {
  code: string;
  description: string;
  expiresAt: string | null;
};

export type PublicCardCoupon = {
  title: string;
  description: string | null;
  discountLabel: string;
  endsAt: string | null;
  myCode: string | null;
  myCodeExpiresAt: string | null;
};

export type PublicCard = {
  token: string;
  store: PublicCardStore;
  customer: PublicCardCustomer;
  cards: PublicCardEntry[];
  rewards: PublicCardReward[];
  coupons: PublicCardCoupon[];
};
