CREATE TABLE "consent_records" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"source" text NOT NULL,
	"text_version" text NOT NULL,
	"coupon_id" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_records_customer_coupon_version_unique" UNIQUE("customer_id","coupon_id","text_version")
);
--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "consent_records_customerId_idx" ON "consent_records" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "consent_records_storeId_createdAt_idx" ON "consent_records" USING btree ("store_id","created_at");