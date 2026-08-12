import { relations } from "drizzle-orm";
import {
  accountTable,
  cardTable,
  couponRedemptionTable,
  couponTable,
  customerTable,
  programTable,
  rewardTable,
  sessionTable,
  stampTable,
  storeMemberTable,
  storeTable,
  subscriptionTable,
  userTable,
  verificationTable,
} from "./schema";

export const userTableRelations = relations(userTable, ({ many, one }) => ({
  sessions: many(sessionTable),
  accounts: many(accountTable),
  ownedStores: many(storeTable),
  storeMemberships: many(storeMemberTable),
  subscription: one(subscriptionTable),
}));

export const sessionTableRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const accountTableRelations = relations(accountTable, ({ one }) => ({
  user: one(userTable, {
    fields: [accountTable.userId],
    references: [userTable.id],
  }),
}));

export const verificationTableRelations = relations(
  verificationTable,
  () => ({}),
);

export const storeTableRelations = relations(storeTable, ({ many, one }) => ({
  owner: one(userTable, {
    fields: [storeTable.ownerUserId],
    references: [userTable.id],
  }),
  members: many(storeMemberTable),
  programs: many(programTable),
  customers: many(customerTable),
  cards: many(cardTable),
  stamps: many(stampTable),
  rewards: many(rewardTable),
  coupons: many(couponTable),
  couponRedemptions: many(couponRedemptionTable),
}));

export const storeMemberTableRelations = relations(
  storeMemberTable,
  ({ one }) => ({
    store: one(storeTable, {
      fields: [storeMemberTable.storeId],
      references: [storeTable.id],
    }),
    user: one(userTable, {
      fields: [storeMemberTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const programTableRelations = relations(
  programTable,
  ({ many, one }) => ({
    store: one(storeTable, {
      fields: [programTable.storeId],
      references: [storeTable.id],
    }),
    cards: many(cardTable),
    stamps: many(stampTable),
    rewards: many(rewardTable),
  }),
);

export const customerTableRelations = relations(
  customerTable,
  ({ many, one }) => ({
    store: one(storeTable, {
      fields: [customerTable.storeId],
      references: [storeTable.id],
    }),
    cards: many(cardTable),
    stamps: many(stampTable),
    rewards: many(rewardTable),
    couponRedemptions: many(couponRedemptionTable),
  }),
);

export const cardTableRelations = relations(cardTable, ({ many, one }) => ({
  store: one(storeTable, {
    fields: [cardTable.storeId],
    references: [storeTable.id],
  }),
  program: one(programTable, {
    fields: [cardTable.programId],
    references: [programTable.id],
  }),
  customer: one(customerTable, {
    fields: [cardTable.customerId],
    references: [customerTable.id],
  }),
  stamps: many(stampTable),
  reward: one(rewardTable),
}));

export const stampTableRelations = relations(stampTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [stampTable.storeId],
    references: [storeTable.id],
  }),
  program: one(programTable, {
    fields: [stampTable.programId],
    references: [programTable.id],
  }),
  customer: one(customerTable, {
    fields: [stampTable.customerId],
    references: [customerTable.id],
  }),
  card: one(cardTable, {
    fields: [stampTable.cardId],
    references: [cardTable.id],
  }),
}));

export const rewardTableRelations = relations(rewardTable, ({ one }) => ({
  store: one(storeTable, {
    fields: [rewardTable.storeId],
    references: [storeTable.id],
  }),
  program: one(programTable, {
    fields: [rewardTable.programId],
    references: [programTable.id],
  }),
  customer: one(customerTable, {
    fields: [rewardTable.customerId],
    references: [customerTable.id],
  }),
  card: one(cardTable, {
    fields: [rewardTable.cardId],
    references: [cardTable.id],
  }),
}));

export const couponTableRelations = relations(couponTable, ({ many, one }) => ({
  store: one(storeTable, {
    fields: [couponTable.storeId],
    references: [storeTable.id],
  }),
  redemptions: many(couponRedemptionTable),
}));

export const couponRedemptionTableRelations = relations(
  couponRedemptionTable,
  ({ one }) => ({
    store: one(storeTable, {
      fields: [couponRedemptionTable.storeId],
      references: [storeTable.id],
    }),
    coupon: one(couponTable, {
      fields: [couponRedemptionTable.couponId],
      references: [couponTable.id],
    }),
    customer: one(customerTable, {
      fields: [couponRedemptionTable.customerId],
      references: [customerTable.id],
    }),
  }),
);

export const subscriptionTableRelations = relations(
  subscriptionTable,
  ({ one }) => ({
    owner: one(userTable, {
      fields: [subscriptionTable.ownerUserId],
      references: [userTable.id],
    }),
  }),
);
